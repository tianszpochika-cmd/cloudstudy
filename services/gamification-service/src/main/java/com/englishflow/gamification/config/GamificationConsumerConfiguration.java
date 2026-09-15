package com.englishflow.gamification.config;

import com.englishflow.gamification.application.GamificationApplicationService;
import com.englishflow.gamification.integration.TrustedCompletionKafkaConsumer;

import java.time.Clock;
import java.util.HashMap;
import java.util.Map;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.KafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.ExponentialBackOff;

/**
 * M7-001 inbound consumer wiring for trusted learning completions. Off by default: a
 * consumer that starts against an unconfigured broker must be an explicit decision.
 * Offsets are manual: commit happens only after the settlement and its receipt are durable.
 */
@Configuration(proxyBeanMethods = false)
@EnableKafka
@EnableConfigurationProperties(GamificationConsumerProperties.class)
@ConditionalOnProperty(prefix = "gamification.events.consumer", name = "enabled", havingValue = "true")
public class GamificationConsumerConfiguration {

    @Bean
    @ConditionalOnMissingBean(name = "gamificationEventProducerFactory")
    ProducerFactory<String, String> gamificationEventProducerFactory(
            GamificationConsumerProperties properties) {
        Map<String, Object> config = new HashMap<>();
        config.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, properties.getBootstrapServers());
        config.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        config.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        return new DefaultKafkaProducerFactory<>(config);
    }

    @Bean
    @ConditionalOnMissingBean(name = "gamificationEventKafkaTemplate")
    KafkaTemplate<String, String> gamificationEventKafkaTemplate(
            ProducerFactory<String, String> gamificationEventProducerFactory) {
        return new KafkaTemplate<>(gamificationEventProducerFactory);
    }

    @Bean
    @ConditionalOnMissingBean(name = "gamificationInboundConsumerFactory")
    ConsumerFactory<String, String> gamificationInboundConsumerFactory(
            GamificationConsumerProperties properties) {
        Map<String, Object> config = new HashMap<>();
        config.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, properties.getBootstrapServers());
        config.put(ConsumerConfig.GROUP_ID_CONFIG, properties.getGroupId());
        config.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        config.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        config.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);
        config.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        config.put(ConsumerConfig.CLIENT_ID_CONFIG, properties.getGroupId());
        return new DefaultKafkaConsumerFactory<>(config);
    }

    @Bean
    KafkaListenerContainerFactory<?> gamificationInboundKafkaListenerContainerFactory(
            ConsumerFactory<String, String> gamificationInboundConsumerFactory,
            GamificationConsumerProperties properties,
            DefaultErrorHandler gamificationInboundErrorHandler) {
        ConcurrentKafkaListenerContainerFactory<String, String> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(gamificationInboundConsumerFactory);
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.MANUAL);
        factory.getContainerProperties().setPollTimeout(properties.getPollTimeout().toMillis());
        factory.setCommonErrorHandler(gamificationInboundErrorHandler);
        return factory;
    }

    @Bean
    DefaultErrorHandler gamificationInboundErrorHandler(
            KafkaTemplate<String, String> gamificationEventKafkaTemplate,
            GamificationConsumerProperties properties) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(
                gamificationEventKafkaTemplate,
                (record, failure) -> new org.apache.kafka.common.TopicPartition(
                        properties.getDlqTopic(), record.partition()));
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
        long attempts = Math.max(1, properties.getMaxAttempts());
        long budget = properties.getBaseDelay().toMillis() * ((1L << Math.min(attempts - 1, 20)) - 1);
        backOff.setMaxElapsedTime(Math.max(budget, properties.getBaseDelay().toMillis()));
        DefaultErrorHandler handler = new DefaultErrorHandler(recoverer, backOff);
        handler.setAckAfterHandle(true);
        return handler;
    }

    @Bean
    @ConditionalOnMissingBean(TrustedCompletionKafkaConsumer.class)
    TrustedCompletionKafkaConsumer trustedCompletionKafkaConsumer(
            GamificationApplicationService gamificationApplicationService,
            KafkaTemplate<String, String> gamificationEventKafkaTemplate,
            GamificationConsumerProperties properties,
            Clock gamificationClock) {
        return new TrustedCompletionKafkaConsumer(
                gamificationApplicationService, gamificationEventKafkaTemplate, properties,
                gamificationClock);
    }
}
