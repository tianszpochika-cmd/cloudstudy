package com.englishflow.assessment.web;

import com.englishflow.assessment.domain.ContentSnapshot;
import com.englishflow.assessment.domain.P1PlacementScorer;
import com.englishflow.assessment.domain.RuleScoringEngine;
import com.englishflow.assessment.domain.ScoringStatus;
import com.englishflow.assessment.domain.SafePayloads;
import com.englishflow.assessment.port.AssessmentOutboxPort;
import com.englishflow.assessment.port.P1PlacementSourcePort;
import com.englishflow.assessment.port.P1PlacementSourcePort.Resolved;
import com.englishflow.assessment.port.P1PlacementSourcePort.SealedItem;
import com.englishflow.assessment.port.PlacementRuleScorePort;
import com.englishflow.assessment.web.AssessmentHttpPrincipals.VerifiedAssessmentPrincipal;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Instant;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Dedicated owner for the canonical P1 ten-item placement. B25 is never its source. */
@RestController
@RequestMapping("/internal/v1/assessment/placement")
@ConditionalOnProperty(prefix = "assessment.persistence", name = "enabled", havingValue = "true")
public class P1PlacementJdbcController {
    private static final String TENANT = "platform";
    private static final String RULE = "P1_PLACEMENT_V1";
    private static final String DIGEST_PATTERN = "[a-f0-9]{64}";
    private static final List<Map<String, Object>> DIMENSIONS = List.of(
            Map.of("dimension", "VOCABULARY", "weight", 25, "requiredItemCount", 3, "displayOrder", 1),
            Map.of("dimension", "BASIC_GRAMMAR", "weight", 25, "requiredItemCount", 3, "displayOrder", 2),
            Map.of("dimension", "READING", "weight", 25, "requiredItemCount", 2, "displayOrder", 3),
            Map.of("dimension", "LISTENING", "weight", 25, "requiredItemCount", 2, "displayOrder", 4));

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final P1PlacementSourcePort sourcePort;
    private final AssessmentOutboxPort outbox;
    private final PlacementRuleScorePort ruleScorePort;
    private final RuleScoringEngine scorer = new RuleScoringEngine();

    /** Checkpoint tests that predate rule scoring. Runtime injection always supplies the port. */
    public P1PlacementJdbcController(JdbcTemplate jdbc, ObjectMapper mapper,
                                     P1PlacementSourcePort sourcePort, AssessmentOutboxPort outbox) {
        this(jdbc, mapper, sourcePort, outbox, null);
    }

    @Autowired
    public P1PlacementJdbcController(JdbcTemplate jdbc, ObjectMapper mapper,
                                     P1PlacementSourcePort sourcePort, AssessmentOutboxPort outbox,
                                     PlacementRuleScorePort ruleScorePort) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.sourcePort = sourcePort;
        this.outbox = outbox;
        this.ruleScorePort = ruleScorePort;
    }

    @PostMapping("/sessions")
    @Transactional
    public ResponseEntity<Map<String, Object>> create(Authentication authentication,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        VerifiedAssessmentPrincipal principal = AssessmentHttpPrincipals.require(authentication,
                "assessment.placement.session.create");
        requireKey(key);
        if (body != null && !body.isEmpty()) throw invalid("placement start has no client authority fields");
        Resolved source = resolve(principal);
        if (source.items().size() != 10) {
            throw unavailable("placement bank must expose exactly ten sealed items");
        }
        String requestDigest = SafePayloads.digest(List.of("CREATE", sourceDigest(source)));
        Map<String, Object> replay = claimOrReplay(principal, key, "CREATE", requestDigest);
        if (replay != null) return ResponseEntity.status(HttpStatus.CREATED).body(envelope(replay));

        String sessionId = "asess_" + compactId();
        Instant now = Instant.now();
        insertSession(sessionId, principal, source, "CREATED", 1, now);
        Map<String, Object> view = sessionView(ownerSession(sessionId, principal));
        finishClaim(principal, key, view);
        return ResponseEntity.status(HttpStatus.CREATED).body(envelope(view));
    }

    @GetMapping("/sessions/{sessionId}")
    public Map<String, Object> read(Authentication authentication, @PathVariable String sessionId) {
        VerifiedAssessmentPrincipal principal = AssessmentHttpPrincipals.require(authentication,
                "assessment.placement.session.read");
        return envelope(sessionView(ownerSession(sessionId, principal)));
    }

    @PostMapping("/sessions/{sessionId}/responses")
    @Transactional
    public Map<String, Object> respond(Authentication authentication, @PathVariable String sessionId,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestHeader(value = "If-Match", required = false) String ifMatch) {
        VerifiedAssessmentPrincipal principal = AssessmentHttpPrincipals.require(authentication,
                "assessment.placement.response.submit");
        requireKey(key);
        requireKeys(body, Set.of("expectedStateVersion", "itemId", "itemSequence",
                "candidateResponse", "responseDigest", "timeSpentSec"));
        long expectedVersion = positiveLong(body.get("expectedStateVersion"));
        if (ifMatch != null && !ifMatch.equals("state-" + expectedVersion)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "If-Match and expectedStateVersion differ");
        }
        int sequence = boundedInt(body.get("itemSequence"), 1, 10);
        long itemId = positiveLong(body.get("itemId"));
        int spent = boundedInt(body.get("timeSpentSec"), 0, 3600);
        String responseDigest = String.valueOf(body.get("responseDigest"));
        if (!responseDigest.matches(DIGEST_PATTERN)) throw invalid("responseDigest must be SHA-256");
        Map<String, Object> candidate = requestObject(body.get("candidateResponse"));
        // Check the resource owner even when this key replays an old receipt.
        ownerSession(sessionId, principal);
        String requestDigest = SafePayloads.digest(List.of("RESPONSE", sessionId, body));
        Map<String, Object> existingClaim = one("""
                SELECT operation, request_digest, response_json FROM p1_placement_idempotency
                 WHERE tenant_id = ? AND principal_id = ? AND idempotency_key = ?
                """, TENANT, principal.subject(), key);
        if (existingClaim != null) {
            if (!"RESPONSE".equals(existingClaim.get("operation"))
                    || !requestDigest.equals(existingClaim.get("request_digest"))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Idempotency-Key was reused for a different command");
            }
            Map<String, Object> stored = object(existingClaim.get("response_json"));
            if (!stored.isEmpty()) return envelope(stored);
        }

        Map<String, Object> session = ownerSessionForUpdate(sessionId, principal);
        List<Map<String, Object>> sealed = maps(session.get("sealed_items_json"));
        if (sealed.size() != 10) throw unavailable("sealed placement snapshot is invalid");
        Map<String, Object> already = one("""
                SELECT item_sequence, accepted_at FROM p1_placement_response
                 WHERE session_id = ? AND principal_id = ? AND tenant_id = ?
                   AND item_sequence = ? AND request_digest = ?
                """, sessionId, principal.subject(), TENANT, sequence, requestDigest);
        if (already != null && existingClaim != null) {
            Map<String, Object> receipt = receiptForAccepted(session, sealed, sequence);
            saveResponseReceipt(principal, key, requestDigest, receipt);
            return envelope(receipt);
        }
        if ("SKIPPED".equals(String.valueOf(session.get("status")))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "placement was skipped");
        }
        if ("COMPLETED".equals(session.get("status"))) {
            // A repeated tenth answer returns the stored report. It does not insert another one.
            if (sameStoredCompletion(session, sealed, sequence, requestDigest)) {
                Map<String, Object> receipt = receiptForAccepted(session, sealed, sequence);
                saveResponseReceipt(principal, key, requestDigest, receipt);
                return envelope(receipt);
            }
            throw new ResponseStatusException(HttpStatus.CONFLICT, "placement is already complete");
        }
        int cursor = ((Number) session.get("current_sequence")).intValue();
        long stateVersion = ((Number) session.get("state_version")).longValue();
        if (sequence != cursor || expectedVersion != stateVersion) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "placement checkpoint is stale or out of order");
        }
        Map<String, Object> current = sealed.get(sequence - 1);
        if (positiveLong(current.get("itemId")) != itemId) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "placement item is out of order");
        }
        // Answer-free opens have no sealed rule. Score only this current item.
        boolean deferred = answerFree(current);
        Boolean correct = null;
        String outcome = null;
        String explanation = null;
        if (deferred) {
            Map<String, Object> learnerItem = maps(session.get("learner_items_json")).get(sequence - 1);
            acceptUnscored(learnerItem, candidate);
            if (ruleScorePort != null) {
                PlacementRuleScorePort.RuleScore graded = gradeCurrent(itemId, candidate);
                correct = "FULL".equals(graded.outcome());
                outcome = graded.outcome();
                explanation = graded.explanation();
            }
        } else {
            correct = score(current, candidate);
        }
        long nextVersion = stateVersion + 1;
        int nextSequence = sequence + 1;
        // Unscored answer-free sessions stay open. The tenth scored outcome freezes one report.
        boolean outcomeReportDue = deferred && ruleScorePort != null && nextSequence == 11;
        String nextStatus = (!deferred && nextSequence == 11) || outcomeReportDue ? "COMPLETED" : "IN_PROGRESS";
        String previousStatus = String.valueOf(session.get("status"));
        Instant now = Instant.now();
        Timestamp savedAt = Timestamp.from(now);
        int claimed = jdbc.update("""
                UPDATE p1_placement_session SET status = ?, state_version = ?, current_sequence = ?, updated_at = ?
                 WHERE session_id = ? AND principal_id = ? AND tenant_id = ?
                   AND state_version = ? AND current_sequence = ?
                """, nextStatus, nextVersion, nextSequence, savedAt,
                sessionId, principal.subject(), TENANT, stateVersion, cursor);
        if (claimed != 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "placement checkpoint changed concurrently");
        }
        try {
            jdbc.update("""
                    INSERT INTO p1_placement_response
                        (session_id, item_sequence, item_id, principal_id, tenant_id,
                         response_digest, request_digest, correct, time_spent_sec, accepted_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, sessionId, sequence, itemId, principal.subject(), TENANT,
                    responseDigest, requestDigest, correct, spent, savedAt);
            String checkpointDigest = sha256(sessionId + ":" + nextVersion + ":" + nextSequence
                    + ":" + requestDigest);
            jdbc.update("""
                    INSERT INTO p1_placement_checkpoint
                        (session_id, state_version, principal_id, tenant_id, next_sequence, checkpoint_digest, saved_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, sessionId, nextVersion, principal.subject(), TENANT,
                    nextSequence, checkpointDigest, savedAt);
        } catch (DuplicateKeyException conflict) {
            revertCheckpoint(sessionId, principal.subject(), previousStatus, stateVersion, cursor, savedAt);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "placement checkpoint changed concurrently");
        }
        Map<String, Object> finalResult = null;
        Map<String, Object> outcomeReport = null;
        if (!deferred && nextSequence == 11) {
            finalResult = freezeScoredPlacement(session, principal, sealed, nextVersion, now);
        } else if (outcomeReportDue) {
            outcomeReport = freezeOutcomeReport(session, principal, now);
        }
        Map<String, Object> receipt = checkpointReceipt(sessionId, sequence, nextVersion, nextStatus,
                now, session, finalResult, outcome, explanation, outcomeReport);
        saveResponseReceipt(principal, key, requestDigest, receipt);
        return envelope(receipt);
    }

    @PostMapping("/baselines/skip")
    @Transactional
    public ResponseEntity<Map<String, Object>> skip(Authentication authentication,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        VerifiedAssessmentPrincipal principal = AssessmentHttpPrincipals.require(authentication,
                "assessment.placement.skip");
        requireKey(key);
        Map<String, Object> input = body == null ? Map.of() : body;
        if (!Set.of("requestedStartingLevel", "sessionId").containsAll(input.keySet())) {
            throw invalid("skip accepts only a non-authoritative starting-level hint");
        }
        Map<String, Object> requestedLevel = null;
        if (input.containsKey("requestedStartingLevel")) {
            requestedLevel = requestObject(input.get("requestedStartingLevel"));
            requireKeys(requestedLevel, Set.of("level", "authority"));
            if (!List.of("A1", "A2", "B1", "B2", "C1", "C2").contains(requestedLevel.get("level"))
                    || !"USER_SELECTED_NON_AUTHORITATIVE".equals(requestedLevel.get("authority"))) {
                throw invalid("starting-level hint is invalid");
            }
        }
        String bound = null;
        if (input.containsKey("sessionId")) {
            if (!(input.get("sessionId") instanceof String id) || !id.matches("asess_[A-Za-z0-9]{8,128}")) {
                throw invalid("placement session id is invalid");
            }
            bound = id;
        }
        // A finished report is not a skip target. Reject before the bank read and before any write.
        Map<String, Object> boundSession = null;
        if (bound != null) {
            boundSession = ownerSession(bound, principal);
            if ("COMPLETED".equals(String.valueOf(boundSession.get("status"))) || hasResult(bound)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "completed placement cannot be skipped");
            }
        }
        Resolved source = null;
        if (bound == null) source = resolve(principal);
        String requestDigest = bound == null
                ? SafePayloads.digest(List.of("SKIP", sourceDigest(source), input))
                : SafePayloads.digest(List.of("SKIP", bound, input));
        Map<String, Object> replay = claimOrReplay(principal, key, "SKIP", requestDigest);
        if (replay != null) return ResponseEntity.status(HttpStatus.CREATED).body(envelope(replay));
        if (boundSession != null && "SKIPPED".equals(String.valueOf(boundSession.get("status")))) {
            Map<String, Object> existing = object(boundSession.get("baseline_json"));
            finishClaim(principal, key, existing);
            return ResponseEntity.status(HttpStatus.CREATED).body(envelope(existing));
        }
        Instant now = Instant.now();
        String sessionId;
        if (bound == null) {
            sessionId = "asess_" + compactId();
            insertSession(sessionId, principal, source, "SKIPPED", 1, now);
        } else {
            sessionId = bound;
        }
        Map<String, Object> baseline = skippedBaseline(sessionId, requestedLevel, now);
        int marked = jdbc.update("""
                UPDATE p1_placement_session SET status = 'SKIPPED', baseline_json = ?, updated_at = ?
                 WHERE session_id = ? AND principal_id = ? AND tenant_id = ?
                   AND status IN ('CREATED', 'IN_PROGRESS', 'SKIPPED')
                """, json(baseline), Timestamp.from(now), sessionId, principal.subject(), TENANT);
        if (marked != 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "completed placement cannot be skipped");
        }
        finishClaim(principal, key, baseline);
        return ResponseEntity.status(HttpStatus.CREATED).body(envelope(baseline));
    }

    @GetMapping("/reports/{reportId}")
    public Map<String, Object> report(Authentication authentication, @PathVariable String reportId) {
        VerifiedAssessmentPrincipal principal = AssessmentHttpPrincipals.require(authentication,
                "assessment.placement.report.read");
        Map<String, Object> row = one("SELECT * FROM p1_placement_result WHERE report_id = ? AND tenant_id = ?",
                reportId, TENANT);
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "placement report not found");
        if (!principal.subject().equals(row.get("principal_id"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "placement report owner mismatch");
        }
        return envelope(object(row.get("report_json")));
    }

    /** Opens a new session from the current bank. The completed session and its report stay as stored. */
    @PostMapping("/sessions/{sessionId}/retest")
    @Transactional
    public ResponseEntity<Map<String, Object>> retest(Authentication authentication,
            @PathVariable String sessionId,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        VerifiedAssessmentPrincipal principal = AssessmentHttpPrincipals.require(authentication,
                "assessment.placement.session.create");
        requireKey(key);
        if (body != null && !body.isEmpty()) throw invalid("placement retest has no client authority fields");
        // Reject before the bank read so an unfinished session cannot insert a row.
        requireCompletedReport(sessionId, principal);
        Resolved source = resolve(principal);
        if (source.items().size() != 10) {
            throw unavailable("placement bank must expose exactly ten sealed items");
        }
        String requestDigest = SafePayloads.digest(List.of("RETEST", sessionId, sourceDigest(source)));
        Map<String, Object> replay = claimOrReplay(principal, key, "RETEST", requestDigest);
        if (replay != null) return ResponseEntity.status(HttpStatus.CREATED).body(envelope(replay));

        String retestSessionId = "asess_" + compactId();
        insertSession(retestSessionId, principal, source, "CREATED", 1, Instant.now());
        Map<String, Object> view = sessionView(ownerSession(retestSessionId, principal));
        finishClaim(principal, key, view);
        return ResponseEntity.status(HttpStatus.CREATED).body(envelope(view));
    }

    @GetMapping("/history")
    public Map<String, Object> history(Authentication authentication) {
        VerifiedAssessmentPrincipal principal = AssessmentHttpPrincipals.require(authentication,
                "assessment.placement.session.read");
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT s.session_id, s.status, s.current_sequence, s.started_at, s.updated_at,
                       r.report_id, r.result_json
                  FROM p1_placement_session s
                  LEFT JOIN p1_placement_result r
                    ON r.session_id = s.session_id AND r.tenant_id = s.tenant_id
                   AND r.principal_id = s.principal_id
                 WHERE s.tenant_id = ? AND s.principal_id = ?
                 ORDER BY s.started_at ASC, s.session_id ASC
                """, TENANT, principal.subject());
        List<Map<String, Object>> entries = new ArrayList<>(rows.size());
        for (Map<String, Object> row : rows) entries.add(historyEntry(row));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("entries", List.copyOf(entries));
        return envelope(body);
    }

    private void requireCompletedReport(String sessionId, VerifiedAssessmentPrincipal principal) {
        Map<String, Object> session = ownerSession(sessionId, principal);
        if (!"COMPLETED".equals(session.get("status"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "placement retest requires a completed report");
        }
        Map<String, Object> result = one("""
                SELECT report_id FROM p1_placement_result
                 WHERE session_id = ? AND principal_id = ? AND tenant_id = ?
                """, sessionId, principal.subject(), TENANT);
        if (result == null || result.get("report_id") == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "placement retest requires a completed report");
        }
    }

    private Map<String, Object> historyEntry(Map<String, Object> row) {
        int cursor = ((Number) row.get("current_sequence")).intValue();
        if (cursor < 1 || cursor > 11) throw unavailable("placement item pin is invalid");
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("sessionId", row.get("session_id"));
        entry.put("status", row.get("status"));
        entry.put("acceptedSequence", cursor - 1);
        entry.put("startedAt", timestamp(row.get("started_at")));
        entry.put("updatedAt", timestamp(row.get("updated_at")));
        Object reportId = row.get("report_id");
        if (reportId != null) {
            entry.put("reportId", reportId);
            String digest = summaryDigest(row.get("result_json"));
            if (digest != null) entry.put("digest", digest);
        }
        return entry;
    }

    /** Only the pinned outcome digest. The stored report body is not copied into history. */
    private String summaryDigest(Object raw) {
        if (raw == null) return null;
        Object digest = object(raw).get("digest");
        if (digest instanceof String value && value.matches(DIGEST_PATTERN)) return value;
        return null;
    }

    private Resolved resolve(VerifiedAssessmentPrincipal principal) {
        try {
            Resolved source = sourcePort.resolve(principal);
            if (source == null) throw unavailable("authorized placement source is unavailable");
            return source;
        } catch (ResponseStatusException expected) {
            throw expected;
        } catch (RuntimeException invalidSource) {
            throw unavailable("authorized placement source is invalid");
        }
    }

    private void insertSession(String sessionId, VerifiedAssessmentPrincipal principal,
                               Resolved source, String status, int cursor, Instant now) {
        List<Map<String, Object>> safeItems = source.items().stream().map(SealedItem::learnerItem).toList();
        List<Map<String, Object>> sealed = source.items().stream().map(item -> {
            ContentSnapshot snapshot = item.scoringSnapshot();
            Map<String, Object> sealedItem = new LinkedHashMap<>();
            sealedItem.put("itemId", item.itemId());
            sealedItem.put("dimension", item.dimension().name());
            if (snapshot == null) {
                // Answer-free open. Do not invent correctOption or answerRules.
                sealedItem.put("contentVersionId", source.contentPin().get("contentVersionId"));
                return sealedItem;
            }
            sealedItem.put("contentCode", snapshot.contentCode());
            sealedItem.put("contentVersionId", snapshot.contentVersionId());
            sealedItem.put("questionId", snapshot.questionId());
            sealedItem.put("questionType", snapshot.questionType().name());
            sealedItem.put("learnerFields", snapshot.learnerFields());
            sealedItem.put("answerRules", snapshot.answerRules());
            sealedItem.put("scoringVersion", snapshot.scoringVersion());
            sealedItem.put("maxScore", snapshot.maxScore());
            return sealedItem;
        }).toList();
        String snapshotDigest = SafePayloads.digest(List.of(manifest(), source.targetPin(),
                source.contentPin(), source.answerRulePin(), safeItems, sealed));
        jdbc.update("""
                INSERT INTO p1_placement_session
                    (session_id, principal_id, tenant_id, status, state_version, current_sequence,
                     session_snapshot_digest, manifest_json, content_pin_json, answer_rule_pin_json,
                     target_pin_json, learner_items_json, sealed_items_json, started_at, updated_at)
                VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, sessionId, principal.subject(), TENANT, status, cursor, snapshotDigest,
                json(manifest()), json(source.contentPin()), json(source.answerRulePin()),
                json(source.targetPin()), json(safeItems), json(sealed),
                Timestamp.from(now), Timestamp.from(now));
    }

    private Map<String, Object> freezeResult(Map<String, Object> session,
            VerifiedAssessmentPrincipal principal, String kind, P1PlacementScorer.Assessed assessed,
            Map<String, Object> requestedLevel, long stateVersion, Instant now) {
        String sessionId = String.valueOf(session.get("session_id"));
        String resultId = "plr_" + compactId();
        String reportId = "rpt_" + compactId();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("placementResultId", resultId);
        result.put("sessionId", sessionId);
        result.put("resultVersion", 1);
        result.put("reportId", reportId);
        result.put("reportVersion", 1);
        result.put("resultKind", kind);
        result.put("completionStatus", "ASSESSED".equals(kind) ? "COMPLETED" : "SKIPPED");
        result.put("confidence", assessed == null ? "UNVERIFIED" : assessed.progress().confidence());
        result.put("coverageRatio", assessed == null ? 0 : assessed.progress().coverageRatio());
        result.put("aggregateScore", assessed == null ? null : assessed.aggregateScore());
        result.put("referenceLevel", assessed == null ? null : assessed.referenceLevel());
        if (assessed != null) result.put("dimensionSummaries", assessed.dimensionSummaries().stream()
                .map(summary -> Map.<String, Object>of("dimension", summary.dimension().name(),
                        "validItemCount", summary.validItemCount(), "earnedItemCount",
                        summary.earnedItemCount(), "dimensionPercent", summary.dimensionPercent())).toList());
        if (requestedLevel != null) result.put("requestedStartingLevel", requestedLevel);
        Map<String, Object> manifest = object(session.get("manifest_json"));
        Map<String, Object> contentPin = object(session.get("content_pin_json"));
        Map<String, Object> rulePin = object(session.get("answer_rule_pin_json"));
        Map<String, Object> targetPin = object(session.get("target_pin_json"));
        result.put("manifest", manifestPin(manifest));
        result.put("contentPin", contentPin);
        result.put("answerRulePin", rulePin);
        result.put("targetPin", targetPin);
        result.put("completedAt", now.toString());
        String resultDigest = sha256(json(result));
        result.put("resultDigest", resultDigest);
        String reportDigest = sha256(json(List.of(resultDigest, manifest, contentPin, rulePin, targetPin)));
        result.put("reportDigest", reportDigest);
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("result", result);
        report.put("manifest", manifest);
        report.put("contentPin", contentPin);
        report.put("answerRulePin", rulePin);
        report.put("targetPin", targetPin);
        report.put("generatedAt", now.toString());
        jdbc.update("""
                INSERT INTO p1_placement_result
                    (placement_result_id, session_id, report_id, principal_id, tenant_id,
                     result_kind, result_json, report_json, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, resultId, sessionId, reportId, principal.subject(), TENANT,
                kind, json(result), json(report), Timestamp.from(now));
        appendCompletion(principal, session, result, stateVersion, now);
        return result;
    }

    void appendCompletion(VerifiedAssessmentPrincipal principal, Map<String, Object> session,
                                  Map<String, Object> result, long stateVersion, Instant now) {
        Map<String, Object> contentPin = object(session.get("content_pin_json"));
        Map<String, Object> rulePin = object(session.get("answer_rule_pin_json"));
        Map<String, Object> targetPin = object(session.get("target_pin_json"));
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("tenantId", TENANT);
        event.put("principalId", principal.subject());
        event.put("sessionId", result.get("sessionId"));
        event.put("stateVersion", stateVersion);
        event.put("sessionSnapshotDigest", session.get("session_snapshot_digest"));
        for (String field : List.of("placementResultId", "resultVersion", "reportId", "reportVersion",
                "resultDigest", "reportDigest", "resultKind", "completionStatus", "aggregateScore",
                "referenceLevel", "confidence", "coverageRatio", "completedAt")) {
            event.put(field, result.get(field));
        }
        Map<String, Object> manifest = object(session.get("manifest_json"));
        for (String field : List.of("placementManifestId", "placementManifestVersion",
                "placementManifestDigest", "dimensionSetDigest", "totalItemCount")) {
            event.put(field, manifest.get(field));
        }
        event.putAll(contentPin);
        event.putAll(rulePin);
        event.putAll(targetPin);
        if (result.containsKey("dimensionSummaries")) {
            // The outbox projection intentionally excludes raw answer counts and uses the
            // smaller, separately versioned event schema.
            event.put("dimensionSummaries", ((List<?>) result.get("dimensionSummaries")).stream()
                    .map(this::object)
                    .map(summary -> Map.<String, Object>of(
                            "dimensionId", summary.get("dimension"),
                            "dimensionPercent", summary.get("dimensionPercent"),
                            "coverageRatio", 1)).toList());
        }
        if (result.containsKey("requestedStartingLevel")) event.put("requestedStartingLevel", result.get("requestedStartingLevel"));
        if (SafePayloads.containsAnswerLeak(event)) {
            throw unavailable("placement completion event contains protected answer material");
        }
        String sessionId = String.valueOf(result.get("sessionId"));
        // The outbox schema slot carries the envelope schema family (VARCHAR(32)),
        // exactly like every B10 event ("assessment.event.v1"). The full event name
        // stays in the event_name column; putting the 33-char event name here
        // overflows strict MySQL and turns every placement completion into a 500.
        outbox.append(new AssessmentOutboxPort.AssessmentOutboxEvent(UUID.randomUUID(),
                "assessment.placement.completed.v1", "placement_session", sessionId,
                TENANT, principal.subject(), "placement-" + sessionId, "placement-" + sessionId,
                "assessment.event.v1", 1, "placement-complete:" + sessionId,
                event, now));
    }

    private static boolean answerFree(Map<String, Object> sealed) {
        return !sealed.containsKey("questionType") && !sealed.containsKey("answerRules");
    }

    private void acceptUnscored(Map<String, Object> learnerItem, Map<String, Object> candidate) {
        if (!"CHOICE".equals(String.valueOf(candidate.get("responseType")))) {
            throw invalid("placement response does not match the current item");
        }
        requireKeys(candidate, Set.of("responseType", "selectedOptionIds"));
        requireStrings(candidate.get("selectedOptionIds"), 32, "[a-z][a-z0-9._:-]{0,63}");
        if (!(learnerItem.get("options") instanceof List<?> options) || options.isEmpty()) {
            throw unavailable("placement learner item is not answer-free");
        }
        java.util.HashSet<String> optionIds = new java.util.HashSet<>();
        for (Object raw : options) {
            if (raw instanceof Map<?, ?> option && option.get("optionId") instanceof String id) optionIds.add(id);
        }
        for (Object selected : (List<?>) candidate.get("selectedOptionIds")) {
            if (!optionIds.contains(String.valueOf(selected))) {
                throw invalid("placement response does not match the current item");
            }
        }
    }

    private Map<String, Object> receiptForAccepted(Map<String, Object> session, List<Map<String, Object>> sealed,
                                                   int sequence) {
        String sessionId = String.valueOf(session.get("session_id"));
        Map<String, Object> checkpoint = one("""
                SELECT state_version, next_sequence, saved_at FROM p1_placement_checkpoint
                 WHERE session_id = ? AND principal_id = ? AND tenant_id = ? AND next_sequence = ?
                """, sessionId, session.get("principal_id"), TENANT, sequence + 1);
        if (checkpoint == null) throw unavailable("placement checkpoint is missing");
        boolean deferred = answerFree(sealed.get(sequence - 1));
        String status = !deferred && sequence == 10 ? "COMPLETED" : "IN_PROGRESS";
        Map<String, Object> finalResult = null;
        if ("COMPLETED".equals(status)) {
            Map<String, Object> result = one(
                    "SELECT result_json FROM p1_placement_result WHERE session_id = ? AND tenant_id = ?",
                    sessionId, TENANT);
            if (result == null) throw unavailable("placement result is missing");
            finalResult = object(result.get("result_json"));
        }
        String outcome = null;
        String explanation = null;
        if (ruleScorePort != null && deferred) {
            Map<String, Object> graded = one("""
                    SELECT correct FROM p1_placement_response
                     WHERE session_id = ? AND principal_id = ? AND tenant_id = ? AND item_sequence = ?
                    """, sessionId, session.get("principal_id"), TENANT, sequence);
            if (graded != null && graded.get("correct") != null) {
                boolean full = Boolean.TRUE.equals(graded.get("correct"))
                        || graded.get("correct") instanceof Number number && number.intValue() == 1;
                outcome = full ? "FULL" : "ZERO";
                explanation = full ? PlacementRuleScorePort.FULL_EXPLANATION
                        : PlacementRuleScorePort.ZERO_EXPLANATION;
            }
        }
        Map<String, Object> outcomeReport = null;
        if (ruleScorePort != null && deferred && sequence == 10) {
            outcomeReport = storedOutcomeReport(sessionId);
            status = "COMPLETED";
        }
        return checkpointReceipt(sessionId, sequence, ((Number) checkpoint.get("state_version")).longValue(),
                status, acceptedInstant(checkpoint.get("saved_at")), session, finalResult, outcome, explanation,
                outcomeReport);
    }

    private boolean sameStoredCompletion(Map<String, Object> session, List<Map<String, Object>> sealed,
                                         int sequence, String requestDigest) {
        if (ruleScorePort == null || sequence != 10 || sealed.size() != 10 || !answerFree(sealed.get(9))) {
            return false;
        }
        Map<String, Object> stored = one("""
                SELECT request_digest FROM p1_placement_response
                 WHERE session_id = ? AND principal_id = ? AND tenant_id = ? AND item_sequence = 10
                """, session.get("session_id"), session.get("principal_id"), TENANT);
        return stored != null && requestDigest.equals(stored.get("request_digest"));
    }

    /** One immutable snapshot. A second call returns the row already stored for this session. */
    private Map<String, Object> freezeOutcomeReport(Map<String, Object> session,
                                                     VerifiedAssessmentPrincipal principal, Instant now) {
        String sessionId = String.valueOf(session.get("session_id"));
        Map<String, Object> existing = one("""
                SELECT report_json FROM p1_placement_result WHERE session_id = ? AND tenant_id = ?
                """, sessionId, TENANT);
        if (existing != null) return object(existing.get("report_json"));
        List<Map<String, Object>> sealed = maps(session.get("sealed_items_json"));
        if (sealed.size() != 10) throw unavailable("sealed placement snapshot is invalid");
        List<Map<String, Object>> answers = jdbc.queryForList("""
                SELECT item_sequence, item_id, correct FROM p1_placement_response
                 WHERE session_id = ? AND principal_id = ? AND tenant_id = ?
                 ORDER BY item_sequence
                """, sessionId, principal.subject(), TENANT);
        if (answers.size() != 10) throw unavailable("placement checkpoint coverage is incomplete");
        List<Map<String, Object>> outcomes = new ArrayList<>(10);
        Map<String, Boolean> graded = new LinkedHashMap<>();
        int fullCount = 0;
        for (int index = 0; index < answers.size(); index++) {
            Map<String, Object> answer = answers.get(index);
            int itemSequence = ((Number) answer.get("item_sequence")).intValue();
            if (itemSequence != index + 1 || answer.get("correct") == null || answer.get("item_id") == null) {
                throw unavailable("placement outcome sequence is incomplete");
            }
            boolean full = Boolean.TRUE.equals(answer.get("correct"))
                    || answer.get("correct") instanceof Number number && number.intValue() == 1;
            if (full) fullCount++;
            graded.put(String.valueOf(answer.get("item_id")), full);
            Map<String, Object> outcome = new LinkedHashMap<>();
            outcome.put("sequence", itemSequence);
            outcome.put("outcome", full ? "FULL" : "ZERO");
            outcomes.add(outcome);
        }
        P1PlacementScorer.Assessed assessed = P1PlacementScorer.assess(scorerItems(sealed), graded);
        Map<String, Object> contentPin = object(session.get("content_pin_json"));
        String snapshotId = String.valueOf(contentPin.get("snapshotId"));
        String snapshotHash = String.valueOf(contentPin.get("snapshotHash"));
        if (!snapshotId.matches("snap_[A-Za-z0-9._:-]{8,127}") || !snapshotHash.matches(DIGEST_PATTERN)) {
            throw unavailable("placement bank snapshot pin is invalid");
        }
        String reportId = "rpt_" + compactId();
        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("reportId", reportId);
        facts.put("outcomes", outcomes);
        facts.put("snapshotId", snapshotId);
        facts.put("snapshotHash", snapshotHash);
        String digest = sha256(json(facts));
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("reportId", reportId);
        summary.put("digest", digest);
        summary.put("itemCount", 10);
        summary.put("fullCount", fullCount);
        summary.put("zeroCount", 10 - fullCount);
        summary.put("snapshotId", snapshotId);
        summary.put("snapshotHash", snapshotHash);
        String resultId = "plr_" + compactId();
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("reportId", reportId);
        report.put("digest", digest);
        report.put("snapshotId", snapshotId);
        report.put("snapshotHash", snapshotHash);
        report.put("outcomes", outcomes);
        report.put("summary", summary);
        // Scoring facts sit beside the four digest fields. They are not part of
        // facts(), so a later read still matches the stored outcome digest.
        report.put("sessionId", sessionId);
        report.put("placementResultId", resultId);
        report.put("resultKind", "ASSESSED");
        report.put("completedAt", now.toString());
        report.put("confidence", assessed.progress().confidence());
        report.put("referenceLevel", assessed.referenceLevel());
        report.put("aggregateScore", assessed.aggregateScore());
        String reportJson = json(report);
        String summaryJson = json(summary);
        if (reportJson.contains("correctOption") || reportJson.contains("answerRule")
                || summaryJson.contains("correctOption") || summaryJson.contains("answerRule")
                || SafePayloads.containsSensitive(report)) {
            throw unavailable("placement report contains protected answer material");
        }
        try {
            jdbc.update("""
                    INSERT INTO p1_placement_result
                        (placement_result_id, session_id, report_id, principal_id, tenant_id,
                         result_kind, result_json, report_json, completed_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, resultId, sessionId, reportId, principal.subject(), TENANT,
                    "ASSESSED", summaryJson, reportJson, Timestamp.from(now));
        } catch (DuplicateKeyException conflict) {
            return storedOutcomeReport(sessionId);
        }
        return report;
    }

    private Map<String, Object> storedOutcomeReport(String sessionId) {
        Map<String, Object> row = one("""
                SELECT report_json FROM p1_placement_result WHERE session_id = ? AND tenant_id = ?
                """, sessionId, TENANT);
        if (row == null) throw unavailable("placement report is missing");
        return object(row.get("report_json"));
    }

    private PlacementRuleScorePort.RuleScore gradeCurrent(long itemId, Map<String, Object> candidate) {
        List<?> selected = (List<?>) candidate.get("selectedOptionIds");
        PlacementRuleScorePort.RuleScore graded;
        if (selected.size() != 1) {
            graded = new PlacementRuleScorePort.RuleScore("ZERO", PlacementRuleScorePort.ZERO_EXPLANATION);
        } else {
            try {
                graded = ruleScorePort.score(itemId, String.valueOf(selected.getFirst()));
            } catch (ResponseStatusException expected) {
                throw expected;
            } catch (RuntimeException failed) {
                throw unavailable("placement rule score is unavailable");
            }
        }
        if (graded == null) throw unavailable("placement rule score is not objective");
        return graded;
    }

    private Map<String, Object> checkpointReceipt(String sessionId, int acceptedSequence, long stateVersion,
                                                  String status, Instant acceptedAt, Map<String, Object> session,
                                                  Map<String, Object> finalResult, String outcome, String explanation,
                                                  Map<String, Object> outcomeReport) {
        Map<String, Object> receipt = new LinkedHashMap<>();
        receipt.put("sessionId", sessionId);
        receipt.put("stateVersion", stateVersion);
        receipt.put("status", status);
        receipt.put("acceptedSequence", acceptedSequence);
        receipt.put("nextSequence", acceptedSequence + 1);
        receipt.put("acceptedAt", acceptedAt.toString());
        if (outcome != null) {
            receipt.put("outcome", outcome);
            receipt.put("explanation", explanation);
        }
        if (finalResult != null) {
            receipt.put("finalResult", finalResult);
        } else if (outcomeReport != null) {
            receipt.put("report", outcomeReport);
            receipt.put("summary", outcomeReport.get("summary"));
        } else if (acceptedSequence < 10) {
            receipt.put("nextItem", maps(session.get("learner_items_json")).get(acceptedSequence));
        }
        return receipt;
    }

    private Map<String, Object> freezeScoredPlacement(Map<String, Object> session,
                                                      VerifiedAssessmentPrincipal principal,
                                                      List<Map<String, Object>> sealed, long nextVersion, Instant now) {
        String sessionId = String.valueOf(session.get("session_id"));
        List<Map<String, Object>> answers = jdbc.queryForList("""
                SELECT item_id, correct FROM p1_placement_response
                 WHERE session_id = ? AND principal_id = ? AND tenant_id = ? ORDER BY item_sequence
                """, sessionId, principal.subject(), TENANT);
        if (answers.size() != 10) throw unavailable("placement checkpoint coverage is incomplete");
        Map<String, Boolean> graded = new LinkedHashMap<>();
        for (Map<String, Object> answer : answers) {
            graded.put(String.valueOf(answer.get("item_id")), Boolean.TRUE.equals(answer.get("correct"))
                    || answer.get("correct") instanceof Number n && n.intValue() == 1);
        }
        P1PlacementScorer.Assessed assessed = P1PlacementScorer.assess(scorerItems(sealed), graded);
        return freezeResult(session, principal, "ASSESSED", assessed, null, nextVersion, now);
    }

    private void saveResponseReceipt(VerifiedAssessmentPrincipal principal, String key, String requestDigest,
                                     Map<String, Object> response) {
        Map<String, Object> existing = one("""
                SELECT operation, request_digest, response_json FROM p1_placement_idempotency
                 WHERE tenant_id = ? AND principal_id = ? AND idempotency_key = ?
                """, TENANT, principal.subject(), key);
        if (existing == null) {
            try {
                jdbc.update("""
                        INSERT INTO p1_placement_idempotency
                            (tenant_id, principal_id, idempotency_key, operation, request_digest, response_json, created_at)
                        VALUES (?, ?, ?, ?, ?, '{}', CURRENT_TIMESTAMP(6))
                        """, TENANT, principal.subject(), key, "RESPONSE", requestDigest);
            } catch (DuplicateKeyException ignored) {
                existing = one("""
                        SELECT operation, request_digest, response_json FROM p1_placement_idempotency
                         WHERE tenant_id = ? AND principal_id = ? AND idempotency_key = ?
                        """, TENANT, principal.subject(), key);
                if (existing == null) throw ignored;
            }
        }
        if (existing != null && (!"RESPONSE".equals(existing.get("operation"))
                || !requestDigest.equals(existing.get("request_digest")))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Idempotency-Key was reused for a different command");
        }
        finishClaim(principal, key, response);
    }

    private void revertCheckpoint(String sessionId, String principal, String status, long stateVersion,
                                  int sequence, Timestamp updatedAt) {
        jdbc.update("""
                UPDATE p1_placement_session SET status = ?, state_version = ?, current_sequence = ?, updated_at = ?
                 WHERE session_id = ? AND principal_id = ? AND tenant_id = ? AND state_version = ?
                """, status, stateVersion, sequence, updatedAt,
                sessionId, principal, TENANT, stateVersion + 1);
    }

    private static Instant acceptedInstant(Object value) {
        if (value instanceof Timestamp timestamp) return timestamp.toInstant();
        if (value instanceof Instant instant) return instant;
        if (value instanceof java.time.LocalDateTime dateTime) return dateTime.toInstant(java.time.ZoneOffset.UTC);
        return Instant.parse(String.valueOf(value));
    }

    boolean score(Map<String, Object> sealed, Map<String, Object> candidate) {
        String responseType = String.valueOf(candidate.get("responseType"));
        if ("UNANSWERED".equals(responseType)) {
            requireKeys(candidate, Set.of("responseType"));
            return false;
        }
        com.englishflow.assessment.domain.QuestionType questionType;
        try {
            questionType = com.englishflow.assessment.domain.QuestionType.valueOf(
                    String.valueOf(sealed.get("questionType")));
        } catch (IllegalArgumentException invalidType) {
            throw unavailable("sealed placement question type is invalid");
        }
        Map<String, Object> scoringCandidate = switch (responseType) {
            case "CHOICE" -> {
                requireKeys(candidate, Set.of("responseType", "selectedOptionIds"));
                requireStrings(candidate.get("selectedOptionIds"), 32, "[a-z][a-z0-9._:-]{0,63}");
                if (questionType != com.englishflow.assessment.domain.QuestionType.CHOICE
                        && questionType != com.englishflow.assessment.domain.QuestionType.LISTEN_CHOICE) {
                    throw invalid("placement response does not match the current item");
                }
                yield Map.of("selectedOptionKeys", candidate.get("selectedOptionIds"));
            }
            case "MATCHING" -> {
                requireKeys(candidate, Set.of("responseType", "pairs"));
                requireEntryList(candidate.get("pairs"), 128, Set.of("leftId", "rightId"),
                        "[A-Za-z0-9][A-Za-z0-9._:-]{0,95}");
                if (questionType != com.englishflow.assessment.domain.QuestionType.CONNECT_LINE) {
                    throw invalid("placement response does not match the current item");
                }
                yield Map.of("pairs", candidate.get("pairs"));
            }
            case "ORDERING" -> {
                requireKeys(candidate, Set.of("responseType", "orderedTokenIds"));
                requireStrings(candidate.get("orderedTokenIds"), 256,
                        "[A-Za-z0-9][A-Za-z0-9._:-]{0,95}");
                if (questionType != com.englishflow.assessment.domain.QuestionType.DRAG_SORTER) {
                    throw invalid("placement response does not match the current item");
                }
                yield Map.of("orderedTokenIds", candidate.get("orderedTokenIds"));
            }
            case "CLOZE" -> {
                requireKeys(candidate, Set.of("responseType", "blanks"));
                requireEntryList(candidate.get("blanks"), 128, Set.of("blankId", "text"), null);
                for (Object rawBlank : (List<?>) candidate.get("blanks")) {
                    Map<?, ?> blank = (Map<?, ?>) rawBlank;
                    if (!String.valueOf(blank.get("blankId"))
                            .matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,95}")
                            || String.valueOf(blank.get("text")).length() > 4096) {
                        throw invalid("placement cloze entry is invalid");
                    }
                }
                if (questionType != com.englishflow.assessment.domain.QuestionType.FILL_BLANK) {
                    throw invalid("placement response does not match the current item");
                }
                yield Map.of("blanks", candidate.get("blanks"));
            }
            case "TEXT" -> {
                requireKeys(candidate, Set.of("responseType", "text"));
                if (!(candidate.get("text") instanceof String value) || value.isBlank()
                        || value.length() > 12000) throw invalid("placement text response is invalid");
                if (questionType != com.englishflow.assessment.domain.QuestionType.SPELL_INPUT
                        && questionType != com.englishflow.assessment.domain.QuestionType.DICTATION) {
                    throw invalid("placement response does not match the current item");
                }
                yield Map.of("text", value);
            }
            default -> throw invalid("placement response type is invalid");
        };
        try {
            ContentSnapshot snapshot = new ContentSnapshot(String.valueOf(sealed.get("contentCode")),
                    positiveLong(sealed.get("contentVersionId")), positiveLong(sealed.get("questionId")),
                    positiveLong(sealed.get("itemId")),
                    questionType,
                    object(sealed.get("learnerFields")), object(sealed.get("answerRules")),
                    String.valueOf(sealed.get("scoringVersion")), boundedInt(sealed.get("maxScore"), 1, 100), true);
            var score = scorer.score(snapshot, scoringCandidate);
            if (score.status() != ScoringStatus.SCORED || score.correct() == null) {
                throw unavailable("placement scoring result is not objective");
            }
            return score.correct();
        } catch (ResponseStatusException expected) {
            throw expected;
        } catch (RuntimeException invalidRule) {
            throw unavailable("sealed placement scoring rule is invalid");
        }
    }

    private static void requireStrings(Object raw, int maximum, String pattern) {
        if (!(raw instanceof List<?> values) || values.isEmpty() || values.size() > maximum
                || values.stream().anyMatch(value -> !(value instanceof String text) || !text.matches(pattern))
                || Set.copyOf(values).size() != values.size()) throw invalid("placement response values are invalid");
    }

    private static void requireEntryList(Object raw, int maximum, Set<String> fields, String tokenPattern) {
        if (!(raw instanceof List<?> values) || values.isEmpty() || values.size() > maximum) {
            throw invalid("placement response entries are invalid");
        }
        Set<Object> distinct = new java.util.HashSet<>();
        for (Object value : values) {
            if (!(value instanceof Map<?, ?> entry) || !entry.keySet().equals(fields)
                    || !distinct.add(entry)) throw invalid("placement response entry is invalid");
            for (String field : fields) {
                if (!(entry.get(field) instanceof String text) || text.isBlank()
                        || text.length() > 12000 || tokenPattern != null && !text.matches(tokenPattern)) {
                    throw invalid("placement response entry value is invalid");
                }
            }
        }
    }

    private Map<String, Object> sessionView(Map<String, Object> row) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("sessionId", row.get("session_id"));
        view.put("status", row.get("status"));
        view.put("stateVersion", row.get("state_version"));
        view.put("sessionSnapshotDigest", row.get("session_snapshot_digest"));
        view.put("manifest", object(row.get("manifest_json")));
        view.put("contentPin", object(row.get("content_pin_json")));
        view.put("answerRulePin", object(row.get("answer_rule_pin_json")));
        view.put("targetPin", object(row.get("target_pin_json")));
        view.put("startedAt", timestamp(row.get("started_at")));
        view.put("updatedAt", timestamp(row.get("updated_at")));
        List<Map<String, Object>> items = projectLearnerItems(row.get("learner_items_json"));
        view.put("items", items);
        int cursor = ((Number) row.get("current_sequence")).intValue();
        if (cursor < 1 || cursor > 11) throw unavailable("placement item pin is invalid");
        view.put("acceptedSequence", cursor - 1);
        view.put("nextSequence", cursor);
        if ("SKIPPED".equals(String.valueOf(row.get("status")))) {
            view.put("resultKind", "SKIPPED");
            view.put("baselineSource", "USER_SKIP");
            view.put("confidence", "UNVERIFIED");
            if (row.get("baseline_json") != null) {
                Map<String, Object> baseline = object(row.get("baseline_json"));
                if (baseline.get("requestedStartingLevel") != null) {
                    view.put("requestedStartingLevel", baseline.get("requestedStartingLevel"));
                }
            }
            return view;
        }
        if ("COMPLETED".equals(row.get("status"))) {
            Map<String, Object> result = one("SELECT result_json FROM p1_placement_result WHERE session_id = ? AND tenant_id = ?",
                    row.get("session_id"), TENANT);
            if (result == null) throw unavailable("placement result is missing");
            view.put("completedResult", object(result.get("result_json")));
        } else if (cursor <= 10) {
            view.put("currentItem", items.get(cursor - 1));
        }
        return view;
    }

    private List<Map<String, Object>> projectLearnerItems(Object raw) {
        List<Map<String, Object>> items = maps(raw);
        if (items.size() != 10) throw unavailable("placement item pin is invalid");
        List<Map<String, Object>> projected = new ArrayList<>(10);
        for (Map<String, Object> item : items) {
            Map<String, Object> safe = new LinkedHashMap<>(SafePayloads.sanitizeLearnerView(item));
            safe.keySet().removeIf(P1PlacementJdbcController::hiddenAnswerField);
            if (SafePayloads.containsSensitive(safe) || !text(safe.get("stem"))
                    || !(safe.get("options") instanceof List<?> options) || options.isEmpty()) {
                throw unavailable("placement learner item is not answer-free");
            }
            projected.add(Map.copyOf(safe));
        }
        return List.copyOf(projected);
    }

    private static boolean hiddenAnswerField(String key) {
        String normalized = key.toLowerCase(java.util.Locale.ROOT).replace("_", "");
        return normalized.equals("explanation") || normalized.equals("correctanswer")
                || normalized.equals("answerrule") || normalized.equals("answerrules")
                || normalized.equals("correctoption") || normalized.equals("correctoptionkeys");
    }

    private static boolean text(Object value) {
        return value instanceof String string && !string.isBlank();
    }

    private Map<String, Object> ownerSession(String sessionId, VerifiedAssessmentPrincipal principal) {
        Map<String, Object> row = one("SELECT * FROM p1_placement_session WHERE session_id = ? AND tenant_id = ?",
                sessionId, TENANT);
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "placement session not found");
        if (!principal.subject().equals(row.get("principal_id"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "placement session owner mismatch");
        }
        return row;
    }

    private Map<String, Object> ownerSessionForUpdate(String sessionId, VerifiedAssessmentPrincipal principal) {
        Map<String, Object> row = one("SELECT * FROM p1_placement_session WHERE session_id = ? AND tenant_id = ? FOR UPDATE",
                sessionId, TENANT);
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "placement session not found");
        if (!principal.subject().equals(row.get("principal_id"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "placement session owner mismatch");
        }
        return row;
    }

    /** Skip is a user choice. It is not a scored report and has no reportId or digest. */
    private Map<String, Object> skippedBaseline(String sessionId, Map<String, Object> requestedLevel, Instant now) {
        Map<String, Object> baseline = new LinkedHashMap<>();
        baseline.put("sessionId", sessionId);
        baseline.put("status", "SKIPPED");
        baseline.put("resultKind", "SKIPPED");
        baseline.put("baselineSource", "USER_SKIP");
        baseline.put("confidence", "UNVERIFIED");
        if (requestedLevel != null) baseline.put("requestedStartingLevel", requestedLevel);
        baseline.put("recordedAt", now.toString());
        return baseline;
    }

    private boolean hasResult(String sessionId) {
        return one("""
                SELECT report_id FROM p1_placement_result
                 WHERE session_id = ? AND tenant_id = ?
                """, sessionId, TENANT) != null;
    }

    private Map<String, Object> claimOrReplay(VerifiedAssessmentPrincipal principal, String key,
                                              String operation, String requestDigest) {
        Map<String, Object> existing = one("""
                SELECT operation, request_digest, response_json FROM p1_placement_idempotency
                 WHERE tenant_id = ? AND principal_id = ? AND idempotency_key = ?
                """, TENANT, principal.subject(), key);
        if (existing != null) return checkedReplay(existing, operation, requestDigest);
        try {
            jdbc.update("""
                    INSERT INTO p1_placement_idempotency
                        (tenant_id, principal_id, idempotency_key, operation, request_digest, response_json, created_at)
                    VALUES (?, ?, ?, ?, ?, '{}', CURRENT_TIMESTAMP(6))
                    """, TENANT, principal.subject(), key, operation, requestDigest);
            return null;
        } catch (DuplicateKeyException race) {
            Map<String, Object> winner = one("""
                    SELECT operation, request_digest, response_json FROM p1_placement_idempotency
                     WHERE tenant_id = ? AND principal_id = ? AND idempotency_key = ?
                    """, TENANT, principal.subject(), key);
            if (winner == null) throw race;
            return checkedReplay(winner, operation, requestDigest);
        }
    }

    private Map<String, Object> checkedReplay(Map<String, Object> row, String operation, String digest) {
        if (!operation.equals(row.get("operation")) || !digest.equals(row.get("request_digest"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Idempotency-Key was reused for a different command");
        }
        Map<String, Object> response = object(row.get("response_json"));
        if (response.isEmpty()) throw unavailable("idempotent placement response is not durable");
        return response;
    }

    private void finishClaim(VerifiedAssessmentPrincipal principal, String key, Map<String, Object> response) {
        if (jdbc.update("""
                UPDATE p1_placement_idempotency SET response_json = ?
                 WHERE tenant_id = ? AND principal_id = ? AND idempotency_key = ?
                """, json(response), TENANT, principal.subject(), key) != 1) {
            throw unavailable("placement idempotency receipt could not be saved");
        }
    }

    private static Map<String, Object> manifest() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("placementManifestId", RULE);
        value.put("placementManifestVersion", RULE);
        value.put("placementManifestDigest", sha256(RULE + "|3/3/2/2|25/25/25/25|HALF_UP"));
        value.put("dimensionSetDigest", sha256("VOCABULARY|BASIC_GRAMMAR|READING|LISTENING"));
        value.put("totalItemCount", 10);
        value.put("dimensions", DIMENSIONS);
        return value;
    }

    private static Map<String, Object> manifestPin(Map<String, Object> manifest) {
        Map<String, Object> pin = new LinkedHashMap<>(manifest);
        pin.remove("dimensions");
        return pin;
    }

    private String sourceDigest(Resolved source) {
        return SafePayloads.digest(List.of(source.targetPin(), source.contentPin(), source.answerRulePin(),
                source.items().stream().map(item -> {
                    ContentSnapshot snapshot = item.scoringSnapshot();
                    if (snapshot == null) {
                        return List.of(item.itemId(), item.dimension().name(), item.learnerItem());
                    }
                    return List.of(item.itemId(), item.dimension().name(), item.learnerItem(),
                            snapshot.learnerFields(), snapshot.answerRules(), snapshot.scoringVersion());
                }).toList()));
    }

    private static List<P1PlacementScorer.Item> scorerItems(List<Map<String, Object>> sealed) {
        return sealed.stream().map(item -> new P1PlacementScorer.Item(String.valueOf(item.get("itemId")),
                P1PlacementScorer.Dimension.valueOf(String.valueOf(item.get("dimension"))))).toList();
    }

    private Map<String, Object> one(String sql, Object... args) {
        List<Map<String, Object>> rows = jdbc.queryForList(sql, args);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    private String json(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (JacksonException error) { throw unavailable("placement snapshot serialization failed"); }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> object(Object raw) {
        if (raw instanceof Map<?, ?> map) return (Map<String, Object>) map;
        if (raw == null) throw invalid("placement object is required");
        try {
            Object decoded = mapper.readValue(String.valueOf(raw), Object.class);
            if (decoded instanceof Map<?, ?> map) return (Map<String, Object>) map;
        } catch (JacksonException ignored) {
            throw unavailable("placement stored JSON is invalid");
        }
        throw invalid("placement object is required");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> requestObject(Object raw) {
        if (raw instanceof Map<?, ?> map && map.keySet().stream().allMatch(String.class::isInstance)) {
            return (Map<String, Object>) map;
        }
        throw invalid("placement request object is required");
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> maps(Object raw) {
        try {
            Object decoded = mapper.readValue(String.valueOf(raw), Object.class);
            if (decoded instanceof List<?> list && list.stream().allMatch(Map.class::isInstance)) {
                return (List<Map<String, Object>>) decoded;
            }
        } catch (JacksonException ignored) {
            throw unavailable("placement stored item snapshot is invalid");
        }
        throw unavailable("placement stored item snapshot is invalid");
    }

    private static long positiveLong(Object value) {
        if (value instanceof Number number) {
            try {
                long result = new BigDecimal(number.toString()).toBigIntegerExact().longValueExact();
                if (result > 0) return result;
            } catch (ArithmeticException | NumberFormatException invalid) {
                // Fractional and overflowing values are not valid identifiers or versions.
            }
        }
        throw invalid("positive placement identifier or version is required");
    }

    private static int boundedInt(Object value, int min, int max) {
        if (value instanceof Number number) {
            try {
                int result = new BigDecimal(number.toString()).toBigIntegerExact().intValueExact();
                if (result >= min && result <= max) return result;
            } catch (ArithmeticException | NumberFormatException invalid) {
                // Fractional and overflowing values are not placement integers.
            }
        }
        throw invalid("placement integer is outside the allowed range");
    }

    private static void requireKey(String key) {
        if (key == null || key.length() < 16 || key.length() > 192 || key.contains("\r") || key.contains("\n")) {
            throw invalid("Idempotency-Key is required");
        }
    }

    private static void requireKeys(Map<String, Object> value, Set<String> required) {
        if (value == null || !value.keySet().equals(required)) throw invalid("placement request fields are invalid");
    }

    private static ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message);
    }

    private static ResponseStatusException unavailable(String message) {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, message);
    }

    private static String compactId() { return UUID.randomUUID().toString().replace("-", ""); }

    private static String timestamp(Object value) {
        if (value instanceof Timestamp timestamp) return timestamp.toInstant().toString();
        if (value instanceof java.time.LocalDateTime dateTime) return dateTime.toInstant(java.time.ZoneOffset.UTC).toString();
        return String.valueOf(value);
    }

    private static Map<String, Object> envelope(Map<String, Object> data) { return Map.of("data", data); }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
