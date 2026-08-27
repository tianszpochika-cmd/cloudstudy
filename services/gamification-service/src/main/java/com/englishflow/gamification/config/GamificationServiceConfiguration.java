package com.englishflow.gamification.config;

import com.englishflow.gamification.application.GamificationAccessPolicy;
import com.englishflow.gamification.application.GamificationApplicationService;
import com.englishflow.gamification.domain.CompletionRuleCatalog;
import com.englishflow.gamification.domain.RewardProbabilityCatalog;
import com.englishflow.gamification.port.GamificationFactStore;
import com.englishflow.gamification.port.UserTimeZonePort;
import java.time.Clock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class GamificationServiceConfiguration {

    @Bean
    Clock gamificationClock() {
        return Clock.systemUTC();
    }

    @Bean
    CompletionRuleCatalog completionRuleCatalog() {
        return new CompletionRuleCatalog();
    }

    @Bean
    RewardProbabilityCatalog rewardProbabilityCatalog() {
        return new RewardProbabilityCatalog();
    }

    @Bean
    GamificationAccessPolicy gamificationAccessPolicy() {
        return new GamificationAccessPolicy();
    }

    @Bean
    GamificationApplicationService gamificationApplicationService(
            GamificationFactStore store,
            UserTimeZonePort timeZones,
            Clock clock,
            CompletionRuleCatalog rules,
            RewardProbabilityCatalog probabilities,
            @Value("${gamification.feature.enabled:true}") boolean featureEnabled) {
        return new GamificationApplicationService(store, timeZones, clock, rules, probabilities,
                featureEnabled);
    }
}
