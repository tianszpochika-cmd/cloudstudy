package com.englishflow.analytics.config;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/** Runs analytics owner-schema migrations before the local-real JDBC projection store is used. */
@Configuration(proxyBeanMethods = false)
@Profile("local-real")
public class AnalyticsLocalRealPersistenceConfiguration {

    @Bean
    @ConditionalOnProperty(prefix = "spring.flyway", name = "enabled", havingValue = "true")
    Flyway analyticsFlyway(DataSource dataSource,
            @Value("${service.schema:analytics_service}") String schema) {
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
