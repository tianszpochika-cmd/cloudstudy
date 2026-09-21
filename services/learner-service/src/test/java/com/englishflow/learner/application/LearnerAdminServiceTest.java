package com.englishflow.learner.application;

import com.englishflow.learner.adapter.memory.InMemoryLearnerProfileStore;
import com.englishflow.learner.adapter.memory.InMemoryLearnerTargetIdGenerator;
import com.englishflow.learner.domain.LearnerDecisionCode;
import com.englishflow.learner.domain.LearnerDomainException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** B3 learner control-plane tests: search, goal and preference interventions. */
@DisplayName("LearnerAdminService control-plane operations")
class LearnerAdminServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-21T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final String SUBJECT = "prn_admin_test_subject_0001";

    private LearnerAdminService admin;
    private final AtomicInteger keys = new AtomicInteger();

    @BeforeEach
    void setUp() {
        admin = new LearnerAdminService(
                new InMemoryLearnerProfileStore(), new InMemoryLearnerTargetIdGenerator(), CLOCK);
    }

    private String key() {
        return "admin-test-key-" + keys.incrementAndGet() + "-idempotency";
    }

    @Test
    void setGoalOnNewSubjectCreatesOwnedProfile() {
        LearnerAdminService.AdminMutationResult result = admin.setGoal(
                SUBJECT, "WORKPLACE", 30, "2027-06-01", "A2", null, null, null, key(),
                "req-admin-1", "0123456789abcdef0123456789abcdef", "admin-1");
        assertEquals(1, result.view().version());
        assertTrue(result.view().goal().isPresent());
        assertEquals("WORKPLACE", result.view().goal().orElseThrow().type().name());
    }

    @Test
    void replayWithSameKeyReturnsOriginal() {
        String idempotency = key();
        LearnerAdminService.AdminMutationResult first = admin.setGoal(
                SUBJECT, "WORKPLACE", 30, null, "A2", null, null, null, idempotency,
                "req-admin-1", "0123456789abcdef0123456789abcdef", "admin-1");
        LearnerAdminService.AdminMutationResult replayed = admin.setGoal(
                SUBJECT, "WORKPLACE", 30, null, "A2", null, null, null, idempotency,
                "req-admin-1", "0123456789abcdef0123456789abcdef", "admin-1");
        assertTrue(replayed.replayed());
        assertEquals(first.view().version(), replayed.view().version());
    }

    @Test
    void staleVersionIsRejected() {
        admin.setGoal(SUBJECT, "WORKPLACE", 30, null, "A2", null, null, null, key(),
                "req-admin-1", "0123456789abcdef0123456789abcdef", "admin-1");
        LearnerDomainException conflict = assertThrows(LearnerDomainException.class, () -> admin.setGoal(
                SUBJECT, "WORKPLACE", 30, null, "A2", null, null, 0L, key(),
                "req-admin-1", "0123456789abcdef0123456789abcdef", "admin-1"));
        assertEquals(LearnerDecisionCode.CONCURRENT_UPDATE, conflict.code());
    }

    @Test
    void updatePreferencesPersistsLocales() {
        admin.setGoal(SUBJECT, "WORKPLACE", 30, null, "A2", null, null, null, key(),
                "req-admin-1", "0123456789abcdef0123456789abcdef", "admin-1");
        LearnerAdminService.AdminMutationResult result = admin.updatePreferences(
                SUBJECT, "zh-CN", "en-US", "DARK", "Asia/Shanghai", false, null, key(),
                "req-admin-1", "0123456789abcdef0123456789abcdef", "admin-1");
        assertTrue(result.view().preferences().isPresent());
        assertEquals("DARK", result.view().preferences().orElseThrow().themeMode().name());
    }

    @Test
    void searchFindsOwnedSubjects() {
        admin.setGoal(SUBJECT, "WORKPLACE", 30, null, "A2", null, null, null, key(),
                "req-admin-1", "0123456789abcdef0123456789abcdef", "admin-1");
        assertEquals(1, admin.search("admin_test", 50).size());
        assertEquals(0, admin.search("nobody-here", 50).size());
    }

    @Test
    void languageCertGoalCarriesExamFields() {
        LearnerAdminService.AdminMutationResult result = admin.setGoal(
                SUBJECT, "LANGUAGE_CERT", 30, "2027-06-01", "B2", "DELF-B2", "fr-FR", null, key(),
                "req-admin-1", "0123456789abcdef0123456789abcdef", "admin-1");
        assertTrue(result.view().goal().isPresent());
        assertEquals("LANGUAGE_CERT", result.view().goal().orElseThrow().type().name());
        assertEquals("DELF-B2", result.view().goal().orElseThrow().fields().get("examName"));
        assertEquals("fr-FR", result.view().goal().orElseThrow().fields().get("language"));
    }

    @Test
    void languageCertGoalWithoutExamIsRejected() {
        assertThrows(LearnerDomainException.class, () -> admin.setGoal(
                SUBJECT, "LANGUAGE_CERT", 30, null, "B2", null, null, null, key(),
                "req-admin-1", "0123456789abcdef0123456789abcdef", "admin-1"));
        assertThrows(LearnerDomainException.class, () -> admin.setGoal(
                SUBJECT, "LANGUAGE_CERT", 30, null, "B2", "DELF-B2", null, null, key(),
                "req-admin-1", "0123456789abcdef0123456789abcdef", "admin-1"));
        assertThrows(LearnerDomainException.class, () -> admin.setGoal(
                SUBJECT, "LANGUAGE_CERT", 30, null, "B2", "DELF-B2", "not-a-language!!", null, key(),
                "req-admin-1", "0123456789abcdef0123456789abcdef", "admin-1"));
    }

    @Test
    void examFieldsOnHistoricalGoalAreRejected() {
        assertThrows(LearnerDomainException.class, () -> admin.setGoal(
                SUBJECT, "WORKPLACE", 30, null, "A2", "DELF-B2", "fr-FR", null, key(),
                "req-admin-1", "0123456789abcdef0123456789abcdef", "admin-1"));
    }

    @Test
    void historicalCetGoalStillInteroperates() {
        LearnerAdminService.AdminMutationResult created = admin.setGoal(
                SUBJECT, "CET_4_6", 15, null, "B1", null, null, null, key(),
                "req-admin-1", "0123456789abcdef0123456789abcdef", "admin-1");
        assertEquals("CET_4_6", created.view().goal().orElseThrow().type().name());
        assertTrue(created.view().goal().orElseThrow().fields().isEmpty());
        LearnerAdminService.AdminMutationResult migrated = admin.setGoal(
                SUBJECT, "LANGUAGE_CERT", 30, null, "B2", "DELF-B2", "fr-FR", null, key(),
                "req-admin-1", "0123456789abcdef0123456789abcdef", "admin-1");
        assertEquals("LANGUAGE_CERT", migrated.view().goal().orElseThrow().type().name());
    }
}
