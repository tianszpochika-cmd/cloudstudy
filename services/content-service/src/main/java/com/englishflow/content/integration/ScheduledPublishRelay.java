package com.englishflow.content.integration;

import com.englishflow.content.application.ScheduledPublishExecutor;

import java.time.Clock;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * Executes due scheduled-publish tasks inside the owning service.
 * Disabled by default; enable with {@code content.schedule.enabled=true}.
 * A stale state pin fails the task instead of publishing the wrong version.
 */
public final class ScheduledPublishRelay {

    private static final Logger log = LoggerFactory.getLogger(ScheduledPublishRelay.class);

    private final ScheduledPublishExecutor executor;
    private final Clock clock;

    public ScheduledPublishRelay(ScheduledPublishExecutor executor, Clock clock) {
        this.executor = executor;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${content.schedule.poll-interval:30s}",
            initialDelayString = "${content.schedule.initial-delay:30s}")
    public void poll() {
        ScheduledPublishExecutor.ExecutionReport report = executor.executeDue(clock.instant());
        if (report.executed() > 0 || report.failed() > 0) {
            log.warn("content schedule: executed {} task(s), failed {} task(s)",
                    report.executed(), report.failed());
        }
    }
}
