package com.englishflow.content.config;

import com.englishflow.content.adapter.jdbc.JdbcContentInboundEventApplier;
import com.englishflow.content.integration.ContentInboundEventConsumer;
import com.englishflow.content.port.ContentInboundEventPort;

import java.time.Clock;
import java.util.HashMap;
import java.util.Map;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.KafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.ExponentialBackOff;

/**
 * Composes the inbound consumer. Off by default for the same reason the relay is: a consumer that
 * starts against an unconfigured broker must be an explicit decision.
 *
 * <p>The container acknowledges manually, so the offset is committed only after
 * {@link ContentInboundEventConsumer} has applied the effect, its receipt and, when needed, the DLQ
 * write. The error handler is a safety net for records the listener never sees, such as a
 * deserialization failure; ordinary failures are retried and routed inside the listener so the
 * attempt count stays exactly the configured one.
 */
@Configuration(proxyBeanMethods = false)
@EnableKafka
@EnableConfigurationProperties(ContentInboundConsumerProperties.class)
@ConditionalOnProperty(prefix = "content.events.consumer", name = "enabled", havingValue = "true")
public class ContentInboundConsumerConfiguration {

    @Bean
    @ConditionalOnMissingBean(ContentInboundEventPort.class)
    ContentInboundEventPort contentInboundEventPort(JdbcTemplate jdbcTemplate) {
        return new JdbcContentInboundEventApplier(jdbcTemplate);
    }

    @Bean
    @ConditionalOnMissingBean(name = "contentInboundConsumerFactory")
    ConsumerFactory<String, String> contentInboundConsumerFactory(ContentInboundConsumerProperties properties) {
        Map<String, Object> config = new HashMap<>();
        config.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, properties.getBootstrapServers());
        config.put(ConsumerConfig.GROUP_ID_CONFIG, properties.getGroupId());
        config.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        config.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        // Offsets are committed through the container, never by the client's timer.
        config.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);
        config.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        config.put(ConsumerConfig.CLIENT_ID_CONFIG, properties.getGroupId());
        return new DefaultKafkaConsumerFactory<>(config);
    }

    @Bean
    KafkaListenerContainerFactory<?> contentInboundKafkaListenerContainerFactory(
            ConsumerFactory<String, String> contentInboundConsumerFactory,
            ContentInboundConsumerProperties properties,
            DefaultErrorHandler contentInboundErrorHandler) {
        ConcurrentKafkaListenerContainerFactory<String, String> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(contentInboundConsumerFactory);
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.MANUAL);
        factory.getContainerProperties().setPollTimeout(properties.getPollTimeout().toMillis());
        factory.setCommonErrorHandler(contentInboundErrorHandler);
        return factory;
    }

    @Bean
    DefaultErrorHandler contentInboundErrorHandler(KafkaTemplate<String, String> contentEventKafkaTemplate,
                                                   ContentInboundConsumerProperties properties) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(
                contentEventKafkaTemplate,
                (record, failure) -> new org.apache.kafka.common.TopicPartition(
                        properties.getDlqTopic(), record.partition()));
        // Adds the contract's failure fields on top of the headers the recoverer already copies, so a
        // record that never reached the listener is still recoverable by an operator.
        recoverer.addHeadersFunction((record, failure) -> {
            org.apache.kafka.common.header.internals.RecordHeaders headers =
                    new org.apache.kafka.common.header.internals.RecordHeaders();
            headers.add("consumerGroup", properties.getGroupId().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            headers.add("failureCode", failure.getClass().getSimpleName().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            headers.add("recoveryState", "AWAITING_OPERATOR".getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return headers;
        });
        ExponentialBackOff backOff = new ExponentialBackOff(
                properties.getBaseDelay().toMillis(), 2.0);
        backOff.setMaxInterval(properties.getMaxDelay().toMillis());
        // ExponentialBackOff otherwise retries forever, which parks the retried record at the head of
        // its partition and blocks every later record behind it. The budget is the total wait a
        // maxAttempts sequence produces, so the handler gives up after exactly that many attempts
        // and hands the record to the DLQ.
        long attempts = Math.max(1, properties.getMaxAttempts());
        long budget = properties.getBaseDelay().toMillis() * ((1L << Math.min(attempts - 1, 20)) - 1);
        backOff.setMaxElapsedTime(Math.max(budget, properties.getBaseDelay().toMillis()));
        DefaultErrorHandler handler = new DefaultErrorHandler(recoverer, backOff);
        handler.setAckAfterHandle(true);
        return handler;
    }

    @Bean
    @ConditionalOnMissingBean(ContentInboundEventConsumer.class)
    ContentInboundEventConsumer contentInboundEventConsumer(ContentInboundEventPort contentInboundEventPort,
                                                           KafkaTemplate<String, String> contentEventKafkaTemplate,
                                                           ContentInboundConsumerProperties properties,
                                                           Clock contentClock) {
        return new ContentInboundEventConsumer(
                contentInboundEventPort, contentEventKafkaTemplate, properties, contentClock);
    }
}
