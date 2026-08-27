package com.englishflow.adminops.config;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * Runs the admin-ops owner-schema migrations before local-real adapters can serve traffic.
 *
 * <p>The repository contains an earlier local bootstrap shape without Flyway history.  The
 * baseline keeps that known V1 shape and applies the additive durable runtime migration V2 on
 * both a clean schema and an already bootstrapped local schema.</p>
 */
@Configuration(proxyBeanMethods = false)
@Profile("local-real")
public class AdminOpsLocalRealPersistenceConfiguration {

    @Bean
    @ConditionalOnProperty(prefix = "spring.flyway", name = "enabled", havingValue = "true")
    Flyway adminOpsFlyway(DataSource dataSource,
            @Value("${service.schema:admin_ops_service}") String schema) {
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .schemas(schema)
                .defaultSchema(schema)
                .createSchemas(true)
                .baselineOnMigrate(true)
                .baselineVersion("1")
                .locations("classpath:db/migration")
                .load();
        flyway.migrate();
        return flyway;
    }
}
