package com.englishflow.notification.unit;

import com.englishflow.notification.domain.IdempotencyKey;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationCategory;
import com.englishflow.notification.domain.NotificationDndWindow;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationFrequencyPolicy;
import com.englishflow.notification.domain.NotificationPreference;
import com.englishflow.notification.domain.OfflineSyncReceipt;
import com.englishflow.notification.domain.OfflineVector;
import com.englishflow.notification.domain.SafeEventAttributes;
import com.englishflow.notification.domain.SyncConflict;
import com.englishflow.notification.domain.SyncCursor;
import com.englishflow.notification.domain.SyncStatus;
import com.englishflow.notification.domain.TrustedEventAllowlist;
import com.englishflow.notification.domain.TrustedEventEnvelope;
import com.englishflow.notification.domain.TrustedEventRule;
import com.englishflow.notification.domain.WorkflowState;
import com.englishflow.notification.domain.WorkflowTask;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Pure validation / rule logic for notification domain value objects. */
class DomainValidationTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final String DIGEST = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    // --- NotificationDomainException ---

    @Test
    void exceptionCarriesCode() {
        var ex = new NotificationDomainException(NotificationDomainException.Code.FORBIDDEN, "no");
        assertEquals(NotificationDomainException.Code.FORBIDDEN, ex.code());
        assertEquals(NotificationDomainException.Code.INVALID_ARGUMENT, NotificationDomainException.invalid("x").code());
    }

    // --- IdempotencyKey ---

    @Test
    void idempotencyKeyRejectsBlankAndOverlong() {
        assertThrows(NotificationDomainException.class, () -> new IdempotencyKey("  "));
        assertThrows(NotificationDomainException.class, () -> new IdempotencyKey("a".repeat(201)));
        var key = new IdempotencyKey("  key-with-spaces  ");
        assertEquals("key-with-spaces", key.value());
    }

    // --- NotificationPreference ---

    @Test
    void preferenceRequiresMandatoryFields() {
        assertThrows(NotificationDomainException.class, () -> new NotificationPreference(
                "", "p", NotificationCategory.SYSTEM, NotificationChannel.IN_APP, true, "zh-CN", 1,
                NotificationDndWindow.parse("23:00", "08:00"), NotificationFrequencyPolicy.IMMEDIATE, 1, NOW));
        assertThrows(NotificationDomainException.class, () -> new NotificationPreference(
                "t", "p", NotificationCategory.SYSTEM, NotificationChannel.IN_APP, true, "zh-CN", 0,
                NotificationDndWindow.parse("23:00", "08:00"), NotificationFrequencyPolicy.IMMEDIATE, 1, NOW));
        assertThrows(NotificationDomainException.class, () -> new NotificationPreference(
                "t", "p", NotificationCategory.SYSTEM, NotificationChannel.IN_APP, true, "zh-CN", 1,
                NotificationDndWindow.parse("23:00", "08:00"), NotificationFrequencyPolicy.IMMEDIATE, 1, null));
    }

    @Test
    void preferenceChangeBumpsVersionWithoutChangingOwnerFields() {
        var base = new NotificationPreference("t", "p", NotificationCategory.LEARNING,
                NotificationChannel.IN_APP, true, "zh-CN", 1, NotificationDndWindow.parse("23:00", "08:00"),
                NotificationFrequencyPolicy.IMMEDIATE, 1, NOW);
        var next = base.change(false, "zh-CN", 1, NotificationDndWindow.parse("22:00", "07:00"),
                NotificationFrequencyPolicy.DAILY_DIGEST, NOW);
        assertEquals(2, next.version());
        assertEquals(false, next.enabled());
        assertEquals("zh-CN", next.locale());
        assertEquals(1, next.consentVersion());
        assertEquals(NotificationFrequencyPolicy.DAILY_DIGEST, next.frequencyPolicy());
    }

    // --- TrustedEventAllowlist ---

    @Test
    void allowlistRejectsEmptyAndDuplicates() {
        assertThrows(NotificationDomainException.class, () -> new TrustedEventAllowlist(Set.of()));
        var distinct = new TrustedEventRule("dup.v1", "learning.event.v1", 1, "learning_review_queue",
                "learning.review.due", "learning.review.due", "v1", NotificationChannel.IN_APP,
                "zh-CN", Set.of("queueItemId"), Duration.ZERO, true);
        assertThrows(NotificationDomainException.class,
                () -> new TrustedEventAllowlist(java.util.List.of(rule("dup.v1"), distinct)));
        var standard = TrustedEventAllowlist.standard();
        assertEquals(6, standard.rules().size());
        assertEquals(0, standard.find("unknown.event.v1").map(x -> 1).orElse(0));
    }

    // --- TrustedEventRule ---

    @Test
    void ruleValidatesEnvelopeAndRejectsMismatch() {
        var rule = rule("learning.review.scheduled.v1");
        var ok = envelope("learning.review.scheduled.v1", null, Map.of("queueItemId", "q1"), "zh-CN");
        assertEquals(Map.of("queueItemId", "q1"), rule.validate(ok));

        var badTemplate = envelope("learning.review.scheduled.v1", "wrong-template", Map.of("queueItemId", "q1"), "zh-CN");
        var ex = assertThrows(NotificationDomainException.class, () -> rule.validate(badTemplate));
        assertEquals(NotificationDomainException.Code.TEMPLATE_NOT_ALLOWED, ex.code());

        var badAttr = envelope("learning.review.scheduled.v1", null, Map.of("unlisted", "x"), "zh-CN");
        var ex2 = assertThrows(NotificationDomainException.class, () -> rule.validate(badAttr));
        assertEquals(NotificationDomainException.Code.PAYLOAD_NOT_ALLOWED, ex2.code());
    }

    @Test
    void ruleResolveLocalePrefersPreferenceThenEvent() {
        var rule = rule("learning.review.scheduled.v1");
        var env = envelope("learning.review.scheduled.v1", null, Map.of("queueItemId", "q1"), "zh-CN");
        assertEquals("en-US", rule.resolveLocale(env, "en-US"));
        assertEquals("zh-CN", rule.resolveLocale(env, null));
        var envFr = envelope("learning.review.scheduled.v1", null, Map.of("queueItemId", "q1"), "fr-FR");
        assertThrows(NotificationDomainException.class, () -> rule.resolveLocale(envFr, null));
    }

    // --- WorkflowTask ---

    @Test
    void workflowTaskRejectsInvalidStateAndTransition() {
        assertThrows(NotificationDomainException.class, () -> new WorkflowTask(
                "id", "t", "p", "a", "at", "aid", null, 0, 3, null, NOW, NOW));
        assertThrows(NotificationDomainException.class, () -> new WorkflowTask(
                "id", "t", "p", "a", "at", "aid", WorkflowState.QUEUED, 5, 3, null, NOW, NOW));
        var task = new WorkflowTask("id", "t", "p", "a", "at", "aid", WorkflowState.QUEUED, 0, 3, null, NOW, NOW);
        var next = task.transition(WorkflowState.RUNNING, 1, null, NOW);
        assertEquals(WorkflowState.RUNNING, next.state());
        assertEquals(1, next.attempt());
    }

    // --- OfflineVector ---

    @Test
    void offlineVectorRelationAndMerge() {
        var empty = new OfflineVector(Map.of());
        var a = new OfflineVector(Map.of("d1", 1L));
        var b = new OfflineVector(Map.of("d2", 1L));
        assertEquals(OfflineVector.Relation.EQUAL, a.relationTo(a));
        assertEquals(OfflineVector.Relation.DOMINATES, a.relationTo(empty));
        assertEquals(OfflineVector.Relation.CONCURRENT, a.relationTo(b));
        var merged = a.merge(b);
        assertEquals(1L, merged.values().get("d1"));
        assertEquals(1L, merged.values().get("d2"));
        assertThrows(NotificationDomainException.class, () -> new OfflineVector(Map.of("d", -1L)));
    }

    // --- SyncCursor ---

    @Test
    void syncCursorAdvances() {
        var cursor = SyncCursor.initial("t", "p", "d", NOW);
        assertEquals(0, cursor.serverVersion());
        var change = new com.englishflow.notification.domain.OfflineChange(
                "t", "p", "d", "e1", 1, "ET", "eid", "UPSERT", 0,
                new OfflineVector(Map.of("d", 1L)), DIGEST, NOW);
        var next = cursor.advance(change, NOW);
        assertEquals(1, next.serverVersion());
        assertEquals(1, next.lastClientSeq());
    }

    // --- SafeEventAttributes ---

    @Test
    void safeAttributesRejectForbiddenAndMalformed() {
        assertThrows(NotificationDomainException.class, () -> SafeEventAttributes.copy(Map.of("token", "x")));
        assertThrows(NotificationDomainException.class, () -> SafeEventAttributes.copy(Map.of("payload", "x")));
        assertThrows(NotificationDomainException.class, () -> SafeEventAttributes.copy(Map.of("k", "line1\nline2")));
        assertEquals(Map.of(), SafeEventAttributes.copy(null));
        assertEquals(Map.of("score", "A"), SafeEventAttributes.copy(Map.of("score", "A")));
    }

    // --- SyncConflict / OfflineSyncReceipt ---

    @Test
    void syncConflictAndReceiptValidate() {
        assertThrows(NotificationDomainException.class, () -> new SyncConflict("r", 1, new OfflineVector(Map.of()), 0));
        new SyncConflict("r", 1, new OfflineVector(Map.of()), 1);
        assertThrows(NotificationDomainException.class, () -> new OfflineSyncReceipt(
                "e", "fp", 0, SyncStatus.APPLIED, 1, NOW));
        var receipt = new OfflineSyncReceipt("e", "fp", 1, SyncStatus.APPLIED, 1, NOW);
        assertEquals(SyncStatus.APPLIED, receipt.status());
    }

    // --- helpers ---

    private static TrustedEventRule rule(String eventName) {
        return new TrustedEventRule(eventName, "learning.event.v1", 1, "learning_review_queue",
                "learning.review.due", "learning.review.due", "v1", NotificationChannel.IN_APP,
                "zh-CN", Set.of("queueItemId"), Duration.ZERO, true);
    }

    private static TrustedEventEnvelope envelope(String eventName, String templateId,
            Map<String, String> attrs, String locale) {
        return new TrustedEventEnvelope("evt-1", eventName, "learning.event.v1", 1, NOW,
                "learning_review_queue", "q1", "actor", "trace-1", "req-1", "learning.event.v1",
                "dedupe-1", "t", "p", templateId, locale, NotificationChannel.IN_APP, null, attrs);
    }
}
