package com.englishflow.audit.config;

import com.englishflow.audit.adapter.failclosed.UnavailableAuditFactStore;
import com.englishflow.audit.adapter.jdbc.JdbcAuditFactStore;
import com.englishflow.audit.application.AuditIngestService;
import com.englishflow.audit.domain.AuditFactStore;
import com.zaxxer.hikari.HikariDataSource;

import org.flywaydb.core.Flyway;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import tools.jackson.databind.ObjectMapper;

import javax.sql.DataSource;

@Configuration
public class AuditPersistenceConfiguration {

    @Bean(destroyMethod = "close")
    @ConditionalOnProperty(prefix = "audit.persistence", name = "enabled", havingValue = "true")
    DataSource auditDataSource(AuditServiceProperties properties) {
        AuditServiceProperties.Persistence persistence = properties.getPersistence();
        if (persistence.getJdbcUrl().isBlank() || persistence.getUsername().isBlank()) {
            throw new IllegalStateException("audit persistence requires audit.persistence.jdbc-url and username");
        }
        HikariDataSource dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(persistence.getJdbcUrl());
        dataSource.setUsername(persistence.getUsername());
        dataSource.setPassword(persistence.getPassword());
        dataSource.setMaximumPoolSize(4);
        dataSource.setConnectionTimeout(persistence.getConnectTimeout().toMillis());
        return dataSource;
    }

    @Bean
    @ConditionalOnProperty(prefix = "audit.persistence", name = "enabled", havingValue = "true")
    Flyway auditFlyway(DataSource auditDataSource, AuditServiceProperties properties) {
        // The audit schema is provisioned externally with least-privilege grants; migrations must not
        // create schemas or databases on their own.
        return Flyway.configure()
                .dataSource(auditDataSource)
                .schemas(properties.getPersistence().getSchema())
                .createSchemas(false)
                .load();
    }

    @Bean
    @ConditionalOnProperty(prefix = "audit.persistence", name = "enabled", havingValue = "true")
    JdbcTemplate auditJdbcTemplate(DataSource auditDataSource, Flyway auditFlyway) {
        return new JdbcTemplate(auditDataSource);
    }

    @Bean
    @ConditionalOnProperty(prefix = "audit.persistence", name = "enabled", havingValue = "true")
    AuditFactStore jdbcAuditFactStore(JdbcTemplate auditJdbcTemplate, ObjectMapper objectMapper) {
        return new JdbcAuditFactStore(auditJdbcTemplate, objectMapper);
    }

    @Bean
    @ConditionalOnMissingBean(AuditFactStore.class)
    AuditFactStore unavailableAuditFactStore() {
        return new UnavailableAuditFactStore();
    }

    @Bean
    AuditIngestService auditIngestService(AuditFactStore auditFactStore) {
        return new AuditIngestService(auditFactStore);
    }
}
