package com.englishflow.iam.config;

import com.englishflow.iam.auth.JwtSigningKeyProvider;
import com.englishflow.iam.auth.JwtTokenService;
import com.englishflow.iam.domain.AccountStore;
import com.englishflow.iam.domain.AdultGateFactStore;
import com.englishflow.iam.domain.AdultGateService;
import com.englishflow.iam.domain.AuditFactPort;
import com.englishflow.iam.domain.ConsentPolicyPort;
import com.englishflow.iam.domain.ConsentService;
import com.englishflow.iam.domain.ConsentStore;
import com.englishflow.iam.domain.ConsentType;
import com.englishflow.iam.domain.ConsentVersion;
import com.englishflow.iam.domain.DeviceRegistryPort;
import com.englishflow.iam.domain.DeviceService;
import com.englishflow.iam.domain.FailClosedAdultGateFactStore;
import com.englishflow.iam.domain.FailClosedAccountStore;
import com.englishflow.iam.domain.FailClosedAuditFactPort;
import com.englishflow.iam.domain.FailClosedConsentStore;
import com.englishflow.iam.domain.FailClosedDeviceRegistry;
import com.englishflow.iam.domain.FailClosedSessionStore;
import com.englishflow.iam.domain.InMemoryAccountStore;
import com.englishflow.iam.domain.InMemoryAdultGateFactStore;
import com.englishflow.iam.domain.InMemoryAuditFactPort;
import com.englishflow.iam.domain.InMemoryConsentStore;
import com.englishflow.iam.domain.InMemoryDeviceRegistry;
import com.englishflow.iam.domain.InMemoryPasswordResetChallengeStore;
import com.englishflow.iam.domain.InMemorySessionStore;
import com.englishflow.iam.domain.JdbcAccountStore;
import com.englishflow.iam.domain.JdbcAdultGateFactStore;
import com.englishflow.iam.domain.JdbcAuditFactPort;
import com.englishflow.iam.domain.JdbcConsentStore;
import com.englishflow.iam.domain.JdbcDeviceRegistry;
import com.englishflow.iam.domain.JdbcSessionStore;
import com.englishflow.iam.domain.PasswordAccountService;
import com.englishflow.iam.domain.PasswordResetChallengeStore;
import com.englishflow.iam.domain.PasswordResetService;
import com.englishflow.iam.domain.SessionService;
import com.englishflow.iam.domain.SessionStore;
import com.englishflow.iam.domain.StaticConsentPolicy;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.transaction.PlatformTransactionManager;

import javax.sql.DataSource;
import java.time.Clock;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

/** Composition root for the self-owned JWT authentication center. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(IamServiceProperties.class)
public class IamRuntimeConfiguration {

    @Bean public Clock iamClock() { return Clock.system(ZoneOffset.UTC); }
    @Bean public ObjectMapper iamObjectMapper() { return new ObjectMapper(); }

    @Bean
    @ConditionalOnProperty(prefix = "iam.persistence", name = "enabled", havingValue = "true")
    public DataSource iamDataSource(IamServiceProperties properties) {
        IamServiceProperties.PersistenceProperties persistence = properties.getPersistence();
        if (blank(persistence.getJdbcUrl()) || blank(persistence.getUsername()) || persistence.getPassword() == null) {
            throw new IllegalStateException("IAM JDBC is enabled but URL, username or password is missing");
        }
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("com.mysql.cj.jdbc.Driver");
        dataSource.setUrl(persistence.getJdbcUrl());
        dataSource.setUsername(persistence.getUsername());
        dataSource.setPassword(persistence.getPassword());
        return dataSource;
    }

    @Bean @ConditionalOnBean(DataSource.class)
    public JdbcTemplate iamJdbcTemplate(DataSource dataSource) { return new JdbcTemplate(dataSource); }

    @Bean
    public AuditFactPort auditFactPort(IamServiceProperties properties, ObjectProvider<JdbcTemplate> jdbc) {
        JdbcTemplate template = jdbc.getIfAvailable();
        if (properties.getPersistence().isEnabled() && template != null) return new JdbcAuditFactPort(template);
        return properties.getPersistence().isEnabled() ? new FailClosedAuditFactPort() : new InMemoryAuditFactPort();
    }

    @Bean
    public DeviceRegistryPort deviceRegistryPort(IamServiceProperties properties, ObjectProvider<JdbcTemplate> jdbc) {
        JdbcTemplate template = jdbc.getIfAvailable();
        if (properties.getPersistence().isEnabled() && template != null) return new JdbcDeviceRegistry(template);
        return properties.getPersistence().isEnabled() ? new FailClosedDeviceRegistry() : new InMemoryDeviceRegistry();
    }

    @Bean public DeviceService deviceService(DeviceRegistryPort devices, AuditFactPort audit, Clock iamClock) {
        return new DeviceService(devices, audit, iamClock);
    }

    @Bean
    public ConsentStore consentStore(IamServiceProperties properties, ObjectProvider<JdbcTemplate> jdbc) {
        JdbcTemplate template = jdbc.getIfAvailable();
        if (properties.getPersistence().isEnabled() && template != null) return new JdbcConsentStore(template);
        return properties.getPersistence().isEnabled() ? new FailClosedConsentStore() : new InMemoryConsentStore();
    }

    @Bean public ConsentPolicyPort consentPolicyPort() {
        ConsentVersion version = new ConsentVersion("b30-consent-v1");
        return new StaticConsentPolicy(Map.of(ConsentType.TERMS_OF_SERVICE, version, ConsentType.PRIVACY_NOTICE, version));
    }

    @Bean public ConsentService consentService(ConsentStore consents, ConsentPolicyPort policy,
                                                AuditFactPort audit, Clock iamClock) {
        return new ConsentService(consents, policy, audit, iamClock);
    }

    @Bean public AdultGateService adultGateService(AuditFactPort audit, Clock iamClock) { return new AdultGateService(audit, iamClock); }

    @Bean
    public AdultGateFactStore adultGateFactStore(IamServiceProperties properties, ObjectProvider<JdbcTemplate> jdbc) {
        JdbcTemplate template = jdbc.getIfAvailable();
        if (properties.getPersistence().isEnabled() && template != null) return new JdbcAdultGateFactStore(template);
        return properties.getPersistence().isEnabled() ? new FailClosedAdultGateFactStore() : new InMemoryAdultGateFactStore();
    }

    @Bean @ConditionalOnBean(DataSource.class)
    public PlatformTransactionManager iamTransactionManager(DataSource dataSource) { return new DataSourceTransactionManager(dataSource); }

    @Bean
    public AccountStore accountStore(IamServiceProperties properties, ObjectProvider<JdbcTemplate> jdbc) {
        JdbcTemplate template = jdbc.getIfAvailable();
        if (properties.getPersistence().isEnabled() && template != null) return new JdbcAccountStore(template);
        return properties.getPersistence().isEnabled() ? new FailClosedAccountStore() : new InMemoryAccountStore();
    }

    @Bean public PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }

    @Bean public PasswordAccountService passwordAccountService(AccountStore accounts, PasswordEncoder encoder,
                                                               AuditFactPort audit, Clock clock,
                                                               IamServiceProperties properties) {
        return new PasswordAccountService(accounts, encoder, audit, clock, properties);
    }

    @Bean public PasswordResetChallengeStore passwordResetChallengeStore() { return new InMemoryPasswordResetChallengeStore(); }

    @Bean public PasswordResetService passwordResetService(AccountStore accounts, PasswordResetChallengeStore challenges,
                                                           PasswordAccountService passwords, AuditFactPort audit,
                                                           Clock clock, IamServiceProperties properties) {
        return new PasswordResetService(accounts, challenges, passwords, audit, clock, properties);
    }

    @Bean
    public SessionStore sessionStore(IamServiceProperties properties, ObjectProvider<JdbcTemplate> jdbc) {
        JdbcTemplate template = jdbc.getIfAvailable();
        if (properties.getPersistence().isEnabled() && template != null) return new JdbcSessionStore(template);
        return properties.getPersistence().isEnabled() ? new FailClosedSessionStore() : new InMemorySessionStore();
    }

    @Bean public SessionService sessionService(SessionStore sessions, AuditFactPort audit, Clock clock,
                                                IamServiceProperties properties) {
        return new SessionService(sessions, audit, clock, properties);
    }

    @Bean public JwtSigningKeyProvider jwtSigningKeyProvider(IamServiceProperties properties) {
        return new JwtSigningKeyProvider(properties);
    }

    @Bean public JwtEncoder jwtEncoder(JwtSigningKeyProvider keys) {
        JWKSource<SecurityContext> source = (selector, context) -> List.of(keys.signingKey());
        return new NimbusJwtEncoder(source);
    }

    @Bean public JwtTokenService jwtTokenService(JwtEncoder encoder, JwtSigningKeyProvider keys,
                                                  IamServiceProperties properties, Clock clock) {
        return new JwtTokenService(encoder, keys, properties, clock);
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }
}
