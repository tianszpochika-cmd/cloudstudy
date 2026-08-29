package com.englishflow.learner;

import com.englishflow.learner.adapter.memory.InMemoryLearnerProfileStore;
import com.englishflow.learner.adapter.shadow.LearnerProfileShadowAdapter;
import com.englishflow.learner.application.DefaultLearnerProfileCommandService;
import com.englishflow.learner.application.DefaultLearnerProfileQueryService;
import com.englishflow.learner.application.FirstDayView;
import com.englishflow.learner.application.LearnerProfileView;
import com.englishflow.learner.application.RequestMetadata;
import com.englishflow.learner.application.SetLearningGoalCommand;
import com.englishflow.learner.application.UpdateLearnerPreferencesCommand;
import com.englishflow.learner.domain.AssessmentState;
import com.englishflow.learner.domain.AuthorizationDecision;
import com.englishflow.learner.domain.ClientAuthorityClaims;
import com.englishflow.learner.domain.ConsentState;
import com.englishflow.learner.domain.CefrLevel;
import com.englishflow.learner.domain.DailyStudyMinutes;
import com.englishflow.learner.domain.GoalType;
import com.englishflow.learner.domain.IdempotencyKey;
import com.englishflow.learner.domain.LearnerAccessPolicy;
import com.englishflow.learner.domain.LearnerAuthorizationException;
import com.englishflow.learner.domain.LearnerDecisionCode;
import com.englishflow.learner.domain.LearnerDomainException;
import com.englishflow.learner.domain.LearnerPrincipalContext;
import com.englishflow.learner.domain.LearnerTenantScope;
import com.englishflow.learner.domain.LegacyLearnerSnapshot;
import com.englishflow.learner.domain.OnboardingState;
import com.englishflow.learner.domain.ProfileSource;
import com.englishflow.learner.domain.ThemeMode;
import com.englishflow.learner.port.LegacyLearnerReadModelPort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.LocalDate;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LearnerDomainTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final String SUBJECT = "prn_learner00000001";

    private InMemoryLearnerProfileStore store;
    private LearnerProfileShadowAdapter shadowAdapter;
    private DefaultLearnerProfileCommandService commands;
    private DefaultLearnerProfileQueryService queries;
    private LearnerPrincipalContext context;

    @BeforeEach
    void setUp() {
        store = new InMemoryLearnerProfileStore();
        LegacyLearnerReadModelPort emptyLegacy = scope -> Optional.empty();
        shadowAdapter = new LearnerProfileShadowAdapter(emptyLegacy, CLOCK);
        LearnerAccessPolicy policy = new LearnerAccessPolicy(CLOCK);
        commands = new DefaultLearnerProfileCommandService(store, shadowAdapter, policy, CLOCK);
        queries = new DefaultLearnerProfileQueryService(store, shadowAdapter, policy, CLOCK);
        context = LearnerPrincipalContext.phaseOne(SUBJECT);
    }

    @Test
    void goalUpdateIsValidatedAndSameKeyIsReplayedWithoutAnotherEvent() {
        SetLearningGoalCommand command = new SetLearningGoalCommand(
                GoalType.WORKPLACE, DailyStudyMinutes.FIFTEEN, LocalDate.of(2026, 9, 1), CefrLevel.B1,
                key("goal-20260822-001"));

        var first = commands.setLearningGoal(context, command, RequestMetadata.none());
        var replay = commands.setLearningGoal(context, command, RequestMetadata.none());

        assertEquals(1, first.version());
        assertFalse(first.replayed());
        assertTrue(replay.replayed());
        assertEquals(first.data(), replay.data());
        assertEquals(1, store.outboxEvents().size());
        assertEquals(GoalType.WORKPLACE, first.data().goal().orElseThrow().type());

        SetLearningGoalCommand conflicting = new SetLearningGoalCommand(
                GoalType.CET_4_6, DailyStudyMinutes.FIFTEEN, LocalDate.of(2026, 9, 1), CefrLevel.B1,
                command.idempotencyKey());
        LearnerDomainException exception = assertThrows(LearnerDomainException.class,
                () -> commands.setLearningGoal(context, conflicting, RequestMetadata.none()));
        assertEquals(LearnerDecisionCode.IDEMPOTENCY_CONFLICT, exception.code());
    }

    @Test
    void preferencesKeepUiAndContentLocaleIndependent() {
        var result = commands.updatePreferences(context,
                new UpdateLearnerPreferencesCommand(
                        "zh-CN", "en-US", ThemeMode.DARK, "Asia/Shanghai", true,
                        key("preference-20260822-001")),
                RequestMetadata.none());

        assertEquals(ProfileSource.OWNED, result.data().source());
        assertEquals("zh-CN", result.data().preferences().orElseThrow().uiLocale());
        assertEquals("en-US", result.data().preferences().orElseThrow().contentLocale());
        assertEquals(ThemeMode.DARK, result.data().preferences().orElseThrow().themeMode());
    }

    @Test
    void oldProfileIsReadAsShadowAndFirstWritePromotesItToOwnedData() {
        LegacyLearnerSnapshot legacy = new LegacyLearnerSnapshot(
                "platform", SUBJECT, "legacy-profile-1", GoalType.FOUNDATION,
                DailyStudyMinutes.FIVE, null, null, "zh-CN", "en-US", ThemeMode.SYSTEM,
                "Asia/Shanghai", false, OnboardingState.DRAFT, AssessmentState.NOT_STARTED,
                "onboarding.resume", 7, NOW);
        LegacyLearnerReadModelPort legacyPort = scope -> Optional.of(legacy);
        shadowAdapter = new LearnerProfileShadowAdapter(legacyPort, CLOCK);
        LearnerAccessPolicy policy = new LearnerAccessPolicy(CLOCK);
        commands = new DefaultLearnerProfileCommandService(store, shadowAdapter, policy, CLOCK);
        queries = new DefaultLearnerProfileQueryService(store, shadowAdapter, policy, CLOCK);

        LearnerProfileView shadow = queries.getProfile(context);
        assertEquals(ProfileSource.LEGACY_SHADOW, shadow.source());
        assertEquals(GoalType.FOUNDATION, shadow.goal().orElseThrow().type());

        var promoted = commands.updatePreferences(context,
                new UpdateLearnerPreferencesCommand(
                        "zh-CN", "en-US", ThemeMode.HIGH_CONTRAST, "Asia/Shanghai", false,
                        key("shadow-promote-20260822")),
                RequestMetadata.none());

        assertEquals(ProfileSource.OWNED, promoted.data().source());
        assertEquals(1, promoted.version());
        assertEquals(ProfileSource.OWNED, queries.getProfile(context).source());
        assertEquals(1, store.outboxEvents().size());
    }

    @Test
    void firstDayProjectionIsReadOnlyAndDoesNotContainAnswerRules() {
        FirstDayView firstDay = queries.getFirstDay(context);
        assertEquals(ProfileSource.EMPTY, firstDay.source());
        assertEquals("onboarding.select-goal", firstDay.nextAction());
        assertEquals(0, firstDay.todayNewItems());
        assertFalse(firstDayContainsAnswerRules(firstDay));

        commands.setLearningGoal(context, new SetLearningGoalCommand(
                GoalType.FOUNDATION, DailyStudyMinutes.FIVE, null, CefrLevel.A1,
                key("first-day-goal-20260822")), RequestMetadata.none());
        assertEquals("onboarding.resume", queries.getFirstDay(context).nextAction());
    }

    @Test
    void policyDefaultsToDenyForMissingFactsOrClientAuthorities() {
        LearnerAccessPolicy policy = new LearnerAccessPolicy(CLOCK);
        AuthorizationDecision missing = policy.authorize(null, "learner.profile.read",
                "learner-profile", "profile", "platform", SUBJECT);
        assertEquals(LearnerDecisionCode.MISSING_PRINCIPAL, missing.code());
        assertFalse(missing.allowed());

        LearnerPrincipalContext clientOverride = new LearnerPrincipalContext(
                LearnerTenantScope.forPhaseOne(SUBJECT), "phase-1", Set.of("learner"),
                Set.of("learner.profile.read"), ConsentState.GRANTED, false,
                new ClientAuthorityClaims("platform-admin", "other-tenant", SUBJECT));
        AuthorizationDecision denied = policy.authorize(clientOverride, "learner.profile.read",
                "learner-profile", "profile", "platform", SUBJECT);
        assertEquals(LearnerDecisionCode.CLIENT_AUTHORITY_REJECTED, denied.code());

        assertThrows(LearnerAuthorizationException.class,
                () -> queries.getProfile(clientOverride));
    }

    @Test
    void verifiedLocalJwtUuidCanBeUsedUntilIamPrincipalMappingIsAvailable() {
        String jwtSubject = "550e8400-e29b-41d4-a716-446655440000";
        assertEquals(jwtSubject, LearnerTenantScope.forPhaseOne(jwtSubject).subjectId());
    }

    @Test
    void crossTenantAndInvalidGoalAreRejected() {
        AuthorizationDecision crossTenant = new LearnerAccessPolicy(CLOCK).authorize(
                context, "learner.profile.read", "learner-profile", "profile", "other-tenant", SUBJECT);
        assertEquals(LearnerDecisionCode.TENANT_MISMATCH, crossTenant.code());

        SetLearningGoalCommand invalid = new SetLearningGoalCommand(
                GoalType.CET_4_6, DailyStudyMinutes.FIFTEEN, LocalDate.of(2020, 1, 1), CefrLevel.B1,
                key("invalid-goal-20260822"));
        LearnerDomainException exception = assertThrows(LearnerDomainException.class,
                () -> commands.setLearningGoal(context, invalid, RequestMetadata.none()));
        assertEquals(LearnerDecisionCode.INVALID_GOAL, exception.code());
    }

    private static boolean firstDayContainsAnswerRules(FirstDayView view) {
        return view.nextAction().contains("answer") || view.nextAction().contains("rule");
    }

    private static IdempotencyKey key(String value) {
        return new IdempotencyKey(value);
    }
}
