package com.englishflow.learning.config;

import java.time.Clock;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;

import com.englishflow.learning.adapter.failclosed.FailClosedLearningFactStore;
import com.englishflow.learning.adapter.failclosed.FailClosedLearningIdGenerator;
import com.englishflow.learning.adapter.failclosed.FailClosedLearnerTargetPort;
import com.englishflow.learning.adapter.failclosed.FailClosedPublishedContentPort;
import com.englishflow.learning.adapter.jdbc.JdbcLearningFactStore;
import com.englishflow.learning.adapter.jdbc.JdbcLearningIdGenerator;
import com.englishflow.learning.adapter.memory.InMemoryLearningFactStore;
import com.englishflow.learning.adapter.memory.InMemoryLearningIdGenerator;
import com.englishflow.learning.application.LearningMasteryService;
import com.englishflow.learning.application.LearningPlanService;
import com.englishflow.learning.application.LearningProgressService;
import com.englishflow.learning.application.LearningQueryService;
import com.englishflow.learning.application.LearningReviewService;
import com.englishflow.learning.domain.LearningAccessPolicy;
import com.englishflow.learning.port.LearnerTargetPort;
import com.englishflow.learning.port.LearningFactStore;
import com.englishflow.learning.port.LearningIdGenerator;
import com.englishflow.learning.port.PublishedContentPort;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.JdbcTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Spring seam that selects durable JDBC, explicit memory fixture, or fail-closed adapters. */
@Configuration(proxyBeanMethods = false)
public class LearningRuntimeConfiguration {

    @Bean
    Clock learningClock() {
        return Clock.systemUTC();
    }

    @Bean
    LearningAccessPolicy learningAccessPolicy(Clock learningClock) {
        return new LearningAccessPolicy(learningClock);
    }

    @Bean
    @ConditionalOnExpression("'jdbc'.equals('${learning.persistence.mode:fail-closed}') || 'mysql'.equals('${learning.persistence.mode:fail-closed}')")
    DataSource learningDataSource(LearningPersistenceProperties properties) {
        if (blank(properties.getJdbcUrl()) || blank(properties.getUsername())
                || properties.getPassword() == null || blank(properties.getDriverClassName())) {
            throw new IllegalStateException(
                    "learning JDBC is enabled but LEARNING_JDBC_URL/USERNAME/PASSWORD/DRIVER are incomplete");
        }
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName(properties.getDriverClassName());
        dataSource.setUrl(properties.getJdbcUrl());
        dataSource.setUsername(properties.getUsername());
        dataSource.setPassword(properties.getPassword());
        return dataSource;
    }

    @Bean
    @ConditionalOnProperty(prefix = "learning.persistence", name = "mode", havingValue = "jdbc")
    Flyway learningFlyway(DataSource dataSource, @org.springframework.beans.factory.annotation.Value("${spring.flyway.enabled:false}") boolean migrationEnabled, @org.springframework.beans.factory.annotation.Value("${service.schema:learning_service}") String schema) {
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .schemas(schema)
                .defaultSchema(schema)
                .createSchemas(false)
                .baselineOnMigrate(true)
                .baselineVersion("0")
                .locations("classpath:db/migration")
                .load();
        if (migrationEnabled) {
            flyway.migrate();
        }
        return flyway;
    }

    @Bean
    @ConditionalOnExpression("'jdbc'.equals('${learning.persistence.mode:fail-closed}') || 'mysql'.equals('${learning.persistence.mode:fail-closed}')")
    JdbcTemplate learningJdbcTemplate(DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    @Bean
    @ConditionalOnProperty(prefix = "learning.persistence", name = "mode", havingValue = "jdbc")
    LearningFactStore jdbcLearningFactStore(
            JdbcTemplate jdbcTemplate,
            TransactionTemplate learningTransactionTemplate,
            tools.jackson.databind.ObjectMapper objectMapper) {
        return new JdbcLearningFactStore(jdbcTemplate, learningTransactionTemplate, objectMapper);
    }

    @Bean
    @ConditionalOnProperty(prefix = "learning.persistence", name = "mode", havingValue = "mysql")
    LearningFactStore mysqlLearningFactStore(
            JdbcTemplate jdbcTemplate,
            TransactionTemplate learningTransactionTemplate,
            tools.jackson.databind.ObjectMapper objectMapper) {
        return new JdbcLearningFactStore(jdbcTemplate, learningTransactionTemplate, objectMapper);
    }

    @Bean
    @ConditionalOnProperty(prefix = "learning.persistence", name = "mode", havingValue = "memory-fixture")
    LearningFactStore memoryFixtureLearningFactStore() {
        return new InMemoryLearningFactStore();
    }

    @Bean
    @ConditionalOnProperty(prefix = "learning.persistence", name = "mode", havingValue = "memory_fixture")
    LearningFactStore memoryFixtureUnderscoreLearningFactStore() {
        return new InMemoryLearningFactStore();
    }

    @Bean
    @ConditionalOnProperty(prefix = "learning.persistence", name = "mode", havingValue = "fixture")
    LearningFactStore fixtureLearningFactStore() {
        return new InMemoryLearningFactStore();
    }

    @Bean
    @ConditionalOnProperty(prefix = "learning.persistence", name = "mode", havingValue = "fail-closed", matchIfMissing = true)
    LearningFactStore failClosedLearningFactStore() {
        return new FailClosedLearningFactStore();
    }

    @Bean
    @ConditionalOnProperty(prefix = "learning.persistence", name = "mode", havingValue = "jdbc")
    LearningIdGenerator jdbcLearningIdGenerator(JdbcTemplate jdbcTemplate) {
        return new JdbcLearningIdGenerator(jdbcTemplate);
    }

    @Bean
    @ConditionalOnProperty(prefix = "learning.persistence", name = "mode", havingValue = "mysql")
    LearningIdGenerator mysqlLearningIdGenerator(JdbcTemplate jdbcTemplate) {
        return new JdbcLearningIdGenerator(jdbcTemplate);
    }

    @Bean
    @ConditionalOnProperty(prefix = "learning.persistence", name = "mode", havingValue = "memory-fixture")
    LearningIdGenerator memoryFixtureLearningIdGenerator() {
        return new InMemoryLearningIdGenerator();
    }

    @Bean
    @ConditionalOnProperty(prefix = "learning.persistence", name = "mode", havingValue = "memory_fixture")
    LearningIdGenerator memoryFixtureUnderscoreLearningIdGenerator() {
        return new InMemoryLearningIdGenerator();
    }

    @Bean
    @ConditionalOnProperty(prefix = "learning.persistence", name = "mode", havingValue = "fixture")
    LearningIdGenerator fixtureLearningIdGenerator() {
        return new InMemoryLearningIdGenerator();
    }

    @Bean
    @ConditionalOnProperty(prefix = "learning.persistence", name = "mode", havingValue = "fail-closed", matchIfMissing = true)
    LearningIdGenerator failClosedLearningIdGenerator() {
        return new FailClosedLearningIdGenerator();
    }

    @Bean
    @ConditionalOnProperty(prefix = "learning.persistence", name = "mode", havingValue = "jdbc")
    PlatformTransactionManager learningJdbcTransactionManager(DataSource dataSource) {
        return new JdbcTransactionManager(dataSource);
    }

    @Bean
    @ConditionalOnProperty(prefix = "learning.persistence", name = "mode", havingValue = "mysql")
    PlatformTransactionManager mysqlLearningJdbcTransactionManager(DataSource dataSource) {
        return new JdbcTransactionManager(dataSource);
    }

    @Bean
    @ConditionalOnProperty(prefix = "learning.persistence", name = "mode", havingValue = "jdbc")
    TransactionTemplate learningTransactionTemplate(PlatformTransactionManager transactionManager) {
        return new TransactionTemplate(transactionManager);
    }

    @Bean
    @ConditionalOnProperty(prefix = "learning.persistence", name = "mode", havingValue = "mysql")
    TransactionTemplate mysqlLearningTransactionTemplate(PlatformTransactionManager transactionManager) {
        return new TransactionTemplate(transactionManager);
    }

    @Bean
    LearnerTargetPort failClosedLearnerTargetPort() {
        return new FailClosedLearnerTargetPort();
    }

    @Bean
    PublishedContentPort failClosedPublishedContentPort() {
        return new FailClosedPublishedContentPort();
    }

    @Bean
    LearningPlanService learningPlanService(LearningFactStore store, LearnerTargetPort targetPort,
            PublishedContentPort contentPort, LearningIdGenerator ids, LearningAccessPolicy policy, Clock clock) {
        return new LearningPlanService(store, targetPort, contentPort, ids, policy, clock);
    }

    @Bean
    LearningProgressService learningProgressService(LearningFactStore store, LearningAccessPolicy policy,
            Clock clock) {
        return new LearningProgressService(store, policy, clock);
    }

    @Bean
    LearningReviewService learningReviewService(LearningFactStore store, LearnerTargetPort targetPort,
            PublishedContentPort contentPort, LearningIdGenerator ids, LearningAccessPolicy policy, Clock clock) {
        return new LearningReviewService(store, targetPort, contentPort, ids, policy, clock);
    }

    @Bean
    LearningMasteryService learningMasteryService(LearningFactStore store, LearningAccessPolicy policy,
            Clock clock) {
        return new LearningMasteryService(store, policy, clock);
    }

    @Bean
    LearningQueryService learningQueryService(LearningFactStore store, LearningAccessPolicy policy,
            Clock clock, LearningServiceProperties properties) {
        return new LearningQueryService(store, policy, clock, properties.getSrsRulesVersion());
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
