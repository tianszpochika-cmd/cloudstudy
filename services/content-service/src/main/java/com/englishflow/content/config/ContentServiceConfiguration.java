package com.englishflow.content.config;

import com.englishflow.content.adapter.memory.InMemoryContentIdempotency;
import com.englishflow.content.adapter.memory.InMemoryContentOutbox;
import com.englishflow.content.adapter.memory.InMemoryContentRepository;
import com.englishflow.content.adapter.memory.InMemoryPublicProjectionStore;
import com.englishflow.content.adapter.memory.RecordingContentCacheInvalidator;
import com.englishflow.content.application.ContentCommandService;
import com.englishflow.content.application.ContentReadService;
import com.englishflow.content.port.ContentCacheInvalidator;
import com.englishflow.content.port.ContentIdempotencyPort;
import com.englishflow.content.port.ContentOutboxPort;
import com.englishflow.content.port.ContentRepository;
import com.englishflow.content.port.PublicProjectionStore;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Local code-layer wiring. These memory adapters are deliberately replaceable seams and do not
 * claim MySQL/Kafka runtime evidence; production wiring must provide content-owned adapters.
 */
@Configuration(proxyBeanMethods = false)
public class ContentServiceConfiguration {

    @Bean
    Clock contentClock() {
        return Clock.systemUTC();
    }

    @Bean
    ContentRepository contentRepository() {
        return new InMemoryContentRepository();
    }

    @Bean
    ContentOutboxPort contentOutboxPort() {
        return new InMemoryContentOutbox();
    }

    @Bean
    ContentIdempotencyPort contentIdempotencyPort() {
        return new InMemoryContentIdempotency();
    }

    @Bean
    PublicProjectionStore publicProjectionStore() {
        return new InMemoryPublicProjectionStore();
    }

    @Bean
    ContentCacheInvalidator contentCacheInvalidator() {
        return new RecordingContentCacheInvalidator();
    }

    @Bean
    ContentCommandService contentCommandService(
            ContentRepository repository,
            ContentOutboxPort outbox,
            ContentIdempotencyPort idempotency,
            PublicProjectionStore projectionStore,
            ContentCacheInvalidator cacheInvalidator,
            Clock contentClock) {
        return new ContentCommandService(
                repository, outbox, idempotency, projectionStore, cacheInvalidator, contentClock);
    }

    @Bean
    ContentReadService contentReadService(
            ContentRepository repository,
            PublicProjectionStore projectionStore,
            Clock contentClock) {
        return new ContentReadService(repository, projectionStore, contentClock);
    }
}
