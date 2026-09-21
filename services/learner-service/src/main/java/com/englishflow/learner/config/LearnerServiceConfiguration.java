package com.englishflow.learner.config;

import com.englishflow.learner.adapter.memory.EmptyLegacyLearnerReadModel;
import com.englishflow.learner.adapter.shadow.LearnerProfileShadowAdapter;
import com.englishflow.learner.application.DefaultLearnerProfileCommandService;
import com.englishflow.learner.application.DefaultLearnerProfileQueryService;
import com.englishflow.learner.domain.LearnerAccessPolicy;
import com.englishflow.learner.port.LearnerProfileStore;
import com.englishflow.learner.port.LearnerTargetIdGenerator;
import com.englishflow.learner.port.LegacyLearnerReadModelPort;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Explicit learner adapter wiring; no implicit memory-to-production fallback is permitted. */
@Configuration(proxyBeanMethods = false)
public class LearnerServiceConfiguration {

    @Bean
    Clock learnerClock() {
        return Clock.systemUTC();
    }

    @Bean
    LegacyLearnerReadModelPort legacyLearnerReadModelPort() {
        return new EmptyLegacyLearnerReadModel();
    }

    @Bean
    LearnerProfileShadowAdapter learnerProfileShadowAdapter(
            LegacyLearnerReadModelPort legacyPort,
            Clock learnerClock) {
        return new LearnerProfileShadowAdapter(legacyPort, learnerClock);
    }

    @Bean
    LearnerAccessPolicy learnerAccessPolicy(Clock learnerClock) {
        return new LearnerAccessPolicy(learnerClock);
    }

    @Bean
    DefaultLearnerProfileCommandService learnerProfileCommandService(
            LearnerProfileStore store,
            LearnerProfileShadowAdapter shadowAdapter,
            LearnerAccessPolicy accessPolicy,
            LearnerTargetIdGenerator targetIdGenerator,
            Clock learnerClock) {
        return new DefaultLearnerProfileCommandService(
                store, shadowAdapter, accessPolicy, learnerClock, targetIdGenerator);
    }

    @Bean
    DefaultLearnerProfileQueryService learnerProfileQueryService(
            LearnerProfileStore store,
            LearnerProfileShadowAdapter shadowAdapter,
            LearnerAccessPolicy accessPolicy,
            Clock learnerClock) {
        return new DefaultLearnerProfileQueryService(store, shadowAdapter, accessPolicy, learnerClock);
    }

    @Bean
    com.englishflow.learner.application.LearnerAdminService learnerAdminService(
            LearnerProfileStore store,
            LearnerTargetIdGenerator targetIdGenerator,
            Clock learnerClock) {
        return new com.englishflow.learner.application.LearnerAdminService(store, targetIdGenerator, learnerClock);
    }
}
