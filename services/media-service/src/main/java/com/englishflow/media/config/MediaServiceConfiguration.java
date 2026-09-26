package com.englishflow.media.config;

import com.englishflow.media.adapter.jdbc.JdbcMediaEventOutbox;
import com.englishflow.media.adapter.jdbc.JdbcMediaRegistrationIdempotencyStore;
import com.englishflow.media.adapter.jdbc.JdbcMediaRepository;
import com.englishflow.media.adapter.jdbc.JdbcMediaWriteIdempotency;
import com.englishflow.media.adapter.memory.InMemoryMediaEventOutbox;
import com.englishflow.media.adapter.memory.InMemoryMediaRepository;
import com.englishflow.media.adapter.memory.InMemoryMediaRegistrationIdempotencyStore;
import com.englishflow.media.adapter.memory.InMemoryMediaWriteIdempotency;
import com.englishflow.media.adapter.failclosed.FailClosedSignedUrlPort;
import com.englishflow.media.adapter.objectstore.MinioObjectStorePort;
import com.englishflow.media.adapter.objectstore.VerifiedObjectSignedUrlPort;
import com.englishflow.media.application.MediaAssetCommandService;
import com.englishflow.media.application.MediaReadService;
import com.englishflow.media.port.MediaEventPort;
import com.englishflow.media.port.MediaRepository;
import com.englishflow.media.port.MediaRegistrationIdempotencyPort;
import com.englishflow.media.port.MediaWriteIdempotencyPort;
import com.englishflow.media.port.SignedUrlPort;

import java.time.Clock;

import javax.sql.DataSource;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/** Local code-layer wiring; production replaces memory adapters with media-owned adapters. */
@Configuration(proxyBeanMethods = false)
public class MediaServiceConfiguration {

    @Bean
    Clock mediaClock() {
        return Clock.systemUTC();
    }

    @Bean
    @Profile("!local-real")
    MediaRepository mediaRepository() {
        return new InMemoryMediaRepository();
    }

    @Bean
    @Profile("local-real")
    @ConditionalOnMissingBean(MediaRepository.class)
    MediaRepository localRealMediaRepository(JdbcTemplate jdbcTemplate) {
        return new JdbcMediaRepository(jdbcTemplate);
    }

    @Bean
    @Profile("local-real")
    @ConditionalOnMissingBean(DataSource.class)
    DataSource localRealMediaDataSource(
            @Value("${spring.datasource.url:}") String url,
            @Value("${spring.datasource.username:}") String username,
            @Value("${spring.datasource.password:}") String password,
            @Value("${spring.datasource.driver-class-name:com.mysql.cj.jdbc.Driver}") String driverClassName) {
        if (url.isBlank() || username.isBlank() || password.isBlank()) {
            throw new IllegalStateException("local-real media JDBC requires spring.datasource.url/username/password");
        }
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName(driverClassName);
        dataSource.setUrl(url);
        dataSource.setUsername(username);
        dataSource.setPassword(password);
        return dataSource;
    }

    @Bean
    @Profile("local-real")
    Flyway localRealMediaFlyway(
            DataSource dataSource,
            @org.springframework.beans.factory.annotation.Value("${spring.flyway.enabled:false}") boolean migrationEnabled,
            MediaServiceProperties properties) {
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .schemas(properties.getSchema())
                .defaultSchema(properties.getSchema())
                .createSchemas(false)
                .baselineOnMigrate(true)
                .baselineVersion("0")
                .locations("classpath:db/migration")
                .load();
        if (migrationEnabled) {
            flyway.migrate();
        }
        return flyway;
    }

    @Bean
    @Profile("local-real")
    JdbcTemplate localRealMediaJdbcTemplate(DataSource dataSource, Flyway localRealMediaFlyway) {
        return new JdbcTemplate(dataSource);
    }

    @Bean
    @Profile("!local-real")
    SignedUrlPort signedUrlPort(MediaServiceProperties properties) {
        return configuredSignedUrlPort(properties);
    }

    @Bean
    @Profile("local-real")
    SignedUrlPort localRealSignedUrlPort(MediaServiceProperties properties) {
        return configuredSignedUrlPort(properties);
    }

    private SignedUrlPort configuredSignedUrlPort(MediaServiceProperties properties) {
        if (!properties.isObjectStoreEnabled()) {
            return new FailClosedSignedUrlPort();
        }
        return new VerifiedObjectSignedUrlPort(
                new MinioObjectStorePort(properties.getObjectStoreEndpoint(),
                        properties.getObjectStorePublicEndpoint(),
                        properties.getObjectStoreAccessKey(), properties.getObjectStoreSecretKey(),
                        properties.getObjectStoreRegion()),
                properties.getObjectStoreBucket());
    }

    @Bean
    @Profile("!local-real")
    MediaEventPort mediaEventPort() {
        return new InMemoryMediaEventOutbox();
    }

    @Bean
    @Profile("local-real")
    MediaEventPort localRealMediaEventPort(JdbcTemplate localRealMediaJdbcTemplate,
            MediaServiceProperties properties) {
        // M3-004: durable outbox now that the schema carries the standard
        // shape (V4) with a wide enough event id (V5).
        return new JdbcMediaEventOutbox(localRealMediaJdbcTemplate, properties.getSchema());
    }

    @Bean
    @Profile("!local-real")
    MediaRegistrationIdempotencyPort mediaRegistrationIdempotencyPort() {
        return new InMemoryMediaRegistrationIdempotencyStore();
    }

    @Bean
    @Profile("local-real")
    MediaRegistrationIdempotencyPort localRealMediaRegistrationIdempotencyPort(
            JdbcTemplate localRealMediaJdbcTemplate, MediaServiceProperties properties) {
        // M3-004: durable idempotency so a restart cannot change a key's meaning.
        return new JdbcMediaRegistrationIdempotencyStore(localRealMediaJdbcTemplate, properties.getSchema());
    }

    @Bean
    @Profile("!local-real")
    MediaWriteIdempotencyPort mediaWriteIdempotencyPort() {
        return new InMemoryMediaWriteIdempotency();
    }

    @Bean
    @Profile("local-real")
    MediaWriteIdempotencyPort localRealMediaWriteIdempotencyPort(
            JdbcTemplate localRealMediaJdbcTemplate, DataSource dataSource,
            MediaServiceProperties properties) {
        return new JdbcMediaWriteIdempotency(
                localRealMediaJdbcTemplate, dataSource, properties.getSchema(), new ObjectMapper());
    }

    @Bean
    MediaAssetCommandService mediaAssetCommandService(
            MediaRepository repository,
            SignedUrlPort signedUrlPort,
            MediaEventPort eventPort,
            MediaRegistrationIdempotencyPort idempotencyPort,
            Clock mediaClock) {
        return new MediaAssetCommandService(repository, signedUrlPort, eventPort, idempotencyPort, mediaClock);
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
