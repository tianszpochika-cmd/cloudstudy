package com.englishflow.modules.onboarding;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import org.springframework.stereotype.Service;

/**
 * In-memory B1 substitute for the profile aggregate. The migration is the
 * persistence contract; this implementation keeps the Core API compilable
 * before the auth and repository modules are wired in.
 */
@Service
public class OnboardingProfileService {
    private static final String DEFAULT_LEVEL = "A1";
    private static final int MAX_TAGS = 3;
    private static final int MAX_LAYOUT_ITEMS = 12;
    private final ConcurrentMap<Long, OnboardingProfile> profiles = new ConcurrentHashMap<>();
    private final Clock clock;

    public OnboardingProfileService() {
        this(Clock.systemUTC());
    }

    public OnboardingProfileService(Clock clock) {
        this.clock = clock;
    }

    public OnboardingProfile get(long userId) {
        requireUser(userId);
        return profiles.computeIfAbsent(userId, this::defaultProfile);
    }

    public boolean exists(long userId) {
        return profiles.containsKey(userId);
    }

    public OnboardingProfile save(long userId, OnboardingProfileRequest request) {
        requireUser(userId);
        if (request == null) throw new IllegalArgumentException("profile request is required");
        synchronized (lockFor(userId)) {
            OnboardingProfile current = profiles.get(userId);
            checkExpectedVersion(current, request.expectedVersion());
            OnboardingProfile next = buildProfile(userId, request, current);
            profiles.put(userId, next);
            return next;
        }
    }

    public OnboardingProfile patch(long userId, OnboardingProfilePatchRequest request) {
        requireUser(userId);
        if (request == null) throw new IllegalArgumentException("profile patch is required");
        synchronized (lockFor(userId)) {
            OnboardingProfile current = get(userId);
            checkExpectedVersion(current, request.expectedVersion());
            OnboardingProfileRequest merged = new OnboardingProfileRequest(
                    valueOr(request.language(), current.language().name()),
                    valueOr(request.targetGoal(), current.targetGoal().name()),
                    valueOr(request.examType(), current.examType().name()),
                    request.dailyQuotaMinutes() == null ? current.dailyQuotaMinutes() : request.dailyQuotaMinutes(),
                    request.preferenceTags() == null ? current.preferenceTags() : request.preferenceTags(),
                    valueOr(request.accentPreference(), current.accentPreference().name()),
                    request.customHomeLayout() == null ? current.customHomeLayout() : request.customHomeLayout(),
                    request.customHomeLayoutOrder() == null ? current.customHomeLayoutOrder() : request.customHomeLayoutOrder(),
                    request.expectedVersion()
            );
            OnboardingProfile next = buildProfile(userId, merged, current);
            profiles.put(userId, next);
            return next;
        }
    }

    public OnboardingProfile applyPlacement(
            long userId,
            String cefrLevel,
            int estimatedVocabulary,
            boolean skipped
    ) {
        requireUser(userId);
        validateCefr(cefrLevel);
        if (estimatedVocabulary < 0) throw new IllegalArgumentException("estimatedVocabulary must be non-negative");
        synchronized (lockFor(userId)) {
            OnboardingProfile current = get(userId);
            Instant now = clock.instant();
            OnboardingProfile next = new OnboardingProfile(
                    userId,
                    current.language(),
                    current.targetGoal(),
                    current.examType(),
                    current.dailyQuotaMinutes(),
                    current.preferenceTags(),
                    current.accentPreference(),
                    current.initialCefrLevel(),
                    cefrLevel,
                    estimatedVocabulary,
                    skipped,
                    current.customHomeLayout(),
                    current.customHomeLayoutOrder(),
                    current.profileVersion() + 1,
                    current.createdAt(),
                    now
            );
            profiles.put(userId, next);
            return next;
        }
    }

    public Map<Long, OnboardingProfile> snapshot() {
        return Map.copyOf(profiles);
    }

    private OnboardingProfile buildProfile(long userId, OnboardingProfileRequest request, OnboardingProfile current) {
        LearningLanguage language = request.language() == null && current != null
                ? current.language() : LearningLanguage.from(request.language());
        TargetGoal targetGoal = request.targetGoal() == null && current != null
                ? current.targetGoal() : TargetGoal.from(request.targetGoal());
        ExamType examType = request.examType() == null && current != null
                ? current.examType() : ExamType.from(request.examType());
        int dailyMinutes = request.dailyQuotaMinutes() == null && current != null
                ? current.dailyQuotaMinutes() : DailyDuration.fromMinutes(request.dailyQuotaMinutes()).minutes();
        AccentPreference accent = request.accentPreference() == null && current != null
                ? current.accentPreference() : AccentPreference.from(request.accentPreference());
        List<String> tags = normalizeTags(request.preferenceTags() == null && current != null
                ? current.preferenceTags() : request.preferenceTags());
        boolean customLayout = request.customHomeLayout() != null
                ? request.customHomeLayout()
                : current != null && current.customHomeLayout();
        List<String> layout = normalizeLayout(request.customHomeLayoutOrder() == null && current != null
                ? current.customHomeLayoutOrder() : request.customHomeLayoutOrder());
        if (!customLayout) layout = List.of();
        Instant now = clock.instant();
        return new OnboardingProfile(
                userId,
                language,
                targetGoal,
                examType,
                dailyMinutes,
                tags,
                accent,
                current == null ? DEFAULT_LEVEL : current.initialCefrLevel(),
                current == null ? DEFAULT_LEVEL : current.currentCefrLevel(),
                current == null ? 800 : current.estimatedVocabulary(),
                current != null && current.placementSkipped(),
                customLayout,
                layout,
                current == null ? 1 : current.profileVersion() + 1,
                current == null ? now : current.createdAt(),
                now
        );
    }

    private OnboardingProfile defaultProfile(long userId) {
        Instant now = clock.instant();
        return new OnboardingProfile(
                userId, LearningLanguage.ENGLISH, TargetGoal.ZERO_BASIS, ExamType.NONE,
                DailyDuration.FIFTEEN.minutes(), List.of(), AccentPreference.NEUTRAL,
                DEFAULT_LEVEL, DEFAULT_LEVEL, 800, false, false, List.of(), 0, now, now
        );
    }

    private Object lockFor(long userId) {
        return ("profile-lock-" + userId).intern();
    }

    private static void checkExpectedVersion(OnboardingProfile current, Long expectedVersion) {
        if (expectedVersion == null) return;
        long actual = current == null ? 0 : current.profileVersion();
        if (actual != expectedVersion) {
            throw B1DomainException.conflict("VERSION_CONFLICT", "profile version does not match");
        }
    }

    private static List<String> normalizeTags(List<String> values) {
        if (values == null) return List.of();
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String value : values) {
            if (value == null || value.isBlank()) throw new IllegalArgumentException("preferenceTags cannot contain blank values");
            String tag = value.trim().toUpperCase();
            if (!tag.matches("[A-Z0-9_]{1,32}")) throw new IllegalArgumentException("preferenceTags contain an invalid value");
            normalized.add(tag);
        }
        if (normalized.size() > MAX_TAGS) throw new IllegalArgumentException("at most 3 preferenceTags are allowed");
        return List.copyOf(normalized);
    }

    private static List<String> normalizeLayout(List<String> values) {
        if (values == null) return List.of();
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String value : values) {
            if (value == null || value.isBlank()) throw new IllegalArgumentException("customHomeLayoutOrder cannot contain blank values");
            normalized.add(value.trim());
        }
        if (normalized.size() > MAX_LAYOUT_ITEMS) throw new IllegalArgumentException("customHomeLayoutOrder is too long");
        return List.copyOf(normalized);
    }

    private static void validateCefr(String level) {
        if (level == null || !level.matches("A1|A2|B1|B2|C1|C2")) {
            throw new IllegalArgumentException("CEFR level must be A1, A2, B1, B2, C1, or C2");
        }
    }

    private static String valueOr(String value, String fallback) {
        return value == null ? fallback : value;
    }

    private static void requireUser(long userId) {
        if (userId <= 0) throw new IllegalArgumentException("userId must be positive");
    }
}
