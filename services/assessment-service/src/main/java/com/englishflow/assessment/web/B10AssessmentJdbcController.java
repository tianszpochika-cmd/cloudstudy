package com.englishflow.assessment.web;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import com.englishflow.assessment.adapter.content.BankPracticeRuleProvider;
import com.englishflow.assessment.domain.AssessmentMistake;
import com.englishflow.assessment.domain.AssessmentPrincipal;
import com.englishflow.assessment.domain.GrammarReadingPack;
import com.englishflow.assessment.domain.PracticeCheckpoint;
import com.englishflow.assessment.domain.PracticeFeedback;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * B10 canonical assessment adapter backed only by assessment-service tables.
 * The controller intentionally exposes learner-safe content items and keeps
 * answer rules inside this service boundary.
 */
@RestController
@RequestMapping("/internal/v1/assessment")
@ConditionalOnProperty(prefix = "assessment.persistence", name = "enabled", havingValue = "true")
public class B10AssessmentJdbcController {
    private static final String TENANT = "platform";
    private static final String CONTENT_CODE = "course-b25-basics";
    private static final String SESSION_CREATE_OPERATION = "B10_SESSION_CREATE";
    private static final long DEFAULT_CONTENT_VERSION = 25001L;
    private static final long CONTENT_EPOCH = 1L;
    private static final long SNAPSHOT_ID = 25001L;
    private static final String SNAPSHOT_HASH = "0000000000000000000000000000000000000000000000000000000000000001";

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final String contentBaseUrl;
    private final BankPracticeRuleProvider bankRules;

    public B10AssessmentJdbcController(JdbcTemplate jdbc, ObjectMapper mapper,
            @org.springframework.beans.factory.annotation.Value("${assessment.content.base-url:http://127.0.0.1:18089}") String contentBaseUrl) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.contentBaseUrl = contentBaseUrl;
        this.bankRules = new BankPracticeRuleProvider(mapper, contentBaseUrl);
    }

    @PostMapping("/sessions")
    @Transactional
    public Map<String, Object> createSession(
            Authentication authentication,
            @RequestBody Map<String, Object> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        Principal principal = principal(authentication, "assessment.session.write");
        requireKey(idempotencyKey);
        // B3 interaction loop: the client may name the gradable content it just
        // read (B3 stems carry a practiceRef). The name is validated against
        // the contract code pattern and resolved server-side; unknown or
        // rule-less content keeps the existing 410 behavior.
        String requestedCode = text(body.get("contentCode"), CONTENT_CODE);
        if (!requestedCode.matches("[a-z][a-z0-9._:-]{1,127}")) bad("contentCode is invalid");
        long contentVersionId = positiveLong(body.get("contentVersionId"), DEFAULT_CONTENT_VERSION);
        String mode = upperText(body.get("mode"), "PRACTICE");
        if (!List.of("PRACTICE", "REVIEW", "PLACEMENT", "MOCK").contains(mode)) {
            bad("unsupported assessment mode");
        }
        String requestDigest = sha256(json(canonicalValue(body)));
        Map<String, Object> existing = one("""
                SELECT * FROM b10_assessment_session
                 WHERE tenant_id = ? AND principal_id = ? AND idempotency_key = ?
                """, TENANT, principal.subject(), idempotencyKey);
        if (existing != null) {
            return replaySessionCreation(principal.subject(), idempotencyKey, requestDigest,
                    body, mode, requestedCode, contentVersionId, existing);
        }
        // A second open of the same learnable pin reuses the in-progress session.
        // A new idempotency key still stores that same receipt. Reuse happens
        // before the pack check so a session that already opened can finish.
        Map<String, Object> open = one("""
                SELECT * FROM b10_assessment_session
                 WHERE tenant_id = ? AND principal_id = ? AND status = 'IN_PROGRESS'
                   AND content_code = ? AND content_version_id = ? AND mode = ?
                 ORDER BY started_at
                 LIMIT 1
                """, TENANT, principal.subject(), requestedCode, contentVersionId, mode);
        if (open != null) {
            Map<String, Object> raced = claimSessionCreate(principal, idempotencyKey, requestDigest,
                    body, mode, requestedCode, contentVersionId);
            if (raced != null) return raced;
            Map<String, Object> response = envelope(sessionView(open));
            int saved = jdbc.update("""
                    UPDATE assessment_idempotency SET response_json = ?
                     WHERE tenant_id = ? AND subject_id = ? AND operation = ? AND idempotency_key = ?
                    """, json(response), TENANT, principal.subject(), SESSION_CREATE_OPERATION, idempotencyKey);
            if (saved != 1) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "assessment session creation response was not saved");
            }
            return response;
        }

        List<Map<String, Object>> rules = rules(requestedCode, contentVersionId, body.get("itemIds"));
        BankPracticeRuleProvider.BankRules bank = null;
        if (rules.isEmpty() && BankPracticeRuleProvider.BANK_CONTENT_CODE.equals(requestedCode)) {
            bank = bankRules(requestedCode, contentVersionId, authorization);
            // The same requested-item filter as local rules: unknown item ids
            // fall through to the substitute/410 path instead of grading the
            // whole bank.
            if (bank != null) rules = filterByItemIds(bank.rows(), body.get("itemIds"));
        }
        // Grammar is three items and reading is two. A short pack closes here,
        // before any idempotency claim and before the 7B substitute, so a
        // missing pack does not borrow another skill or stick a key.
        boolean namedItems = !valueList(body.get("itemIds")).isEmpty();
        GrammarReadingPack.Selection pack = GrammarReadingPack.select(requestedCode, rules, namedItems);
        if (pack.closedMissing()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, GrammarReadingPack.CLOSED_MISSING);
        }
        rules = pack.rules();
        Map<String, Object> raced = claimSessionCreate(principal, idempotencyKey, requestDigest,
                body, mode, requestedCode, contentVersionId);
        if (raced != null) return raced;
        // P1R decision 7B: assessment assembles the session pin. The requested pin
        // stays in content_*; when it has no rules, ask content-service for the
        // deterministic substitute and grade that instead of inventing content.
        // Without a substitute the original 410 stands.
        Long alternativeVersion = null;
        String alternativeCode = null;
        String alternativeReason = null;
        if (rules.isEmpty()) {
            SubstituteResolution substitute = resolveSubstitute(requestedCode, authorization);
            if (substitute != null) {
                List<Map<String, Object>> alt = rules(substitute.contentCode(), substitute.contentVersionId(), body.get("itemIds"));
                if (!alt.isEmpty()) {
                    rules = alt;
                    alternativeVersion = substitute.contentVersionId();
                    alternativeCode = substitute.contentCode();
                    alternativeReason = substitute.reasonCode();
                }
            }
        }
        if (rules.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.GONE, "assessment content is unavailable");
        }
        String sessionId = "asess_" + compactUuid();
        List<Map<String, Object>> items = rules.stream().map(this::learnerItem).toList();
        // Bank sessions pin the sealed bank facts: the numeric snapshot_id
        // carries the bank content version (BIGINT cannot hold snap_ strings)
        // while snapshot_hash carries the full bank digest, so no pin identity
        // is lost. Default sessions keep the frozen B25 constants.
        long pinEpoch = bank == null ? CONTENT_EPOCH : bank.contentEpoch();
        long pinSnapshotId = bank == null ? SNAPSHOT_ID : bank.contentVersionId();
        String pinSnapshotHash = bank == null ? SNAPSHOT_HASH : bank.snapshotHash();
        jdbc.update("""
                INSERT INTO b10_assessment_session
                    (session_id, principal_id, tenant_id, mode, status, content_code,
                     content_version_id, alternative_content_version_id, alternative_content_code,
                     alternative_reason_code, content_epoch, snapshot_id, snapshot_hash,
                     items_json, answers_json, state_version, attempt_count,
                     idempotency_key, started_at)
                VALUES (?, ?, ?, ?, 'IN_PROGRESS', ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', 1, 0, ?, CURRENT_TIMESTAMP(6))
                """, sessionId, principal.subject(), TENANT, mode, requestedCode,
                contentVersionId, alternativeVersion, alternativeCode, alternativeReason,
                pinEpoch, pinSnapshotId, pinSnapshotHash,
                json(items), idempotencyKey);
        Map<String, Object> response = envelope(sessionView(one(
                "SELECT * FROM b10_assessment_session WHERE session_id = ?", sessionId)));
        int saved = jdbc.update("""
                UPDATE assessment_idempotency SET response_json = ?
                 WHERE tenant_id = ? AND subject_id = ? AND operation = ? AND idempotency_key = ?
                """, json(response), TENANT, principal.subject(), SESSION_CREATE_OPERATION, idempotencyKey);
        if (saved != 1) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "assessment session creation response was not saved");
        }
        return response;
    }

    /**
     * Claims the idempotency key. A null return means this caller owns the claim.
     * A map is the replay of a session that won the same key.
     */
    private Map<String, Object> claimSessionCreate(Principal principal, String idempotencyKey, String requestDigest,
            Map<String, Object> body, String mode, String requestedCode, long contentVersionId) {
        int claimed = jdbc.update("""
                INSERT IGNORE INTO assessment_idempotency
                    (tenant_id, subject_id, operation, idempotency_key, request_digest, response_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6))
                """, TENANT, principal.subject(), SESSION_CREATE_OPERATION, idempotencyKey,
                requestDigest, json(Map.of("status", "IN_PROGRESS")));
        if (claimed != 0) return null;
        Map<String, Object> raced = one("""
                SELECT * FROM b10_assessment_session
                 WHERE tenant_id = ? AND principal_id = ? AND idempotency_key = ?
                 FOR UPDATE
                """, TENANT, principal.subject(), idempotencyKey);
        if (raced == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "assessment session creation is still processing");
        }
        return replaySessionCreation(principal.subject(), idempotencyKey, requestDigest,
                body, mode, requestedCode, contentVersionId, raced);
    }

    private Map<String, Object> replaySessionCreation(String subject, String key, String requestDigest,
            Map<String, Object> body, String mode, String requestedCode, long contentVersionId, Map<String, Object> session) {
        // Duplicate INSERT IGNORE may hold a shared claim lock. Keep this a shared
        // current read so concurrent replays do not deadlock on a lock upgrade.
        Map<String, Object> claim = one("""
                SELECT request_digest, response_json FROM assessment_idempotency
                 WHERE tenant_id = ? AND subject_id = ? AND operation = ? AND idempotency_key = ?
                 FOR SHARE
                """, TENANT, subject, SESSION_CREATE_OPERATION, key);
        if (claim == null) {
            // V4 sessions have no request digest. Keep their normal replay path,
            // but refuse fields that cannot be checked against their saved pin.
            if (!Set.of("contentCode", "contentVersionId", "mode", "itemIds", "clientSessionRef")
                    .containsAll(body.keySet())
                    || !requestedCode.equals(text(session.get("content_code")))
                    || !mode.equals(text(session.get("mode")))
                    || contentVersionId != number(session.get("content_version_id"))
                    || body.containsKey("itemIds")
                    || body.containsKey("clientSessionRef")
                        && !key.equals(text(body.get("clientSessionRef")))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Idempotency-Key was reused with a different assessment session request");
            }
            return envelope(sessionView(session));
        }
        if (!requestDigest.equals(text(claim.get("request_digest")))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Idempotency-Key was reused with a different assessment session request");
        }
        Object raw = claim.get("response_json");
        Object parsed = parseJson(raw instanceof byte[] bytes ? new String(bytes, StandardCharsets.UTF_8) : raw,
                Map.of());
        if (!(parsed instanceof Map<?, ?> response) || !response.containsKey("data")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "assessment session creation is still processing");
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> storedResponse = (Map<String, Object>) response;
        return storedResponse;
    }

    @GetMapping("/sessions/{sessionId}")
    public Map<String, Object> readSession(Authentication authentication, @PathVariable String sessionId) {
        Principal principal = principal(authentication, "assessment.session.read");
        return envelope(sessionView(ownerSession(sessionId, principal.subject())));
    }

    @PostMapping("/sessions/{sessionId}/attempts")
    @Transactional
    public Map<String, Object> submitAttempt(
            Authentication authentication,
            @PathVariable String sessionId,
            @RequestBody Map<String, Object> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        Principal principal = principal(authentication, "assessment.session.write");
        requireKey(idempotencyKey);
        Map<String, Object> session = ownerSession(sessionId, principal.subject());
        String submissionId = text(body.get("submissionId"));
        if (submissionId.isBlank()) bad("submissionId is required");
        List<Map<String, Object>> submissions = objectList(body.get("items"));
        if (submissions.isEmpty()) bad("items is required");
        String requestDigest = sha256(json(body));
        Map<String, Object> idempotentAttempt = claimAttemptIdempotency(principal.subject(), idempotencyKey, requestDigest);
        if (idempotentAttempt != null) return envelope(attemptView(idempotentAttempt));
        Map<String, Object> duplicate = one("""
                SELECT * FROM b10_assessment_attempt
                 WHERE session_id = ? AND submission_id = ? AND principal_id = ?
                """, sessionId, submissionId, principal.subject());
        if (duplicate != null) {
            if (!sha256(json(submissions)).equals(text(duplicate.get("submission_digest")))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "submissionId was reused with a different answer");
            }
            Map<String, Object> view = attemptView(duplicate);
            saveAttemptIdempotency(principal.subject(), idempotencyKey, requestDigest, text(duplicate.get("attempt_id")));
            return envelope(view);
        }
        long expectedStateVersion = positiveLong(body.get("expectedStateVersion"), 1L);
        long stateVersion = longValue(session.get("state_version"), 1L);
        if (expectedStateVersion != stateVersion) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "assessment state version is stale");
        }
        // Grading follows the fulfilled substitute when the requested pin was
        // unavailable (P1R decision 7B); otherwise the requested pin itself.
        Object altVersion = session.get("alternative_content_version_id");
        Object altCode = session.get("alternative_content_code");
        String gradingCode = altVersion == null ? text(session.get("content_code"), CONTENT_CODE) : text(altCode, CONTENT_CODE);
        long gradingVersion = altVersion == null
                ? longValue(session.get("content_version_id"), DEFAULT_CONTENT_VERSION)
                : ((Number) altVersion).longValue();
        List<Map<String, Object>> rules = rules(gradingCode, gradingVersion, null);
        if (rules.isEmpty() && BankPracticeRuleProvider.BANK_CONTENT_CODE.equals(gradingCode)) {
            BankPracticeRuleProvider.BankRules bank = bankRules(gradingCode, gradingVersion, contextBearer());
            if (bank != null) rules = bank.rows();
        }
        Map<Long, Map<String, Object>> ruleById = new LinkedHashMap<>();
        for (Map<String, Object> rule : rules) ruleById.put(numericItemId(text(rule.get("item_id"))), rule);
        ObjectNode answers = objectAnswers(session.get("answers_json"));
        int correct = 0;
        int scored = 0;
        List<String> mistakes = new ArrayList<>();
        for (Map<String, Object> submission : submissions) {
            // P1-LIVE-010: FNV-64 itemIds exceed the JS safe-integer range, so web
            // clients cannot echo them back exactly. Accept the stable string
            // itemCode as well (same dual-matching idiom as the rules filter).
            long itemId = positiveLong(submission.get("itemId"), 0L);
            Map<String, Object> rule = ruleById.get(itemId);
            String itemCode = text(submission.get("itemCode"), "");
            if (rule == null && !itemCode.isBlank()) {
                for (Map<String, Object> candidate : rules) {
                    if (text(candidate.get("item_id")).equals(itemCode)) {
                        rule = candidate;
                        itemId = numericItemId(itemCode);
                        break;
                    }
                }
            }
            if (rule == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "assessment item is unavailable");
            String selected = answerValue(submission.get("response"));
            answers.put(String.valueOf(itemId), selected);
            scored++;
            if (isCorrect(rule.get("answer_rule_json"), selected)) correct++;
            else mistakes.add(text(rule.get("item_id")));
        }
        String submissionDigest = sha256(json(submissions));
        int attemptVersion = (int) number(oneValue("SELECT COALESCE(MAX(attempt_version), 0) + 1 FROM b10_assessment_attempt WHERE session_id = ?", sessionId));
        String attemptId = "aatm_" + compactUuid();
        boolean exactPack = grammarReadingPack(session);
        String scoreBucket = exactPack
                ? GrammarReadingPack.score(correct, scored)
                : correct == scored ? "FULL" : correct == 0 ? "ZERO" : "PARTIAL";
        String reportId = "rpt_" + compactUuid();
        Map<String, String> answerMap = readAnswers(answers);
        // Mistake and score totals cover the session's own items: unanswered
        // session items count as mistakes, but rules outside this session
        // (e.g. the rest of the bank for a subset practice) never do.
        List<Map<String, Object>> sessionRules = sessionRules(session, rules);
        List<String> allMistakes = sessionRules.stream()
                .filter(rule -> !isCorrect(rule.get("answer_rule_json"), answerMap.get(String.valueOf(numericItemId(text(rule.get("item_id")))))))
                .map(rule -> text(rule.get("item_id"))).toList();
        int total = sessionRules.size();
        int totalCorrect = total - allMistakes.size();
        String totalScoreBucket = exactPack
                ? GrammarReadingPack.score(totalCorrect, total)
                : totalCorrect == total ? "FULL" : totalCorrect == 0 ? "ZERO" : "PARTIAL";
        jdbc.update("""
                INSERT INTO b10_assessment_attempt
                    (attempt_id, session_id, principal_id, tenant_id, attempt_version,
                     submission_id, status, item_count, submission_digest, score_bucket,
                     mistake_codes_json, report_id)
                VALUES (?, ?, ?, ?, ?, ?, 'ASSESSED', ?, ?, ?, ?, ?)
                """, attemptId, sessionId, principal.subject(), TENANT, attemptVersion,
                submissionId, scored, submissionDigest, scoreBucket, json(allMistakes), reportId);
        Map<String, Object> sessionForPin = session;
        jdbc.update("""
                INSERT INTO b10_assessment_report
                    (report_id, attempt_id, session_id, principal_id, tenant_id,
                     report_version, status, score_bucket, mistake_codes_json,
                     mastery_signal, pin_json, generated_at)
                VALUES (?, ?, ?, ?, ?, 1, 'READY', ?, ?, ?, ?, CURRENT_TIMESTAMP(6))
                """, reportId, attemptId, sessionId, principal.subject(), TENANT,
                totalScoreBucket, json(allMistakes), allMistakes.isEmpty() ? "MASTERED" : "RETRY",
                json(pin(sessionForPin)));
        // P1R decision 5A: emit canonical learning facts atomically with grading.
        // Per-item assessed events plus one report-ready event go to the durable
        // outbox in the same transaction; no raw answers, keys or rule text leave.
        emitAssessedEvents(principal.subject(), session, gradingCode, gradingVersion,
                attemptId, reportId, submissionId, sessionRules, mistakes, totalScoreBucket,
                total, totalCorrect, allMistakes.size());
        // M5-009: persist wrong-answer mistake facts so the D0/D1/D7 delay
        // machine and variant repair have durable state to drive. B10 items
        // are questions, so questionId mirrors itemId; the rule engine does
        // not classify errors, hence UNCLASSIFIED (its own term elsewhere).
        // allMistakes (not just submitted) so unanswered items count too.
        recordMistakes(principal.subject(), allMistakes, answerMap, gradingCode, gradingVersion);
        String nextStatus = allMistakes.isEmpty() || answerMap.size() >= total ? "ASSESSED" : "IN_PROGRESS";
        jdbc.update("""
                UPDATE b10_assessment_session
                   SET answers_json = ?, state_version = state_version + 1,
                       attempt_count = attempt_count + 1, last_attempt_id = ?, last_report_id = ?, status = ?,
                       updated_at = CURRENT_TIMESTAMP(6)
                 WHERE session_id = ? AND principal_id = ? AND tenant_id = ?
                """, json(answers), attemptId, reportId, nextStatus, sessionId, principal.subject(), TENANT);
        Map<String, Object> view = attemptView(one("SELECT * FROM b10_assessment_attempt WHERE attempt_id = ?", attemptId));
        saveAttemptIdempotency(principal.subject(), idempotencyKey, requestDigest, attemptId);
        return envelope(view);
    }

    /**
     * M5-009 variant-issuing + D0/D1/D7 delay machine, HTTP-wired.
     * Mistakes are server-derived facts from grading; the endpoints only move
     * them through verify/variant transitions. All writes are idempotent on
     * the caller's key via the shared attempt idempotency record.
     */
    @GetMapping("/mistakes")
    public Map<String, Object> listMistakes(Authentication authentication) {
        Principal principal = principal(authentication, "assessment.session.read");
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT * FROM assessment_mistake WHERE tenant_id = ? AND subject_id = ?
                 ORDER BY mistake_id
                """, TENANT, principal.subject());
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> row : rows) items.add(mistakeView(restoreMistake(row)));
        return envelope(Map.of("items", items, "count", items.size()));
    }

    @PostMapping("/mistakes/{mistakeId}/verify")
    @Transactional
    public Map<String, Object> verifyMistake(
            Authentication authentication,
            @PathVariable long mistakeId,
            @RequestBody Map<String, Object> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        Principal principal = principal(authentication, "assessment.session.write");
        requireKey(idempotencyKey);
        boolean correct = "CORRECT".equals(upperText(body.get("outcome"), ""));
        if (!correct && !"WRONG".equals(upperText(body.get("outcome"), ""))) bad("outcome must be CORRECT or WRONG");
        String requestDigest = mistakeRequestDigest(mistakeId, body);
        Map<String, Object> replay = claimMistakeIdempotency(principal.subject(), "B10_MISTAKE_VERIFY",
                idempotencyKey, requestDigest);
        if (replay != null) return replay;
        AssessmentMistake mistake = ownedMistake(mistakeId, principal.subject());
        Instant now = Instant.now();
        try {
            if (correct) {
                switch (mistake.mistakeStatus()) {
                    case PENDING_RETRY, REOPENED -> mistake.markD0Corrected(now);
                    case DELAY_VERIFY_D1 -> mistake.markD1Passed(now);
                    case DELAY_VERIFY_D7 -> mistake.markD7Passed(now);
                    case MASTERED -> throw new ResponseStatusException(HttpStatus.CONFLICT, "mistake is already mastered");
                }
            } else {
                mistake.mergeWrong(now, mistake.errorCategory());
            }
        } catch (com.englishflow.assessment.domain.AssessmentDomainException state) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, state.getMessage());
        }
        saveMistake(mistake);
        Map<String, Object> response = envelope(mistakeView(mistake));
        saveMistakeIdempotency(principal.subject(), "B10_MISTAKE_VERIFY", idempotencyKey, response);
        return response;
    }

    @PostMapping("/mistakes/{mistakeId}/variant")
    @Transactional
    public Map<String, Object> issueVariant(
            Authentication authentication,
            @PathVariable long mistakeId,
            @RequestBody Map<String, Object> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        Principal principal = principal(authentication, "assessment.session.write");
        requireKey(idempotencyKey);
        long variantItemId = positiveLong(body.get("variantItemId"), 0L);
        String requestDigest = mistakeRequestDigest(mistakeId, body);
        Map<String, Object> replay = claimMistakeIdempotency(principal.subject(), "B10_MISTAKE_VARIANT",
                idempotencyKey, requestDigest);
        if (replay != null) return replay;
        AssessmentMistake mistake = ownedMistake(mistakeId, principal.subject());
        try {
            mistake.registerVariant(variantItemId, Instant.now());
        } catch (com.englishflow.assessment.domain.AssessmentDomainException invalid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, invalid.getMessage());
        }
        saveMistake(mistake);
        Map<String, Object> response = envelope(mistakeView(mistake));
        saveMistakeIdempotency(principal.subject(), "B10_MISTAKE_VARIANT", idempotencyKey, response);
        return response;
    }

    private void recordMistakes(String subject, List<String> codes, Map<String, String> answerMap,
            String gradingCode, long gradingVersion) {
        String ruleVersion = (gradingCode + ":v" + gradingVersion).trim();
        if (ruleVersion.length() > 128) ruleVersion = ruleVersion.substring(0, 128);
        Instant now = Instant.now();
        for (String code : codes) {
            long itemId = numericItemId(code);
            if (itemId < 1) continue;
            Map<String, Object> row = one("SELECT * FROM assessment_mistake WHERE tenant_id = ? AND subject_id = ? AND item_id = ?",
                    TENANT, subject, itemId);
            AssessmentMistake mistake;
            if (row == null) {
                long nextId = number(oneValue("SELECT COALESCE(MAX(mistake_id), 0) + 1 FROM assessment_mistake"), 1L);
                mistake = new AssessmentMistake(nextId, AssessmentPrincipal.authenticated(subject, TENANT),
                        itemId, itemId, "UNCLASSIFIED", ruleVersion, sha256(answerMap.getOrDefault(code, "")), now);
            } else {
                mistake = restoreMistake(row);
                mistake.mergeWrong(now, mistake.errorCategory());
            }
            saveMistake(mistake);
        }
    }

    private AssessmentMistake ownedMistake(long mistakeId, String subject) {
        Map<String, Object> row = one("SELECT * FROM assessment_mistake WHERE mistake_id = ? AND tenant_id = ? AND subject_id = ? FOR UPDATE",
                mistakeId, TENANT, subject);
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "assessment mistake is unavailable");
        return restoreMistake(row);
    }

    private AssessmentMistake restoreMistake(Map<String, Object> row) {
        try {
            return AssessmentMistake.restore(number(row.get("mistake_id")),
                    AssessmentPrincipal.authenticated(text(row.get("subject_id")), text(row.get("tenant_id"), TENANT)),
                    number(row.get("item_id")), number(row.get("question_id")), text(row.get("error_category")),
                    text(row.get("rule_version")), text(row.get("answer_hash")), number(row.get("wrong_count"), 1),
                    AssessmentMistake.MistakeStatus.valueOf(text(row.get("mistake_status"))),
                    AssessmentMistake.MasteryStatus.valueOf(text(row.get("mastery_status"))),
                    instantOf(row.get("first_error_at")), instantOf(row.get("last_error_at")), instantOf(row.get("next_action_at")),
                    readTrace(text(row.get("reason_trace_json"))));
        } catch (com.englishflow.assessment.domain.AssessmentDomainException corrupt) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "stored mistake fact is unreadable");
        }
    }

    private void saveMistake(AssessmentMistake mistake) {
        jdbc.update("""
                INSERT INTO assessment_mistake
                    (mistake_id, subject_id, tenant_id, item_id, question_id, error_category, rule_version, answer_hash,
                     wrong_count, mistake_status, mastery_status, first_error_at, last_error_at, next_action_at, reason_trace_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE answer_hash = VALUES(answer_hash), wrong_count = VALUES(wrong_count),
                    mistake_status = VALUES(mistake_status), mastery_status = VALUES(mastery_status),
                    last_error_at = VALUES(last_error_at), next_action_at = VALUES(next_action_at),
                    reason_trace_json = VALUES(reason_trace_json)
                """, mistake.mistakeId(), mistake.ownerSubjectId(), mistake.tenantId(), mistake.itemId(), mistake.questionId(),
                mistake.errorCategory(), mistake.ruleVersion(), mistake.answerHash(), mistake.wrongCount(),
                mistake.mistakeStatus().name(), mistake.masteryStatus().name(),
                Timestamp.from(mistake.firstErrorAt()), Timestamp.from(mistake.lastErrorAt()), Timestamp.from(mistake.nextActionAt()),
                json(mistake.reasonTrace()));
    }

    private Map<String, Object> mistakeView(AssessmentMistake mistake) {
        Map<String, Object> view = new LinkedHashMap<>(mistake.learnerView());
        view.put("tenantId", mistake.tenantId());
        return view;
    }

    private static Instant instantOf(Object value) {
        if (value instanceof Timestamp timestamp) return timestamp.toInstant();
        if (value instanceof java.time.LocalDateTime localDateTime) {
            return localDateTime.toInstant(java.time.ZoneOffset.UTC);
        }
        return Instant.parse(String.valueOf(value));
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> readTrace(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        try {
            Object parsed = mapper.readValue(raw, Object.class);
            if (parsed instanceof List<?> list) return (List<Map<String, Object>>) list;
            return List.of();
        } catch (JacksonException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "stored mistake fact is unreadable");
        }
    }

    @PutMapping("/sessions/{sessionId}/attempts/{attemptId}/checkpoint")
    @Transactional
    public Map<String, Object> saveCheckpoint(
            Authentication authentication,
            @PathVariable String sessionId,
            @PathVariable String attemptId,
            @RequestBody Map<String, Object> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        Principal principal = principal(authentication, "assessment.session.write");
        requireKey(idempotencyKey);
        Map<String, Object> checkpointSession = ownerSession(sessionId, principal.subject());
        if ("CONTENT_OFFLINE".equals(text(checkpointSession.get("alternative_reason_code")))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, PracticeCheckpoint.OFFLINE_EXIT);
        }
        Map<String, Object> attempt = one("""
                SELECT * FROM b10_assessment_attempt
                 WHERE attempt_id = ? AND session_id = ? AND principal_id = ? AND tenant_id = ?
                """, attemptId, sessionId, principal.subject(), TENANT);
        if (attempt == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "assessment attempt not found");
        long version = positiveLong(body.get("checkpointVersion"), 1L);
        int receivedAnswers = jsonSize(checkpointSession.get("answers_json"), false);
        int cursor = PracticeCheckpoint.clampCursor(receivedAnswers, (int) Math.max(0L, longValue(body.get("itemCursor"), 0L)));
        String digest = text(body.get("checkpointDigest"));
        if (digest.isBlank()) bad("checkpointDigest is required");
        List<Object> completed = valueList(body.get("completedItemIds"));
        jdbc.update("""
                INSERT INTO b10_assessment_checkpoint
                    (attempt_id, session_id, principal_id, tenant_id, checkpoint_version,
                     item_cursor, completed_item_ids_json, checkpoint_digest, saved_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6))
                ON DUPLICATE KEY UPDATE checkpoint_digest = VALUES(checkpoint_digest),
                    item_cursor = VALUES(item_cursor), completed_item_ids_json = VALUES(completed_item_ids_json)
                """, attemptId, sessionId, principal.subject(), TENANT, version,
                cursor, json(completed), digest);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("attemptId", attemptId);
        data.put("checkpointVersion", version);
        data.put("itemCursor", cursor);
        data.put("checkpointDigest", digest);
        data.put("savedAt", Instant.now().toString());
        return envelope(data);
    }

    @GetMapping("/reports/{reportId}")
    public Map<String, Object> readReport(Authentication authentication, @PathVariable String reportId) {
        Principal principal = principal(authentication, "assessment.session.read");
        Map<String, Object> row = one("""
                SELECT * FROM b10_assessment_report
                 WHERE report_id = ? AND principal_id = ? AND tenant_id = ?
                """, reportId, principal.subject(), TENANT);
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "assessment report not found");
        return envelope(reportView(row));
    }

    private Map<String, Object> sessionView(Map<String, Object> row) {
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "assessment session not found");
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("sessionId", row.get("session_id"));
        data.put("status", row.get("status"));
        data.put("mode", row.get("mode"));
        data.put("pin", pin(row));
        boolean contentOffline = "CONTENT_OFFLINE".equals(text(row.get("alternative_reason_code")));
        PracticeCheckpoint.Resume resume = PracticeCheckpoint.resume(jsonSize(row.get("answers_json"), false), !contentOffline);
        data.put("items", resume.stopped() ? List.of() : parseJson(row.get("items_json"), List.of()));
        data.put("resumeIndex", resume.index());
        data.put("resumeCopy", resume.copy());
        data.put("contentOffline", resume.stopped());
        if (resume.stopped()) data.put("exitCopy", resume.copy());
        data.put("attemptCount", number(row.get("attempt_count")));
        data.put("stateVersion", number(row.get("state_version")));
        String lastAttemptId = text(row.get("last_attempt_id"));
        data.put("lastAttemptId", lastAttemptId.isBlank() ? null : lastAttemptId);
        data.put("startedAt", timestamp(row.get("started_at")));
        data.put("expiresAt", timestamp(row.get("expires_at")));
        String reportId = text(row.get("last_report_id"));
        if (!reportId.isBlank()) data.put("reportId", reportId);
        return data;
    }

    private Map<String, Object> attemptView(Map<String, Object> row) {
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "assessment attempt not found");
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("attemptId", row.get("attempt_id"));
        data.put("sessionId", row.get("session_id"));
        data.put("attemptVersion", number(row.get("attempt_version")));
        data.put("status", row.get("status"));
        data.put("itemCount", number(row.get("item_count")));
        data.put("submissionDigest", row.get("submission_digest"));
        data.put("scoreBucket", row.get("score_bucket"));
        Map<String, Object> sessionRow = one("SELECT * FROM b10_assessment_session WHERE session_id = ?", row.get("session_id"));
        data.put("pin", pin(sessionRow));
        int received = jsonSize(sessionRow == null ? null : sessionRow.get("answers_json"), false);
        int total = jsonSize(sessionRow == null ? null : sessionRow.get("items_json"), true);
        if (total < 1) total = (int) number(row.get("item_count"));
        data.putAll(PracticeFeedback.of(text(row.get("score_bucket")), received, total).ordered());
        data.put("assessmentVersion", "B10_RULES_2026_08_26");
        data.put("createdAt", timestamp(row.get("created_at")));
        data.put("assessedAt", timestamp(row.get("created_at")));
        String reportId = text(row.get("report_id"));
        if (!reportId.isBlank()) data.put("reportId", reportId);
        return data;
    }

    private Map<String, Object> reportView(Map<String, Object> row) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("reportId", row.get("report_id"));
        data.put("attemptId", row.get("attempt_id"));
        data.put("reportVersion", number(row.get("report_version")));
        data.put("status", row.get("status"));
        data.put("scoreBucket", row.get("score_bucket"));
        data.put("mistakeCodes", parseJson(row.get("mistake_codes_json"), List.of()));
        data.put("masterySignal", row.get("mastery_signal"));
        data.put("pin", parseJson(row.get("pin_json"), Map.of()));
        data.put("generatedAt", timestamp(row.get("generated_at")));
        data.put("replayable", true);
        return data;
    }

    /**
     * Bank rules seam for the B3 practice loop. Overridable in tests; the
     * production path re-reads the sealed bank on every call and returns null
     * (keeping the caller's 410/404 behavior) on any failure.
     */
    BankPracticeRuleProvider.BankRules bankRules(String contentCode, long contentVersionId,
                                                 String authorization) {
        return bankRules.fetch(contentCode, contentVersionId, authorization);
    }

    private static String contextBearer() {
        org.springframework.security.core.Authentication authentication =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken jwt
                && jwt.isAuthenticated() && jwt.getToken().getTokenValue() != null) {
            return "Bearer " + jwt.getToken().getTokenValue();
        }
        return null;
    }

    private List<Map<String, Object>> rules(String contentCode, long contentVersionId, Object requestedItemIds) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT item_id, content_version_id, prompt, options_json, dimension,
                       difficulty, answer_rule_json
                  FROM b25_assessment_item_rule
                 WHERE content_code = ? AND content_version_id = ? AND active = TRUE
                 ORDER BY item_id
                """, contentCode, contentVersionId);
        return filterByItemIds(rows, requestedItemIds);
    }

    private List<Map<String, Object>> sessionRules(Map<String, Object> session,
                                                     List<Map<String, Object>> rules) {
        Object raw = parseJson(session.get("items_json"), List.of());
        if (!(raw instanceof List<?> items) || items.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "assessment session items are unreadable");
        }
        java.util.Set<String> keys = new java.util.HashSet<>();
        for (Object entry : items) {
            if (entry instanceof Map<?, ?> item) {
                keys.add(String.valueOf(item.get("itemId")));
                if (item.get("itemCode") != null) keys.add(String.valueOf(item.get("itemCode")));
            }
        }
        List<Map<String, Object>> scoped = rules.stream()
                .filter(rule -> keys.contains(String.valueOf(numericItemId(text(rule.get("item_id")))))
                        || keys.contains(text(rule.get("item_id"))))
                .toList();
        if (scoped.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "assessment session items do not match their grading rules");
        }
        return scoped;
    }

    private static List<Map<String, Object>> filterByItemIds(List<Map<String, Object>> rows,
                                                             Object requestedItemIds) {
        List<Object> requested = valueList(requestedItemIds);
        if (requested.isEmpty()) return rows;
        return rows.stream().filter(row -> {
            long numeric = numericItemId(text(row.get("item_id")));
            String code = text(row.get("item_id"));
            return requested.stream().anyMatch(value -> String.valueOf(value).equals(String.valueOf(numeric)) || String.valueOf(value).equals(code));
        }).toList();
    }

    private Map<String, Object> learnerItem(Map<String, Object> row) {
        Map<String, Object> item = new LinkedHashMap<>();
        String code = text(row.get("item_id"));
        item.put("itemId", numericItemId(code));
        item.put("itemCode", code);
        item.put("itemType", itemType(row.get("dimension")));
        item.put("stem", text(row.get("prompt")));
        item.put("options", learnerOptions(row.get("options_json")));
        item.put("displayOrder", 0);
        return item;
    }

    private List<Map<String, Object>> learnerOptions(Object raw) {
        Object value = parseJson(raw, List.of());
        if (!(value instanceof List<?> list)) return List.of();
        return list.stream().filter(Map.class::isInstance).map(entry -> {
            @SuppressWarnings("unchecked") Map<String, Object> source = (Map<String, Object>) entry;
            Map<String, Object> option = new LinkedHashMap<>();
            option.put("optionId", lowerText(source.get("key"), lowerText(source.get("optionId"), "option")));
            option.put("label", text(source.get("text"), text(source.get("label"))));
            return option;
        }).toList();
    }

    private Map<String, Object> pin(Map<String, Object> row) {
        Map<String, Object> pin = new LinkedHashMap<>();
        pin.put("contentCode", text(row == null ? null : row.get("content_code"), CONTENT_CODE));
        pin.put("contentVersionId", number(row == null ? null : row.get("content_version_id"), DEFAULT_CONTENT_VERSION));
        pin.put("contentEpoch", number(row == null ? null : row.get("content_epoch"), CONTENT_EPOCH));
        pin.put("snapshotId", number(row == null ? null : row.get("snapshot_id"), SNAPSHOT_ID));
        pin.put("snapshotHash", text(row == null ? null : row.get("snapshot_hash"), SNAPSHOT_HASH));
        pin.put("pinStatus", "PINNED");
        pin.put("pinnedAt", Instant.now().toString());
        Object altVersion = row == null ? null : row.get("alternative_content_version_id");
        if (altVersion != null) {
            pin.put("pinStatus", "SUBSTITUTED");
            pin.put("alternativeContentVersionId", ((Number) altVersion).longValue());
            pin.put("alternativeContentCode", text(row.get("alternative_content_code"), CONTENT_CODE));
            pin.put("alternativeReasonCode", text(row.get("alternative_reason_code"), "PIN_UNAVAILABLE"));
        }
        return pin;
    }

    /**
     * P1R decision 7B: assessment assembles the session pin by asking
     * content-service for the deterministic substitute. The learner's own JWT is
     * forwarded so content evaluates the same subject, tenant and rights. Any
     * failure or empty resolution degrades to null and the caller keeps 410 —
     * never invents content, never fails a healthy pin path.
     */
    private record SubstituteResolution(String contentCode, long contentVersionId, String reasonCode) {
    }

    private SubstituteResolution resolveSubstitute(String unavailableCode, String authorization) {
        try {
            if (authorization == null || authorization.isBlank()) return null;
            String url = contentBaseUrl.replaceAll("/$", "")
                    + "/api/v1/content/learner/substitute?code="
                    + java.net.URLEncoder.encode(unavailableCode, java.nio.charset.StandardCharsets.UTF_8)
                    + "&reason=PIN_UNAVAILABLE";
            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(url))
                    .header("Accept", "application/json")
                    .header("Authorization", authorization.trim())
                    .GET()
                    .timeout(java.time.Duration.ofSeconds(5))
                    .build();
            java.net.http.HttpResponse<String> response = java.net.http.HttpClient.newHttpClient()
                    .send(request, java.net.http.HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) return null;
            Map<String, Object> body = mapper.readValue(response.body(), Map.class);
            Object data = body.get("data");
            if (!(data instanceof Map<?, ?> dataMap)) return null;
            Object substitute = dataMap.get("substitute");
            if (!(substitute instanceof Map<?, ?> sub)) return null;
            Object code = sub.get("contentCode");
            Object version = sub.get("contentVersionId");
            if (code == null || !(version instanceof Number number)) return null;
            Object reason = dataMap.get("reasonCode");
            return new SubstituteResolution(String.valueOf(code), number.longValue(),
                    reason == null ? "PIN_UNAVAILABLE" : String.valueOf(reason));
        } catch (Exception ignored) {
            return null;
        }
    }

    private void emitAssessedEvents(String subject, Map<String, Object> session, String gradingCode,
            long gradingVersion, String attemptId, String reportId, String submissionId,
            List<Map<String, Object>> rules, List<String> mistakes, String totalScoreBucket,
            int total, int totalCorrect, int totalMistakes) {
        Instant now = Instant.now();
        String policyDigest = sha256("objective-assessment-v1");
        Map<String, Object> contentPin = new LinkedHashMap<>();
        contentPin.put("contentVersionId", gradingVersion);
        contentPin.put("contentEpoch", number(session.get("content_epoch"), CONTENT_EPOCH));
        // The contract snapshotId is a snap_-prefixed string; derive it
        // deterministically from the numeric session snapshot.
        contentPin.put("snapshotId", "snap_assessment_" + text(session.get("snapshot_id"), String.valueOf(SNAPSHOT_ID)));
        contentPin.put("snapshotHash", text(session.get("snapshot_hash"), SNAPSHOT_HASH));
        for (Map<String, Object> rule : rules) {
            String ruleItemId = text(rule.get("item_id"));
            boolean itemCorrect = !mistakes.contains(ruleItemId);
            String itemAssessmentId = "aitm_" + compactUuid();
            String logical = "li_" + ruleItemId.replaceAll("[^A-Za-z0-9._:-]", "_");
            while (logical.length() < 11) logical = logical + "0";
            Map<String, Object> rulePin = new LinkedHashMap<>();
            rulePin.put("answerRuleSetVersion", "B10_RULES_2026_08_26");
            rulePin.put("answerRuleVersion", "v1");
            rulePin.put("ruleDigest", sha256(json(rule.get("answer_rule_json"))));
            rulePin.put("completionRuleVersion", "v1");
            rulePin.put("assessmentVersion", "B10_RULES_2026_08_26");
            Map<String, Object> reportPin = new LinkedHashMap<>();
            reportPin.put("reportId", reportId);
            reportPin.put("reportVersion", 1);
            reportPin.put("reportRuleVersion", "v1");
            reportPin.put("reportStatus", "READY");
            reportPin.put("reportDigest", sha256(reportId + totalScoreBucket));
            reportPin.put("asOf", now.toString());
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("tenantId", TENANT);
            payload.put("principalId", subject);
            payload.put("itemAssessmentId", itemAssessmentId);
            payload.put("attemptId", attemptId);
            payload.put("sessionId", text(session.get("session_id"), ""));
            payload.put("logicalItemId", logical);
            payload.put("contentPin", contentPin);
            payload.put("rulePin", rulePin);
            payload.put("reportPin", reportPin);
            payload.put("objectivePolicyPin", Map.of("practiceType", "OBJECTIVE_ASSESSMENT",
                    "objectiveExpected", true, "policyVersion", "v1", "policyDigest", policyDigest));
            payload.put("objectiveOutcome", itemCorrect ? "CORRECT_VERIFIED" : "INCORRECT");
            payload.put("objectiveNumerator", itemCorrect ? 1 : 0);
            payload.put("objectiveDenominator", 1);
            payload.put("objectiveCorrect", itemCorrect);
            payload.put("guessSignal", false);
            payload.put("semanticErrorCategory", "UNCLASSIFIED");
            payload.put("mappingVersion", "v1");
            payload.put("verificationStage", "NONE");
            payload.put("reasonTrace", List.of(Map.of("ruleCode", "B10_SCORE", "ruleVersion", "v1",
                    "category", "UNCLASSIFIED", "reasonCode", itemCorrect ? "FULL_MATCH" : "NO_MATCH",
                    "evidenceRef", "attempt:" + attemptId)));
            payload.put("outcomeDigest", sha256(itemAssessmentId + itemCorrect));
            payload.put("assessmentFactWatermark", "b10." + text(session.get("session_id"), ""));
            payload.put("assessedAt", now.toString());
            appendOutbox("assessment.item.assessed.v2", "assessment.event.v2", 2,
                    "assessment_item", itemAssessmentId, subject, submissionId, submissionId,
                    attemptId + ":" + itemAssessmentId, payload, now);
        }
        Map<String, Object> reportPayload = new LinkedHashMap<>();
        reportPayload.put("tenantId", TENANT);
        reportPayload.put("principalId", subject);
        reportPayload.put("reportId", reportId);
        reportPayload.put("attemptId", attemptId);
        reportPayload.put("sessionId", text(session.get("session_id"), ""));
        reportPayload.put("contentCode", gradingCode);
        reportPayload.put("contentVersionId", gradingVersion);
        reportPayload.put("scoreBucket", totalScoreBucket);
        reportPayload.put("totalItems", total);
        reportPayload.put("totalCorrect", totalCorrect);
        reportPayload.put("totalMistakes", totalMistakes);
        reportPayload.put("completedAt", now.toString());
        appendOutbox("learning.report.ready.v1", "learning.event.v1", 1,
                "learning_report", reportId, subject, submissionId, submissionId,
                reportId, reportPayload, now);
    }

    private void appendOutbox(String eventName, String schema, int version, String aggregateType,
            String aggregateId, String subject, String requestId, String traceId,
            String dedupeKey, Map<String, Object> payload, Instant now) {
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("eventId", UUID.randomUUID().toString());
        envelope.put("eventName", eventName);
        envelope.put("schema", schema);
        envelope.put("version", version);
        envelope.put("occurredAt", now.toString());
        envelope.put("aggregateType", aggregateType);
        envelope.put("aggregateId", aggregateId);
        envelope.put("actorId", subject);
        envelope.put("tenantId", TENANT);
        envelope.put("traceId", traceId);
        envelope.put("requestId", requestId);
        envelope.put("schemaVersion", schema);
        envelope.put("dedupeKey", dedupeKey);
        envelope.put("payload", payload);
        jdbc.update("""
                INSERT INTO assessment_outbox_event
                    (event_id, aggregate_id, event_name, schema_version, dedupe_key, payload_json,
                     status, attempt_count, available_at, created_at, occurred_at, request_id, trace_id)
                VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE dedupe_key = VALUES(dedupe_key)
                """, UUID.randomUUID().toString(), aggregateId, eventName, schema, dedupeKey,
                json(envelope), Timestamp.from(now), Timestamp.from(now), Timestamp.from(now), requestId, traceId);
    }

    private Map<String, Object> ownerSession(String sessionId, String subject) {        Map<String, Object> row = one("""
                SELECT * FROM b10_assessment_session
                 WHERE session_id = ? AND principal_id = ? AND tenant_id = ?
                """, sessionId, subject, TENANT);
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "assessment session not found");
        return row;
    }

    /** Claim the generic durable idempotency fact before scoring so retries do not create another attempt. */
    private Map<String, Object> claimAttemptIdempotency(String subject, String key, String requestDigest) {
        String operation = "B10_ATTEMPT_SUBMIT";
        int inserted = jdbc.update("""
                INSERT IGNORE INTO assessment_idempotency
                    (tenant_id, subject_id, operation, idempotency_key, request_digest, response_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6))
                """, TENANT, subject, operation, key, requestDigest, json(Map.of("status", "IN_PROGRESS")));
        if (inserted > 0) return null;
        Map<String, Object> existing = one("""
                SELECT request_digest, response_json FROM assessment_idempotency
                 WHERE tenant_id = ? AND subject_id = ? AND operation = ? AND idempotency_key = ?
                """, TENANT, subject, operation, key);
        if (existing == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "assessment idempotency claim is unavailable");
        if (!requestDigest.equals(text(existing.get("request_digest")))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Idempotency-Key was reused with a different assessment request");
        }
        String attemptId = storedAttemptId(existing.get("response_json"));
        if (attemptId.isBlank()) throw new ResponseStatusException(HttpStatus.CONFLICT, "assessment attempt is still being processed");
        Map<String, Object> attempt = one("""
                SELECT * FROM b10_assessment_attempt
                 WHERE attempt_id = ? AND principal_id = ? AND tenant_id = ?
                """, attemptId, subject, TENANT);
        if (attempt == null) throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "assessment idempotency response is missing");
        return attempt;
    }

    private void saveAttemptIdempotency(String subject, String key, String requestDigest, String attemptId) {
        jdbc.update("""
                UPDATE assessment_idempotency SET request_digest = ?, response_json = ?
                 WHERE tenant_id = ? AND subject_id = ? AND operation = ? AND idempotency_key = ?
                """, requestDigest, json(Map.of("attemptId", attemptId)), TENANT, subject, "B10_ATTEMPT_SUBMIT", key);
    }

    /** Claim, state update, and response snapshot commit in the same local transaction. */
    private Map<String, Object> claimMistakeIdempotency(String subject, String operation, String key,
                                                        String requestDigest) {
        int inserted = jdbc.update("""
                INSERT IGNORE INTO assessment_idempotency
                    (tenant_id, subject_id, operation, idempotency_key, request_digest, response_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6))
                """, TENANT, subject, operation, key, requestDigest, json(Map.of("status", "IN_PROGRESS")));
        if (inserted > 0) return null;
        Map<String, Object> existing = one("""
                SELECT request_digest, response_json FROM assessment_idempotency
                 WHERE tenant_id = ? AND subject_id = ? AND operation = ? AND idempotency_key = ?
                """, TENANT, subject, operation, key);
        if (existing == null || !requestDigest.equals(text(existing.get("request_digest")))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Idempotency-Key was reused with a different mistake request");
        }
        Object raw = existing.get("response_json");
        Object parsed = parseJson(raw instanceof byte[] bytes ? new String(bytes, StandardCharsets.UTF_8) : raw, null);
        if (!(parsed instanceof Map<?, ?> response) || !response.containsKey("data")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "mistake request is still being processed");
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> storedResponse = (Map<String, Object>) response;
        return storedResponse;
    }

    private void saveMistakeIdempotency(String subject, String operation, String key,
                                        Map<String, Object> response) {
        int updated = jdbc.update("""
                UPDATE assessment_idempotency SET response_json = ?
                 WHERE tenant_id = ? AND subject_id = ? AND operation = ? AND idempotency_key = ?
                """, json(response), TENANT, subject, operation, key);
        if (updated != 1) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "mistake idempotency response was not saved");
        }
    }

    private String mistakeRequestDigest(long mistakeId, Map<String, Object> body) {
        return sha256(mistakeId + "|" + json(canonicalValue(body)));
    }

    private Object canonicalValue(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> ordered = new TreeMap<>();
            map.forEach((key, child) -> ordered.put(String.valueOf(key), canonicalValue(child)));
            return ordered;
        }
        if (value instanceof List<?> list) return list.stream().map(this::canonicalValue).toList();
        return value;
    }

    private String storedAttemptId(Object raw) {
        try {
            JsonNode node = mapper.readTree(raw instanceof byte[] bytes ? new String(bytes, StandardCharsets.UTF_8) : String.valueOf(raw));
            return text(node.path("attemptId").asText());
        } catch (JacksonException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "assessment idempotency response is invalid", exception);
        }
    }

    private ObjectNode objectAnswers(Object raw) {
        ObjectNode result = mapper.createObjectNode();
        Object parsed = parseJson(raw, Map.of());
        if (parsed instanceof Map<?, ?> map) {
            map.forEach((key, value) -> result.set(String.valueOf(key), mapper.valueToTree(value)));
        }
        return result;
    }

    private Map<String, String> readAnswers(ObjectNode answers) {
        Map<String, String> result = new LinkedHashMap<>();
        for (Map.Entry<String, JsonNode> entry : answers.properties()) result.put(entry.getKey(), entry.getValue().asText(""));
        return result;
    }

    private String answerValue(Object raw) {
        if (raw instanceof Map<?, ?> map) {
            Object keys = map.get("selectedOptionKeys");
            if (keys instanceof List<?> list && !list.isEmpty()) return text(list.getFirst());
            return text(map.get("selectedOptionKey"), text(map.get("selectedKey"), text(map.get("text"))));
        }
        return text(raw);
    }

    private boolean isCorrect(Object rawRule, String selected) {
        // P1-LIVE-010: unanswered items (partial submissions) score as mistakes,
        // never NullPointerException. The caller passes null when the answer map
        // has no entry for a rule item.
        if (selected == null || selected.isBlank()) return false;
        JsonNode rule = mapper.readTree(text(rawRule, "{}"));
        JsonNode accepted = rule.get("acceptedKeys");
        if (accepted != null && accepted.isArray()) for (JsonNode item : accepted) if (selected.equals(item.asText())) return true;
        return selected.equals(rule.path("answer").asText()) || selected.equals(rule.path("correctKey").asText());
    }

    private List<Map<String, Object>> objectList(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        return list.stream().filter(Map.class::isInstance).map(entry -> {
            @SuppressWarnings("unchecked") Map<String, Object> row = (Map<String, Object>) entry;
            return row;
        }).toList();
    }

    private static List<Object> valueList(Object value) { return value instanceof List<?> list ? new ArrayList<>(list) : List.of(); }

    private int jsonSize(Object raw, boolean list) {
        Object parsed = parseJson(raw, list ? List.of() : Map.of());
        if (list && parsed instanceof List<?> values) return values.size();
        if (!list && parsed instanceof Map<?, ?> values) return values.size();
        return 0;
    }

    private Object parseJson(Object raw, Object fallback) {
        try { return raw == null ? fallback : mapper.readValue(String.valueOf(raw), Object.class); }
        catch (JacksonException ignored) { return fallback; }
    }

    private String json(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (JacksonException exception) { throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "assessment state cannot be serialized", exception); }
    }

    private boolean grammarReadingPack(Map<String, Object> session) {
        Object raw = parseJson(session.get("items_json"), List.of());
        if (!(raw instanceof List<?> items) || items.isEmpty()) return false;
        List<String> types = new ArrayList<>();
        for (Object entry : items) {
            if (entry instanceof Map<?, ?> item && item.get("itemType") != null) {
                types.add(String.valueOf(item.get("itemType")));
            }
        }
        return GrammarReadingPack.isExactPack(types);
    }

    private static String itemType(Object dimension) {
        String value = upperText(dimension, "VOCABULARY");
        return switch (value) {
            case "GRAMMAR", "BASIC_GRAMMAR" -> "GRAMMAR";
            case "SENTENCE" -> "SENTENCE";
            case "READING" -> "READING";
            case "LISTENING" -> "LISTENING";
            case "WRITING" -> "WRITING";
            default -> "VOCABULARY";
        };
    }

    private static long numericItemId(String code) {
        try { return Long.parseLong(code); }
        catch (NumberFormatException ignored) {
            long hash = 1469598103934665603L;
            for (byte value : code.getBytes(StandardCharsets.UTF_8)) hash = (hash ^ (value & 0xff)) * 1099511628211L;
            return hash & Long.MAX_VALUE;
        }
    }

    private static String sha256(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }

    private static String compactUuid() { return UUID.randomUUID().toString().replace("-", ""); }
    private static Map<String, Object> envelope(Object data) { return Map.of("data", data); }
    private static String timestamp(Object value) { return value == null ? null : value instanceof java.sql.Timestamp timestamp ? timestamp.toInstant().toString() : String.valueOf(value); }
    private static long number(Object value) { return number(value, 0L); }
    private static long number(Object value, long fallback) { return value instanceof Number number ? number.longValue() : fallback; }
    private static long longValue(Object value, long fallback) { try { return value == null ? fallback : Long.parseLong(String.valueOf(value)); } catch (NumberFormatException ignored) { return fallback; } }
    private static long positiveLong(Object value, long fallback) { long result = longValue(value, fallback); if (result <= 0) bad("positive numeric value is required"); return result; }
    private static int number(Object value, int fallback) { return (int) number(value, (long) fallback); }
    private static String text(Object value) { return text(value, ""); }
    private static String text(Object value, String fallback) { return value == null ? fallback : String.valueOf(value).trim().isBlank() ? fallback : String.valueOf(value).trim(); }
    private static String lowerText(Object value, String fallback) { return text(value, fallback).toLowerCase(java.util.Locale.ROOT); }
    private static String upperText(Object value, String fallback) { return text(value, fallback).toUpperCase(java.util.Locale.ROOT); }
    private static void requireKey(String key) { if (key == null || key.isBlank() || key.length() > 192) bad("Idempotency-Key is required"); }
    private static void bad(String message) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }

    private Map<String, Object> one(String sql, Object... args) { List<Map<String, Object>> rows = jdbc.queryForList(sql, args); return rows.isEmpty() ? null : rows.getFirst(); }
    private Object oneValue(String sql, Object... args) { List<Map<String, Object>> rows = jdbc.queryForList(sql, args); return rows.isEmpty() ? null : rows.getFirst().values().stream().findFirst().orElse(null); }

    private Principal principal(Authentication authentication, String permission) {
        return new Principal(AssessmentHttpPrincipals.require(authentication, permission).subject());
    }

    private record Principal(String subject) {}
}
