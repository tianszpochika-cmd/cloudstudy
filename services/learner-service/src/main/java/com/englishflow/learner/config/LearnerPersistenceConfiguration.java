package com.englishflow.learner.config;

import com.englishflow.learner.adapter.failclosed.FailClosedLearnerProfileStore;
import com.englishflow.learner.adapter.failclosed.FailClosedLearnerTargetIdGenerator;
import com.englishflow.learner.adapter.jdbc.JdbcLearnerProfileStore;
import com.englishflow.learner.adapter.jdbc.JdbcLearnerTargetIdGenerator;
import com.englishflow.learner.port.LearnerProfileStore;
import com.englishflow.learner.port.LearnerTargetIdGenerator;

import javax.sql.DataSource;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.zaxxer.hikari.HikariDataSource;

import tools.jackson.databind.ObjectMapper;

import org.flywaydb.core.Flyway;

/**
 * Runtime persistence composition root.
 *
 * <p>Only {@code jdbc} creates a durable adapter. The default and the test-only {@code memory}
 * value both resolve to fail-closed runtime ports; the in-memory adapter is intentionally never
 * created by Spring.</p>
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(LearnerPersistenceProperties.class)
public class LearnerPersistenceConfiguration {

    @Bean
    @ConditionalOnProperty(prefix = "learner.persistence", name = "mode", havingValue = "jdbc")
    HikariDataSource learnerDataSource(LearnerPersistenceProperties properties) {
        if (blank(properties.getJdbcUrl()) || blank(properties.getUsername())
                || properties.getPassword() == null || blank(properties.getDriverClassName())) {
            throw new IllegalStateException(
                    "learner JDBC is enabled but LEARNER_JDBC_URL/USERNAME/PASSWORD/DRIVER are incomplete");
        }
        HikariDataSource dataSource = new HikariDataSource();
        dataSource.setPoolName("learner-service");
        dataSource.setJdbcUrl(properties.getJdbcUrl());
        dataSource.setUsername(properties.getUsername());
        dataSource.setPassword(properties.getPassword());
        dataSource.setDriverClassName(properties.getDriverClassName());
        return dataSource;
    }

    @Bean
    @ConditionalOnProperty(prefix = "learner.persistence", name = "mode", havingValue = "jdbc")
    Flyway learnerFlyway(
            DataSource dataSource,
            @org.springframework.beans.factory.annotation.Value("${LEARNER_SCHEMA:learner_service}") String schema) {
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .schemas(schema)
                .defaultSchema(schema)
                .createSchemas(true)
                .locations("classpath:db/migration")
                .load();
        flyway.migrate();
        return flyway;
    }

    @Bean
    @ConditionalOnProperty(prefix = "learner.persistence", name = "mode", havingValue = "jdbc")
    JdbcTemplate learnerJdbcTemplate(DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    @Bean(name = "learnerTransactionManager")
    @ConditionalOnProperty(prefix = "learner.persistence", name = "mode", havingValue = "jdbc")
    PlatformTransactionManager learnerTransactionManager(DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }

    @Bean(name = "learnerTransactionTemplate")
    @ConditionalOnProperty(prefix = "learner.persistence", name = "mode", havingValue = "jdbc")
    TransactionTemplate learnerTransactionTemplate(
            @Qualifier("learnerTransactionManager") PlatformTransactionManager transactionManager) {
        return new TransactionTemplate(transactionManager);
    }

    @Bean
    @ConditionalOnProperty(prefix = "learner.persistence", name = "mode", havingValue = "jdbc")
    LearnerProfileStore learnerProfileStore(
            JdbcTemplate jdbc,
            @Qualifier("learnerTransactionTemplate") TransactionTemplate transactionTemplate,
            ObjectMapper objectMapper) {
        return new JdbcLearnerProfileStore(jdbc, transactionTemplate, objectMapper);
    }

    @Bean
    @ConditionalOnProperty(prefix = "learner.persistence", name = "mode", havingValue = "jdbc")
    LearnerTargetIdGenerator learnerTargetIdGenerator(
            JdbcTemplate jdbc,
            @Qualifier("learnerTransactionTemplate") TransactionTemplate transactionTemplate) {
        return new JdbcLearnerTargetIdGenerator(jdbc, transactionTemplate);
    }

    @Bean
    @ConditionalOnMissingBean(LearnerProfileStore.class)
    LearnerProfileStore failClosedLearnerProfileStore() {
        return new FailClosedLearnerProfileStore();
    }

    @Bean
    @ConditionalOnMissingBean(LearnerTargetIdGenerator.class)
    LearnerTargetIdGenerator failClosedLearnerTargetIdGenerator() {
        return new FailClosedLearnerTargetIdGenerator();
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
