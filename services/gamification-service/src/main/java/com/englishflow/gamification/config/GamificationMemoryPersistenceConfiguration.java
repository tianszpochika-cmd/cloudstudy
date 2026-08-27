package com.englishflow.gamification.config;

import com.englishflow.gamification.adapter.memory.InMemoryGamificationFactStore;
import com.englishflow.gamification.adapter.memory.InMemoryUserTimeZonePort;
import com.englishflow.gamification.port.GamificationFactStore;
import com.englishflow.gamification.port.UserTimeZonePort;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * Compatibility wiring for smoke/dev profiles. It is intentionally excluded from local-real.
 */
@Configuration
@Profile("!local-real")
public class GamificationMemoryPersistenceConfiguration {

    @Bean
    GamificationFactStore gamificationFactStore() {
        return new InMemoryGamificationFactStore();
    }

    @Bean
    UserTimeZonePort userTimeZonePort(
            @Value("${gamification.default-time-zone:Asia/Shanghai}") String defaultTimeZone) {
        return new InMemoryUserTimeZonePort(ZoneId.of(defaultTimeZone));
    }
}
