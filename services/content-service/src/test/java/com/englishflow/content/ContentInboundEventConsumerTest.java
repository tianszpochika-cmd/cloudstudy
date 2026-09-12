package com.englishflow.content;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.englishflow.content.config.ContentInboundConsumerProperties;
import com.englishflow.content.integration.ContentInboundEventConsumer;
import com.englishflow.content.port.ContentInboundEventPort;
import com.englishflow.content.port.ContentInboundEventPort.ApplyOutcome;
import com.englishflow.content.port.ContentInboundEventPort.InboundEvent;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.header.internals.RecordHeader;
import org.apache.kafka.common.header.internals.RecordHeaders;

import org.junit.jupiter.api.Test;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.kafka.support.SendResult;

/**
 * Deterministic tests for the inbound consumer's contract semantics: a duplicate is acknowledged
 * without re-running the effect, a failure is retried up to the configured budget and then routed to
 * the DLQ, a non-retriable failure skips the budget, and a record whose DLQ write failed is left
 * unacknowledged so it is redelivered rather than lost.
 */
class ContentInboundEventConsumerTest {

    private static final Instant NOW = Instant.parse("2026-09-13T12:00:00Z");

    @Test
    void acknowledgesAfterTheEffectIsApplied() {
        FakeApplier applier = new FakeApplier(ApplyOutcome.APPLIED);
        FakeKafka kafka = new FakeKafka();
        FakeAck ack = new FakeAck();
        consumer(applier, kafka).onEvent(record("evt-1"), ack);

        assertEquals(1, applier.calls.size());
        assertEquals(1, ack.acknowledged, "the offset must be committed after the effect");
        assertTrue(kafka.sent.isEmpty(), "a successful delivery must not reach the DLQ");
    }

    @Test
    void acknowledgesADuplicateWithoutRunningTheEffectAgain() {
        FakeApplier applier = new FakeApplier(ApplyOutcome.DUPLICATE);
        FakeKafka kafka = new FakeKafka();
        FakeAck ack = new FakeAck();
        consumer(applier, kafka).onEvent(record("evt-2"), ack);

        assertEquals(1, applier.calls.size());
        assertEquals(1, ack.acknowledged, "a duplicate is a success and must be acknowledged");
        assertTrue(kafka.sent.isEmpty(), "a duplicate must not be treated as a failure");
    }

    @Test
    void retriesARetryableFailureAndThenRoutesItToDlq() {
        FakeApplier applier = new FakeApplier(ApplyOutcome.APPLIED);
        applier.failWith(new QueryTimeoutException("database is unavailable"));
        FakeKafka kafka = new FakeKafka();
        FakeAck ack = new FakeAck();
        RecordingSleeper sleeper = new RecordingSleeper();
        ContentInboundEventConsumer consumer = consumer(applier, kafka, sleeper);

        consumer.onEvent(record("evt-3"), ack);

        assertEquals(5, applier.calls.size(), "the retry budget is exactly maxAttempts");
        assertEquals(1, kafka.sent.size(), "an exhausted budget routes the record to the DLQ");
        assertEquals("platform.events.dlq.v1", kafka.sent.get(0).topic());
        assertEquals(1, ack.acknowledged, "the record is acknowledged once it is safely in the DLQ");
        assertEquals(4, sleeper.slept.size(), "no sleep after the final attempt");
    }

    @Test
    void routesANonRetryableFailureStraightToDlq() {
        FakeApplier applier = new FakeApplier(ApplyOutcome.APPLIED);
        applier.failWith(new DataIntegrityViolationException("schema violation"));
        FakeKafka kafka = new FakeKafka();
        FakeAck ack = new FakeAck();
        ContentInboundEventConsumer consumer = consumer(applier, kafka);

        consumer.onEvent(record("evt-4"), ack);

        assertEquals(1, applier.calls.size(), "a non-retriable failure must not consume the budget");
        assertEquals(1, kafka.sent.size());
        assertEquals(1, ack.acknowledged);
    }

    @Test
    void leavesTheRecordUnacknowledgedWhenTheDlqWriteItselfFails() {
        FakeApplier applier = new FakeApplier(ApplyOutcome.APPLIED);
        applier.failWith(new DataIntegrityViolationException("schema violation"));
        FakeKafka kafka = new FakeKafka();
        kafka.failWith(new org.apache.kafka.common.errors.TimeoutException("no broker"));
        FakeAck ack = new FakeAck();
        ContentInboundEventConsumer consumer = consumer(applier, kafka);

        assertThrows(IllegalStateException.class, () -> consumer.onEvent(record("evt-5"), ack));
        assertEquals(0, ack.acknowledged,
                "the record must stay unacknowledged so redelivery can retry the DLQ write");
    }

    @Test
    void dlqRecordCarriesTheOriginalEnvelopeAndTheFailureFields() {
        FakeApplier applier = new FakeApplier(ApplyOutcome.APPLIED);
        applier.failWith(new DataIntegrityViolationException("schema violation"));
        FakeKafka kafka = new FakeKafka();
        consumer(applier, kafka).onEvent(record("evt-6"), new FakeAck());

        Map<String, String> headers = kafka.headersOf(0);
        assertEquals("evt-6", headers.get("eventId"));
        assertEquals("iam.account.registered.v1", headers.get("eventName"));
        assertEquals("iam.event.v1", headers.get("schemaVersion"));
        assertEquals("dedupe-6", headers.get("dedupeKey"));
        assertEquals("req-6", headers.get("requestId"));
        assertEquals("trace-6", headers.get("traceId"));
        assertEquals("cg.content-from-iam.v1", headers.get("consumerGroup"));
        assertEquals("DataIntegrityViolationException", headers.get("failureCode"));
        assertEquals("1", headers.get("attempt"));
        assertEquals("AWAITING_OPERATOR", headers.get("recoveryState"));
        assertNotNull(headers.get("failedAt"));
    }

    @Test
    void routesARecordWithNoEnvelopeHeaderStraightToDlq() {
        // A record that cannot be read can never succeed however often it is retried, so it must be
        // taken out of the partition immediately instead of blocking every later record behind it.
        FakeApplier applier = new FakeApplier(ApplyOutcome.APPLIED);
        FakeKafka kafka = new FakeKafka();
        FakeAck ack = new FakeAck();
        ConsumerRecord<String, String> bare = new ConsumerRecord<>("platform.iam.v1", 0, 0L, "k", "{}");

        consumer(applier, kafka).onEvent(bare, ack);

        assertEquals(0, applier.calls.size(), "an unreadable envelope must never reach the effect");
        assertEquals(1, kafka.sent.size(), "it is routed to the DLQ instead");
        assertEquals("UNREADABLE", kafka.headersOf(0).get("envelopeState"));
        assertEquals("IllegalArgumentException", kafka.headersOf(0).get("failureCode"));
        assertEquals(1, ack.acknowledged, "and acknowledged, so the partition moves on");
    }

    @Test
    void backoffGrowsAndStaysWithinTheCap() {
        ContentInboundEventConsumer consumer = consumer(new FakeApplier(ApplyOutcome.APPLIED), new FakeKafka());
        long previous = 0;
        for (int attempt = 1; attempt <= 12; attempt++) {
            long millis = consumer.backoff(attempt).toMillis();
            assertTrue(millis <= 60_000, "backoff must stay within the cap, got " + millis);
            assertTrue(millis >= previous, "backoff must not shrink");
            previous = millis;
        }
    }

    private static ContentInboundEventConsumer consumer(FakeApplier applier, FakeKafka kafka) {
        return consumer(applier, kafka, new RecordingSleeper());
    }

    private static ContentInboundEventConsumer consumer(FakeApplier applier, FakeKafka kafka,
                                                       ContentInboundEventConsumer.Sleeper sleeper) {
        ContentInboundConsumerProperties properties = new ContentInboundConsumerProperties();
        properties.setEnabled(true);
        properties.setMaxAttempts(5);
        properties.setBaseDelay(Duration.ofSeconds(1));
        properties.setMaxDelay(Duration.ofSeconds(60));
        return new ContentInboundEventConsumer(applier, kafka, properties, Clock.fixed(NOW, ZoneOffset.UTC), sleeper);
    }

    private static ConsumerRecord<String, String> record(String eventId) {
        ConsumerRecord<String, String> record =
                new ConsumerRecord<>("platform.iam.v1", 0, 0L, "key", "{\"probe\":\"" + eventId + "\"}");
        header(record.headers(), "eventId", eventId);
        header(record.headers(), "eventName", "iam.account.registered.v1");
        header(record.headers(), "schemaVersion", "iam.event.v1");
        header(record.headers(), "dedupeKey", "dedupe-" + eventId.substring(eventId.length() - 1));
        header(record.headers(), "requestId", "req-" + eventId.substring(eventId.length() - 1));
        header(record.headers(), "traceId", "trace-" + eventId.substring(eventId.length() - 1));
        return record;
    }

    private static void header(org.apache.kafka.common.header.Headers headers, String name, String value) {
        headers.add(new RecordHeader(name, value.getBytes(StandardCharsets.UTF_8)));
    }

    private static final class RecordingSleeper implements ContentInboundEventConsumer.Sleeper {
        final List<Duration> slept = new ArrayList<>();

        @Override
        public void sleep(Duration duration) {
            slept.add(duration);
        }
    }

    private static final class FakeAck implements Acknowledgment {
        int acknowledged;

        @Override
        public void acknowledge() {
            acknowledged++;
        }

        @Override
        public void nack(Duration sleep) {
            throw new UnsupportedOperationException();
        }
    }

    private static final class FakeApplier implements ContentInboundEventPort {
        final List<InboundEvent> calls = new ArrayList<>();
        private final ApplyOutcome outcome;
        private RuntimeException failure;

        FakeApplier(ApplyOutcome outcome) {
            this.outcome = outcome;
        }

        void failWith(RuntimeException failure) {
            this.failure = failure;
        }

        @Override
        public ApplyOutcome applyOnce(InboundEvent event, Instant receivedAt) {
            calls.add(event);
            if (failure != null) {
                throw failure;
            }
            return outcome;
        }
    }

    private static final class FakeKafka extends KafkaTemplate<String, String> {
        final List<ProducerRecord<String, String>> sent = new ArrayList<>();
        private RuntimeException failure;

        FakeKafka() {
            super(new DefaultKafkaProducerFactory<>(Map.of(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "127.0.0.1:1")));
        }

        void failWith(RuntimeException failure) {
            this.failure = failure;
        }

        Map<String, String> headersOf(int index) {
            Map<String, String> captured = new java.util.HashMap<>();
            sent.get(index).headers().forEach(header -> captured.put(header.key(), new String(header.value())));
            return captured;
        }

        @Override
        public CompletableFuture<SendResult<String, String>> send(ProducerRecord<String, String> record) {
            if (failure != null) {
                return CompletableFuture.failedFuture(failure);
            }
            sent.add(record);
            return CompletableFuture.completedFuture(null);
        }
    }
}
