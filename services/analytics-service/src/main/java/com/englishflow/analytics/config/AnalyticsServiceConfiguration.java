package com.englishflow.analytics.config;

import com.englishflow.analytics.adapter.memory.InMemoryAnalyticsProjectionStore;
import com.englishflow.analytics.application.AnalyticsQueryService;
import com.englishflow.analytics.application.AnalyticsRecomputeService;
import com.englishflow.analytics.application.AnalyticsWorkerService;
import com.englishflow.analytics.port.AnalyticsProjectionStore;
import com.englishflow.analytics.port.AnalyticsQueryPort;
import com.englishflow.analytics.port.AnalyticsReplayPort;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(AnalyticsProperties.class)
public class AnalyticsServiceConfiguration {

    @Bean
    AnalyticsProjectionStore analyticsProjectionStore() {
        return new InMemoryAnalyticsProjectionStore();
    }

    @Bean
    AnalyticsWorkerService analyticsWorkerService(AnalyticsProjectionStore store) {
        return new AnalyticsWorkerService(store);
    }

    @Bean
    AnalyticsQueryPort analyticsQueryPort(AnalyticsProjectionStore store) {
        return new AnalyticsQueryService(store);
    }

    @Bean
    AnalyticsReplayPort analyticsReplayPort(AnalyticsProjectionStore store) {
        return new AnalyticsRecomputeService(store);
    }
}
