package com.englishflow.content.adapter.memory;

import com.englishflow.content.domain.ScheduledPublishTask;
import com.englishflow.content.port.ScheduledPublishRepository;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Test-only schedule double. Production uses the JDBC adapter. */
public final class InMemoryScheduledPublishRepository implements ScheduledPublishRepository {

    private final Map<String, ScheduledPublishTask> tasks = new ConcurrentHashMap<>();

    @Override
    public Optional<ScheduledPublishTask> findById(String taskId) {
        return Optional.ofNullable(tasks.get(taskId));
    }

    @Override
    public List<ScheduledPublishTask> listByPack(String packCode, int limit) {
        return tasks.values().stream()
                .filter(task -> task.packCode().equals(packCode))
                .sorted(Comparator.comparing(ScheduledPublishTask::runAt).reversed())
                .limit(Math.max(1, Math.min(limit, 100)))
                .toList();
    }

    @Override
    public List<ScheduledPublishTask> dueTasks(Instant now, int limit) {
        return tasks.values().stream()
                .filter(task -> "SCHEDULED".equals(task.status()) && !task.runAt().isAfter(now))
                .sorted(Comparator.comparing(ScheduledPublishTask::runAt))
                .limit(Math.max(1, Math.min(limit, 50)))
                .toList();
    }

    @Override
    public void save(ScheduledPublishTask task) {
        tasks.put(task.taskId(), task);
    }
}
