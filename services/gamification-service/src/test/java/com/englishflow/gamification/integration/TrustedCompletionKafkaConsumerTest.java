package com.englishflow.gamification.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.CompletableFuture;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.header.internals.RecordHeaders;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.Acknowledgment;

import com.englishflow.gamification.application.GamificationApplicationService;
import com.englishflow.gamification.config.GamificationConsumerProperties;
import com.englishflow.gamification.domain.GamificationDomainException;
import com.englishflow.gamification.domain.TrustedCompletionEvent;

import tools.jackson.databind.ObjectMapper;

/** M7-001 inbound consumer: mapping, idempotent settlement key, retry budget and DLQ. */
class TrustedCompletionKafkaConsumerTest {

    private static final Instant NOW = Instant.parse("2026-09-21T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    private static GamificationConsumerProperties properties() {
        GamificationConsumerProperties properties = new GamificationConsumerProperties();
        properties.setGroupId("cg.gamification-from-learning.v1");
        properties.setTopic("platform.learning.v1");
        properties.setDlqTopic("platform.events.dlq.v1");
        properties.setBootstrapServers("127.0.0.1:19092");
        properties.setMaxAttempts(1);
        properties.setBaseDelay(Duration.ofSeconds(1));
        properties.setMaxDelay(Duration.ofSeconds(60));
        properties.setPollTimeout(Duration.ofSeconds(3));
        return properties;
    }

    private static ConsumerRecord<String, String> record(String value) {
        ConsumerRecord<String, String> record =
                new ConsumerRecord<>("platform.learning.v1", 0, 0L, "subject-1", value);
        record.headers().add("eventName", "learning.task.completed.v2".getBytes(StandardCharsets.UTF_8));
        record.headers().add("eventId", "evt-1".getBytes(StandardCharsets.UTF_8));
        record.headers().add("dedupeKey", "task-7:completed:3".getBytes(StandardCharsets.UTF_8));
        record.headers().add("traceId", "0123456789abcdef0123456789abcdef".getBytes(StandardCharsets.UTF_8));
        record.headers().add("requestId", "req-1".getBytes(StandardCharsets.UTF_8));
        return record;
    }

    private static String value() {
        return "{\"completedAt\":\"2026-09-21T00:00:00Z\",\"subjectRef\":\"subject-1\","
                + "\"completionId\":\"task-7\",\"completionRuleVersion\":\"P1_TASK_COMPLETION_V1\"}";
    }

    private TrustedCompletionKafkaConsumer consumer(GamificationApplicationService service,
            KafkaTemplate<String, String> kafka) {
        return new TrustedCompletionKafkaConsumer(service, kafka, properties(), CLOCK,
                new ObjectMapper(), duration -> {
                });
    }

    @Test
    void mapsRecordOntoTrustedEnvelope() {
        var consumer = consumer(mock(GamificationApplicationService.class), mock(KafkaTemplate.class));
        TrustedCompletionEvent event = consumer.toEvent(record(value()));
        assertEquals("learning-service", event.sourceService());
        assertEquals("evt-1", event.eventId());
        assertEquals("subject-1", event.subjectId());
        assertEquals("task-7", event.aggregateId());
        assertEquals("P1_TASK_COMPLETION_V1", event.ruleVersion());
        assertEquals("learning.task.completed.v2", event.eventType());
    }

    @Test
    void rejectsWrongEventNameMissingTraceAndBadJson() {
        var consumer = consumer(mock(GamificationApplicationService.class), mock(KafkaTemplate.class));
        ConsumerRecord<String, String> wrongName = record(value());
        wrongName.headers().remove("eventName");
        wrongName.headers().add("eventName", "learning.task.completed.v1".getBytes(StandardCharsets.UTF_8));
        assertThrows(IllegalArgumentException.class, () -> consumer.toEvent(wrongName));
        ConsumerRecord<String, String> noTrace = record(value());
        noTrace.headers().remove("traceId");
        assertThrows(IllegalArgumentException.class, () -> consumer.toEvent(noTrace));
        assertThrows(IllegalArgumentException.class, () -> consumer.toEvent(record("not-json")));
    }

    @Test
    void backoffStaysWithinBounds() {
        var consumer = consumer(mock(GamificationApplicationService.class), mock(KafkaTemplate.class));
        for (int attempt = 1; attempt <= 6; attempt++) {
            Duration delay = consumer.backoff(attempt);
            assertTrue(!delay.isNegative() && delay.compareTo(Duration.ofSeconds(60)) <= 0,
                    "backoff must stay within [0, maxDelay]");
        }
    }

    @Test
    @SuppressWarnings({ "unchecked", "rawtypes" })
    void successSettlesOnceWithStableKeyAndAcks() {
        var service = mock(GamificationApplicationService.class);
        var kafka = mock(KafkaTemplate.class);
        var ack = mock(Acknowledgment.class);
        consumer(service, kafka).onEvent(record(value()), ack);
        verify(service).consumeTrustedEvent(any(TrustedCompletionEvent.class),
                org.mockito.ArgumentMatchers.eq("kafka:task-7:completed:3"),
                org.mockito.ArgumentMatchers.eq("learning-service"));
        verify(ack).acknowledge();
        verify(kafka, never()).send((ProducerRecord) any());
    }

    @Test
    @SuppressWarnings({ "unchecked", "rawtypes" })
    void malformedRecordGoesToDlqAndAcks() {
        var service = mock(GamificationApplicationService.class);
        var kafka = mock(KafkaTemplate.class);
        when(kafka.send((ProducerRecord) any()))
                .thenReturn(CompletableFuture.completedFuture(null));
        var ack = mock(Acknowledgment.class);
        consumer(service, kafka).onEvent(record("not-json"), ack);
        verify(service, never()).consumeTrustedEvent(any(), any(), any());
        ArgumentCaptor<ProducerRecord> dlq = ArgumentCaptor.forClass(ProducerRecord.class);
        verify(kafka).send(dlq.capture());
        assertEquals("platform.events.dlq.v1", dlq.getValue().topic());
        assertEquals("subject-1", dlq.getValue().key());
        verify(ack).acknowledge();
    }

    @Test
    @SuppressWarnings({ "unchecked", "rawtypes" })
    void exhaustedFailureGoesToDlqAndAcks() {
        var service = mock(GamificationApplicationService.class);
        var kafka = mock(KafkaTemplate.class);
        when(kafka.send((ProducerRecord) any()))
                .thenReturn(CompletableFuture.completedFuture(null));
        when(service.consumeTrustedEvent(any(), any(), any()))
                .thenThrow(GamificationDomainException.invalidEvent("boom"));
        var ack = mock(Acknowledgment.class);
        consumer(service, kafka).onEvent(record(value()), ack);
        ArgumentCaptor<ProducerRecord> dlq = ArgumentCaptor.forClass(ProducerRecord.class);
        verify(kafka).send(dlq.capture());
        assertEquals("platform.events.dlq.v1", dlq.getValue().topic());
        verify(ack).acknowledge();
    }
}
