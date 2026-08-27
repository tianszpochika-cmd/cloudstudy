package com.englishflow.iam.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.englishflow.iam.domain.FailClosedPrincipalMappingPort;
import com.englishflow.iam.domain.FailClosedAuditFactPort;
import com.englishflow.iam.domain.FailClosedConsentStore;
import com.englishflow.iam.domain.FailClosedDeviceRegistry;
import com.englishflow.iam.domain.FailClosedProviderSessionPort;
import com.englishflow.iam.domain.FailClosedSessionStore;
import com.englishflow.iam.domain.JdbcConsentStore;
import com.englishflow.iam.domain.JdbcDeviceRegistry;
import com.englishflow.iam.domain.JdbcPrincipalMappingPort;
import com.englishflow.iam.domain.JdbcAuditFactPort;
import com.englishflow.iam.domain.JdbcSessionStore;
import com.englishflow.iam.domain.PrincipalMappingPort;
import com.englishflow.iam.domain.PrincipalMappingService;
import com.englishflow.iam.domain.ProviderSessionPort;
import com.englishflow.iam.domain.SessionStore;
import com.englishflow.iam.domain.AuditFactPort;
import com.englishflow.iam.domain.AdultGateService;
import com.englishflow.iam.domain.AdultGateFactStore;
import com.englishflow.iam.domain.FailClosedAdultGateFactStore;
import com.englishflow.iam.domain.JdbcAdultGateFactStore;
import com.englishflow.iam.domain.ConsentPolicyPort;
import com.englishflow.iam.domain.ConsentService;
import com.englishflow.iam.domain.ConsentStore;
import com.englishflow.iam.domain.ConsentType;
import com.englishflow.iam.domain.ConsentVersion;
import com.englishflow.iam.domain.DeviceRegistryPort;
import com.englishflow.iam.domain.DeviceService;
import com.englishflow.iam.domain.SessionService;
import com.englishflow.iam.domain.StaticConsentPolicy;
import com.englishflow.iam.oidc.AuthorizationTransactionPort;
import com.englishflow.iam.oidc.FailClosedAuthorizationTransactionStore;
import com.englishflow.iam.oidc.HttpOidcProviderAdapter;
import com.englishflow.iam.oidc.JdbcAuthorizationTransactionStore;
import com.englishflow.iam.oidc.OidcClientPort;
import com.englishflow.iam.oidc.OidcProviderAdapter;
import com.englishflow.iam.oidc.ProviderNeutralOidcClient;
import com.englishflow.iam.oidc.RedirectUriAllowlist;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.PlatformTransactionManager;

import javax.sql.DataSource;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.ZoneOffset;
import java.util.Set;
import java.util.Map;
import java.util.stream.Collectors;

/** Runtime composition root. Missing provider or database configuration remains fail closed. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(IamServiceProperties.class)
public class IamRuntimeConfiguration {

    @Bean
    public Clock iamClock() {
        return Clock.system(ZoneOffset.UTC);
    }

    @Bean
    public ObjectMapper iamObjectMapper() {
        return new ObjectMapper();
    }

    @Bean
    @ConditionalOnProperty(prefix = "iam.persistence", name = "enabled", havingValue = "true")
    public DataSource iamDataSource(IamServiceProperties properties) {
        IamServiceProperties.PersistenceProperties persistence = properties.getPersistence();
        if (blank(persistence.getJdbcUrl()) || blank(persistence.getUsername())
                || persistence.getPassword() == null) {
            throw new IllegalStateException("IAM JDBC is enabled but its URL/username/password is incomplete");
        }
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("com.mysql.cj.jdbc.Driver");
        dataSource.setUrl(persistence.getJdbcUrl());
        dataSource.setUsername(persistence.getUsername());
        dataSource.setPassword(persistence.getPassword());
        return dataSource;
    }

    @Bean
    @ConditionalOnBean(DataSource.class)
    public JdbcTemplate iamJdbcTemplate(DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    @Bean
    public AuditFactPort auditFactPort(
            IamServiceProperties properties,
            ObjectProvider<JdbcTemplate> jdbc) {
        JdbcTemplate template = jdbc.getIfAvailable();
        if (properties.getPersistence().isEnabled() && template != null) {
            return new JdbcAuditFactPort(template);
        }
        return new FailClosedAuditFactPort();
    }

    @Bean
    public DeviceRegistryPort deviceRegistryPort(
            IamServiceProperties properties,
            ObjectProvider<JdbcTemplate> jdbc) {
        JdbcTemplate template = jdbc.getIfAvailable();
        if (properties.getPersistence().isEnabled() && template != null) {
            return new JdbcDeviceRegistry(template);
        }
        return new FailClosedDeviceRegistry();
    }

    @Bean
    public DeviceService deviceService(
            DeviceRegistryPort devices,
            AuditFactPort audit,
            Clock iamClock) {
        return new DeviceService(devices, audit, iamClock);
    }

    @Bean
    public ConsentStore consentStore(
            IamServiceProperties properties,
            ObjectProvider<JdbcTemplate> jdbc) {
        JdbcTemplate template = jdbc.getIfAvailable();
        if (properties.getPersistence().isEnabled() && template != null) {
            return new JdbcConsentStore(template);
        }
        return new FailClosedConsentStore();
    }

    @Bean
    public ConsentPolicyPort consentPolicyPort() {
        ConsentVersion version = new ConsentVersion("b30-consent-v1");
        return new StaticConsentPolicy(Map.of(
                ConsentType.TERMS_OF_SERVICE, version,
                ConsentType.PRIVACY_NOTICE, version));
    }

    @Bean
    public ConsentService consentService(
            ConsentStore consents,
            ConsentPolicyPort policy,
            AuditFactPort audit,
            Clock iamClock) {
        return new ConsentService(consents, policy, audit, iamClock);
    }

    @Bean
    public AdultGateService adultGateService(AuditFactPort audit, Clock iamClock) {
        return new AdultGateService(audit, iamClock);
    }

    @Bean
    public AdultGateFactStore adultGateFactStore(
            IamServiceProperties properties,
            ObjectProvider<JdbcTemplate> jdbc) {
        JdbcTemplate template = jdbc.getIfAvailable();
        if (properties.getPersistence().isEnabled() && template != null) {
            return new JdbcAdultGateFactStore(template);
        }
        return new FailClosedAdultGateFactStore();
    }

    @Bean(name = "iamTransactionManager")
    @ConditionalOnBean(DataSource.class)
    public PlatformTransactionManager iamTransactionManager(DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }

    @Bean
    public OidcProviderAdapter oidcProviderAdapter(
            IamServiceProperties properties,
            ObjectMapper objectMapper,
            Clock iamClock) {
        if (!properties.isRealProviderEnabled() || !properties.getOidc().isEnabled()) {
            return new com.englishflow.iam.oidc.FailClosedOidcProviderAdapter(properties.getOidc().getProviderId());
        }
        return new HttpOidcProviderAdapter(properties.getOidc(), objectMapper, iamClock);
    }

    @Bean
    public ProviderSessionPort providerSessionPort(OidcProviderAdapter adapter) {
        return adapter instanceof ProviderSessionPort provider
                ? provider
                : new FailClosedProviderSessionPort();
    }

    @Bean
    public RedirectUriAllowlist redirectUriAllowlist(IamServiceProperties properties) {
        Set<URI> redirectUris = properties.getOidc().getRedirectUris().stream()
                .filter(value -> value != null && !value.isBlank())
                .map(URI::create)
                .collect(Collectors.toUnmodifiableSet());
        return new RedirectUriAllowlist(redirectUris);
    }

    @Bean
    public AuthorizationTransactionPort authorizationTransactionPort(
            IamServiceProperties properties,
            ObjectProvider<JdbcTemplate> jdbc,
            Clock iamClock) {
        JdbcTemplate template = jdbc.getIfAvailable();
        if (properties.getPersistence().isEnabled() && template != null) {
            return new JdbcAuthorizationTransactionStore(template, iamClock);
        }
        return new FailClosedAuthorizationTransactionStore();
    }

    @Bean
    public PrincipalMappingPort principalMappingPort(
            IamServiceProperties properties,
            ObjectProvider<JdbcTemplate> jdbc) {
        JdbcTemplate template = jdbc.getIfAvailable();
        if (properties.getPersistence().isEnabled() && template != null) {
            return new JdbcPrincipalMappingPort(template);
        }
        return new FailClosedPrincipalMappingPort();
    }

    @Bean
    public SessionStore sessionStore(
            IamServiceProperties properties,
            ObjectProvider<JdbcTemplate> jdbc) {
        JdbcTemplate template = jdbc.getIfAvailable();
        if (properties.getPersistence().isEnabled() && template != null) {
            return new JdbcSessionStore(template, Duration.ofDays(30));
        }
        return new FailClosedSessionStore();
    }

    @Bean
    public SessionService sessionService(
            SessionStore sessions,
            @Qualifier("providerSessionPort") ProviderSessionPort provider,
            AuditFactPort audit,
            Clock iamClock,
            IamServiceProperties properties) {
        return new SessionService(sessions, provider, audit, iamClock);
    }

    @Bean
    public PrincipalMappingService principalMappingService(PrincipalMappingPort mappings, Clock iamClock) {
        return new PrincipalMappingService(mappings, iamClock);
    }

    @Bean
    public OidcClientPort oidcClient(
            OidcProviderAdapter provider,
            RedirectUriAllowlist redirectUris,
            AuthorizationTransactionPort transactions,
            IamServiceProperties properties,
            Clock iamClock) {
        IamServiceProperties.OidcProperties oidc = properties.getOidc();
        return new ProviderNeutralOidcClient(
                provider,
                redirectUris,
                transactions,
                iamClock,
                positiveOrDefault(oidc.getTransactionTtl(), Duration.ofMinutes(5)),
                positiveOrDefault(oidc.getJwksMaxAge(), Duration.ofMinutes(15)));
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static Duration positiveOrDefault(Duration value, Duration fallback) {
        return value == null || value.isNegative() || value.isZero() ? fallback : value;
    }

}
