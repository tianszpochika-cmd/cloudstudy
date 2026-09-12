package com.englishflow.content;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.englishflow.content.config.ContentEventRelayProperties;
import com.englishflow.content.integration.ContentOutboxKafkaRelay;
import com.englishflow.content.port.ContentOutboxRelayPort;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.errors.TimeoutException;
import org.apache.kafka.common.errors.SerializationException;

import org.junit.jupiter.api.Test;

import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

/**
 * Deterministic tests for the outbox relay's delivery semantics. They pin the three properties the
 * event runtime contract cares about: a row is only marked published once the broker acknowledged
 * it, a retryable failure is rescheduled inside the bounded backoff window, and an exhausted or
 * non-retryable failure ends in DLQ rather than being dropped.
 */
class ContentOutboxKafkaRelayTest {

    private static final Instant NOW = Instant.parse("2026-09-13T12:00:00Z");

    @Test
    void marksPublishedOnlyAfterTheBrokerAcknowledges() {
        FakeRelayPort port = new FakeRelayPort(List.of(event(1)));
        FakeKafka kafka = new FakeKafka();
        ContentOutboxKafkaRelay relay = relay(port, kafka, 5);

        relay.poll();

        assertEquals(List.of(event(1).eventId()), kafka.sentEventIds());
        assertEquals(List.of(event(1).eventId()), port.published);
        assertTrue(port.failed.isEmpty(), "an acknowledged record must not be marked failed");
        // The record carries the envelope fields the contract requires to survive on the wire.
        Map<String, String> headers = kafka.headersOf(0);
        assertEquals(event(1).eventId(), headers.get("eventId"));
        assertEquals(event(1).eventName(), headers.get("eventName"));
        assertEquals(event(1).schemaVersion(), headers.get("schemaVersion"));
        assertEquals(event(1).dedupeKey(), headers.get("dedupeKey"));
        assertEquals(event(1).requestId(), headers.get("requestId"));
        assertEquals(event(1).traceId(), headers.get("traceId"));
        assertEquals(event(1).aggregateId(), kafka.keys.get(0), "the aggregate id is the partition key");
    }

    @Test
    void reschedulesARetryableFailureInsideTheBackoffWindow() {
        // attemptCount is the value read before this attempt was claimed, so 0 means the failure
        // below is the first attempt and must be scheduled on the base delay.
        FakeRelayPort port = new FakeRelayPort(List.of(event(0)));
        FakeKafka kafka = new FakeKafka();
        kafka.failWith(new TimeoutException("broker unavailable"));
        ContentOutboxKafkaRelay relay = relay(port, kafka, 5);

        relay.poll();

        assertTrue(port.published.isEmpty(), "a failed publish must not be recorded as published");
        assertEquals(1, port.failed.size());
        Failure failure = port.failed.get(0);
        assertEquals(false, failure.exhausted);
        assertTrue(failure.availableAt.isAfter(NOW), "a retry must be scheduled in the future");
        long delay = Duration.between(NOW, failure.availableAt).toMillis();
        assertTrue(delay > 1000 && delay <= 1200,
                "the first retry uses the 1s base delay plus at most 20% jitter, got " + delay + "ms");
    }

    @Test
    void doublesTheDelayForEachFurtherAttempt() {
        FakeRelayPort port = new FakeRelayPort(List.of(event(1)));
        FakeKafka kafka = new FakeKafka();
        kafka.failWith(new TimeoutException("broker unavailable"));
        ContentOutboxKafkaRelay relay = relay(port, kafka, 5);

        relay.poll();

        long delay = Duration.between(NOW, port.failed.get(0).availableAt).toMillis();
        assertTrue(delay > 2000 && delay <= 2400,
                "the second attempt waits on the doubled base delay, got " + delay + "ms");
    }

    @Test
    void routesExhaustedAttemptsToDlq() {
        FakeRelayPort port = new FakeRelayPort(List.of(event(4)));
        FakeKafka kafka = new FakeKafka();
        kafka.failWith(new TimeoutException("still unavailable"));
        ContentOutboxKafkaRelay relay = relay(port, kafka, 5);

        relay.poll();

        assertEquals(1, port.failed.size());
        assertTrue(port.failed.get(0).exhausted, "the fifth attempt exhausts the budget and must go to DLQ");
    }

    @Test
    void routesNonRetryableFailuresStraightToDlq() {
        FakeRelayPort port = new FakeRelayPort(List.of(event(0)));
        FakeKafka kafka = new FakeKafka();
        kafka.failWith(new SerializationException("payload cannot be serialized"));
        ContentOutboxKafkaRelay relay = relay(port, kafka, 5);

        relay.poll();

        assertTrue(port.failed.get(0).exhausted,
                "a non-retryable failure must not consume the retry budget");
    }

    @Test
    void backoffGrowsExponentiallyAndStaysCapped() {
        ContentOutboxKafkaRelay relay = relay(new FakeRelayPort(List.of()), new FakeKafka(), 10);
        long previous = 0;
        for (int attempt = 1; attempt <= 10; attempt++) {
            long millis = relay.backoff(attempt).toMillis();
            assertTrue(millis <= 60_000, "backoff must stay within the 60s cap, got " + millis);
            if (attempt > 1) {
                assertTrue(millis >= previous, "backoff must not shrink between attempts");
            }
            previous = millis;
        }
        assertTrue(relay.backoff(30).toMillis() <= 60_000,
                "a very high attempt still resolves to at most the cap");
    }

    @Test
    void reclaimsExpiredLeasesBeforeClaiming() {
        FakeRelayPort port = new FakeRelayPort(List.of());
        ContentOutboxKafkaRelay relay = relay(port, new FakeKafka(), 5);

        relay.poll();

        assertEquals(1, port.reclaimCalls, "a crashed relay's rows must be reclaimed on every poll");
    }

    private static ContentOutboxKafkaRelay relay(FakeRelayPort port, FakeKafka kafka, int maxAttempts) {
        ContentEventRelayProperties properties = new ContentEventRelayProperties();
        properties.setEnabled(true);
        properties.setMaxAttempts(maxAttempts);
        properties.setBaseDelay(Duration.ofSeconds(1));
        properties.setMaxDelay(Duration.ofSeconds(60));
        return new ContentOutboxKafkaRelay(port, kafka, properties, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static ContentOutboxRelayPort.ClaimedEvent event(int attemptCount) {
        return new ContentOutboxRelayPort.ClaimedEvent(
                "11111111-1111-4111-8111-111111111111", "content-1", "content.version.published.v1",
                "content.event.v1", 1, "dedupe-1", "{\"k\":\"v\"}", "req-1", "trace-1", attemptCount);
    }

    private record Failure(String eventId, Instant availableAt, boolean exhausted, String code, String message) {
    }

    private static final class FakeRelayPort implements ContentOutboxRelayPort {

        private final List<ClaimedEvent> claimed;
        final List<String> published = new ArrayList<>();
        final List<Failure> failed = new ArrayList<>();
        int reclaimCalls;

        FakeRelayPort(List<ClaimedEvent> claimed) {
            this.claimed = claimed;
        }

        @Override
        public List<ClaimedEvent> claim(String instanceId, Instant now, int batchSize, Duration lease) {
            return claimed;
        }

        @Override
        public void markPublished(String eventId, Instant publishedAt) {
            published.add(eventId);
        }

        @Override
        public void markFailed(String eventId, Instant availableAt, boolean exhausted, String errorCode, String errorMessage) {
            failed.add(new Failure(eventId, availableAt, exhausted, errorCode, errorMessage));
        }

        @Override
        public int reclaimExpiredLeases(Instant now) {
            reclaimCalls++;
            return 0;
        }
    }

    private static final class FakeKafka extends KafkaTemplate<String, String> {

        final List<String> keys = new ArrayList<>();
        private final List<Map<String, String>> headers = new ArrayList<>();
        private RuntimeException failure;

        FakeKafka() {
            super(new DefaultKafkaProducerFactory<>(Map.of(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "127.0.0.1:1")));
        }

        void failWith(RuntimeException failure) {
            this.failure = failure;
        }

        List<String> sentEventIds() {
            return headers.stream().map(entry -> entry.get("eventId")).toList();
        }

        Map<String, String> headersOf(int index) {
            return headers.get(index);
        }

        @Override
        public CompletableFuture<SendResult<String, String>> send(ProducerRecord<String, String> record) {
            if (failure != null) {
                return CompletableFuture.failedFuture(failure);
            }
            Map<String, String> captured = new HashMap<>();
            record.headers().forEach(header -> captured.put(header.key(), new String(header.value())));
            assertNotNull(captured.get("eventId"));
            headers.add(captured);
            keys.add(record.key());
            return CompletableFuture.completedFuture(null);
        }
    }
}

