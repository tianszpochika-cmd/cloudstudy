package com.englishflow.commerce.config;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("local-real")
@ConditionalOnProperty(prefix = "spring.flyway", name = "enabled", havingValue = "true")
public class CommerceFlywayConfiguration {

    /**
     * Runs the owner migrations on startup for the local-real runtime. The baseline version keeps
     * a schema that was provisioned by reconcile-owner-schemas.mjs compatible: a non-empty schema
     * without history baselines at V1 instead of replaying the initial migration.
     */
    @Bean(initMethod = "migrate")
    Flyway commerceFlyway(
            DataSource dataSource,
            @Value("${spring.flyway.baseline-on-migrate:true}") boolean baselineOnMigrate,
            @Value("${spring.flyway.baseline-version:1}") String baselineVersion) {
        return Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .baselineOnMigrate(baselineOnMigrate)
                .baselineVersion(baselineVersion)
                .load();
    }
}
