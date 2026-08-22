package com.englishflow.analytics;

import com.englishflow.analytics.adapter.memory.InMemoryAnalyticsProjectionStore;
import com.englishflow.analytics.application.AnalyticsQueryService;
import com.englishflow.analytics.application.AnalyticsRecomputeService;
import com.englishflow.analytics.application.AnalyticsWorkerService;
import com.englishflow.analytics.domain.AnalyticsEventAllowlist;
import com.englishflow.analytics.domain.AnalyticsEventEnvelope;
import com.englishflow.analytics.domain.AnalyticsErrorCode;
import com.englishflow.analytics.domain.AnalyticsIngestState;
import com.englishflow.analytics.domain.AnalyticsMetricVersions;
import com.englishflow.analytics.domain.AnalyticsQuery;
import com.englishflow.analytics.domain.AnalyticsQueryState;
import com.englishflow.analytics.domain.RecomputeRequest;
import com.englishflow.analytics.domain.RecomputeState;
import com.englishflow.analytics.domain.TenantScope;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Dependency-free B13-ANL-004 logic smoke. */
public final class B13AnalyticsSmoke {

    private B13AnalyticsSmoke() {
    }

    public static void main(String[] args) {
        TenantScope tenantA = new TenantScope("tenant-a");
        TenantScope tenantB = new TenantScope("tenant-b");
        InMemoryAnalyticsProjectionStore store = new InMemoryAnalyticsProjectionStore();
        AnalyticsWorkerService worker = new AnalyticsWorkerService(store);
        AnalyticsQueryService query = new AnalyticsQueryService(store);
        AnalyticsRecomputeService recompute = new AnalyticsRecomputeService(store);

        Map<String, Object> submitted = submittedEvent("attempt-1", "dedupe-1", "tenant-a", 5);
        AnalyticsEventEnvelope submittedEnvelope = AnalyticsEventEnvelope.fromTrustedMap(
                submitted, "assessment-service", tenantA.tenantId());
        require(worker.consume(submittedEnvelope).state() == AnalyticsIngestState.ACCEPTED,
                "first allowlisted event must be accepted");
        require(worker.consume(submittedEnvelope).state() == AnalyticsIngestState.DUPLICATE_IGNORED,
                "same dedupe key must be ignored");

        Map<String, Object> conflict = submittedEvent("attempt-1", "dedupe-1", "tenant-a", 6);
        require(worker.consume(AnalyticsEventEnvelope.fromTrustedMap(conflict,
                "assessment-service", tenantA.tenantId())).reasonCode() == AnalyticsErrorCode.DEDUPE_PAYLOAD_CONFLICT,
                "same dedupe key with a different payload must be rejected");

        Map<String, Object> rawPii = submittedEvent("attempt-pii", "dedupe-pii", "tenant-a", 1);
        payload(rawPii).put("email", "person@example.com");
        requireRejected(() -> AnalyticsEventEnvelope.fromTrustedMap(rawPii,
                "assessment-service", tenantA.tenantId()), AnalyticsErrorCode.RAW_PII_REJECTED);

        Map<String, Object> rawAnswer = submittedEvent("attempt-answer", "dedupe-answer", "tenant-a", 1);
        payload(rawAnswer).put("answerText", "private answer");
        requireRejected(() -> AnalyticsEventEnvelope.fromTrustedMap(rawAnswer,
                "assessment-service", tenantA.tenantId()), AnalyticsErrorCode.RAW_PII_REJECTED);

        Map<String, Object> rawAudio = submittedEvent("attempt-audio", "dedupe-audio", "tenant-a", 1);
        payload(rawAudio).put("rawAudio", "data:audio/wav;base64,AAAA");
        requireRejected(() -> AnalyticsEventEnvelope.fromTrustedMap(rawAudio,
                "assessment-service", tenantA.tenantId()), AnalyticsErrorCode.RAW_PII_REJECTED);

        Map<String, Object> paymentCredential = submittedEvent("attempt-payment", "dedupe-payment", "tenant-a", 1);
        payload(paymentCredential).put("paymentToken", "tok_private");
        requireRejected(() -> AnalyticsEventEnvelope.fromTrustedMap(paymentCredential,
                "assessment-service", tenantA.tenantId()), AnalyticsErrorCode.RAW_PII_REJECTED);

        Map<String, Object> tenantMismatch = submittedEvent("attempt-tenant", "dedupe-tenant", "tenant-b", 1);
        require(worker.consume(AnalyticsEventEnvelope.fromTrustedMap(tenantMismatch,
                "assessment-service", tenantA.tenantId())).reasonCode() == AnalyticsErrorCode.TENANT_SCOPE_INVALID,
                "payload tenant must match the verified tenant scope");

        Map<String, Object> unknown = submittedEvent("order-1", "order-dedupe", "tenant-a", 1);
        unknown.put("eventName", "order.created.v1");
        require(worker.consume(AnalyticsEventEnvelope.fromTrustedMap(unknown,
                "commerce-service", tenantA.tenantId())).reasonCode() == AnalyticsErrorCode.EVENT_NOT_ALLOWLISTED,
                "commerce events must remain outside the analytics allowlist");

        Map<String, Object> xp = xpEvent("ledger-1", "xp-dedupe", "tenant-a", 12);
        var xpResult = worker.consume(AnalyticsEventEnvelope.fromTrustedMap(xp,
                "gamification-service", tenantA.tenantId()));
        require(xpResult.state() == AnalyticsIngestState.ACCEPTED,
                "B12 sanitized growth event must be accepted: " + xpResult);

        LocalDate day = LocalDate.of(2026, 8, 22);
        var learningQuery = query.query(new AnalyticsQuery(tenantA,
                List.of("learning.attempt.submitted"), day, day, "learning.v1"));
        require(learningQuery.state() == AnalyticsQueryState.READY && learningQuery.rows().size() == 1
                        && learningQuery.rows().get(0).eventCount() == 1,
                "tenant A learning projection must be queryable");
        var growthQuery = query.query(new AnalyticsQuery(tenantA,
                List.of("growth.ledger.posted"), day, day, "growth.v1"));
        require(growthQuery.rows().get(0).totalValue() == 12L,
                "growth projection must use the server event amount");
        require(query.query(new AnalyticsQuery(tenantB, List.of(), day, day,
                AnalyticsMetricVersions.ALL_CURRENT)).state() == AnalyticsQueryState.EMPTY,
                "another tenant must not see tenant A projections");

        var recomputeResult = recompute.recompute(new RecomputeRequest(tenantA, "learning.v1", day, day, "job-1"));
        require(recomputeResult.state() == RecomputeState.COMPLETED
                        && recomputeResult.replayedEventCount() == 1,
                "recompute must rebuild from the analytics journal: " + recomputeResult);
        require(store.journalSnapshot(tenantA).stream().noneMatch(event -> event.payload().containsKey("actorId")),
                "journal must not store actor identity from the envelope");

        require(query.query(new AnalyticsQuery(tenantA, List.of(), day.plusDays(1), day.plusDays(1), null))
                        .state() == AnalyticsQueryState.EMPTY,
                "no rows must be represented as EMPTY, not fabricated zeros");
        store.failReads(true);
        require(query.query(new AnalyticsQuery(tenantA, List.of(), day, day, null)).state() == AnalyticsQueryState.ERROR,
                "projection read failures must be visible as ERROR");
        store.failReads(false);
        store.failWrites(true);
        require(worker.consume(AnalyticsEventEnvelope.fromTrustedMap(
                rewardEvent("grant-1", "reward-dedupe", "tenant-a"),
                "gamification-service", tenantA.tenantId())).state() == AnalyticsIngestState.ERROR,
                "projection write failures must be retryable errors");

        require(AnalyticsEventAllowlist.eventNames().size() == 19,
                "B10/B12 allowlist must remain explicit and finite");
        System.out.println("analytics-service B13-ANL-004 smoke: PASS");
    }

    private static Map<String, Object> submittedEvent(String attemptId, String dedupeKey,
            String tenantId, int itemCount) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tenantId", tenantId);
        payload.put("principalId", "principal-a");
        payload.put("attemptId", attemptId);
        payload.put("sessionId", "session-1");
        payload.put("contentVersionId", 10);
        payload.put("contentSnapshotId", "snapshot-1");
        payload.put("contentEpoch", 1);
        payload.put("attemptVersion", 1);
        payload.put("submissionDigest", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        payload.put("itemCount", itemCount);
        payload.put("gradingRuleVersion", "grading-v1");
        payload.put("submittedAt", "2026-08-22T00:00:00Z");
        return envelope("assessment.attempt.submitted.v1", "assessment.event.v1", "assessment_attempt",
                attemptId, "attempt-actor", dedupeKey, payload);
    }

    private static Map<String, Object> xpEvent(String ledgerId, String dedupeKey, String tenantId, int amount) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("ledgerEntryId", ledgerId);
        payload.put("subjectRef", "subject-a");
        payload.put("ledgerKind", "SCORE");
        payload.put("amount", amount);
        payload.put("ruleVersion", "growth-v1");
        payload.put("sourceEventId", "assessment-event-1");
        return envelope("gamification.xp.ledger_posted.v1", "gamification.event.v1", "growth_ledger",
                ledgerId, "growth-actor", dedupeKey, payload);
    }

    private static Map<String, Object> rewardEvent(String grantId, String dedupeKey, String tenantId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("grantId", grantId);
        payload.put("subjectRef", "subject-a");
        payload.put("rewardCode", "streak-badge");
        payload.put("probabilityVersion", "reward-v1");
        payload.put("grantState", "AVAILABLE");
        return envelope("gamification.reward.granted.v1", "gamification.event.v1", "reward_grant",
                grantId, "growth-actor", dedupeKey, payload);
    }

    private static Map<String, Object> envelope(String eventName, String schema, String aggregateType,
            String aggregateId, String actorId, String dedupeKey, Map<String, Object> payload) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("eventId", "event-" + aggregateId);
        body.put("eventName", eventName);
        body.put("schema", schema);
        body.put("version", 1);
        body.put("occurredAt", "2026-08-22T00:00:00Z");
        body.put("aggregateType", aggregateType);
        body.put("aggregateId", aggregateId);
        body.put("actorId", actorId);
        body.put("traceId", "trace-1");
        body.put("requestId", "request-1");
        body.put("schemaVersion", "1");
        body.put("dedupeKey", dedupeKey);
        body.put("payload", payload);
        return body;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> payload(Map<String, Object> envelope) {
        return (Map<String, Object>) envelope.get("payload");
    }

    private static void requireRejected(Runnable action, AnalyticsErrorCode code) {
        try {
            action.run();
            throw new AssertionError("expected rejection: " + code);
        } catch (com.englishflow.analytics.domain.AnalyticsDomainException exception) {
            require(exception.code() == code, "unexpected rejection code");
        }
    }

    private static void require(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }
}
