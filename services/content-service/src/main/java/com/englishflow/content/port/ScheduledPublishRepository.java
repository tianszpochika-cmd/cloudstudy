package com.englishflow.content.port;

import com.englishflow.content.domain.ScheduledPublishTask;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** Scheduled-publish repository port owned by content-service. */
public interface ScheduledPublishRepository {

    Optional<ScheduledPublishTask> findById(String taskId);

    List<ScheduledPublishTask> listByPack(String packCode, int limit);

    List<ScheduledPublishTask> dueTasks(Instant now, int limit);

    void save(ScheduledPublishTask task);
}
