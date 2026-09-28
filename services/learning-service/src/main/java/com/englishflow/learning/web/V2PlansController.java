package com.englishflow.learning.web;

import com.englishflow.learning.adapter.http.BearerTokens;
import com.englishflow.learning.adapter.http.HttpLearnerTargetPort;
import com.englishflow.learning.adapter.http.HttpPlanContentPort;
import com.englishflow.learning.adapter.http.LearnerProfileReads;
import com.englishflow.learning.adapter.http.LearnerTargetPinWriter;
import com.englishflow.learning.adapter.http.VerifiedPlacementReport;
import com.englishflow.learning.adapter.http.VerifiedPlacementReport.PlacementPins;
import com.englishflow.learning.application.CreateLearningPlanCommand;
import com.englishflow.learning.application.LearningCommandResult;
import com.englishflow.learning.application.LearningPlanService;
import com.englishflow.learning.application.PlanningInputAssembler;
import com.englishflow.learning.application.PlanningInputAssembler.AssembledPlanView;
import com.englishflow.learning.application.ResumeLearningPlanCommand;
import com.englishflow.learning.domain.ClientAuthorityClaims;
import com.englishflow.learning.domain.ConsentState;
import com.englishflow.learning.domain.IdempotencyKey;
import com.englishflow.learning.domain.LearningPlan;
import com.englishflow.learning.domain.LearningPlanStatus;
import com.englishflow.learning.domain.LearningPrincipalContext;
import com.englishflow.learning.domain.LearningRequestMetadata;
import com.englishflow.learning.domain.LearningTenantScope;
import com.englishflow.learning.port.LearnerTargetPort.LearnerTargetSnapshot;
import com.englishflow.learning.web.LearningHttpPrincipals.VerifiedLearningPrincipal;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

/**
 * Plan wiring ("定级完成自动 pin 定级内容", ADR-0027).
 *
 * <p>POST /api/v1/learning/plans:ensure takes only a placement report
 * pointer. The server verifies the report with assessment-service, pins the
 * verified content onto the learner target, creates (or replays) the domain
 * plan, assembles the immutable planning input, and projects B25-today facts.
 * The client auto-calls this right after placement completes; a future Kafka
 * placement-completed saga can replace the call without changing pin
 * semantics (see ADR).
 */
@RestController
@RequestMapping("/api/v1/learning")
@ConditionalOnProperty(prefix = "learning.persistence", name = "mode", havingValue = "jdbc")
public class V2PlansController {

    private static final String TENANT = "platform";

    private final LearningPlanService plans;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final HttpLearnerTargetPort targets;
    private final HttpPlanContentPort contents;
    private final VerifiedPlacementReport reports;
    private final LearnerProfileReads profiles;
    private final LearnerTargetPinWriter pinWriter;

    public V2PlansController(
            LearningPlanService plans,
            JdbcTemplate jdbc,
            ObjectMapper mapper,
            HttpLearnerTargetPort targets,
            HttpPlanContentPort contents,
            VerifiedPlacementReport reports,
            LearnerProfileReads profiles,
            LearnerTargetPinWriter pinWriter) {
        this.plans = plans;
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.targets = targets;
        this.contents = contents;
        this.reports = reports;
        this.profiles = profiles;
        this.pinWriter = pinWriter;
    }

    @PostMapping("/plans:ensure")
    @Transactional
    public ResponseEntity<Map<String, Object>> ensure(
            Authentication authentication,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestHeader HttpHeaders headers) {
        VerifiedLearningPrincipal verified = LearningHttpPrincipals.require(authentication, "learning.plan.write");
        requireKey(idempotencyKey);
        String reportId = body != null && body.get("placementReportId") instanceof String text
                && !text.isBlank() ? text : null;
        if (reportId == null || reportId.length() > 128) {
            throw unprocessable("placementReportId is required");
        }
        LearningPrincipalContext principal = context(authentication, verified);
        String bearer = BearerTokens.current(authentication);
        if (bearer == null) throw unavailable("verified caller JWT is required");
        LearningRequestMetadata metadata = metadata(headers);

        PlacementPins pins = reports.verify(reportId, bearer);
        // Pin first: the target adapter reads the learner-served pin, so the
        // verified pin must land before any target resolution. The pin writer
        // refuses unknown or mismatched targets; the values below all come
        // from the verified report.
        try {
            pinWriter.pinTarget(bearer, idempotencyKey, pins.targetId(),
                    pins.contentVersionId(), pins.contentEpoch(), pins.reportId());
        } catch (IllegalStateException missing) {
            throw unprocessable("learner target is not available");
        }
        LearnerTargetSnapshot target = targets.findTarget(principal, pins.targetId())
                .orElseThrow(() -> unprocessable("learner target is not available"));
        if (target.targetVersion() != pins.targetVersion()) {
            // The target changed after the placement: the measurement no
            // longer describes it. Re-placement re-pins honestly.
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "placement target pin is stale; complete placement again");
        }
        if (target.contentVersionId() != pins.contentVersionId()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "placement content pin does not match the target pin");
        }
        LearnerProfileReads.LearnerProfileFacts facts = profiles.read(bearer);

        LearningCommandResult<LearningPlan> created = plans.createPlan(principal,
                new CreateLearningPlanCommand(target.targetId(), pins.contentVersionId(),
                        new IdempotencyKey(idempotencyKey), metadata));
        LearningPlan plan = created.value();
        boolean resumed = false;
        if (plan.status() == LearningPlanStatus.DRAFT) {
            LearningCommandResult<LearningPlan> again = plans.resumePlan(principal,
                    new ResumeLearningPlanCommand(plan.planId(), plan.version(),
                            new IdempotencyKey(idempotencyKey + ":resume"), metadata));
            plan = again.value();
            resumed = !again.replayed();
        }
        long rightsStateVersion = contents.findLearnerSnapshot(principal, pins.contentVersionId())
                .map(snapshot -> snapshot.rightsStateVersion())
                .orElseThrow(() -> unavailable("plan content snapshot is unavailable"));
        AssembledPlanView assembled = PlanningInputAssembler.assemble(pins, target,
                facts.profileVersion(), facts.preferenceVersion(), facts.contentLocale(),
                facts.weeklyStudyDays(), plan, rightsStateVersion, verified.subject(),
                TENANT, adultGate(authentication), consentState(authentication), Instant.now());
        boolean inputExisted = saveInputSnapshot(principal.scope().ownerId(), target, plan, assembled);
        Map<String, Map<String, Object>> refs = contents.planSeeds(plan.contentVersionId());
        projectB25(principal.scope().ownerId(), target, plan, refs);
        boolean replayed = created.replayed() && inputExisted && !resumed;

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("planId", "plan-" + plan.planId());
        data.put("status", plan.status().name());
        data.put("targetMinutes", plan.dailyQuotaMinutes());
        data.put("planVersion", plan.version());
        data.put("replayed", replayed);
        data.put("planningInput", assembled.planningInput());
        data.put("plan", assembled.planRef());
        data.put("tasks", planTasks(plan, refs));
        return ResponseEntity.ok(Map.of("data", data));
    }

    private boolean saveInputSnapshot(String subject, LearnerTargetSnapshot target,
                                      LearningPlan plan, AssembledPlanView assembled) {
        List<Map<String, Object>> existing = jdbc.queryForList(
                "SELECT pin_digest FROM learning_plan_input_snapshot WHERE tenant_id = ? AND principal_id = ? AND target_id = ? AND content_version_id = ?",
                TENANT, subject, target.targetId(), target.contentVersionId());
        if (!existing.isEmpty()
                && assembled.pinDigest().equals(String.valueOf(existing.getFirst().get("pin_digest")))) {
            return true;
        }
        jdbc.update("""
                INSERT INTO learning_plan_input_snapshot
                    (tenant_id, principal_id, target_id, content_version_id, content_epoch,
                     plan_id, pin_id, pin_version, pin_digest, input_fact_watermark, input_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6))
                ON DUPLICATE KEY UPDATE plan_id = VALUES(plan_id), pin_id = VALUES(pin_id),
                    pin_version = VALUES(pin_version), pin_digest = VALUES(pin_digest),
                    input_fact_watermark = VALUES(input_fact_watermark), input_json = VALUES(input_json)
                """, TENANT, subject, target.targetId(), target.contentVersionId(), plan.contentEpoch(),
                plan.planId(), assembled.pinId(), assembled.pinVersion(), assembled.pinDigest(),
                assembled.watermark(), json(assembled.planningInput()));
        return false;
    }

    private void projectB25(String subject, LearnerTargetSnapshot target, LearningPlan plan,
                            Map<String, Map<String, Object>> refs) {
        if (plan.status() != LearningPlanStatus.ACTIVE && plan.status() != LearningPlanStatus.PAUSED) {
            return;
        }
        jdbc.update("""
                INSERT INTO b25_learning_plan (plan_id, principal_id, tenant_id, status, target_minutes, plan_version)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE status = VALUES(status), target_minutes = VALUES(target_minutes),
                    plan_version = VALUES(plan_version)
                """, "plan-" + plan.planId(), subject, TENANT, plan.status().name(),
                plan.dailyQuotaMinutes(), plan.version());
        // Practice refs are pinned from the same bank version the plan was
        // assembled from (one extra read at ensure, never per today-read).
        // Rows keep their seeded refs when the bank later moves; progress
        // columns are never touched by the ref fill.
        for (String seed : dayZeroSeeds(plan)) {
            String refJson = null;
            Map<String, Object> ref = refs.get(seed);
            if (ref != null) {
                try {
                    refJson = mapper.writeValueAsString(ref);
                } catch (Exception ignored) {
                    refJson = null;
                }
            }
            jdbc.update("""
                    INSERT INTO b25_learning_srs_state
                        (principal_id, item_id, tenant_id, stage, due_at, interval_days, ease_factor,
                         review_count, practice_ref_json)
                    VALUES (?, ?, ?, 'NEW', CURRENT_TIMESTAMP(6), 0, 2.50, 0, ?)
                    ON DUPLICATE KEY UPDATE practice_ref_json = VALUES(practice_ref_json)
                    """, subject, seed, TENANT, refJson);
        }
    }

    private List<String> dayZeroSeeds(LearningPlan plan) {
        java.time.LocalDate today = java.time.LocalDate.now(
                java.time.ZoneId.of(plan.timeZoneId()));
        List<String> seeds = new ArrayList<>();
        for (var task : plan.tasks()) {
            if (!task.plannedLocalDate().isAfter(today)) {
                seeds.add(String.valueOf(task.contentItemId()));
            }
        }
        return seeds;
    }

    private List<Map<String, Object>> planTasks(LearningPlan plan,
                                                  Map<String, Map<String, Object>> refs) {
        java.time.LocalDate today = java.time.LocalDate.now(
                java.time.ZoneId.of(plan.timeZoneId()));
        List<Map<String, Object>> tasks = new ArrayList<>();
        for (var task : plan.tasks()) {
            if (task.plannedLocalDate().isAfter(today)) continue;
            Map<String, Object> view = new LinkedHashMap<>();
            view.put("taskId", task.taskId());
            view.put("itemId", String.valueOf(task.contentItemId()));
            view.put("taskType", task.taskType().name());
            view.put("status", task.status().name());
            view.put("plannedLocalDate", task.plannedLocalDate().toString());
            Map<String, Object> ref = refs.get(String.valueOf(task.contentItemId()));
            if (ref != null) view.put("practiceRef", ref);
            tasks.add(view);
        }
        return tasks;
    }

    private LearningPrincipalContext context(Authentication authentication,
                                             VerifiedLearningPrincipal verified) {
        JwtAuthenticationToken jwt = (JwtAuthenticationToken) authentication;
        return new LearningPrincipalContext(
                LearningTenantScope.forPhaseOne(verified.subject(),
                        LearningTenantScope.stableUserIdFor(verified.subject())),
                "phase-1",
                Set.copyOf(verified.roles()),
                Set.copyOf(verified.permissions()),
                com.englishflow.learning.domain.ConsentState.GRANTED,
                false,
                com.englishflow.learning.domain.ClientAuthorityClaims.none());
    }

    private String adultGate(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwt) {
            return String.valueOf(jwt.getToken().getClaimAsString("adult_gate"));
        }
        return "UNKNOWN";
    }

    private String consentState(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwt) {
            return String.valueOf(jwt.getToken().getClaimAsString("consent_state"));
        }
        return "UNKNOWN";
    }

    private LearningRequestMetadata metadata(org.springframework.http.HttpHeaders headers) {
        String requestId = headers.getFirst("X-Request-Id");
        String traceId = headers.getFirst("X-Trace-Id");
        if (requestId == null || !requestId.matches("[A-Za-z][A-Za-z0-9._-]{7,127}")) {
            requestId = "req-learning-ensure-" + java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        }
        if (traceId == null || !traceId.matches("[a-f0-9]{32}")) {
            traceId = java.util.UUID.randomUUID().toString().replace("-", "");
        }
        return new LearningRequestMetadata(requestId, traceId);
    }

    private String json(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception invalid) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "plan snapshot serialization failed");
        }
    }

    private static void requireKey(String key) {
        if (key == null || key.isBlank() || key.length() > 192) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Idempotency-Key is required");
        }
    }

    private static ResponseStatusException unprocessable(String message) {
        return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message);
    }

    private static ResponseStatusException unavailable(String message) {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, message);
    }
}
