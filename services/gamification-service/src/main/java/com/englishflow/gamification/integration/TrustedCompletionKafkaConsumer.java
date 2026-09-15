package com.englishflow.gamification.integration;

import com.englishflow.gamification.application.GamificationApplicationService;
import com.englishflow.gamification.config.GamificationConsumerProperties;
import com.englishflow.gamification.domain.TrustedCompletionEvent;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.header.internals.RecordHeader;
import org.apache.kafka.common.header.internals.RecordHeaders;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.Acknowledgment;

import tools.jackson.databind.ObjectMapper;

/**
 * M7-001 trusted-completion consumer: learning completions arrive over the Outbox/Kafka
 * path instead of HTTP alone. The effect runs through the same idempotent
 * {@link GamificationApplicationService#consumeTrustedEvent} settlement, keyed by a stable
 * Kafka-derived idempotency key, so a redelivery settles once and a conflicting reuse fails.
 *
 * <p>Trust root: the record must carry the contract envelope headers and a v2 learning payload
 * whose source stays inside the envelope allowlist; broker ACLs (cg.gamification-from-learning.v1)
 * decide which producer may write the topic. HTTP ingestion stays as legacy-compat until the
 * M8 cutover, declared in the task evidence rather than removed overnight.
 */
public final class TrustedCompletionKafkaConsumer {

    private static final Logger log = LoggerFactory.getLogger(TrustedCompletionKafkaConsumer.class);

    private static final java.util.Set<String> RETRYABLE = java.util.Set.of(
            "TIMEOUT", "TEMPORARY_UNAVAILABLE", "CONFLICT_RETRYABLE", "TransientDataAccessException");

    private final GamificationApplicationService service;
    private final KafkaTemplate<String, String> kafka;
    private final GamificationConsumerProperties properties;
    private final Clock clock;
    private final ObjectMapper objectMapper;
    private final Sleeper sleeper;

    public TrustedCompletionKafkaConsumer(GamificationApplicationService service,
            KafkaTemplate<String, String> kafka,
            GamificationConsumerProperties properties,
            Clock clock) {
        this(service, kafka, properties, clock, new ObjectMapper(),
                duration -> Thread.sleep(duration.toMillis()));
    }

    /** Test seam: lets the deterministic tests observe the backoff without actually waiting. */
    public TrustedCompletionKafkaConsumer(GamificationApplicationService service,
            KafkaTemplate<String, String> kafka,
            GamificationConsumerProperties properties,
            Clock clock,
            ObjectMapper objectMapper,
            Sleeper sleeper) {
        this.service = java.util.Objects.requireNonNull(service, "service is required");
        this.kafka = java.util.Objects.requireNonNull(kafka, "kafka is required");
        this.properties = java.util.Objects.requireNonNull(properties, "properties is required");
        this.clock = java.util.Objects.requireNonNull(clock, "clock is required");
        this.objectMapper = java.util.Objects.requireNonNull(objectMapper, "objectMapper is required");
        this.sleeper = java.util.Objects.requireNonNull(sleeper, "sleeper is required");
    }

    @FunctionalInterface
    public interface Sleeper {
        void sleep(Duration duration) throws InterruptedException;
    }

    @KafkaListener(
            topics = "${gamification.events.consumer.topic:platform.learning.v1}",
            groupId = "${gamification.events.consumer.group-id:cg.gamification-from-learning.v1}",
            containerFactory = "gamificationInboundKafkaListenerContainerFactory",
            autoStartup = "${gamification.events.consumer.enabled:false}")
    public void onEvent(ConsumerRecord<String, String> record, Acknowledgment acknowledgment) {
        TrustedCompletionEvent event;
        String dedupeKey;
        try {
            event = toEvent(record);
            dedupeKey = requiredHeader(record, "dedupeKey");
        } catch (RuntimeException malformed) {
            publishToDlq(record, malformed, 1);
            acknowledgment.acknowledge();
            return;
        }
        // Stable across redeliveries of the same record, distinct across distinct records.
        String idempotencyKey = "kafka:" + dedupeKey;
        int attempt = 0;
        while (true) {
            attempt++;
            try {
                service.consumeTrustedEvent(event, idempotencyKey, event.sourceService());
                acknowledgment.acknowledge();
                return;
            } catch (Exception failure) {
                boolean exhausted = attempt >= properties.getMaxAttempts() || !isRetryable(failure);
                if (exhausted) {
                    publishToDlq(record, failure, attempt);
                    acknowledgment.acknowledge();
                    return;
                }
                log.warn("gamification inbound: event {} attempt {} failed, retrying: {}",
                        event.eventId(), attempt, failure.getMessage());
                if (!sleep(backoff(attempt))) {
                    return;
                }
            }
        }
    }

    /** Maps the v2 learning payload onto the trusted envelope the settlement already verifies. */
    TrustedCompletionEvent toEvent(ConsumerRecord<String, String> record) {
        String eventName = requiredHeader(record, "eventName");
        if (!"learning.task.completed.v2".equals(eventName)) {
            throw new IllegalArgumentException("unsupported trusted event: " + eventName);
        }
        Map<String, Object> payload = readJson(record.value());
        Map<String, Object> envelope = new HashMap<>();
        envelope.put("sourceService", "learning-service");
        envelope.put("eventId", requiredHeader(record, "eventId"));
        envelope.put("traceId", headerValue(record, "traceId"));
        if (envelope.get("traceId") == null) {
            throw new IllegalArgumentException("trusted event is missing the traceId header");
        }
        envelope.put("schemaVersion", "v2");
        envelope.put("occurredAt", text(payload.get("completedAt"), "completedAt"));
        envelope.put("subject", text(payload.get("subjectRef"), "subjectRef"));
        envelope.put("aggregateId", text(payload.get("completionId"), "completionId"));
        Object rulePin = payload.get("rulePin");
        String ruleVersion = rulePin instanceof Map<?, ?> pin
                ? text(pin.get("completionRuleVersion"), "rulePin.completionRuleVersion")
                : text(payload.get("completionRuleVersion"), "completionRuleVersion");
        envelope.put("ruleVersion", ruleVersion);
        envelope.put("eventType", "learning.task.completed.v2");
        return TrustedCompletionEvent.from(envelope);
    }

    /** Bounded exponential backoff with jitter. */
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
            log.warn("gamification inbound: interrupted while backing off; leaving the record unacknowledged");
            return false;
        }
    }

    private void publishToDlq(ConsumerRecord<String, String> record, Exception failure, int attempt) {
        RecordHeaders headers = new RecordHeaders();
        header(headers, "consumerGroup", properties.getGroupId());
        header(headers, "requestId", headerValue(record, "requestId"));
        header(headers, "traceId", headerValue(record, "traceId"));
        header(headers, "failureCode", failure.getClass().getSimpleName());
        header(headers, "attempt", String.valueOf(attempt));
        header(headers, "failedAt", clock.instant().toString());
        header(headers, "recoveryState", "AWAITING_OPERATOR");
        header(headers, "originalTopic", record.topic());
        ProducerRecord<String, String> dead = new ProducerRecord<>(
                properties.getDlqTopic(), null, record.key(), record.value(), headers);
        try {
            kafka.send(dead).get(properties.getPollTimeout().toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);
            log.error("gamification inbound: record routed to {} after {} attempt(s): {}",
                    properties.getDlqTopic(), attempt, failure.getMessage());
        } catch (Exception dlqFailure) {
            throw new IllegalStateException(
                    "gamification inbound: failed to route a record to the DLQ", dlqFailure);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> readJson(String value) {
        try {
            return objectMapper.readValue(value, Map.class);
        } catch (Exception unreadable) {
            throw new IllegalArgumentException("trusted event value is not JSON", unreadable);
        }
    }

    private static String text(Object value, String field) {
        if (!(value instanceof String string) || string.isBlank()) {
            throw new IllegalArgumentException("trusted event is missing " + field);
        }
        return string;
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
            throw new IllegalArgumentException("trusted event is missing the " + name + " header");
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
            return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                    .digest(String.valueOf(value).getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is required", impossible);
        }
    }
}
