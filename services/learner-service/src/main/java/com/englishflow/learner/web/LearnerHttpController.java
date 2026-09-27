package com.englishflow.learner.web;

import com.englishflow.learner.application.DefaultLearnerProfileCommandService;
import com.englishflow.learner.application.DefaultLearnerProfileQueryService;
import com.englishflow.learner.application.FirstDayView;
import com.englishflow.learner.application.LearnerProfileView;
import com.englishflow.learner.application.MutationResult;
import com.englishflow.learner.application.RequestMetadata;
import com.englishflow.learner.application.SetLearningGoalCommand;
import com.englishflow.learner.application.UpdateLearnerPreferencesCommand;
import com.englishflow.learner.application.UpdateLearnerProfileCommand;
import com.englishflow.learner.domain.AssessmentState;
import com.englishflow.learner.domain.CefrLevel;
import com.englishflow.learner.domain.DailyStudyMinutes;
import com.englishflow.learner.domain.GoalType;
import com.englishflow.learner.domain.IdempotencyKey;
import com.englishflow.learner.domain.LearnerDomainException;
import com.englishflow.learner.domain.LearnerDecisionCode;
import com.englishflow.learner.domain.LearnerPrincipalContext;
import com.englishflow.learner.domain.LearnerPreferences;
import com.englishflow.learner.domain.OnboardingState;
import com.englishflow.learner.domain.ThemeMode;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Contract-shaped, self-scoped HTTP adapter for learner-service. */
@RestController
@RequestMapping("/api/v1/learner")
public final class LearnerHttpController {

    private final DefaultLearnerProfileCommandService commands;
    private final DefaultLearnerProfileQueryService queries;
    private final VerifiedLearnerPrincipalFactory principalFactory;
    private final com.englishflow.learner.application.TargetPinService targetPins;
    private final LearningPlanViewClient planViews;

    public LearnerHttpController(
            DefaultLearnerProfileCommandService commands,
            DefaultLearnerProfileQueryService queries,
            VerifiedLearnerPrincipalFactory principalFactory,
            com.englishflow.learner.application.TargetPinService targetPins,
            LearningPlanViewClient planViews) {
        this.commands = commands;
        this.queries = queries;
        this.principalFactory = principalFactory;
        this.targetPins = targetPins;
        this.planViews = planViews;
    }

    @GetMapping("/profile")
    public Envelope<ProfileData> profile(
            Authentication authentication,
            @RequestHeader HttpHeaders headers) {
        return envelope(toProfile(queries.getProfile(context(authentication))), headers, false);
    }

    @PatchMapping("/profile")
    public Envelope<ProfileData> patchProfile(
            @RequestBody ProfilePatchRequest request,
            Authentication authentication,
            @RequestHeader(value = "Idempotency-Key") String idempotencyKey,
            @RequestHeader HttpHeaders headers) {
        LearnerPrincipalContext context = context(authentication);
        LearnerProfileView current = queries.getProfile(context);
        Long expected = request.expectedStateVersion();
        if (request.hasPreferenceFields()) {
            if (request.targetGoal() != null || request.proficiencyLevel() != null) {
                throw boundary("PROFILE_PATCH_SPLIT_REQUIRED",
                        "profile goal/level and preference fields must be written through their owner endpoints");
            }
            LearnerPreferences preferences = current.preferences().orElseGet(() ->
                    LearnerPreferences.defaults(Instant.now()));
            MutationResult<LearnerProfileView> result = commands.updatePreferences(
                    context,
                    new UpdateLearnerPreferencesCommand(
                            Optional.ofNullable(request.uiLocale()).orElse(preferences.uiLocale()),
                            Optional.ofNullable(request.contentLocale()).orElse(preferences.contentLocale()),
                            preferences.themeMode(),
                            Optional.ofNullable(request.timezone()).orElse(preferences.timezone()),
                            preferences.reducedMotion(), preferences.weeklyStudyDays(),
                            new IdempotencyKey(idempotencyKey), expected),
                    metadata(headers));
            return envelope(toProfile(result.data()), headers, result.replayed());
        }
        if (request.targetGoal() != null) {
            throw boundary("TARGET_OWNER_REQUIRED", "targetGoal must be written through /learner/targets");
        }
        MutationResult<LearnerProfileView> result = commands.updateProfile(
                context,
                new UpdateLearnerProfileCommand(
                        current.onboardingState(), current.assessmentState(),
                        Optional.ofNullable(request.proficiencyLevel()).map(CefrLevel::valueOf)
                                .orElse(current.currentLevel().orElse(null)),
                        current.resumeTarget(), new IdempotencyKey(idempotencyKey), expected),
                metadata(headers));
        return envelope(toProfile(result.data()), headers, result.replayed());
    }

    @GetMapping("/targets")
    public ResponseEntity<Envelope<TargetData>> target(
            Authentication authentication,
            @RequestHeader HttpHeaders headers) {
        LearnerProfileView profile = queries.getProfile(context(authentication));
        java.util.Optional<com.englishflow.learner.application.TargetPinService.TargetPin> pin =
                targetPins.findPin(context(authentication).scope().subjectId());
        return profile.goal()
                .map(goal -> ResponseEntity.ok(envelope(toTarget(goal, profile.version(), pin), headers, false)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping("/targets")
    public Envelope<TargetData> putTarget(
            @RequestBody TargetUpsertRequest request,
            Authentication authentication,
            @RequestHeader(value = "Idempotency-Key") String idempotencyKey,
            @RequestHeader HttpHeaders headers) {
        MutationResult<LearnerProfileView> result = commands.setLearningGoal(
                context(authentication),
                new SetLearningGoalCommand(
                        goalType(request.goalCode()), DailyStudyMinutes.from(request.dailyQuotaMinutes()),
                        request.targetDate(), CefrLevel.valueOf(request.targetLevel()),
                        new IdempotencyKey(idempotencyKey), request.expectedStateVersion()),
                metadata(headers));
        // Goal content edits invalidate the placement pin (the measurement no
        // longer describes the edited target); the pin columns are cleared by
        // the profile store on every goal write.
        java.util.Optional<com.englishflow.learner.application.TargetPinService.TargetPin> pin =
                targetPins.findPin(context(authentication).scope().subjectId());
        return envelope(toTarget(result.data().goal().orElseThrow(), result.data().version(), pin), headers, result.replayed());
    }

    @GetMapping("/preferences")
    public Envelope<PreferencesData> preferences(
            Authentication authentication,
            @RequestHeader HttpHeaders headers) {
        LearnerProfileView profile = queries.getProfile(context(authentication));
        LearnerPreferences value = profile.preferences().orElseGet(() -> LearnerPreferences.defaults(Instant.now()));
        return envelope(toPreferences(value, profile.version()), headers, false);
    }

    @PatchMapping("/preferences")
    public Envelope<PreferencesData> patchPreferences(
            @RequestBody PreferencesPatchRequest request,
            Authentication authentication,
            @RequestHeader(value = "Idempotency-Key") String idempotencyKey,
            @RequestHeader HttpHeaders headers) {
        LearnerPrincipalContext context = context(authentication);
        LearnerProfileView current = queries.getProfile(context);
        LearnerPreferences existing = current.preferences().orElseGet(() -> LearnerPreferences.defaults(Instant.now()));
        ThemeMode theme = request.highContrast() ? ThemeMode.HIGH_CONTRAST
                : request.themeMode() == null ? existing.themeMode() : ThemeMode.valueOf(request.themeMode());
        boolean reducedMotion = request.motionMode() == null
                ? existing.reducedMotion() : !"FULL".equals(request.motionMode());
        MutationResult<LearnerProfileView> result = commands.updatePreferences(
                context,
                new UpdateLearnerPreferencesCommand(
                        Optional.ofNullable(request.uiLocale()).orElse(existing.uiLocale()),
                        Optional.ofNullable(request.contentLocale()).orElse(existing.contentLocale()), theme,
                        Optional.ofNullable(request.timezone()).orElse(existing.timezone()), reducedMotion,
                        request.weeklyStudyDays() == null ? existing.weeklyStudyDays() : request.weeklyStudyDays(),
                        new IdempotencyKey(idempotencyKey), request.expectedStateVersion()),
                metadata(headers));
        return envelope(toPreferences(result.data().preferences().orElseThrow(), result.data().version()), headers,
                result.replayed());
    }

    @GetMapping("/first-day")
    public Envelope<FirstDayData> firstDay(
            Authentication authentication,
            @RequestHeader HttpHeaders headers) {
        FirstDayView value = queries.getFirstDay(context(authentication));
        return envelope(firstDayData(authentication, value).data(), headers, false);
    }

    @GetMapping("/home")
    public Envelope<HomeData> home(
            Authentication authentication,
            @RequestHeader HttpHeaders headers) {
        FirstDayView firstDay = queries.getFirstDay(context(authentication));
        FirstDayData data = firstDayData(authentication, firstDay).data();
        return envelope(new HomeData(data, data.tasks(),
                Math.max(1L, firstDay.profileVersion()), data.contentEpoch(), data.generatedAt()), headers, false);
    }

    /**
     * Home projection composer (ADR: home reads learning projection). The
     * learner-local view stays the NOT_READY baseline; a verified ACTIVE plan
     * view from learning-service (immutable planningInput + plan + at least
     * one task) promotes the page to READY with the owner facts embedded
     * verbatim. Anything else keeps the honest NOT_READY state: learning
     * outages degrade to the placement blocker instead of failing the home.
     */
    FirstDayEnvelope firstDayData(Authentication authentication, FirstDayView value) {
        FirstDayEnvelope baseline = toFirstDay(value);
        if (!baseline.data().profileReady() || !baseline.data().targetReady()) return baseline;
        String subject = context(authentication).scope().subjectId();
        var pin = targetPins.findPin(subject);
        boolean pinned = pin.isPresent() && value.goal().isPresent()
                && pin.get().targetId() == value.goal().get().targetId();
        if (!pinned) return baseline;
        var view = planViews.fetchView(authentication);
        if (view.isEmpty()) {
            // Placement verified (pin present) but no plan view yet: the plan
            // is pending ensure, so the page stays NOT_READY with the
            // placement blocker while honestly reporting COMPLETED placement.
            FirstDayData base = baseline.data();
            return new FirstDayEnvelope(new FirstDayData("NOT_READY", base.profileReady(),
                    base.targetReady(), "COMPLETED", 0, List.of(), base.contentEpoch(),
                    base.projectionVersion(), base.projectionWatermark(), base.generatedAt(),
                    "PLACEMENT_REQUIRED", null, null));
        }
        Map<String, Object> plan = view.get();
        if (!"ACTIVE".equals(plan.get("status")) || !(plan.get("planningInput") instanceof Map<?, ?> input)
                || !(plan.get("plan") instanceof Map<?, ?> planRef)
                || !(plan.get("tasks") instanceof java.util.List<?> tasks) || tasks.isEmpty()) {
            return baseline;
        }
        long epoch = plan.get("contentEpoch") instanceof Number number ? number.longValue() : 1L;
        long projectionVersion = plan.get("projectionVersion") instanceof Number number
                ? number.longValue() : 1L;
        String watermark = plan.get("projectionWatermark") instanceof String text ? text
                : "plan-view:" + plan.get("planId");
        FirstDayData data = new FirstDayData("READY", true, true, "COMPLETED", tasks.size(),
                java.util.List.copyOf(tasks), Math.max(1L, epoch), Math.max(1L, projectionVersion),
                watermark, Instant.now(), null, copyMap(input), copyMap(planRef));
        return new FirstDayEnvelope(data);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> copyMap(Map<?, ?> source) {
        return Map.copyOf((Map<String, Object>) source);
    }

    private LearnerPrincipalContext context(Authentication authentication) {
        return principalFactory.from(authentication);
    }

    private static RequestMetadata metadata(HttpHeaders headers) {
        return new RequestMetadata(headers.getFirst("X-Request-Id"), headers.getFirst("X-Trace-Id"));
    }

    static GoalType goalType(String value) {
        if (value == null) {
            throw boundary("GOAL_CODE_UNSUPPORTED", "goalCode is required");
        }
        return switch (value) {
            case "ZERO_BASIS", "FOUNDATION" -> GoalType.FOUNDATION;
            case "CET_4_6", "COLLEGE_CET" -> GoalType.CET_4_6;
            case "POSTGRADUATE", "POSTGRADUATE_ENGLISH" -> GoalType.POSTGRADUATE;
            case "WORKPLACE", "WORKPLACE_DAILY" -> GoalType.WORKPLACE;
            // The older input codes remain readable for clients already deployed.
            // LANGUAGE_CERT belongs to the tenant admin contract, not B9 targets.
            default -> throw boundary("GOAL_CODE_UNSUPPORTED",
                    "goalCode is outside the Phase 1 learner goal set; language-exam goals are managed through the tenant admin channel");
        };
    }

    private static LearnerDomainException boundary(String code, String message) {
        return new LearnerDomainException(com.englishflow.learner.domain.LearnerDecisionCode.INVALID_PROFILE,
                code + ": " + message);
    }

    private static ProfileData toProfile(LearnerProfileView value) {
        LearnerPreferences preferences = value.preferences().orElseGet(() -> LearnerPreferences.defaults(value.updatedAt()));
        return new ProfileData(value.subjectId(), value.tenantId(), status(value.onboardingState()),
                preferences.uiLocale(), preferences.contentLocale(), preferences.timezone(),
                value.goal().map(goal -> goal.type() == GoalType.FOUNDATION ? "ZERO_BASIS" : goal.type().name()).orElse(null),
                value.currentLevel().map(Enum::name).orElse("UNKNOWN"), value.version(), value.updatedAt());
    }

    static TargetData toTarget(com.englishflow.learner.domain.LearningGoal goal, long version,
            java.util.Optional<com.englishflow.learner.application.TargetPinService.TargetPin> pin) {
        java.util.Optional<com.englishflow.learner.application.TargetPinService.TargetPin> matching =
                pin.filter(candidate -> candidate.targetId() == goal.targetId());
        return new TargetData(goal.targetId(), targetGoalCode(goal.type()),
                goal.startingLevel().name(), null, goal.dailyStudyMinutes().minutes(), goal.targetDate(), "ACTIVE",
                matching.map(com.englishflow.learner.application.TargetPinService.TargetPin::contentVersionId)
                        .orElse(null),
                matching.map(com.englishflow.learner.application.TargetPinService.TargetPin::contentEpoch)
                        .orElse(null),
                version, goal.updatedAt());
    }

    private static String targetGoalCode(GoalType type) {
        return switch (type) {
            case FOUNDATION -> "FOUNDATION";
            case CET_4_6 -> "COLLEGE_CET";
            case POSTGRADUATE -> "POSTGRADUATE_ENGLISH";
            case WORKPLACE -> "WORKPLACE_DAILY";
            case LANGUAGE_CERT -> throw boundary("GOAL_CODE_UNSUPPORTED",
                    "admin-managed language-exam goals are outside the Phase 1 learner target contract");
        };
    }

    private static PreferencesData toPreferences(LearnerPreferences value, long version) {
        return new PreferencesData(value.uiLocale(), value.contentLocale(), value.timezone(),
                value.themeMode() == ThemeMode.HIGH_CONTRAST ? "SYSTEM" : value.themeMode().name(),
                value.themeMode() == ThemeMode.HIGH_CONTRAST, value.reducedMotion() ? "REDUCED" : "FULL",
                value.effectiveStudyDays(), version, value.updatedAt());
    }

    static FirstDayEnvelope toFirstDay(FirstDayView value) {
        boolean profileReady = value.source() == com.englishflow.learner.domain.ProfileSource.OWNED;
        boolean targetReady = value.goal().isPresent();
        // A saved target is not a plan. Until the learning owner has supplied pinned
        // planning input, a plan reference and at least one task, the B9 READY shape
        // cannot be produced. Stay honest: report NOT_READY with the contract
        // PLACEMENT_REQUIRED blocker (HTTP 200) instead of failing with 503.
        // Genuine owner-store outages still surface as 503 via the
        // DataAccessException boundary in LearnerHttpExceptionHandler.
        String blocker;
        if (!profileReady) {
            blocker = "PROFILE_INCOMPLETE";
        } else if (!targetReady) {
            blocker = "TARGET_INCOMPLETE";
        } else {
            blocker = "PLACEMENT_REQUIRED";
        }
        String placement = switch (value.assessmentState()) {
            case NOT_STARTED -> "NOT_STARTED";
            case IN_PROGRESS, INTERRUPTED -> "IN_PROGRESS";
            case COMPLETED -> "COMPLETED";
        };
        long version = Math.max(1L, value.profileVersion());
        FirstDayData data = new FirstDayData("NOT_READY", profileReady, targetReady, placement, 0, List.of(),
                1L, version, "learner-profile:" + version, value.generatedAt(), blocker, null, null);
        return new FirstDayEnvelope(data);
    }

    private static String status(OnboardingState state) {
        return state == OnboardingState.COMPLETED ? "ACTIVE" : "ONBOARDING";
    }

    private static <T> Envelope<T> envelope(T data, HttpHeaders headers, boolean replayed) {
        String traceId = headers.getFirst("X-Trace-Id");
        String requestId = headers.getFirst("X-Request-Id");
        return new Envelope<>(data, new Meta(traceId, requestId, "LEARNER_SERVICE", false, replayed));
    }

    public record ProfilePatchRequest(
            long expectedStateVersion,
            String uiLocale,
            String contentLocale,
            String timezone,
            String targetGoal,
            String proficiencyLevel) {
        boolean hasPreferenceFields() {
            return uiLocale != null || contentLocale != null || timezone != null;
        }
    }

    public record TargetUpsertRequest(
            long expectedStateVersion,
            String goalCode,
            String targetLevel,
            Integer dailyQuotaMinutes,
            String examCode,
            java.time.LocalDate targetDate,
            String status) {
        public TargetUpsertRequest {
            if (dailyQuotaMinutes == null) {
                throw boundary("DAILY_QUOTA_REQUIRED", "dailyQuotaMinutes is required");
            }
        }
    }

    public record PreferencesPatchRequest(
            long expectedStateVersion,
            String uiLocale,
            String contentLocale,
            String timezone,
            String themeMode,
            boolean highContrast,
            String motionMode,
            java.util.List<Integer> weeklyStudyDays) {
    }

    public record Envelope<T>(T data, Meta meta) {
    }

    public record Meta(String traceId, String requestId, String source, boolean stale, boolean replayed) {
    }

    public record ProfileData(
            String principalId,
            String tenantId,
            String status,
            String uiLocale,
            String contentLocale,
            String timezone,
            String targetGoal,
            String proficiencyLevel,
            long stateVersion,
            Instant updatedAt) {
    }

    public record TargetData(
            long targetId,
            String goalCode,
            String targetLevel,
            String examCode,
            int dailyQuotaMinutes,
            java.time.LocalDate targetDate,
            String status,
            Long pinnedContentVersionId,
            Long pinnedContentEpoch,
            long stateVersion,
            Instant updatedAt) {
    }

    public record PreferencesData(
            String uiLocale,
            String contentLocale,
            String timezone,
            String themeMode,
            boolean highContrast,
            String motionMode,
            java.util.List<Integer> weeklyStudyDays,
            long stateVersion,
            Instant updatedAt) {
    }

    public record FirstDayEnvelope(FirstDayData data) {
    }

    @com.fasterxml.jackson.annotation.JsonInclude(
            com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public record FirstDayData(
            String state,
            boolean profileReady,
            boolean targetReady,
            String placementStatus,
            int taskCount,
            List<Object> tasks,
            long contentEpoch,
            long projectionVersion,
            String projectionWatermark,
            Instant generatedAt,
            String blocker,
            Map<String, Object> planningInput,
            Map<String, Object> plan) {
    }

    public record HomeData(
            FirstDayData firstDay,
            List<Object> tasks,
            long projectionVersion,
            long contentEpoch,
            Instant generatedAt) {
    }
}
