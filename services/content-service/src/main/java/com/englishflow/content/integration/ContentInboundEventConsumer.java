package com.englishflow.content.integration;

import com.englishflow.content.config.ContentInboundConsumerProperties;
import com.englishflow.content.port.ContentInboundEventPort;
import com.englishflow.content.port.ContentInboundEventPort.ApplyOutcome;
import com.englishflow.content.port.ContentInboundEventPort.InboundEvent;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.header.internals.RecordHeader;
import org.apache.kafka.common.header.internals.RecordHeaders;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.Acknowledgment;

/**
 * Inbound integration-event consumer with consumer-side deduplication.
 *
 * <p>Ordering matters and is fixed by the contract: the effect and its deduplication record are
 * applied first, and only then is the offset acknowledged. A crash before the acknowledgement
 * therefore redelivers the record, which the receipt's primary key absorbs, rather than skipping an
 * effect that never ran.
 *
 * <p>A duplicate delivery is a success, not a failure: the record is acknowledged so the consumer
 * moves on instead of looping on it. A genuine failure is retried in the listener with the
 * contract's bounded exponential backoff plus jitter; once the attempt budget is exhausted, or
 * immediately for a non-retriable failure, the record is published to the DLQ with the original
 * envelope fields plus the contract's failure fields, and only then acknowledged. Retrying inside
 * the listener rather than through the container's error handler keeps the attempt count exactly the
 * configured one instead of deriving it from an elapsed-time budget.
 */
public final class ContentInboundEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(ContentInboundEventConsumer.class);

    /** Failure codes the contract treats as worth another attempt. */
    private static final java.util.Set<String> RETRYABLE = java.util.Set.of(
            "TIMEOUT", "TEMPORARY_UNAVAILABLE", "CONFLICT_RETRYABLE", "TransientDataAccessException");

    private final ContentInboundEventPort applier;
    private final KafkaTemplate<String, String> kafka;
    private final ContentInboundConsumerProperties properties;
    private final Clock clock;
    private final Sleeper sleeper;

    public ContentInboundEventConsumer(ContentInboundEventPort applier,
                                       KafkaTemplate<String, String> kafka,
                                       ContentInboundConsumerProperties properties,
                                       Clock clock) {
        this(applier, kafka, properties, clock, duration -> Thread.sleep(duration.toMillis()));
    }

    /** Test seam: lets the deterministic tests observe the backoff without actually waiting. */
    public ContentInboundEventConsumer(ContentInboundEventPort applier,
                                       KafkaTemplate<String, String> kafka,
                                       ContentInboundConsumerProperties properties,
                                       Clock clock,
                                       Sleeper sleeper) {
        this.applier = java.util.Objects.requireNonNull(applier, "applier is required");
        this.kafka = java.util.Objects.requireNonNull(kafka, "kafka is required");
        this.properties = java.util.Objects.requireNonNull(properties, "properties is required");
        this.clock = java.util.Objects.requireNonNull(clock, "clock is required");
        this.sleeper = java.util.Objects.requireNonNull(sleeper, "sleeper is required");
    }

    @FunctionalInterface
    public interface Sleeper {
        void sleep(Duration duration) throws InterruptedException;
    }

    @KafkaListener(
            topics = "${content.events.consumer.topic:platform.iam.v1}",
            groupId = "${content.events.consumer.group-id:cg.content-from-iam.v1}",
            autoStartup = "${content.events.consumer.enabled:false}")
    public void onEvent(ConsumerRecord<String, String> record, Acknowledgment acknowledgment) {
        InboundEvent event = toInboundEvent(record);
        int attempt = 0;
        while (true) {
            attempt++;
            try {
                ApplyOutcome outcome = applier.applyOnce(event, clock.instant());
                if (outcome == ApplyOutcome.DUPLICATE) {
                    log.info("content inbound: {} for {} was already applied; acknowledging the duplicate",
                            event.eventId(), event.consumerGroup());
                }
                // Committed only after the effect and the receipt are durable.
                acknowledgment.acknowledge();
                return;
            } catch (Exception failure) {
                boolean exhausted = attempt >= properties.getMaxAttempts() || !isRetryable(failure);
                if (exhausted) {
                    publishToDlq(record, event, failure, attempt);
                    acknowledgment.acknowledge();
                    return;
                }
                log.warn("content inbound: event {} attempt {} failed, retrying: {}",
                        event.eventId(), attempt, failure.getMessage());
                if (!sleep(backoff(attempt))) {
                    return;
                }
            }
        }
    }

    /** Bounded exponential backoff with jitter, mirroring the publisher's retry block. */
    public Duration backoff(int attempt) {
        long base = properties.getBaseDelay().toMillis();
        long cap = properties.getMaxDelay().toMillis();
        long exponential = Math.min(base * (1L << Math.min(attempt - 1, 20)), cap);
        long jitter = (long) (exponential * 0.2 * Math.random());
        return Duration.ofMillis(Math.min(exponential + jitter, cap));
    }

    private boolean sleep(Duration duration) {
        try {
            sleeper.sleep(duration);
            return true;
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            log.warn("content inbound: interrupted while backing off; leaving the record unacknowledged "
                    + "so it is redelivered rather than silently skipped");
            return false;
        }
    }

    /**
     * Publishes the failed record to the DLQ. The contract requires the original envelope fields to
     * survive and the failure fields to be added; no client authorization header is forwarded.
     */
    private void publishToDlq(ConsumerRecord<String, String> record, InboundEvent event,
                              Exception failure, int attempt) {
        RecordHeaders headers = new RecordHeaders();
        header(headers, "eventId", event.eventId());
        header(headers, "eventName", event.eventName());
        header(headers, "schemaVersion", event.schemaVersion());
        header(headers, "dedupeKey", event.dedupeKey());
        header(headers, "requestId", headerValue(record, "requestId"));
        header(headers, "traceId", headerValue(record, "traceId"));
        header(headers, "consumerGroup", event.consumerGroup());
        header(headers, "failureCode", failure.getClass().getSimpleName());
        header(headers, "attempt", String.valueOf(attempt));
        header(headers, "failedAt", clock.instant().toString());
        header(headers, "recoveryState", "AWAITING_OPERATOR");
        ProducerRecord<String, String> dead = new ProducerRecord<>(
                properties.getDlqTopic(), null, record.key(), record.value(), headers);
        try {
            kafka.send(dead).get(properties.getPollTimeout().toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);
            log.error("content inbound: event {} routed to {} after {} attempt(s): {}",
                    event.eventId(), properties.getDlqTopic(), attempt, failure.getMessage());
        } catch (Exception dlqFailure) {
            // The DLQ write itself failed, so the record must NOT be acknowledged: redelivery is the
            // only way left to avoid losing it, and the duplicate is absorbed by the receipt.
            throw new IllegalStateException(
                    "content inbound: failed to route event " + event.eventId() + " to the DLQ", dlqFailure);
        }
    }

    private InboundEvent toInboundEvent(ConsumerRecord<String, String> record) {
        return new InboundEvent(
                properties.getGroupId(),
                requiredHeader(record, "eventId"),
                requiredHeader(record, "eventName"),
                requiredHeader(record, "schemaVersion"),
                requiredHeader(record, "dedupeKey"),
                sha256(record.value()));
    }

    private static boolean isRetryable(Exception failure) {
        for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
            if (RETRYABLE.contains(cause.getClass().getSimpleName())) {
                return true;
            }
            if (cause instanceof org.springframework.dao.TransientDataAccessException) {
                return true;
            }
            if (cause instanceof org.apache.kafka.common.errors.RetriableException) {
                return true;
            }
        }
        return false;
    }

    private static String requiredHeader(ConsumerRecord<String, String> record, String name) {
        String value = headerValue(record, name);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("inbound event is missing the " + name + " header");
        }
        return value;
    }

    private static String headerValue(ConsumerRecord<String, String> record, String name) {
        org.apache.kafka.common.header.Header header = record.headers().lastHeader(name);
        return header == null ? null : new String(header.value(), StandardCharsets.UTF_8);
    }

    private static void header(RecordHeaders headers, String name, String value) {
        if (value != null) {
            headers.add(new RecordHeader(name, value.getBytes(StandardCharsets.UTF_8)));
        }
    }

    static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(String.valueOf(value).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is required", impossible);
        }
    }
}
