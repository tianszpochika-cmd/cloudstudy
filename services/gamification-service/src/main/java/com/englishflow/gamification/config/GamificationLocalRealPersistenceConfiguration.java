package com.englishflow.gamification.config;

import com.englishflow.gamification.adapter.jdbc.JdbcGamificationFactStore;
import com.englishflow.gamification.adapter.jdbc.JdbcUserTimeZonePort;
import com.englishflow.gamification.port.GamificationFactStore;
import com.englishflow.gamification.port.UserTimeZonePort;
import java.time.ZoneId;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.flywaydb.core.Flyway;

/**
 * Durable local-real wiring. The local mirror keeps gamification reads and writes inside the
 * gamification owner schema; it does not silently fall back to process-local state.
 */
@Configuration
@Profile("local-real")
public class GamificationLocalRealPersistenceConfiguration {

    @Bean
    @ConditionalOnProperty(prefix = "spring.flyway", name = "enabled", havingValue = "true")
    Flyway gamificationFlyway(DataSource dataSource,
            @Value("${service.schema:gamification_service}") String schema) {
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

    @Bean
    GamificationFactStore gamificationFactStore(JdbcTemplate jdbc, TransactionTemplate transactions,
            ObjectMapper mapper) {
        return new JdbcGamificationFactStore(jdbc, transactions, mapper);
    }

    @Bean
    UserTimeZonePort userTimeZonePort(JdbcTemplate jdbc,
            @Value("${gamification.default-time-zone:Asia/Shanghai}") String defaultTimeZone) {
        return new JdbcUserTimeZonePort(jdbc, ZoneId.of(defaultTimeZone));
    }
}
