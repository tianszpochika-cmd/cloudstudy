package com.englishflow.learning.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import org.apache.kafka.clients.producer.ProducerRecord;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.kafka.core.KafkaTemplate;

import com.englishflow.learning.port.LearningOutboxRelayPort;

/** M5-013 outbound relay: whitelist, broker-ack-before-mark, retry budget and DLQ. */
class LearningOutboxKafkaRelayTest {

    private static final Instant NOW = Instant.parse("2026-09-21T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    private static LearningEventRelayProperties properties() {
        LearningEventRelayProperties properties = new LearningEventRelayProperties();
        properties.setEnabled(true);
        properties.setTopic("platform.learning.v1");
        properties.setBootstrapServers("127.0.0.1:19092");
        properties.setInstanceId("learning-service-test");
        properties.setBatchSize(100);
        properties.setLease(Duration.ofSeconds(30));
        properties.setMaxAttempts(2);
        properties.setBaseDelay(Duration.ofSeconds(1));
        properties.setMaxDelay(Duration.ofSeconds(60));
        return properties;
    }

    private static LearningOutboxRelayPort.ClaimedEvent claimed(String eventId, String eventName) {
        return new LearningOutboxRelayPort.ClaimedEvent(eventId, "42", eventName, "learning.event.v2", 2,
                "dedupe-" + eventId, "{\"taskStatus\":\"COMPLETED\"}", "req-1",
                "0123456789abcdef0123456789abcdef", 0);
    }

    private LearningOutboxKafkaRelay relay(LearningOutboxRelayPort port, KafkaTemplate<String, String> kafka) {
        return new LearningOutboxKafkaRelay(port, kafka, properties(), CLOCK);
    }

    @Test
    void whitelistedEventIsPublishedAfterBrokerAck() {
        var port = mock(LearningOutboxRelayPort.class);
        var kafka = mock(KafkaTemplate.class);
        when(port.claim(any(), any(), anyInt(), any())).thenReturn(List.of(claimed("e-1", "learning.task.completed.v2")));
        when(kafka.send(any(ProducerRecord.class))).thenReturn(CompletableFuture.completedFuture(null));

        relay(port, kafka).poll();

        ArgumentCaptor<ProducerRecord<String, String>> sent = ArgumentCaptor.forClass(ProducerRecord.class);
        verify(kafka).send(sent.capture());
        assertThat(sent.getValue().topic()).isEqualTo("platform.learning.v1");
        assertThat(sent.getValue().key()).isEqualTo("42");
        assertThat(new String(sent.getValue().headers().lastHeader("eventName").value()))
                .isEqualTo("learning.task.completed.v2");
        assertThat(new String(sent.getValue().headers().lastHeader("dedupeKey").value()))
                .startsWith("dedupe-e-1");
        verify(port).markPublished("e-1", NOW);
    }

    @Test
    void nonWhitelistedEventGoesStraightToDlq() {
        var port = mock(LearningOutboxRelayPort.class);
        var kafka = mock(KafkaTemplate.class);
        when(port.claim(any(), any(), anyInt(), any()))
                .thenReturn(List.of(claimed("e-2", "learning.plan.created")));

        relay(port, kafka).poll();

        verify(kafka, never()).send(any(ProducerRecord.class));
        verify(port).markFailed("e-2", NOW, true, "EVENT_NOT_ON_TOPIC",
                "event type learning.plan.created is not carried by platform.learning.v1");
    }

    @Test
    void brokerFailureRetriesThenDlqs() {
        var port = mock(LearningOutboxRelayPort.class);
        var kafka = mock(KafkaTemplate.class);
        when(port.claim(any(), any(), anyInt(), any())).thenReturn(List.of(claimed("e-3", "learning.task.completed.v2")));
        var failure = new CompletableFuture<org.springframework.kafka.support.SendResult<String, String>>();
        failure.completeExceptionally(new org.apache.kafka.common.errors.TimeoutException("no broker"));
        when(kafka.send(any(ProducerRecord.class))).thenReturn(failure);

        relay(port, kafka).poll();

        // TimeoutException is retriable and maxAttempts is 2: first failure reschedules
        // with bounded jitter, so pin the window instead of an exact instant.
        org.mockito.ArgumentCaptor<Instant> availableAt = org.mockito.ArgumentCaptor.forClass(Instant.class);
        verify(port).markFailed(org.mockito.ArgumentMatchers.eq("e-3"), availableAt.capture(),
                org.mockito.ArgumentMatchers.eq(false),
                org.mockito.ArgumentMatchers.eq("TimeoutException"),
                org.mockito.ArgumentMatchers.eq("no broker"));
        assertThat(!availableAt.getValue().isBefore(NOW.plusSeconds(1))
                && !availableAt.getValue().isAfter(NOW.plusMillis(1200))).isTrue();
        verify(port, never()).markPublished(any(), any());
    }

    @Test
    void backoffStaysWithinBounds() {
        var relay = relay(mock(LearningOutboxRelayPort.class), mock(KafkaTemplate.class));
        for (int attempt = 1; attempt <= 6; attempt++) {
            Duration delay = relay.backoff(attempt);
            assertThat(delay.isNegative()).isFalse();
            assertThat(delay.compareTo(Duration.ofSeconds(60)) <= 0).isTrue();
        }
    }

    @Test
    void whitelistCoversTheCanonicalTopic() {
        assertThat(LearningOutboxKafkaRelay.TOPIC_WHITELIST).containsExactlyInAnyOrder(
                "learning.mastery.projected.v2",
                "learning.review.scheduled.v2",
                "learning.task.completed.v2",
                "sync.command_receipted.v2",
                "sync.conflict_detected.v2",
                "sync.recovered.v2");
    }
}
