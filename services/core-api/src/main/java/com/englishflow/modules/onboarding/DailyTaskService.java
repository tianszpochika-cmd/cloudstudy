package com.englishflow.modules.onboarding;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class DailyTaskService {
    private final OnboardingProfileService profileService;
    private final FirstGoalService goalService;
    private final Clock clock;
    private final ConcurrentMap<String, DailyTaskPlan> plans = new ConcurrentHashMap<>();

    public DailyTaskService() {
        this(new OnboardingProfileService(), new FirstGoalService(), Clock.systemUTC());
    }

    @Autowired
    public DailyTaskService(
            OnboardingProfileService profileService,
            FirstGoalService goalService
    ) {
        this(profileService, goalService, Clock.systemUTC());
    }

    public DailyTaskService(OnboardingProfileService profileService, FirstGoalService goalService, Clock clock) {
        this.profileService = Objects.requireNonNull(profileService);
        this.goalService = Objects.requireNonNull(goalService);
        this.clock = Objects.requireNonNull(clock);
    }

    public DailyTaskPlan today(long userId) {
        return forDate(userId, LocalDate.now(clock));
    }

    public DailyTaskPlan forDate(long userId, LocalDate localDate) {
        if (userId <= 0 || localDate == null) throw new IllegalArgumentException("invalid task plan identity");
        String key = key(userId, localDate);
        return plans.computeIfAbsent(key, ignored -> generate(userId, localDate));
    }

    public synchronized DailyTaskPlan completeTask(long userId, LocalDate localDate, String taskId) {
        DailyTaskPlan current = forDate(userId, localDate);
        List<DailyTask> changed = new ArrayList<>();
        boolean found = false;
        for (DailyTask task : current.tasks()) {
            if (task.taskId().equals(taskId)) {
                found = true;
                changed.add(task.withStatus(TaskStatus.COMPLETED, clock.instant()));
            } else {
                changed.add(task);
            }
        }
        if (!found) throw B1DomainException.notFound("daily task does not exist");
        DailyTaskPlan next = rebuild(current, changed, current.reordered(), current.planVersion() + 1);
        plans.put(key(userId, localDate), next);
        return next;
    }

    public synchronized DailyTaskPlan reorder(long userId, LocalDate localDate) {
        DailyTaskPlan current = forDate(userId, localDate);
        OnboardingProfile profile = profileService.get(userId);
        List<TaskType> preferred = preferredOrder(profile.targetGoal());
        Map<TaskType, Integer> rank = new EnumMap<>(TaskType.class);
        for (int index = 0; index < preferred.size(); index++) rank.put(preferred.get(index), index);
        List<DailyTask> reordered = new ArrayList<>(current.tasks());
        reordered.sort(Comparator
                .comparing((DailyTask task) -> task.status() == TaskStatus.COMPLETED)
                .thenComparingInt(task -> rank.getOrDefault(task.taskType(), 99))
                .thenComparing(DailyTask::taskId));
        List<DailyTask> numbered = new ArrayList<>();
        for (int index = 0; index < reordered.size(); index++) {
            numbered.add(reordered.get(index).withSequence(index + 1, 100 - index));
        }
        DailyTaskPlan next = rebuild(current, numbered, true, current.planVersion() + 1);
        plans.put(key(userId, localDate), next);
        return next;
    }

    public Map<String, DailyTaskPlan> snapshot() {
        return Map.copyOf(plans);
    }

    private DailyTaskPlan generate(long userId, LocalDate date) {
        OnboardingProfile profile = profileService.get(userId);
        FirstGoal goal = goalService.ensure(userId, profile);
        int minutes = profile.dailyQuotaMinutes();
        Map<TaskType, Integer> allocation = allocation(minutes);
        List<DailyTask> tasks = new ArrayList<>();
        int sequence = 1;
        for (TaskType type : preferredOrder(profile.targetGoal())) {
            int taskMinutes = allocation.get(type);
            tasks.add(new DailyTask(
                    "task_" + userId + "_" + date + "_" + type.name().toLowerCase(),
                    userId,
                    date,
                    type,
                    title(type),
                    taskMinutes,
                    quantity(type, taskMinutes),
                    100 - sequence,
                    reason(profile.targetGoal(), type),
                    sequence++,
                    TaskStatus.PENDING,
                    null
            ));
        }
        return new DailyTaskPlan(userId, date, goal.goalId(), minutes, 0, 0, tasks, 1, false, clock.instant());
    }

    private static DailyTaskPlan rebuild(DailyTaskPlan current, List<DailyTask> tasks, boolean reordered, long version) {
        int completedMinutes = tasks.stream()
                .filter(task -> task.status() == TaskStatus.COMPLETED)
                .mapToInt(DailyTask::estimatedMinutes)
                .sum();
        int progress = Math.min(100, (int) Math.round(completedMinutes * 100.0 / current.targetMinutes()));
        return new DailyTaskPlan(current.userId(), current.localDate(), current.goalId(), current.targetMinutes(),
                completedMinutes, progress, tasks, version, reordered, Instant.now());
    }

    private static Map<TaskType, Integer> allocation(int minutes) {
        Map<TaskType, Integer> allocation = new EnumMap<>(TaskType.class);
        switch (minutes) {
            case 5 -> {
                allocation.put(TaskType.VOCABULARY_NEW, 2);
                allocation.put(TaskType.REVIEW_DUE, 1);
                allocation.put(TaskType.GRAMMAR_PRACTICE, 1);
                allocation.put(TaskType.LISTENING_MICRO, 1);
            }
            case 15 -> {
                allocation.put(TaskType.VOCABULARY_NEW, 5);
                allocation.put(TaskType.REVIEW_DUE, 4);
                allocation.put(TaskType.GRAMMAR_PRACTICE, 3);
                allocation.put(TaskType.LISTENING_MICRO, 3);
            }
            case 30 -> {
                allocation.put(TaskType.VOCABULARY_NEW, 10);
                allocation.put(TaskType.REVIEW_DUE, 8);
                allocation.put(TaskType.GRAMMAR_PRACTICE, 6);
                allocation.put(TaskType.LISTENING_MICRO, 6);
            }
            case 45 -> {
                allocation.put(TaskType.VOCABULARY_NEW, 15);
                allocation.put(TaskType.REVIEW_DUE, 12);
                allocation.put(TaskType.GRAMMAR_PRACTICE, 9);
                allocation.put(TaskType.LISTENING_MICRO, 9);
            }
            default -> throw new IllegalArgumentException("unsupported daily duration");
        }
        return allocation;
    }

    private static List<TaskType> preferredOrder(TargetGoal goal) {
        return switch (goal) {
            case ZERO_BASIS -> List.of(TaskType.VOCABULARY_NEW, TaskType.LISTENING_MICRO, TaskType.GRAMMAR_PRACTICE, TaskType.REVIEW_DUE);
            case CET_4_6, POSTGRADUATE -> List.of(TaskType.REVIEW_DUE, TaskType.VOCABULARY_NEW, TaskType.GRAMMAR_PRACTICE, TaskType.LISTENING_MICRO);
            case WORKPLACE_DAILY -> List.of(TaskType.LISTENING_MICRO, TaskType.VOCABULARY_NEW, TaskType.REVIEW_DUE, TaskType.GRAMMAR_PRACTICE);
        };
    }

    private static String title(TaskType type) {
        return switch (type) {
            case VOCABULARY_NEW -> "学习今日新词";
            case REVIEW_DUE -> "完成到期复习";
            case GRAMMAR_PRACTICE -> "完成规则语法练习";
            case LISTENING_MICRO -> "完成短听力精听";
        };
    }

    private static int quantity(TaskType type, int minutes) {
        return switch (type) {
            case VOCABULARY_NEW -> minutes * 2;
            case REVIEW_DUE -> minutes * 2;
            case GRAMMAR_PRACTICE -> Math.max(1, minutes);
            case LISTENING_MICRO -> Math.max(1, minutes / 2);
        };
    }

    private static String reason(TargetGoal goal, TaskType type) {
        return goal.name() + "_BASELINE_" + type.name();
    }

    private static String key(long userId, LocalDate date) {
        return userId + ":" + date;
    }
}
