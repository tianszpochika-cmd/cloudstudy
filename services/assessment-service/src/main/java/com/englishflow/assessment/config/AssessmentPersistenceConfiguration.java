package com.englishflow.assessment.config;

import com.englishflow.assessment.adapter.content.HttpPlacementBankPort;
import com.englishflow.assessment.adapter.content.HttpPlacementRuleScorePort;
import com.englishflow.assessment.adapter.content.UnavailableContentSnapshotPort;
import com.englishflow.assessment.adapter.content.UnavailableP1PlacementSourcePort;
import com.englishflow.assessment.adapter.jdbc.JdbcAssessmentOutbox;
import com.englishflow.assessment.adapter.jdbc.JdbcAssessmentStatePort;
import com.englishflow.assessment.application.AssessmentCommandService;
import com.englishflow.assessment.port.AssessmentOutboxPort;
import com.englishflow.assessment.port.AssessmentStatePort;
import com.englishflow.assessment.port.ContentSnapshotPort;
import com.englishflow.assessment.port.P1PlacementSourcePort;
import com.englishflow.assessment.port.PlacementRuleScorePort;
import org.flywaydb.core.Flyway;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.time.Clock;

/**
 * Runtime composition for durable assessment facts.  It is intentionally conditional: with no
 * database flag the application exposes no assessment command controller and cannot present
 * in-memory state as real user data.
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(AssessmentPersistenceProperties.class)
@ConditionalOnProperty(prefix = "assessment.persistence", name = "enabled", havingValue = "true")
public class AssessmentPersistenceConfiguration {

    @Bean
    DataSource assessmentDataSource(AssessmentPersistenceProperties properties) {
        if (properties.getJdbcUrl() == null || properties.getJdbcUrl().isBlank()) {
            throw new IllegalStateException("ASSESSMENT_DB_URL is required when assessment persistence is enabled");
        }
        if (properties.getSchema() == null || !properties.getSchema().matches("[A-Za-z0-9_]{1,64}")) {
            throw new IllegalStateException("ASSESSMENT_SCHEMA is not a safe identifier");
        }
        return DataSourceBuilder.create()
                .url(properties.getJdbcUrl())
                .username(properties.getUsername())
                .password(properties.getPassword())
                .driverClassName(properties.getDriverClassName())
                .build();
    }

    /**
     * Assessment excludes Spring Boot's automatic DataSource configuration because the
     * service owns an explicitly validated JDBC boundary. Flyway therefore has to be
     * composed against that same owner DataSource explicitly; otherwise the B10 migration
     * can be present in the jar but never reach the local schema.
     */
    @Bean
    Flyway assessmentFlyway(DataSource dataSource,
                            @org.springframework.beans.factory.annotation.Value("${spring.flyway.enabled:false}") boolean migrationEnabled,
                            AssessmentPersistenceProperties properties) {
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .schemas(properties.getSchema())
                .defaultSchema(properties.getSchema())
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
    AssessmentStatePort assessmentStatePort(JdbcTemplate jdbcTemplate,
                                            tools.jackson.databind.ObjectMapper objectMapper,
                                            AssessmentPersistenceProperties properties) {
        return new JdbcAssessmentStatePort(jdbcTemplate, objectMapper, properties.getSchema(),
                properties.isTolerateCorruptLegacyRows());
    }

    @Bean
    AssessmentOutboxPort assessmentOutboxPort(JdbcTemplate jdbcTemplate,
                                               tools.jackson.databind.ObjectMapper objectMapper,
                                               AssessmentPersistenceProperties properties) {
        return new JdbcAssessmentOutbox(jdbcTemplate, objectMapper, properties.getSchema());
    }

    @Bean
    @ConditionalOnMissingBean(ContentSnapshotPort.class)
    ContentSnapshotPort unavailableContentSnapshotPort() {
        return new UnavailableContentSnapshotPort();
    }

    @Bean
    @ConditionalOnProperty(prefix = "assessment.placement.bank", name = "enabled",
            havingValue = "false", matchIfMissing = false)
    P1PlacementSourcePort unavailableP1PlacementSourcePort() {
        return new UnavailableP1PlacementSourcePort();
    }

    /**
     * HTTP placement source. Enabled by default so the canonical ten-item bank
     * replaces the fail-closed placeholder wherever content-service and
     * learner-service are reachable; every upstream problem still fails closed
     * with 503 and never substitutes legacy questions. Set
     * {@code assessment.placement.bank.enabled=false} to restore the explicit
     * unavailable port (independent rollback).
     */
    @Bean
    @ConditionalOnProperty(prefix = "assessment.placement.bank", name = "enabled",
            havingValue = "true", matchIfMissing = true)
    P1PlacementSourcePort httpPlacementBankPort(tools.jackson.databind.ObjectMapper objectMapper,
            @org.springframework.beans.factory.annotation.Value(
                    "${assessment.placement.bank.content-base-url:http://127.0.0.1:18089}")
            String contentBaseUrl,
            @org.springframework.beans.factory.annotation.Value(
                    "${assessment.placement.bank.learner-base-url:http://127.0.0.1:18088}")
            String learnerBaseUrl) {
        return new HttpPlacementBankPort(objectMapper, contentBaseUrl, learnerBaseUrl,
                java.time.Duration.ofSeconds(5));
    }

    /**
     * Service-token score call. An empty token fails closed on use and does not
     * invent an outcome. It never forwards the learner JWT.
     */
    @Bean
    PlacementRuleScorePort placementRuleScorePort(tools.jackson.databind.ObjectMapper objectMapper,
            @org.springframework.beans.factory.annotation.Value(
                    "${assessment.placement.score.content-base-url:http://127.0.0.1:18089}")
            String contentBaseUrl,
            @org.springframework.beans.factory.annotation.Value(
                    "${assessment.placement.score.service-token:}")
            String serviceToken) {
        return new HttpPlacementRuleScorePort(objectMapper, contentBaseUrl, serviceToken,
                java.time.Duration.ofSeconds(5));
    }

    @Bean
    Clock assessmentClock() {
        return Clock.systemUTC();
    }

    @Bean
    AssessmentCommandService assessmentCommandService(ContentSnapshotPort contentSnapshotPort,
                                                     AssessmentOutboxPort outbox,
                                                     AssessmentStatePort state,
                                                     Clock clock) {
        return new AssessmentCommandService(contentSnapshotPort, outbox, clock, state);
    }
}
