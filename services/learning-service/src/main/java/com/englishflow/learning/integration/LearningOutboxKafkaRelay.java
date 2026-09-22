package com.englishflow.learning.integration;

import com.englishflow.learning.port.LearningOutboxRelayPort;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.errors.RetriableException;
import org.apache.kafka.common.header.internals.RecordHeader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * Publishes claimed learning outbox rows to Kafka with at-least-once delivery (M5-013).
 *
 * <p>Only the canonical topic whitelist is published: rows whose event type is not on
 * {@code platform.learning.v1} are routed to DLQ as EVENT_NOT_ON_TOPIC instead of
 * flooding the topic (and downstream DLQs) with legacy or fixture rows. A row is
 * marked PUBLISHED only after the broker acknowledged the record.
 *
 * <p>Exactly-once is explicitly not claimed: a crash between acknowledgement and the
 * PUBLISHED update legitimately duplicates, absorbed by consumer-side dedupe on
 * (consumerGroup, eventId). Payloads carry pins and digests, never raw answers,
 * audio or free text (enforced at the domain factory).
 */
public final class LearningOutboxKafkaRelay {

    private static final Logger log = LoggerFactory.getLogger(LearningOutboxKafkaRelay.class);

    /**
     * Canonical v2 events carried by {@code platform.learning.v1} (contract topic table).
     * Everything else on the outbox table is legacy or fixture data and must not reach the wire.
     */
    static final Set<String> TOPIC_WHITELIST = Set.of(
            "learning.mastery.projected.v2",
            "learning.review.scheduled.v2",
            "learning.task.completed.v2",
            "sync.command_receipted.v2",
            "sync.conflict_detected.v2",
            "sync.recovered.v2");

    private final LearningOutboxRelayPort relay;
    private final KafkaTemplate<String, String> kafka;
    private final LearningEventRelayProperties properties;
    private final Clock clock;

    public LearningOutboxKafkaRelay(LearningOutboxRelayPort relay,
            KafkaTemplate<String, String> kafka,
            LearningEventRelayProperties properties,
            Clock clock) {
        this.relay = java.util.Objects.requireNonNull(relay, "relay is required");
        this.kafka = java.util.Objects.requireNonNull(kafka, "kafka is required");
        this.properties = java.util.Objects.requireNonNull(properties, "properties are required");
        this.clock = java.util.Objects.requireNonNull(clock, "clock is required");
    }

    @Scheduled(fixedDelayString = "${learning.events.relay.poll-interval:5s}",
            initialDelayString = "${learning.events.relay.initial-delay:10s}")
    public void poll() {
        Instant now = clock.instant();
        int reclaimed = relay.reclaimExpiredLeases(now);
        if (reclaimed > 0) {
            log.warn("learning outbox: reclaimed {} row(s) whose publishing lease had expired", reclaimed);
        }
        List<LearningOutboxRelayPort.ClaimedEvent> claimed =
                relay.claim(properties.getInstanceId(), now, properties.getBatchSize(), properties.getLease());
        for (LearningOutboxRelayPort.ClaimedEvent event : claimed) {
            if (!TOPIC_WHITELIST.contains(event.eventName())) {
                relay.markFailed(event.eventId(), now, true, "EVENT_NOT_ON_TOPIC",
                        "event type " + event.eventName() + " is not carried by " + properties.getTopic());
                continue;
            }
            publish(event);
        }
    }

    private void publish(LearningOutboxRelayPort.ClaimedEvent event) {
        // The key carries the aggregate so one learner's completions stay ordered per partition.
        ProducerRecord<String, String> record = new ProducerRecord<>(
                properties.getTopic(), null, event.aggregateId(), event.payloadJson());
        header(record, "eventId", event.eventId());
        header(record, "eventName", event.eventName());
        header(record, "schemaVersion", event.schemaVersion());
        header(record, "eventVersion", String.valueOf(event.eventVersion()));
        header(record, "dedupeKey", event.dedupeKey());
        header(record, "requestId", event.requestId());
        header(record, "traceId", event.traceId());
        try {
            kafka.send(record).get(properties.getLease().toMillis(), TimeUnit.MILLISECONDS);
            relay.markPublished(event.eventId(), clock.instant());
        } catch (Exception failure) {
            Throwable cause = failure.getCause() == null ? failure : failure.getCause();
            int attempt = event.attemptCount() + 1;
            boolean retryable = cause instanceof RetriableException;
            boolean exhausted = !retryable || attempt >= properties.getMaxAttempts();
            Instant availableAt = exhausted ? clock.instant() : clock.instant().plus(backoff(attempt));
            relay.markFailed(event.eventId(), availableAt, exhausted,
                    cause.getClass().getSimpleName(), String.valueOf(cause.getMessage()));
            if (exhausted) {
                log.error("learning outbox: event {} routed to DLQ after {} attempt(s): {}",
                        event.eventId(), attempt, cause.getMessage());
            } else {
                log.warn("learning outbox: event {} rescheduled for attempt {} in {}ms: {}",
                        event.eventId(), attempt + 1, backoff(attempt).toMillis(), cause.getMessage());
            }
        }
    }

    /**
     * Bounded exponential backoff with jitter. Public so the deterministic tests
     * can pin the growth and the cap directly.
     */
    public Duration backoff(int attempt) {
        long base = properties.getBaseDelay().toMillis();
        long cap = properties.getMaxDelay().toMillis();
        long exponential = Math.min(base * (1L << Math.min(attempt - 1, 20)), cap);
        long jitter = (long) (exponential * 0.2 * Math.random());
        return Duration.ofMillis(Math.min(exponential + jitter, cap));
    }

    private static void header(ProducerRecord<String, String> record, String name, String value) {
        if (value != null) {
            record.headers().add(new RecordHeader(name, value.getBytes(StandardCharsets.UTF_8)));
        }
    }
}
