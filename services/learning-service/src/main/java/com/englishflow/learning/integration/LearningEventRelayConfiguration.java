package com.englishflow.learning.integration;

import java.util.HashMap;
import java.util.Map;

import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.transaction.support.TransactionTemplate;

import com.englishflow.learning.adapter.jdbc.JdbcLearningOutboxRelay;
import com.englishflow.learning.port.LearningOutboxRelayPort;

import java.time.Clock;

/**
 * Composes the learning outbox relay (M5-013). It is off by default: an
 * unconfigured broker must not silently change delivery semantics, and the
 * deterministic suites keep running without a Kafka container.
 *
 * <p>The producer is idempotent so broker-internal retries cannot duplicate a record, but the
 * delivery claim stays at-least-once: a crash after the acknowledgement and before the PUBLISHED
 * update still produces a legitimate duplicate for consumer-side deduplication to absorb.
 */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
@EnableConfigurationProperties(LearningEventRelayProperties.class)
@ConditionalOnProperty(prefix = "learning.events.relay", name = "enabled", havingValue = "true")
public class LearningEventRelayConfiguration {

    @Bean
    @ConditionalOnMissingBean(LearningOutboxRelayPort.class)
    LearningOutboxRelayPort learningOutboxRelayPort(JdbcTemplate jdbcTemplate,
            TransactionTemplate transactions) {
        return new JdbcLearningOutboxRelay(jdbcTemplate, transactions);
    }

    @Bean
    @ConditionalOnMissingBean(name = "learningEventProducerFactory")
    ProducerFactory<String, String> learningEventProducerFactory(LearningEventRelayProperties properties) {
        Map<String, Object> config = new HashMap<>();
        config.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, properties.getBootstrapServers());
        config.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        config.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        config.put(ProducerConfig.ACKS_CONFIG, "all");
        config.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        config.put(ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION, 5);
        config.put(ProducerConfig.CLIENT_ID_CONFIG, properties.getInstanceId());
        return new DefaultKafkaProducerFactory<>(config);
    }

    @Bean
    @ConditionalOnMissingBean(name = "learningEventKafkaTemplate")
    KafkaTemplate<String, String> learningEventKafkaTemplate(
            ProducerFactory<String, String> learningEventProducerFactory) {
        return new KafkaTemplate<>(learningEventProducerFactory);
    }

    @Bean
    @ConditionalOnMissingBean(LearningOutboxKafkaRelay.class)
    LearningOutboxKafkaRelay learningOutboxKafkaRelay(LearningOutboxRelayPort learningOutboxRelayPort,
            KafkaTemplate<String, String> learningEventKafkaTemplate,
            LearningEventRelayProperties properties,
            Clock learningClock) {
        return new LearningOutboxKafkaRelay(learningOutboxRelayPort, learningEventKafkaTemplate,
                properties, learningClock);
    }
}
