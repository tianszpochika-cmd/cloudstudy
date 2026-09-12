package com.englishflow.content.config;

import com.englishflow.content.adapter.jdbc.JdbcContentOutboxRelay;
import com.englishflow.content.integration.ContentOutboxKafkaRelay;
import com.englishflow.content.port.ContentOutboxRelayPort;

import java.time.Clock;
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

/**
 * Composes the content outbox relay. It is off by default: an unconfigured broker must not silently
 * change delivery semantics, and the deterministic suites keep running without a Kafka container.
 *
 * <p>The producer is idempotent so broker-internal retries cannot duplicate a record, but the
 * delivery claim stays at-least-once: a crash after the acknowledgement and before the PUBLISHED
 * update still produces a legitimate duplicate for consumer-side deduplication to absorb.
 */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
@EnableConfigurationProperties(ContentEventRelayProperties.class)
@ConditionalOnProperty(prefix = "content.events.relay", name = "enabled", havingValue = "true")
public class ContentEventRelayConfiguration {

    @Bean
    @ConditionalOnMissingBean(ContentOutboxRelayPort.class)
    ContentOutboxRelayPort contentOutboxRelayPort(JdbcTemplate jdbcTemplate, TransactionTemplate transactions) {
        return new JdbcContentOutboxRelay(jdbcTemplate, transactions);
    }

    @Bean
    @ConditionalOnMissingBean(name = "contentEventProducerFactory")
    ProducerFactory<String, String> contentEventProducerFactory(ContentEventRelayProperties properties) {
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
    @ConditionalOnMissingBean(name = "contentEventKafkaTemplate")
    KafkaTemplate<String, String> contentEventKafkaTemplate(ProducerFactory<String, String> contentEventProducerFactory) {
        return new KafkaTemplate<>(contentEventProducerFactory);
    }

    @Bean
    @ConditionalOnMissingBean(ContentOutboxKafkaRelay.class)
    ContentOutboxKafkaRelay contentOutboxKafkaRelay(ContentOutboxRelayPort contentOutboxRelayPort,
                                                    KafkaTemplate<String, String> contentEventKafkaTemplate,
                                                    ContentEventRelayProperties properties,
                                                    Clock contentClock) {
        return new ContentOutboxKafkaRelay(contentOutboxRelayPort, contentEventKafkaTemplate, properties, contentClock);
    }
}
