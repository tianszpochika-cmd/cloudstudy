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
import com.englishflow.iam.domain.InMemoryPasswordResetDelivery;
import com.englishflow.iam.domain.InMemorySessionStore;
import com.englishflow.iam.domain.InMemoryIdempotencyStore;
import com.englishflow.iam.domain.IdempotencyService;
import com.englishflow.iam.domain.IdempotencyStore;
import com.englishflow.iam.domain.IdempotencyResponseCodec;
import com.englishflow.iam.domain.IdempotencyReplayPolicy;
import com.englishflow.iam.domain.IdempotencyRequestFingerprint;
import com.englishflow.iam.domain.IamTransactionRunner;
import com.englishflow.iam.domain.JdbcAccountStore;
import com.englishflow.iam.domain.JdbcAdultGateFactStore;
import com.englishflow.iam.domain.JdbcAuditFactPort;
import com.englishflow.iam.domain.JdbcConsentPolicy;
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
import com.englishflow.iam.domain.PasswordResetDeliveryPort;
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
import com.englishflow.iam.domain.UnprovisionedPasswordResetDelivery;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.MigrationState;
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
import java.util.Set;

/** Composition root for the self-owned JWT authentication center. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(IamServiceProperties.class)
@EnableTransactionManagement(proxyTargetClass = false)
public class IamRuntimeConfiguration {
    private static final String IDEMPOTENCY_TABLE = "iam_idempotency_record";
    private static final Set<String> V12_IDEMPOTENCY_COLUMNS = Set.of(
            "request_hash", "response_ciphertext", "response_nonce", "response_key_version");
    private static final Set<String> V13_IDEMPOTENCY_COLUMNS = Set.of(
            "request_fingerprint", "request_fingerprint_version", "replay_ciphertext",
            "replay_nonce", "replay_key_version");
    private static final String REQUIRED_V13_FINGERPRINT_CHECK = canonicalizeFingerprintCheck("""
            (((request_fingerprint_version = 'legacy-invalidated-v0')
              and (request_fingerprint = 0x0000000000000000000000000000000000000000000000000000000000000000)
              and (replay_ciphertext is null) and (replay_nonce is null)
              and (replay_key_version is null))
             or ((request_fingerprint_version = 'hmac-sha256-v1')
              and (request_fingerprint <> 0x0000000000000000000000000000000000000000000000000000000000000000)
              and (((replay_ciphertext is null) and (replay_nonce is null)
                and (replay_key_version is null))
               or ((replay_ciphertext is not null) and (replay_nonce is not null)
                and (replay_key_version is not null)))))
            """);

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
                && Boolean.FALSE.equals(environment.getProperty("spring.flyway.enabled", Boolean.class))) {
            throw new IllegalStateException("IAM durable persistence cannot disable Flyway migrations");
        }
        if (properties.getPersistence().isEnabled()
                && !IdempotencyResponseCodec.isStrongSecret(properties.getIdempotency().getReplaySecret())) {
            throw new IllegalStateException("IAM persistence requires a stable 32-character IAM_IDEMPOTENCY_REPLAY_SECRET");
        }
        if (!IdempotencyRequestFingerprint.isStrongSecret(
                properties.getIdempotency().getFingerprintSecret())) {
            throw new IllegalStateException(
                    "IAM requires a stable 32-character IAM_IDEMPOTENCY_FINGERPRINT_SECRET");
        }
        if (properties.getIdempotency().getReplaySecret()
                .equals(properties.getIdempotency().getFingerprintSecret())) {
            throw new IllegalStateException(
                    "IAM idempotency replay and fingerprint secrets must be independently provisioned");
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

        MigrationInfo[] pending = flyway.info().pending();
        boolean v13Pending = hasVersion(pending, "13");
        Set<String> columns = idempotencyColumns(dataSource, ownerSchema);
        if (v13Pending) {
            if (columns.stream().anyMatch(V13_IDEMPOTENCY_COLUMNS::contains)) {
                throw new IllegalStateException("IAM idempotency V13 schema exists while Flyway history is pending; "
                        + "keep IAM stopped, verify the final schema, then run Flyway repair before restart");
            }
            if (!columns.isEmpty() && (!columns.containsAll(V12_IDEMPOTENCY_COLUMNS)
                    || columns.contains("request_hash_version")
                    || !"InnoDB".equalsIgnoreCase(idempotencyTableEngine(dataSource, ownerSchema)))) {
                throw new IllegalStateException("IAM idempotency V13 found a partial or non-InnoDB V12 schema; "
                        + "keep IAM stopped and restore the exact V12 schema before retrying the atomic migration");
            }
            if (!properties.getIdempotency().isV13WritersDrained()) {
                throw new IllegalStateException("IAM idempotency V13 is a one-way cutover; stop the write entrance, "
                        + "drain every old writer and in-flight request, then set "
                        + "IAM_IDEMPOTENCY_V13_WRITERS_DRAINED=true for the migration start");
            }
        } else if (hasSuccessfulVersion(flyway.info().all(), "13")) {
            requireFinalV13Schema(dataSource, ownerSchema, columns);
        } else {
            throw new IllegalStateException("IAM idempotency V13 is neither pending nor SUCCESS; "
                    + "keep IAM stopped and inspect Flyway history before repair");
        }

        flyway.migrate();
        if (!hasSuccessfulVersion(flyway.info().all(), "13")) {
            throw new IllegalStateException("IAM idempotency V13 was not recorded successful; readiness denied");
        }
        requireFinalV13Schema(dataSource, ownerSchema, idempotencyColumns(dataSource, ownerSchema));
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

    @Bean public ConsentPolicyPort consentPolicyPort(Environment environment, IamServiceProperties properties,
                                                       ObjectProvider<JdbcTemplate> jdbc, ObjectMapper objectMapper) {
        boolean localOrTest = java.util.Arrays.stream(environment.getActiveProfiles())
                .anyMatch(profile -> "local".equals(profile) || "test".equals(profile));
        String source = properties.getConsent().getPolicySource();
        if ("local-candidate".equals(source)) {
            if (!localOrTest) {
                throw new IllegalStateException("local consent candidate documents require an explicit local/test profile");
            }
            return StaticConsentPolicy.localCandidate(true);
        }
        if ("control-plane".equals(source)) {
            JdbcTemplate template = jdbc.getIfAvailable();
            if (!properties.getPersistence().isEnabled() || template == null) {
                throw new IllegalStateException("IAM consent control-plane policy requires durable persistence");
            }
            return new JdbcConsentPolicy(template, objectMapper);
        }
        if (localOrTest) {
            // Local/test keep the explicit candidate documents so onboarding works offline.
            return StaticConsentPolicy.localCandidate(true);
        }
        JdbcTemplate template = jdbc.getIfAvailable();
        if (properties.getPersistence().isEnabled() && template != null) {
            // Non-local deployments read only the published consent-document control plane; an
            // empty or revoked set fails closed per type instead of falling back to fixtures.
            return new JdbcConsentPolicy(template, objectMapper);
        }
        // Missing durable persistence cannot prove published documents, so the policy stays
        // explicitly unavailable rather than exposing local candidate facts.
        return StaticConsentPolicy.localCandidate(false);
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
    public IdempotencyReplayPolicy idempotencyReplayPolicy() {
        return IdempotencyReplayPolicy.failClosedDefaults();
    }

    @Bean
    public IdempotencyService idempotencyService(IdempotencyStore store, ObjectMapper objectMapper,
                                                 IamTransactionRunner transactions,
                                                 IamServiceProperties properties,
                                                 IdempotencyReplayPolicy replayPolicy) {
        return new IdempotencyService(store, objectMapper, transactions,
                properties.getIdempotency().getReplaySecret(),
                properties.getIdempotency().getFingerprintSecret(),
                properties.getIdempotency().getRetention(), replayPolicy);
    }

    @Bean public PasswordResetService passwordResetService(AccountStore accounts, PasswordResetChallengeStore challenges,
                                                           PasswordAccountService passwords, AuditFactPort audit,
                                                           Clock clock, IamServiceProperties properties,
                                                           SessionService sessions, IamTransactionRunner transactions,
                                                           RateLimitStore rateLimits,
                                                           PasswordResetDeliveryPort passwordResetDelivery) {
        return new PasswordResetService(accounts, challenges, passwords, audit, clock, properties,
                sessions, transactions, rateLimits, passwordResetDelivery,
                properties.getIdempotency().getFingerprintSecret());
    }

    @Bean
    public PasswordResetDeliveryPort passwordResetDeliveryPort(Environment environment) {
        boolean localOrTest = java.util.Arrays.stream(environment.getActiveProfiles())
                .anyMatch(profile -> "local".equals(profile) || "test".equals(profile));
        // Phase 1 IAM owns the challenge but not transport: local/test use the explicit
        // in-memory sink, while non-local stays fail-closed until the notification/outbox
        // handoff is provisioned. Neither variant claims a delivery guarantee.
        return localOrTest ? new InMemoryPasswordResetDelivery() : new UnprovisionedPasswordResetDelivery();
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

    private static boolean hasVersion(MigrationInfo[] migrations, String expected) {
        return java.util.Arrays.stream(migrations)
                .anyMatch(info -> info.getVersion() != null
                        && expected.equals(info.getVersion().getVersion()));
    }

    private static boolean hasSuccessfulVersion(MigrationInfo[] migrations, String expected) {
        return java.util.Arrays.stream(migrations)
                .anyMatch(info -> info.getVersion() != null
                        && expected.equals(info.getVersion().getVersion())
                        && info.getState() == MigrationState.SUCCESS);
    }

    private static Set<String> idempotencyColumns(DataSource dataSource, String schema) {
        return Set.copyOf(new JdbcTemplate(dataSource).query(
                "SELECT column_name FROM information_schema.columns "
                        + "WHERE table_schema = ? AND table_name = ?",
                (rs, rowNum) -> rs.getString(1), schema, IDEMPOTENCY_TABLE));
    }

    private static String idempotencyTableEngine(DataSource dataSource, String schema) {
        List<String> engines = new JdbcTemplate(dataSource).query(
                "SELECT engine FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
                (rs, rowNum) -> rs.getString(1), schema, IDEMPOTENCY_TABLE);
        return engines.size() == 1 ? engines.getFirst() : "";
    }

    private static void requireFinalV13Schema(DataSource dataSource, String schema, Set<String> columns) {
        boolean oldColumnsRemain = columns.stream().anyMatch(V12_IDEMPOTENCY_COLUMNS::contains)
                || columns.contains("request_hash_version");
        if (oldColumnsRemain || !columns.containsAll(V13_IDEMPOTENCY_COLUMNS)
                || !"InnoDB".equalsIgnoreCase(idempotencyTableEngine(dataSource, schema))) {
            throw new IllegalStateException("IAM idempotency V13 Flyway history/schema mismatch; "
                    + "keep IAM stopped, verify the one-way cutover, and repair history only after validation");
        }
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        Integer validColumnDefinitions = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = ? "
                        + "AND table_name = ? AND ((column_name = 'request_fingerprint' "
                        + "AND data_type = 'binary' AND character_maximum_length = 32 "
                        + "AND is_nullable = 'NO' AND column_default = '0x') "
                        + "OR (column_name = 'request_fingerprint_version' AND data_type = 'varchar' "
                        + "AND character_maximum_length = 32 AND is_nullable = 'NO' "
                        + "AND column_default = 'legacy-invalidated-v0') "
                        + "OR (column_name = 'replay_ciphertext' AND data_type = 'mediumblob' "
                        + "AND is_nullable = 'YES' AND column_default IS NULL) "
                        + "OR (column_name = 'replay_nonce' AND data_type = 'binary' "
                        + "AND character_maximum_length = 12 AND is_nullable = 'YES' "
                        + "AND column_default IS NULL) "
                        + "OR (column_name = 'replay_key_version' AND data_type = 'varchar' "
                        + "AND character_maximum_length = 16 AND is_nullable = 'YES' "
                        + "AND column_default IS NULL))",
                Integer.class, schema, IDEMPOTENCY_TABLE);
        List<String> checkClauses = jdbc.query(
                "SELECT cc.check_clause FROM information_schema.table_constraints tc "
                        + "JOIN information_schema.check_constraints cc "
                        + "ON cc.constraint_schema = tc.constraint_schema "
                        + "AND cc.constraint_name = tc.constraint_name "
                        + "WHERE tc.table_schema = ? AND tc.table_name = ? "
                        + "AND tc.constraint_name = 'chk_iam_idempotency_request_fingerprint' "
                        + "AND tc.constraint_type = 'CHECK' AND tc.enforced = 'YES'",
                (rs, rowNum) -> rs.getString(1), schema, IDEMPOTENCY_TABLE);
        boolean strongCheck = checkClauses.size() == 1
                && hasStrongFingerprintCheck(checkClauses.getFirst());
        Integer invalidRows = jdbc.queryForObject(
                "SELECT COUNT(*) FROM iam_idempotency_record WHERE NOT ("
                        + "(request_fingerprint_version = 'legacy-invalidated-v0' "
                        + "AND request_fingerprint = 0x0000000000000000000000000000000000000000000000000000000000000000 "
                        + "AND replay_ciphertext IS NULL AND replay_nonce IS NULL AND replay_key_version IS NULL) "
                        + "OR (request_fingerprint_version = 'hmac-sha256-v1' "
                        + "AND request_fingerprint <> 0x0000000000000000000000000000000000000000000000000000000000000000 "
                        + "AND ((replay_ciphertext IS NULL AND replay_nonce IS NULL AND replay_key_version IS NULL) "
                        + "OR (replay_ciphertext IS NOT NULL AND replay_nonce IS NOT NULL "
                        + "AND replay_key_version IS NOT NULL))))",
                Integer.class);
        if (!Integer.valueOf(5).equals(validColumnDefinitions) || !strongCheck
                || !Integer.valueOf(0).equals(invalidRows)) {
            throw new IllegalStateException("IAM idempotency V13 column/default/CHECK drift detected; "
                    + "readiness denied until the final schema is independently verified");
        }
    }

    private static boolean hasStrongFingerprintCheck(String clause) {
        if (clause == null) return false;
        return REQUIRED_V13_FINGERPRINT_CHECK.equals(canonicalizeFingerprintCheck(clause));
    }

    /**
     * Removes only representational differences introduced by MySQL metadata. Parentheses and
     * operators remain intact, so a reordered or weakened boolean expression cannot pass merely
     * because it still contains every expected column and literal.
     */
    private static String canonicalizeFingerprintCheck(String clause) {
        return clause.toLowerCase(java.util.Locale.ROOT)
                .replace("`", "")
                .replace("\\'", "'")
                .replaceAll("_[a-z0-9]+(?=')", "")
                .replaceAll("x'([0-9a-f]{64})'", "0x$1")
                .replace("!=", "<>")
                .replaceAll("\\s+", "");
    }
}
