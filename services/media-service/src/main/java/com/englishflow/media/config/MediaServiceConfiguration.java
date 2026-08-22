package com.englishflow.media.config;

import com.englishflow.media.adapter.memory.InMemoryMediaEventOutbox;
import com.englishflow.media.adapter.memory.InMemoryMediaRepository;
import com.englishflow.media.adapter.memory.InMemorySignedUrlPort;
import com.englishflow.media.application.MediaAssetCommandService;
import com.englishflow.media.application.MediaReadService;
import com.englishflow.media.port.MediaEventPort;
import com.englishflow.media.port.MediaRepository;
import com.englishflow.media.port.SignedUrlPort;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Local code-layer wiring; production replaces memory adapters with media-owned adapters. */
@Configuration(proxyBeanMethods = false)
public class MediaServiceConfiguration {

    @Bean
    Clock mediaClock() {
        return Clock.systemUTC();
    }

    @Bean
    MediaRepository mediaRepository() {
        return new InMemoryMediaRepository();
    }

    @Bean
    SignedUrlPort signedUrlPort(MediaServiceProperties properties) {
        return new InMemorySignedUrlPort(properties.getSignedUrlBaseUrl());
    }

    @Bean
    MediaEventPort mediaEventPort() {
        return new InMemoryMediaEventOutbox();
    }

    @Bean
    MediaAssetCommandService mediaAssetCommandService(
            MediaRepository repository,
            SignedUrlPort signedUrlPort,
            MediaEventPort eventPort,
            Clock mediaClock) {
        return new MediaAssetCommandService(repository, signedUrlPort, eventPort, mediaClock);
    }

    @Bean
    MediaReadService mediaReadService(
            MediaRepository repository,
            SignedUrlPort signedUrlPort,
            MediaServiceProperties properties,
            Clock mediaClock) {
        return new MediaReadService(
                repository, signedUrlPort, mediaClock,
                properties.getSignedUrlTtl(), properties.getMaxSignedUrlTtl());
    }
}
