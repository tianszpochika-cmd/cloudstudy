package com.englishflow.social.config;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/** Runs the social owner schema migrations before local-real controllers can serve traffic. */
@Configuration(proxyBeanMethods = false)
@Profile("local-real")
public class SocialLocalRealPersistenceConfiguration {

    @Bean
    @ConditionalOnProperty(prefix = "spring.flyway", name = "enabled", havingValue = "true")
    Flyway socialFlyway(DataSource dataSource,
            @Value("${service.schema:social_service}") String schema) {
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .schemas(schema)
                .defaultSchema(schema)
                .createSchemas(true)
                .baselineOnMigrate(true)
                .baselineVersion("0")
                .locations("classpath:db/migration")
                .load();
        flyway.migrate();
        return flyway;
    }
}
