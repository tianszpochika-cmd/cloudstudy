package com.englishflow.learner.web;

import com.englishflow.learner.config.LearnerServiceProperties;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** HTTP adapter beans kept separate from the pure learner application services. */
@Configuration(proxyBeanMethods = false)
public class LearnerHttpConfiguration {

    @Bean
    VerifiedLearnerPrincipalFactory verifiedLearnerPrincipalFactory(LearnerServiceProperties properties) {
        return new VerifiedLearnerPrincipalFactory(properties);
    }
}
