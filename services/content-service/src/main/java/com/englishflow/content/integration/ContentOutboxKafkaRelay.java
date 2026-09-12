package com.englishflow.content.integration;

import com.englishflow.content.config.ContentEventRelayProperties;
import com.englishflow.content.port.ContentOutboxRelayPort;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.TimeUnit;

import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.errors.RetriableException;
import org.apache.kafka.common.header.internals.RecordHeader;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * Publishes claimed outbox rows to Kafka with at-least-once delivery.
 *
 * <p>The contract fixes the semantics this class implements: a row is marked PUBLISHED only after the
 * broker acknowledged the record (publishConfirmation: broker-ack-before-mark-published), a failed
 * attempt is rescheduled with bounded exponential backoff plus jitter, and an exhausted attempt
 * budget routes the event to DLQ rather than dropping it or writing any domain fact.
 *
 * <p>Exactly-once is explicitly not claimed anywhere: a crash between the broker acknowledgement and
 * the PUBLISHED update legitimately produces a duplicate, which is what consumer-side deduplication
 * on (consumerGroup, eventId) exists to absorb.
 */
public final class ContentOutboxKafkaRelay {

    private static final Logger log = LoggerFactory.getLogger(ContentOutboxKafkaRelay.class);

    private final ContentOutboxRelayPort relay;
    private final KafkaTemplate<String, String> kafka;
    private final ContentEventRelayProperties properties;
    private final Clock clock;

    public ContentOutboxKafkaRelay(ContentOutboxRelayPort relay,
                                   KafkaTemplate<String, String> kafka,
                                   ContentEventRelayProperties properties,
                                   Clock clock) {
        this.relay = relay;
        this.kafka = kafka;
        this.properties = properties;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${content.events.relay.poll-interval:5s}",
            initialDelayString = "${content.events.relay.initial-delay:10s}")
    public void poll() {
        Instant now = clock.instant();
        int reclaimed = relay.reclaimExpiredLeases(now);
        if (reclaimed > 0) {
            log.warn("content outbox: reclaimed {} row(s) whose publishing lease had expired", reclaimed);
        }
        List<ContentOutboxRelayPort.ClaimedEvent> claimed =
                relay.claim(properties.getInstanceId(), now, properties.getBatchSize(), properties.getLease());
        for (ContentOutboxRelayPort.ClaimedEvent event : claimed) {
            publish(event);
        }
    }

    private void publish(ContentOutboxRelayPort.ClaimedEvent event) {
        ProducerRecord<String, String> record = new ProducerRecord<>(
                properties.getTopic(), null, event.aggregateId(), event.payloadJson());
        // The contract requires these to survive on the wire, including into DLQ.
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
                log.error("content outbox: event {} routed to DLQ after {} attempt(s): {}",
                        event.eventId(), attempt, cause.getMessage());
            } else {
                log.warn("content outbox: event {} rescheduled for attempt {} in {}ms: {}",
                        event.eventId(), attempt + 1, backoff(attempt).toMillis(), cause.getMessage());
            }
        }
    }

    /**
     * Bounded exponential backoff with jitter, per the contract's retry block: the delay doubles per
     * attempt and is capped, and the jitter keeps a batch that failed together from stampeding.
     * Public so the deterministic tests can pin the growth and the cap directly.
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
