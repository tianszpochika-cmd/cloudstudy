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
import com.englishflow.assessment.web.AssessmentHttpPrincipals.VerifiedAssessmentPrincipal;
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
    private final RuleScoringEngine scorer = new RuleScoringEngine();

    public P1PlacementJdbcController(JdbcTemplate jdbc, ObjectMapper mapper,
                                     P1PlacementSourcePort sourcePort, AssessmentOutboxPort outbox) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.sourcePort = sourcePort;
        this.outbox = outbox;
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
        Map<String, Object> replay = claimOrReplay(principal, key, "RESPONSE", requestDigest);
        if (replay != null) return envelope(replay);

        Map<String, Object> session = ownerSessionForUpdate(sessionId, principal);
        if ("COMPLETED".equals(session.get("status"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "placement is already complete");
        }
        int cursor = ((Number) session.get("current_sequence")).intValue();
        long stateVersion = ((Number) session.get("state_version")).longValue();
        if (sequence != cursor || expectedVersion != stateVersion) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "placement checkpoint is stale or out of order");
        }
        List<Map<String, Object>> sealed = maps(session.get("sealed_items_json"));
        if (sealed.size() != 10 || sequence > sealed.size()) throw unavailable("sealed placement snapshot is invalid");
        Map<String, Object> current = sealed.get(sequence - 1);
        if (positiveLong(current.get("itemId")) != itemId) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "placement item is out of order");
        }
        boolean correct = score(current, candidate);
        Instant now = Instant.now();
        jdbc.update("""
                INSERT INTO p1_placement_response
                    (session_id, item_sequence, item_id, principal_id, tenant_id,
                     response_digest, request_digest, correct, time_spent_sec, accepted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, sessionId, sequence, itemId, principal.subject(), TENANT,
                responseDigest, requestDigest, correct, spent, Timestamp.from(now));
        long nextVersion = stateVersion + 1;
        int nextSequence = sequence + 1;
        String checkpointDigest = sha256(sessionId + ":" + nextVersion + ":" + nextSequence
                + ":" + requestDigest);
        jdbc.update("""
                INSERT INTO p1_placement_checkpoint
                    (session_id, state_version, principal_id, tenant_id, next_sequence, checkpoint_digest, saved_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, sessionId, nextVersion, principal.subject(), TENANT,
                nextSequence, checkpointDigest, Timestamp.from(now));
        String nextStatus = nextSequence == 11 ? "COMPLETED" : "IN_PROGRESS";
        int updated = jdbc.update("""
                UPDATE p1_placement_session SET status = ?, state_version = ?, current_sequence = ?, updated_at = ?
                 WHERE session_id = ? AND principal_id = ? AND tenant_id = ? AND state_version = ?
                """, nextStatus, nextVersion, nextSequence, Timestamp.from(now),
                sessionId, principal.subject(), TENANT, stateVersion);
        if (updated != 1) throw new ResponseStatusException(HttpStatus.CONFLICT,
                "placement checkpoint changed concurrently");

        Map<String, Object> receipt = new LinkedHashMap<>();
        receipt.put("sessionId", sessionId);
        receipt.put("stateVersion", nextVersion);
        receipt.put("status", nextStatus);
        receipt.put("acceptedAt", now.toString());
        if (nextSequence == 11) {
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
            List<P1PlacementScorer.Item> manifestItems = scorerItems(sealed);
            P1PlacementScorer.Assessed assessed = P1PlacementScorer.assess(manifestItems, graded);
            Map<String, Object> result = freezeResult(session, principal, "ASSESSED", assessed, null,
                    nextVersion, now);
            receipt.put("finalResult", result);
        } else {
            receipt.put("nextItem", maps(session.get("learner_items_json")).get(nextSequence - 1));
        }
        finishClaim(principal, key, receipt);
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
        if (!Set.of("requestedStartingLevel").containsAll(input.keySet())) {
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
        Resolved source = resolve(principal);
        String requestDigest = SafePayloads.digest(List.of("SKIP", sourceDigest(source), input));
        Map<String, Object> replay = claimOrReplay(principal, key, "SKIP", requestDigest);
        if (replay != null) return ResponseEntity.status(HttpStatus.CREATED).body(envelope(replay));
        String sessionId = "asess_" + compactId();
        Instant now = Instant.now();
        insertSession(sessionId, principal, source, "COMPLETED", 11, now);
        Map<String, Object> result = freezeResult(ownerSession(sessionId, principal), principal,
                "SKIPPED", null, requestedLevel, 1, now);
        finishClaim(principal, key, result);
        return ResponseEntity.status(HttpStatus.CREATED).body(envelope(result));
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
        outbox.append(new AssessmentOutboxPort.AssessmentOutboxEvent(UUID.randomUUID(),
                "assessment.placement.completed.v1", "placement_session", sessionId,
                TENANT, principal.subject(), "placement-" + sessionId, "placement-" + sessionId,
                "assessment.placement.completed.v1", 1, "placement-complete:" + sessionId,
                event, now));
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
        if ("COMPLETED".equals(row.get("status"))) {
            Map<String, Object> result = one("SELECT result_json FROM p1_placement_result WHERE session_id = ? AND tenant_id = ?",
                    row.get("session_id"), TENANT);
            if (result == null) throw unavailable("placement result is missing");
            view.put("completedResult", object(result.get("result_json")));
        } else {
            int cursor = ((Number) row.get("current_sequence")).intValue();
            List<Map<String, Object>> items = maps(row.get("learner_items_json"));
            if (items.size() != 10 || cursor < 1 || cursor > 10) throw unavailable("placement item pin is invalid");
            view.put("currentItem", items.get(cursor - 1));
        }
        return view;
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
                source.items().stream().map(item -> List.of(item.itemId(), item.dimension().name(),
                        item.learnerItem(), item.scoringSnapshot().learnerFields(),
                        item.scoringSnapshot().answerRules(), item.scoringSnapshot().scoringVersion())).toList()));
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
