package com.englishflow.modules.onboarding;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import org.springframework.stereotype.Service;

@Service
public class FirstGoalService {
    private final ConcurrentMap<Long, FirstGoal> goals = new ConcurrentHashMap<>();
    private final Clock clock;

    public FirstGoalService() {
        this(Clock.systemUTC());
    }

    public FirstGoalService(Clock clock) {
        this.clock = clock;
    }

    public FirstGoal ensure(long userId, OnboardingProfile profile) {
        if (profile == null || profile.userId() != userId) throw new IllegalArgumentException("profile does not belong to user");
        return goals.computeIfAbsent(userId, ignored -> create(userId, profile));
    }

    public FirstGoal rebuild(long userId, OnboardingProfile profile, String reasonCode) {
        if (profile == null || profile.userId() != userId) throw new IllegalArgumentException("profile does not belong to user");
        Instant now = clock.instant();
        FirstGoal next = new FirstGoal(
                "goal_" + UUID.randomUUID().toString().replace("-", ""),
                userId,
                profile.targetGoal(),
                profile.examType(),
                profile.currentCefrLevel(),
                profile.dailyQuotaMinutes(),
                title(profile.targetGoal(), profile.examType()),
                "COMPLETE_DAILY_MINUTES_AND_ONE_TASK",
                LocalDate.now(clock),
                GoalStatus.ACTIVE,
                now,
                now
        );
        goals.put(userId, next);
        return next;
    }

    public Optional<FirstGoal> find(long userId) {
        return Optional.ofNullable(goals.get(userId));
    }

    public FirstGoal complete(long userId) {
        FirstGoal current = goals.get(userId);
        if (current == null) throw B1DomainException.notFound("first goal does not exist");
        FirstGoal completed = new FirstGoal(
                current.goalId(), current.userId(), current.targetGoal(), current.examType(), current.startingCefrLevel(),
                current.dailyQuotaMinutes(), current.title(), current.successCriteria(), current.targetDate(),
                GoalStatus.COMPLETED, current.createdAt(), clock.instant()
        );
        goals.put(userId, completed);
        return completed;
    }

    public Map<Long, FirstGoal> snapshot() {
        return Map.copyOf(goals);
    }

    private FirstGoal create(long userId, OnboardingProfile profile) {
        Instant now = clock.instant();
        return new FirstGoal(
                "goal_" + UUID.randomUUID().toString().replace("-", ""),
                userId,
                profile.targetGoal(),
                profile.examType(),
                profile.currentCefrLevel(),
                profile.dailyQuotaMinutes(),
                title(profile.targetGoal(), profile.examType()),
                "COMPLETE_DAILY_MINUTES_AND_ONE_TASK",
                LocalDate.now(clock),
                GoalStatus.ACTIVE,
                now,
                now
        );
    }

    private static String title(TargetGoal goal, ExamType examType) {
        return switch (goal) {
            case ZERO_BASIS -> "建立英语基础微习惯";
            case CET_4_6 -> examType == ExamType.CET6 ? "稳步冲刺 CET-6" : "稳步冲刺 CET-4/6";
            case POSTGRADUATE -> "建立考研英语每日节奏";
            case WORKPLACE_DAILY -> "提升职场日常表达";
        };
    }
}
