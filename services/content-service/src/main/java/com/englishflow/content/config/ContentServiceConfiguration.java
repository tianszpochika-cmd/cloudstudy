package com.englishflow.content.config;

import com.englishflow.content.adapter.failclosed.FailClosedContentCacheInvalidator;
import com.englishflow.content.adapter.failclosed.FailClosedContentIdempotency;
import com.englishflow.content.adapter.failclosed.FailClosedContentOutbox;
import com.englishflow.content.adapter.failclosed.FailClosedContentRepository;
import com.englishflow.content.adapter.failclosed.FailClosedPublishedContentReadProjectionPort;
import com.englishflow.content.adapter.failclosed.FailClosedPublicProjectionStore;
import com.englishflow.content.adapter.jdbc.JdbcContentCacheInvalidator;
import com.englishflow.content.adapter.jdbc.JdbcContentIdempotency;
import com.englishflow.content.adapter.jdbc.JdbcContentOutbox;
import com.englishflow.content.adapter.jdbc.JdbcContentRepository;
import com.englishflow.content.adapter.jdbc.JdbcPublishedContentReadProjectionPort;
import com.englishflow.content.adapter.jdbc.JdbcPublicProjectionStore;
import com.englishflow.content.application.ContentCommandService;
import com.englishflow.content.application.ContentReadService;
import com.englishflow.content.integration.PublishedContentReadProjectionPort;
import com.englishflow.content.port.ContentCacheInvalidator;
import com.englishflow.content.port.ContentIdempotencyPort;
import com.englishflow.content.port.ContentOutboxPort;
import com.englishflow.content.port.ContentRepository;
import com.englishflow.content.port.PublicProjectionStore;

import java.time.Clock;

import javax.sql.DataSource;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;

import tools.jackson.databind.ObjectMapper;

import org.flywaydb.core.Flyway;

/**
 * Runtime composition root. The only deployable storage mode is explicit JDBC; the disabled mode
 * uses fail-closed ports. Memory adapters remain directly constructible for pure domain tests and
 * are intentionally not a production fallback.
 */
@Configuration(proxyBeanMethods = false)
public class ContentServiceConfiguration {

    @Bean
    Clock contentClock() {
        return Clock.systemUTC();
    }

    @Bean
    @ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "disabled", matchIfMissing = true)
    ContentRepository failClosedContentRepository() {
        return new FailClosedContentRepository();
    }

    @Bean
    @ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "disabled", matchIfMissing = true)
    ContentOutboxPort failClosedContentOutbox() {
        return new FailClosedContentOutbox();
    }

    @Bean
    @ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "disabled", matchIfMissing = true)
    ContentIdempotencyPort failClosedContentIdempotency() {
        return new FailClosedContentIdempotency();
    }

    @Bean
    @ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "disabled", matchIfMissing = true)
    PublicProjectionStore failClosedPublicProjectionStore() {
        return new FailClosedPublicProjectionStore();
    }

    @Bean
    @ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "disabled", matchIfMissing = true)
    ContentCacheInvalidator failClosedContentCacheInvalidator() {
        return new FailClosedContentCacheInvalidator();
    }

    @Bean
    @ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "disabled", matchIfMissing = true)
    PublishedContentReadProjectionPort failClosedPublishedContentReadProjectionPort() {
        return new FailClosedPublishedContentReadProjectionPort();
    }

    @Bean
    @ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "jdbc")
    @ConditionalOnMissingBean(DataSource.class)
    DataSource contentDataSource(ContentPersistenceProperties properties) {
        ContentPersistenceProperties persistence = properties;
        if (isBlank(persistence.getJdbcUrl()) || isBlank(persistence.getUsername())
                || persistence.getPassword() == null || isBlank(persistence.getDriverClassName())) {
            throw new IllegalStateException(
                    "CONTENT_PERSISTENCE_MODE=jdbc requires CONTENT_JDBC_URL, CONTENT_JDBC_USERNAME, "
                            + "CONTENT_JDBC_PASSWORD and CONTENT_JDBC_DRIVER");
        }
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName(persistence.getDriverClassName());
        dataSource.setUrl(persistence.getJdbcUrl());
        dataSource.setUsername(persistence.getUsername());
        dataSource.setPassword(persistence.getPassword());
        return dataSource;
    }

    @Bean
    @ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "jdbc")
    Flyway contentFlyway(
            DataSource dataSource,
            @org.springframework.beans.factory.annotation.Value("${spring.flyway.enabled:false}") boolean migrationEnabled,
            ContentServiceProperties serviceProperties) {
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .schemas(serviceProperties.getSchema())
                .defaultSchema(serviceProperties.getSchema())
                .createSchemas(false)
                .locations("classpath:db/migration")
                .load();
        if (migrationEnabled) {
            flyway.migrate();
        }
        return flyway;
    }

    @Bean
    @ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "jdbc")
    JdbcTemplate contentJdbcTemplate(DataSource contentDataSource) {
        return new JdbcTemplate(contentDataSource);
    }

    @Bean
    @ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "jdbc")
    TransactionTemplate contentTransactionTemplate(DataSource contentDataSource) {
        return new TransactionTemplate(new DataSourceTransactionManager(contentDataSource));
    }

    @Bean
    @ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "jdbc")
    ContentRepository jdbcContentRepository(JdbcTemplate contentJdbcTemplate, ObjectMapper objectMapper) {
        return new JdbcContentRepository(contentJdbcTemplate, objectMapper);
    }

    @Bean
    @ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "jdbc")
    ContentOutboxPort jdbcContentOutbox(JdbcTemplate contentJdbcTemplate) {
        return new JdbcContentOutbox(contentJdbcTemplate);
    }

    @Bean
    @ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "jdbc")
    ContentIdempotencyPort jdbcContentIdempotency(
            JdbcTemplate contentJdbcTemplate,
            TransactionTemplate contentTransactionTemplate,
            ObjectMapper objectMapper,
            Clock contentClock) {
        return new JdbcContentIdempotency(
                contentJdbcTemplate, contentTransactionTemplate, objectMapper, contentClock);
    }

    @Bean
    @ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "jdbc")
    PublicProjectionStore jdbcPublicProjectionStore(
            JdbcTemplate contentJdbcTemplate,
            ObjectMapper objectMapper,
            Clock contentClock) {
        return new JdbcPublicProjectionStore(contentJdbcTemplate, objectMapper, contentClock);
    }

    @Bean
    @ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "jdbc")
    ContentCacheInvalidator jdbcContentCacheInvalidator(
            JdbcTemplate contentJdbcTemplate,
            Clock contentClock) {
        return new JdbcContentCacheInvalidator(contentJdbcTemplate, contentClock);
    }

    @Bean
    @ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "jdbc")
    PublishedContentReadProjectionPort jdbcPublishedContentReadProjectionPort(
            JdbcTemplate contentJdbcTemplate,
            Clock contentClock) {
        return new JdbcPublishedContentReadProjectionPort(contentJdbcTemplate, contentClock);
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

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
