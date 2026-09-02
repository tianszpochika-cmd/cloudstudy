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
import com.englishflow.iam.domain.DeviceRegistryPort;
import com.englishflow.iam.domain.DeviceService;
import com.englishflow.iam.domain.FailClosedAdultGateFactStore;
import com.englishflow.iam.domain.FailClosedAccountStore;
import com.englishflow.iam.domain.FailClosedAuditFactPort;
import com.englishflow.iam.domain.FailClosedConsentStore;
import com.englishflow.iam.domain.FailClosedDeviceRegistry;
import com.englishflow.iam.domain.FailClosedSessionStore;
import com.englishflow.iam.domain.FailClosedIdempotencyStore;
import com.englishflow.iam.domain.InMemoryAccountStore;
import com.englishflow.iam.domain.InMemoryAdultGateFactStore;
import com.englishflow.iam.domain.InMemoryAuditFactPort;
import com.englishflow.iam.domain.InMemoryConsentStore;
import com.englishflow.iam.domain.InMemoryDeviceRegistry;
import com.englishflow.iam.domain.InMemoryPasswordResetChallengeStore;
import com.englishflow.iam.domain.InMemorySessionStore;
import com.englishflow.iam.domain.InMemoryIdempotencyStore;
import com.englishflow.iam.domain.IdempotencyService;
import com.englishflow.iam.domain.IdempotencyStore;
import com.englishflow.iam.domain.IdempotencyResponseCodec;
import com.englishflow.iam.domain.IamTransactionRunner;
import com.englishflow.iam.domain.JdbcAccountStore;
import com.englishflow.iam.domain.JdbcAdultGateFactStore;
import com.englishflow.iam.domain.JdbcAuditFactPort;
import com.englishflow.iam.domain.JdbcConsentStore;
import com.englishflow.iam.domain.JdbcDeviceRegistry;
import com.englishflow.iam.domain.JdbcPasswordResetChallengeStore;
import com.englishflow.iam.domain.JdbcIdempotencyStore;
import com.englishflow.iam.domain.JdbcSessionStore;
import com.englishflow.iam.domain.JdbcRateLimitStore;
import com.englishflow.iam.domain.FailClosedRateLimitStore;
import com.englishflow.iam.domain.InMemoryRateLimitStore;
import com.englishflow.iam.domain.PasswordAccountService;
import com.englishflow.iam.domain.PasswordResetChallengeStore;
import com.englishflow.iam.domain.PasswordResetService;
import com.englishflow.iam.domain.PolicyBootstrapService;
import com.englishflow.iam.domain.PolicyAccessAuthenticationVerifier;
import com.englishflow.iam.domain.PolicyControlService;
import com.englishflow.iam.domain.PolicyStore;
import com.englishflow.iam.domain.FailClosedPolicyStore;
import com.englishflow.iam.domain.InMemoryPolicyStore;
import com.englishflow.iam.domain.JdbcPolicyStore;
import com.englishflow.iam.domain.PdpDecisionService;
import com.englishflow.iam.domain.RateLimitStore;
import com.englishflow.iam.domain.SessionService;
import com.englishflow.iam.domain.SessionStore;
import com.englishflow.iam.domain.StaticConsentPolicy;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.time.Clock;
import java.time.ZoneOffset;
import java.util.List;

/** Composition root for the self-owned JWT authentication center. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(IamServiceProperties.class)
@EnableTransactionManagement(proxyTargetClass = false)
public class IamRuntimeConfiguration {

    @Bean public Clock iamClock() { return Clock.system(ZoneOffset.UTC); }
    @Bean
    public ObjectMapper iamObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        return mapper.findAndRegisterModules();
    }

    /**
     * Refuse insecure production wiring. Cookie transport and deterministic idempotency replay
     * both have safe defaults only when the deployment explicitly opts into a local/test profile.
     */
    @Bean
    public Object iamSecurityConfigurationGuard(IamServiceProperties properties, Environment environment) {
        boolean localOrTest = java.util.Arrays.stream(environment.getActiveProfiles())
                .anyMatch(profile -> "local".equals(profile) || "test".equals(profile));
        if (!properties.getJwt().isRefreshCookieSecure() && !localOrTest) {
            throw new IllegalStateException("IAM refresh cookies may be insecure only in an explicit local/test profile");
        }
        if (!localOrTest && !properties.getPersistence().isEnabled()) {
            throw new IllegalStateException("IAM durable persistence must be enabled outside an explicit local/test profile");
        }
        if (!localOrTest && properties.getJwt().isEphemeralKeysAllowed()) {
            throw new IllegalStateException("IAM ephemeral signing keys are allowed only in an explicit local/test profile");
        }
        if (properties.getPersistence().isEnabled()
                && !IdempotencyResponseCodec.isStrongSecret(properties.getIdempotency().getReplaySecret())) {
            throw new IllegalStateException("IAM persistence requires a stable 32-character IAM_IDEMPOTENCY_REPLAY_SECRET");
        }
        if (properties.getPersistence().isEnabled()
                && !schemaMatchesJdbcUrl(properties.getPersistence().getJdbcUrl(), properties.getPersistence().getSchema())) {
            throw new IllegalStateException("IAM JDBC URL database must match the owner schema "
                    + properties.getPersistence().getSchema());
        }
        if (properties.getPolicy().getBootstrap().isEnabled() && !localOrTest) {
            throw new IllegalStateException("IAM policy bootstrap is permitted only in an explicit local/test profile");
        }
        if (properties.getPolicy().getBootstrap().isEnabled()
                && blank(properties.getPolicy().getBootstrap().getExistingAccountIdentifier())) {
            throw new IllegalStateException("IAM policy bootstrap requires an explicit existing account identifier");
        }
        return new Object();
    }

    @Bean
    public IamTransactionRunner iamTransactionRunner(ObjectProvider<PlatformTransactionManager> transactionManagers) {
        PlatformTransactionManager transactionManager = transactionManagers.getIfAvailable();
        if (transactionManager == null) return IamTransactionRunner.direct();
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        return new IamTransactionRunner() {
            @Override public <T> T execute(java.util.function.Supplier<T> operation) {
                return template.execute(status -> operation.get());
            }
        };
    }

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

    /**
     * Spring Boot 4 no longer supplies the Flyway auto-configuration from the general
     * autoconfigure module. IAM therefore composes Flyway explicitly against its owner DataSource;
     * otherwise a migration can be packaged successfully while never reaching the IAM database.
     */
    @Bean
    @ConditionalOnProperty(prefix = "iam.persistence", name = "enabled", havingValue = "true")
    @ConditionalOnProperty(prefix = "spring.flyway", name = "enabled", havingValue = "true", matchIfMissing = true)
    public Flyway iamFlyway(DataSource dataSource, IamServiceProperties properties) {
        String ownerSchema = properties.getPersistence().getSchema();
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .schemas(ownerSchema)
                .defaultSchema(ownerSchema)
                .createSchemas(false)
                .baselineOnMigrate(true)
                .baselineVersion("0")
                .load();
        flyway.migrate();
        return flyway;
    }

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

    @Bean public ConsentPolicyPort consentPolicyPort(Environment environment) {
        boolean localOrTest = java.util.Arrays.stream(environment.getActiveProfiles())
                .anyMatch(profile -> "local".equals(profile) || "test".equals(profile));
        // These are explicit local/test candidates. A non-local deployment gets a read-only
        // policy until published legal-document facts are provisioned, so missing production
        // configuration can never silently authorize a consent write.
        return StaticConsentPolicy.localCandidate(localOrTest);
    }

    @Bean public ConsentService consentService(ConsentStore consents, ConsentPolicyPort policy,
                                                AuditFactPort audit, Clock iamClock, SessionService sessions,
                                                IamTransactionRunner transactions) {
        return new ConsentService(consents, policy, audit, iamClock, sessions, transactions);
    }

    @Bean public AdultGateService adultGateService(AuditFactPort audit, Clock iamClock,
                                                    AdultGateFactStore facts, SessionService sessions,
                                                    IamTransactionRunner transactions) {
        return new AdultGateService(audit, iamClock, facts, sessions, transactions);
    }

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
                                                               IamServiceProperties properties,
                                                               RateLimitStore rateLimits) {
        return new PasswordAccountService(accounts, encoder, audit, clock, properties, rateLimits);
    }

    @Bean
    public PasswordResetChallengeStore passwordResetChallengeStore(IamServiceProperties properties,
                                                                    ObjectProvider<JdbcTemplate> jdbc) {
        JdbcTemplate template = jdbc.getIfAvailable();
        if (properties.getPersistence().isEnabled() && template != null) {
            return new JdbcPasswordResetChallengeStore(template);
        }
        return properties.getPersistence().isEnabled()
                ? new com.englishflow.iam.domain.FailClosedPasswordResetChallengeStore()
                : new InMemoryPasswordResetChallengeStore();
    }

    @Bean
    public IdempotencyStore idempotencyStore(IamServiceProperties properties, ObjectProvider<JdbcTemplate> jdbc) {
        JdbcTemplate template = jdbc.getIfAvailable();
        if (properties.getPersistence().isEnabled() && template != null) return new JdbcIdempotencyStore(template);
        return properties.getPersistence().isEnabled() ? new FailClosedIdempotencyStore() : new InMemoryIdempotencyStore();
    }

    @Bean
    public IdempotencyService idempotencyService(IdempotencyStore store, ObjectMapper objectMapper,
                                                 IamTransactionRunner transactions,
                                                 IamServiceProperties properties) {
        return new IdempotencyService(store, objectMapper, transactions,
                properties.getIdempotency().getReplaySecret(),
                properties.getIdempotency().getRetention());
    }

    @Bean public PasswordResetService passwordResetService(AccountStore accounts, PasswordResetChallengeStore challenges,
                                                           PasswordAccountService passwords, AuditFactPort audit,
                                                           Clock clock, IamServiceProperties properties,
                                                           SessionService sessions, IamTransactionRunner transactions,
                                                           RateLimitStore rateLimits) {
        return new PasswordResetService(accounts, challenges, passwords, audit, clock, properties,
                sessions, transactions, rateLimits);
    }

    @Bean
    public RateLimitStore rateLimitStore(IamServiceProperties properties, ObjectProvider<JdbcTemplate> jdbc) {
        JdbcTemplate template = jdbc.getIfAvailable();
        if (properties.getPersistence().isEnabled() && template != null) return new JdbcRateLimitStore(template);
        return properties.getPersistence().isEnabled() ? new FailClosedRateLimitStore() : new InMemoryRateLimitStore();
    }

    @Bean
    public PolicyStore policyStore(IamServiceProperties properties, ObjectProvider<JdbcTemplate> jdbc,
                                   ObjectMapper objectMapper) {
        JdbcTemplate template = jdbc.getIfAvailable();
        if (properties.getPersistence().isEnabled() && template != null) return new JdbcPolicyStore(template, objectMapper);
        return properties.getPersistence().isEnabled() ? new FailClosedPolicyStore() : new InMemoryPolicyStore();
    }

    @Bean
    public PolicyControlService policyControlService(PolicyStore policies, AuditFactPort audit,
                                                     IamTransactionRunner transactions, ObjectMapper objectMapper,
                                                     Clock iamClock) {
        return new PolicyControlService(policies, audit, transactions, objectMapper, iamClock);
    }

    @Bean
    public PdpDecisionService pdpDecisionService(PolicyControlService policies, AccountStore accounts,
                                                 SessionService sessions, AdultGateFactStore adultGates,
                                                 ConsentStore consents, ConsentPolicyPort consentPolicy,
                                                 AuditFactPort audit, Clock iamClock) {
        return new PdpDecisionService(policies, accounts, sessions, adultGates, consents,
                consentPolicy, audit, iamClock);
    }

    @Bean
    public PolicyAccessAuthenticationVerifier policyAccessAuthenticationVerifier(AccountStore accounts,
                                                                                  SessionService sessions,
                                                                                  Clock iamClock) {
        return new PolicyAccessAuthenticationVerifier(accounts, sessions, iamClock);
    }

    @Bean
    public PolicyBootstrapService policyBootstrapService(AccountStore accounts, AuditFactPort audit, Clock iamClock,
                                                         IamTransactionRunner transactions) {
        return new PolicyBootstrapService(accounts, audit, iamClock, transactions);
    }

    @Bean
    public ApplicationRunner policyBootstrapRunner(IamServiceProperties properties, Environment environment,
                                                   PolicyBootstrapService bootstrap) {
        return arguments -> {
            if (!properties.getPolicy().getBootstrap().isEnabled()) return;
            boolean localOrTest = java.util.Arrays.stream(environment.getActiveProfiles())
                    .anyMatch(profile -> "local".equals(profile) || "test".equals(profile));
            if (!localOrTest) throw new IllegalStateException("IAM policy bootstrap requires a local/test profile");
            bootstrap.grantToExistingAccount(properties.getPolicy().getBootstrap().getExistingAccountIdentifier());
        };
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

    private static boolean schemaMatchesJdbcUrl(String jdbcUrl, String schema) {
        if (blank(jdbcUrl) || blank(schema)) return false;
        int slash = jdbcUrl.lastIndexOf('/');
        if (slash < 0 || slash == jdbcUrl.length() - 1) return false;
        String database = jdbcUrl.substring(slash + 1);
        int query = database.indexOf('?');
        if (query >= 0) database = database.substring(0, query);
        return schema.equals(database);
    }
}
