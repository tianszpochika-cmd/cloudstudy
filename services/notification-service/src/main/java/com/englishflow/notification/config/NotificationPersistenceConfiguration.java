package com.englishflow.notification.config;

import tools.jackson.databind.ObjectMapper;
import com.englishflow.notification.adapter.failclosed.FailClosedNotificationAuditEventStore;
import com.englishflow.notification.adapter.failclosed.FailClosedNotificationSubscriptionStore;
import com.englishflow.notification.adapter.failclosed.FailClosedNotificationTemplateStore;
import com.englishflow.notification.adapter.jdbc.JdbcNotificationSubscriptionStore;
import com.englishflow.notification.adapter.jdbc.JdbcNotificationTemplateStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationSubscriptionStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationTemplateStore;
import com.englishflow.notification.port.NotificationSubscriptionStore;
import com.englishflow.notification.port.NotificationTemplateStore;
import com.englishflow.notification.adapter.failclosed.FailClosedNotificationConsentStore;
import com.englishflow.notification.adapter.failclosed.FailClosedNotificationFactStore;
import com.englishflow.notification.adapter.failclosed.FailClosedOfflineSyncStore;
import com.englishflow.notification.adapter.failclosed.FailClosedOutboxEventPort;
import com.englishflow.notification.adapter.failclosed.FailClosedTrustedEventReceiptStore;
import com.englishflow.notification.adapter.failclosed.FailClosedWorkflowPort;
import com.englishflow.notification.adapter.jdbc.JdbcNotificationAuditEventStore;
import com.englishflow.notification.adapter.jdbc.JdbcNotificationConsentStore;
import com.englishflow.notification.adapter.jdbc.JdbcNotificationFactStore;
import com.englishflow.notification.adapter.jdbc.JdbcNotificationOutboxEventPort;
import com.englishflow.notification.adapter.jdbc.JdbcOfflineSyncStore;
import com.englishflow.notification.adapter.jdbc.JdbcTrustedEventReceiptStore;
import com.englishflow.notification.adapter.jdbc.JdbcWorkflowPort;
import com.englishflow.notification.adapter.memory.InMemoryNotificationAuditEventStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationConsentStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationFactStore;
import com.englishflow.notification.adapter.memory.InMemoryOfflineSyncStore;
import com.englishflow.notification.adapter.memory.InMemoryOutboxEventPort;
import com.englishflow.notification.adapter.memory.InMemoryTrustedEventReceiptStore;
import com.englishflow.notification.adapter.memory.InMemoryWorkflowPort;
import com.englishflow.notification.port.NotificationAuditEventPort;
import com.englishflow.notification.port.NotificationConsentPort;
import com.englishflow.notification.port.NotificationFactStore;
import com.englishflow.notification.port.OfflineSyncStore;
import com.englishflow.notification.port.OutboxEventPort;
import com.englishflow.notification.port.TrustedEventReceiptPort;
import com.englishflow.notification.port.WorkflowPort;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.flywaydb.core.Flyway;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;

/** Runtime composition root: jdbc, explicit memory test mode, or fail-closed. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(NotificationPersistenceProperties.class)
public class NotificationPersistenceConfiguration {

    @Bean
    @ConditionalOnProperty(prefix = "notification.persistence", name = "mode", havingValue = "jdbc")
    DataSource notificationDataSource(NotificationPersistenceProperties properties) {
        if (blank(properties.getJdbcUrl()) || blank(properties.getUsername()) || properties.getPassword() == null) {
            throw new IllegalStateException("notification JDBC is enabled but URL/username/password is incomplete");
        }
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("com.mysql.cj.jdbc.Driver");
        dataSource.setUrl(properties.getJdbcUrl());
        dataSource.setUsername(properties.getUsername());
        dataSource.setPassword(properties.getPassword());
        return dataSource;
    }

    @Bean
    @ConditionalOnBean(DataSource.class)
    JdbcTemplate notificationJdbcTemplate(DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    @Bean
    @ConditionalOnBean(DataSource.class)
    TransactionTemplate notificationTransactionTemplate(DataSource dataSource) {
        return new TransactionTemplate(new DataSourceTransactionManager(dataSource));
    }

    @Bean
    @ConditionalOnProperty(prefix = "spring.flyway", name = "enabled", havingValue = "true")
    Flyway notificationFlyway(DataSource dataSource,
            @Value("${service.schema:notification_service}") String schema) {
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .schemas(schema)
                .defaultSchema(schema)
                .baselineOnMigrate(true)
                .baselineVersion("0")
                .locations("classpath:db/migration")
                .load();
        flyway.migrate();
        return flyway;
    }

    @Bean
    NotificationFactStore notificationFactStore(NotificationPersistenceProperties properties,
            ObjectProvider<JdbcTemplate> jdbc, ObjectMapper objectMapper) {
        if (properties.isJdbc()) return new JdbcNotificationFactStore(requiredJdbc(jdbc), objectMapper);
        if (properties.isMemory()) return new InMemoryNotificationFactStore();
        return new FailClosedNotificationFactStore();
    }

    @Bean
    NotificationConsentPort notificationConsentPort(NotificationPersistenceProperties properties,
            ObjectProvider<JdbcTemplate> jdbc) {
        if (properties.isJdbc()) return new JdbcNotificationConsentStore(requiredJdbc(jdbc));
        if (properties.isMemory()) return new InMemoryNotificationConsentStore();
        return new FailClosedNotificationConsentStore();
    }

    @Bean
    OutboxEventPort notificationOutboxEventPort(NotificationPersistenceProperties properties,
            ObjectProvider<JdbcTemplate> jdbc, ObjectMapper objectMapper) {
        if (properties.isJdbc()) return new JdbcNotificationOutboxEventPort(requiredJdbc(jdbc), objectMapper);
        if (properties.isMemory()) return new InMemoryOutboxEventPort();
        return new FailClosedOutboxEventPort();
    }

    @Bean
    NotificationAuditEventPort notificationAuditEventPort(NotificationPersistenceProperties properties,
            ObjectProvider<JdbcTemplate> jdbc, ObjectMapper objectMapper) {
        if (properties.isJdbc()) return new JdbcNotificationAuditEventStore(requiredJdbc(jdbc), objectMapper);
        if (properties.isMemory()) return new InMemoryNotificationAuditEventStore();
        return new FailClosedNotificationAuditEventStore();
    }

    @Bean
    TrustedEventReceiptPort trustedEventReceiptPort(NotificationPersistenceProperties properties,
            ObjectProvider<JdbcTemplate> jdbc) {
        if (properties.isJdbc()) return new JdbcTrustedEventReceiptStore(requiredJdbc(jdbc));
        if (properties.isMemory()) return new InMemoryTrustedEventReceiptStore();
        return new FailClosedTrustedEventReceiptStore();
    }

    @Bean
    WorkflowPort notificationWorkflowPort(NotificationPersistenceProperties properties,
            ObjectProvider<JdbcTemplate> jdbc) {
        if (properties.isJdbc()) return new JdbcWorkflowPort(requiredJdbc(jdbc));
        if (properties.isMemory()) return new InMemoryWorkflowPort();
        return new FailClosedWorkflowPort();
    }

    @Bean
    NotificationSubscriptionStore notificationSubscriptionStore(NotificationPersistenceProperties properties,
            ObjectProvider<JdbcTemplate> jdbc) {
        if (properties.isJdbc()) return new JdbcNotificationSubscriptionStore(requiredJdbc(jdbc));
        if (properties.isMemory()) return new InMemoryNotificationSubscriptionStore();
        return new FailClosedNotificationSubscriptionStore();
    }

    @Bean
    NotificationTemplateStore notificationTemplateStore(NotificationPersistenceProperties properties,
            ObjectProvider<JdbcTemplate> jdbc) {
        if (properties.isJdbc()) return new JdbcNotificationTemplateStore(requiredJdbc(jdbc));
        if (properties.isMemory()) return new InMemoryNotificationTemplateStore();
        return new FailClosedNotificationTemplateStore();
    }

    @Bean
    OfflineSyncStore notificationOfflineSyncStore(NotificationPersistenceProperties properties,
            ObjectProvider<JdbcTemplate> jdbc, ObjectProvider<TransactionTemplate> transaction,
            ObjectMapper objectMapper) {
        if (properties.isJdbc()) {
            TransactionTemplate template = transaction.getIfAvailable();
            if (template == null) {
                throw new IllegalStateException("notification JDBC mode requires a transaction manager");
            }
            return new JdbcOfflineSyncStore(requiredJdbc(jdbc), template, objectMapper);
        }
        if (properties.isMemory()) return new InMemoryOfflineSyncStore();
        return new FailClosedOfflineSyncStore();
    }

    private static JdbcTemplate requiredJdbc(ObjectProvider<JdbcTemplate> jdbc) {
        JdbcTemplate template = jdbc.getIfAvailable();
        if (template == null) {
            throw new IllegalStateException("notification JDBC mode requires a configured DataSource");
        }
        return template;
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
