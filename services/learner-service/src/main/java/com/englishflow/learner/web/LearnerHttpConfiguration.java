package com.englishflow.learner.web;

import com.englishflow.learner.config.LearnerServiceProperties;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** HTTP adapter beans kept separate from the pure learner application services. */
@Configuration(proxyBeanMethods = false)
public class LearnerHttpConfiguration {

    @Bean
    @ConditionalOnProperty(prefix = "learner.consent-recheck", name = "enabled", havingValue = "true",
            matchIfMissing = true)
    LearningConsentRecheck learningConsentRecheck(LearnerServiceProperties properties) {
        return new IamLearningConsentRecheck(properties.getConsentRecheck());
    }

    @Bean
    VerifiedLearnerPrincipalFactory verifiedLearnerPrincipalFactory(
            LearnerServiceProperties properties,
            ObjectProvider<LearningConsentRecheck> recheck) {
        return new VerifiedLearnerPrincipalFactory(properties, recheck.getIfAvailable());
    }
}
