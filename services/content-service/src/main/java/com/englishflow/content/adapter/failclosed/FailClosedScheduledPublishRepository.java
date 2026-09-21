package com.englishflow.content.adapter.failclosed;

import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ScheduledPublishTask;
import com.englishflow.content.port.ScheduledPublishRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** Fail-closed schedule port used when JDBC persistence is disabled. */
public final class FailClosedScheduledPublishRepository implements ScheduledPublishRepository {

    private static ContentOperationException unavailable() {
        return ContentOperationException.unavailable("SCHEDULE_PERSISTENCE_DISABLED",
                "schedule persistence is disabled; refusing to invent publish tasks");
    }

    @Override
    public Optional<ScheduledPublishTask> findById(String taskId) {
        throw unavailable();
    }

    @Override
    public List<ScheduledPublishTask> listByPack(String packCode, int limit) {
        throw unavailable();
    }

    @Override
    public List<ScheduledPublishTask> dueTasks(Instant now, int limit) {
        throw unavailable();
    }

    @Override
    public void save(ScheduledPublishTask task) {
        throw unavailable();
    }
}
