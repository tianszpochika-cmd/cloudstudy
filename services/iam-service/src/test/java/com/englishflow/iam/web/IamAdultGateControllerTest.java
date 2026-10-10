package com.englishflow.iam.web;

import com.englishflow.iam.auth.JwtSigningKeyProvider;
import com.englishflow.iam.auth.JwtTokenService;
import com.englishflow.iam.config.IamServiceProperties;
import com.englishflow.iam.domain.AccountRecord;
import com.englishflow.iam.domain.AdultGateFact;
import com.englishflow.iam.domain.AdultGateService;
import com.englishflow.iam.domain.AuditDecision;
import com.englishflow.iam.domain.ClientAuthorityClaims;
import com.englishflow.iam.domain.ConsentPolicyPort;
import com.englishflow.iam.domain.ConsentService;
import com.englishflow.iam.domain.DeviceId;
import com.englishflow.iam.domain.DeviceRegistrationCommand;
import com.englishflow.iam.domain.DeviceService;
import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamTransactionRunner;
import com.englishflow.iam.domain.IdempotencyService;
import com.englishflow.iam.domain.InMemoryAccountStore;
import com.englishflow.iam.domain.InMemoryAdultGateFactStore;
import com.englishflow.iam.domain.InMemoryAuditFactPort;
import com.englishflow.iam.domain.InMemoryConsentStore;
import com.englishflow.iam.domain.InMemoryDeviceRegistry;
import com.englishflow.iam.domain.InMemoryIdempotencyStore;
import com.englishflow.iam.domain.InMemoryPasswordResetChallengeStore;
import com.englishflow.iam.domain.InMemoryPasswordResetDelivery;
import com.englishflow.iam.domain.InMemoryRateLimitStore;
import com.englishflow.iam.domain.InMemorySessionStore;
import com.englishflow.iam.domain.PasswordAccountService;
import com.englishflow.iam.domain.PasswordResetService;
import com.englishflow.iam.domain.PrincipalId;
import com.englishflow.iam.domain.ServerPrincipalContext;
import com.englishflow.iam.domain.SessionId;
import com.englishflow.iam.domain.SessionRecord;
import com.englishflow.iam.domain.SessionService;
import com.englishflow.iam.domain.SessionStatus;
import com.englishflow.iam.domain.StaticConsentPolicy;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@DisplayName("R1-006 / BC-006: Adult Gate Controller Integration Tests")
class IamAdultGateControllerTest {

    private static final Instant NOW = Instant.parse("2026-10-09T00:00:00Z");
    private static final String PASSWORD = "ValidPassword123!";

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    private Clock clock;
    private IamServiceProperties properties;
    private InMemoryAuditFactPort audit;
    private InMemoryAccountStore accounts;
    private PasswordAccountService passwords;
    private SessionService sessions;
    private InMemorySessionStore sessionStore;
    private DeviceService devices;
    private InMemoryAdultGateFactStore adultGateFacts;
    private AdultGateService adultGates;
    private IamAuthenticationController controller;
    private MockMvc mockMvc;
    private JwtSigningKeyProvider signingKeys;

    private PrincipalId principalId;
    private SessionRecord session;
    private JwtAuthenticationToken authToken;

    @BeforeEach
    void setUp() {
        clock = Clock.fixed(NOW, ZoneOffset.UTC);
        properties = new IamServiceProperties();
        properties.getJwt().setIssuer("https://auth.englishflow.test");
        properties.getJwt().setAudience("englishflow-platform");
        properties.getJwt().setEphemeralKeysAllowed(true);
        properties.getJwt().setAccessTokenTtl(Duration.ofMinutes(15));
        properties.getJwt().setRefreshTokenTtl(Duration.ofDays(30));
        properties.getIdempotency().setReplaySecret("controller-replay-secret-for-idempotency-2026");
        properties.getIdempotency().setFingerprintSecret("controller-fingerprint-secret-for-idempotency-2026");
        properties.setLocalAdultGateEnabled(true);

        audit = new InMemoryAuditFactPort();
        InMemoryRateLimitStore rateLimits = new InMemoryRateLimitStore();
        accounts = new InMemoryAccountStore();
        passwords = new PasswordAccountService(accounts, new BCryptPasswordEncoder(12), audit, clock, properties, rateLimits);

        AccountRecord account = passwords.register("adult-learner@example.com", PASSWORD, ClientAuthorityClaims.none());
        principalId = account.principalId();
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(principalId, account.roles());

        sessionStore = new InMemorySessionStore();
        sessions = new SessionService(sessionStore, audit, clock, properties);
        InMemoryDeviceRegistry deviceRegistry = new InMemoryDeviceRegistry();
        devices = new DeviceService(deviceRegistry, audit, clock);

        DeviceId deviceId = new DeviceId(UUID.randomUUID().toString());
        devices.register(context, new DeviceRegistrationCommand(deviceId, "WEB", "Chrome Browser", ClientAuthorityClaims.none()));
        session = sessions.open(context, deviceId).session();

        adultGateFacts = new InMemoryAdultGateFactStore();
        adultGates = new AdultGateService(audit, clock, adultGateFacts, sessions, IamTransactionRunner.direct());

        ConsentPolicyPort consentPolicy = StaticConsentPolicy.localCandidate(true);
        InMemoryConsentStore consentStore = new InMemoryConsentStore();
        ConsentService consents = new ConsentService(consentStore, consentPolicy, audit, clock, sessions, IamTransactionRunner.direct());

        InMemoryPasswordResetDelivery resetDelivery = new InMemoryPasswordResetDelivery();
        PasswordResetService passwordResets = new PasswordResetService(accounts,
                new InMemoryPasswordResetChallengeStore(), passwords, audit, clock, properties,
                sessions, IamTransactionRunner.direct(), rateLimits,
                resetDelivery, properties.getIdempotency().getFingerprintSecret());

        signingKeys = new JwtSigningKeyProvider(properties);
        JwtSigningKeyProvider keys = signingKeys;
        JWKSource<SecurityContext> source = (selector, ctx) -> List.of(keys.signingKey());
        JwtTokenService tokens = new JwtTokenService(new NimbusJwtEncoder(source), keys, properties, clock);

        InMemoryIdempotencyStore idempotencyStore = new InMemoryIdempotencyStore();
        IdempotencyService idempotency = new IdempotencyService(idempotencyStore,
                objectMapper,
                IamTransactionRunner.direct(), properties.getIdempotency().getReplaySecret(),
                properties.getIdempotency().getFingerprintSecret(), Duration.ofHours(24));

        controller = new IamAuthenticationController(properties, passwords,
                passwordResets, tokens, keys, sessions, devices, adultGates, adultGateFacts,
                consents, consentStore, idempotency, clock);

        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();

        authToken = createAuthToken(session);
    }

    private JwtAuthenticationToken createAuthToken(SessionRecord userSession) {
        Jwt jwt = Jwt.withTokenValue("jwt-" + UUID.randomUUID())
                .header("alg", "RS256")
                .header("typ", "JWT")
                .subject(principalId.toString())
                .issuedAt(NOW)
                .expiresAt(NOW.plus(Duration.ofMinutes(15)))
                .claim("token_type", "access")
                .claim("tenant_id", userSession.scope().tenantId())
                .claim("owner_id", userSession.scope().owner().toString())
                .claim("session_id", userSession.sessionId().toString())
                .claim("device_id", userSession.deviceId().value())
                .build();
        return new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("TOKEN_TYPE_access")));
    }

    @Test
    @DisplayName("测试 1: 成年提交返回 200 PASSED / ELIGIBLE，factStore 记 APPROVED，审计记 ALLOW")
    void adultSubmissionReturnsPassedAndApproved() throws Exception {
        String requestBody = """
                {
                    "confirmed": true,
                    "birthYear": 1995,
                    "policyVersion": "b30-adult-v1"
                }
                """;

        mockMvc.perform(post("/api/v1/iam/adult-gate")
                        .principal(authToken)
                        .header("Idempotency-Key", "idemp-adult-gate-0000000001")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PASSED"))
                .andExpect(jsonPath("$.data.learningAccess").value("ELIGIBLE"))
                .andExpect(jsonPath("$.data.evidenceStatus").value("SERVER_VERIFIED"))
                .andExpect(jsonPath("$.data.policyVersion").value("b30-adult-v1"))
                .andExpect(jsonPath("$.data.minimumAge").value(18))
                .andExpect(jsonPath("$.data.retryAllowed").value(false));

        // 验证 factStore
        AdultGateFact fact = adultGateFacts.find(principalId, NOW);
        assertEquals("APPROVED", fact.status());
        assertEquals("b30-adult-v1", fact.policyVersion());
        assertFalse(fact.retryAllowed());

        // 验证审计
        AuditDecision decision = audit.decisions().stream()
                .filter(d -> "adult_gate".equals(d.decisionType()))
                .findFirst()
                .orElseThrow();
        assertTrue(decision.allowed());
        assertEquals(IamDecisionCode.ADULT_GATE_ALLOWED, decision.code());
        assertEquals(principalId, decision.principalId());
    }

    @Test
    @DisplayName("测试 2: 未成年提交返回 200 REJECTED / RESTRICTED，factStore 记 REJECTED，审计记 DENY，会话保持 ACTIVE")
    void minorSubmissionReturnsRejectedAndKeepsSessionActive() throws Exception {
        String requestBody = """
                {
                    "confirmed": true,
                    "birthYear": 2015,
                    "policyVersion": "b30-adult-v1"
                }
                """;

        mockMvc.perform(post("/api/v1/iam/adult-gate")
                        .principal(authToken)
                        .header("Idempotency-Key", "idemp-adult-gate-0000000002")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"))
                .andExpect(jsonPath("$.data.learningAccess").value("RESTRICTED"))
                .andExpect(jsonPath("$.data.evidenceStatus").value("REJECTED"))
                .andExpect(jsonPath("$.data.policyVersion").value("b30-adult-v1"))
                .andExpect(jsonPath("$.data.minimumAge").value(18))
                .andExpect(jsonPath("$.data.retryAllowed").value(true));

        // 验证 factStore
        AdultGateFact fact = adultGateFacts.find(principalId, NOW);
        assertEquals("REJECTED", fact.status());
        assertEquals("b30-adult-v1", fact.policyVersion());
        assertTrue(fact.retryAllowed());

        // 验证审计
        AuditDecision decision = audit.decisions().stream()
                .filter(d -> "adult_gate".equals(d.decisionType()))
                .findFirst()
                .orElseThrow();
        assertFalse(decision.allowed());
        assertEquals(IamDecisionCode.ADULT_AGE_BELOW_MINIMUM, decision.code());
        assertEquals(principalId, decision.principalId());

        // 关键防线：会话绝对不能被注销，保持 ACTIVE 供访问受限页
        SessionRecord currentSession = sessions.find(session.sessionId());
        assertEquals(SessionStatus.ACTIVE, currentSession.status());
        assertNull(currentSession.revokedAt());
    }

    @Test
    @DisplayName("测试 3: 成年提交同键幂等重放返回相同 200 结果")
    void adultSubmissionIdempotentReplayReturnsConsistentResult() throws Exception {
        String key = "idemp-adult-gate-0000000003";
        String requestBody = """
                {
                    "confirmed": true,
                    "birthYear": 1995,
                    "policyVersion": "b30-adult-v1"
                }
                """;

        MvcResult first = mockMvc.perform(post("/api/v1/iam/adult-gate")
                        .principal(authToken)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PASSED"))
                .andExpect(jsonPath("$.data.learningAccess").value("ELIGIBLE"))
                .andReturn();

        MvcResult replay = mockMvc.perform(post("/api/v1/iam/adult-gate")
                        .principal(authToken)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PASSED"))
                .andExpect(jsonPath("$.data.learningAccess").value("ELIGIBLE"))
                .andReturn();

        JsonNode firstData = objectMapper.readTree(first.getResponse().getContentAsString()).get("data");
        JsonNode replayData = objectMapper.readTree(replay.getResponse().getContentAsString()).get("data");
        assertEquals(firstData.get("status").asText(), replayData.get("status").asText());
        assertEquals(firstData.get("learningAccess").asText(), replayData.get("learningAccess").asText());
        assertEquals(firstData.get("evidenceStatus").asText(), replayData.get("evidenceStatus").asText());
        assertEquals(firstData.get("effectiveAt").asText(), replayData.get("effectiveAt").asText());
    }

    @Test
    @DisplayName("测试 4: 未成年提交同键幂等重放返回相同 200 结果（不再抛 503）")
    void minorSubmissionIdempotentReplayReturnsConsistentResultWithout503() throws Exception {
        String key = "idemp-adult-gate-0000000004";
        String requestBody = """
                {
                    "confirmed": true,
                    "birthYear": 2015,
                    "policyVersion": "b30-adult-v1"
                }
                """;

        MvcResult first = mockMvc.perform(post("/api/v1/iam/adult-gate")
                        .principal(authToken)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"))
                .andExpect(jsonPath("$.data.learningAccess").value("RESTRICTED"))
                .andReturn();

        MvcResult replay = mockMvc.perform(post("/api/v1/iam/adult-gate")
                        .principal(authToken)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"))
                .andExpect(jsonPath("$.data.learningAccess").value("RESTRICTED"))
                .andReturn();

        JsonNode firstData = objectMapper.readTree(first.getResponse().getContentAsString()).get("data");
        JsonNode replayData = objectMapper.readTree(replay.getResponse().getContentAsString()).get("data");
        assertEquals(firstData.get("status").asText(), replayData.get("status").asText());
        assertEquals(firstData.get("learningAccess").asText(), replayData.get("learningAccess").asText());
        assertEquals(firstData.get("evidenceStatus").asText(), replayData.get("evidenceStatus").asText());
        assertEquals(firstData.get("effectiveAt").asText(), replayData.get("effectiveAt").asText());
    }

    @Test
    @DisplayName("测试 5: 未成年提交后，同键不同请求体返回 409 IDEMPOTENCY_CONFLICT")
    void minorSubmissionSameKeyDifferentBodyReturnsConflict409() throws Exception {
        String key = "idemp-adult-gate-0000000005";
        String requestBody1 = """
                {
                    "confirmed": true,
                    "birthYear": 2015,
                    "policyVersion": "b30-adult-v1"
                }
                """;
        String requestBody2 = """
                {
                    "confirmed": true,
                    "birthYear": 2010,
                    "policyVersion": "b30-adult-v1"
                }
                """;

        mockMvc.perform(post("/api/v1/iam/adult-gate")
                        .principal(authToken)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"));

        mockMvc.perform(post("/api/v1/iam/adult-gate")
                        .principal(authToken)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody2))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.errorCode").value("IDEMPOTENCY_CONFLICT"))
                .andExpect(jsonPath("$.error.message").value("iam.idempotency.key_reused"));
    }

    @Test
    @DisplayName("测试 6: 缺 confirmed 或 confirmed=false 抛 403")
    void missingOrFalseConfirmationReturns403() throws Exception {
        String falseBody = """
                {
                    "confirmed": false,
                    "birthYear": 1995,
                    "policyVersion": "b30-adult-v1"
                }
                """;
        mockMvc.perform(post("/api/v1/iam/adult-gate")
                        .principal(authToken)
                        .header("Idempotency-Key", "idemp-adult-gate-0000000006")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(falseBody))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.errorCode").value("FORBIDDEN"))
                .andExpect(jsonPath("$.error.message").value("iam.adult_gate.confirmation_required"));

        String missingConfirmedBody = """
                {
                    "birthYear": 1995,
                    "policyVersion": "b30-adult-v1"
                }
                """;
        mockMvc.perform(post("/api/v1/iam/adult-gate")
                        .principal(authToken)
                        .header("Idempotency-Key", "idemp-adult-gate-000000006b")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(missingConfirmedBody))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.errorCode").value("FORBIDDEN"))
                .andExpect(jsonPath("$.error.message").value("iam.adult_gate.confirmation_required"));
    }

    @Test
    @DisplayName("测试 7: policyVersion 错误抛 403")
    void invalidPolicyVersionReturns403() throws Exception {
        String wrongVersionBody = """
                {
                    "confirmed": true,
                    "birthYear": 1995,
                    "policyVersion": "b20-legacy-v1"
                }
                """;
        mockMvc.perform(post("/api/v1/iam/adult-gate")
                        .principal(authToken)
                        .header("Idempotency-Key", "idemp-adult-gate-0000000007")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(wrongVersionBody))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.errorCode").value("FORBIDDEN"))
                .andExpect(jsonPath("$.error.message").value("iam.adult_gate.policy_version_invalid"));

        String nullVersionBody = """
                {
                    "confirmed": true,
                    "birthYear": 1995
                }
                """;
        mockMvc.perform(post("/api/v1/iam/adult-gate")
                        .principal(authToken)
                        .header("Idempotency-Key", "idemp-adult-gate-000000007b")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(nullVersionBody))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.errorCode").value("FORBIDDEN"))
                .andExpect(jsonPath("$.error.message").value("iam.adult_gate.policy_version_invalid"));
    }

    @Test
    @DisplayName("测试 8: birthYear 异常（未来年份或超大年份）抛 403")
    void abnormalBirthYearReturns403() throws Exception {
        int currentYear = Year.now().getValue();
        int futureYear = currentYear + 5;
        int ancientYear = currentYear - 200;

        String futureBody = String.format("""
                {
                    "confirmed": true,
                    "birthYear": %d,
                    "policyVersion": "b30-adult-v1"
                }
                """, futureYear);
        mockMvc.perform(post("/api/v1/iam/adult-gate")
                        .principal(authToken)
                        .header("Idempotency-Key", "idemp-adult-gate-0000000008")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(futureBody))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.errorCode").value("FORBIDDEN"))
                .andExpect(jsonPath("$.error.message").value("iam.adult_gate.birth_year_invalid"));

        String ancientBody = String.format("""
                {
                    "confirmed": true,
                    "birthYear": %d,
                    "policyVersion": "b30-adult-v1"
                }
                """, ancientYear);
        mockMvc.perform(post("/api/v1/iam/adult-gate")
                        .principal(authToken)
                        .header("Idempotency-Key", "idemp-adult-gate-000000008b")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ancientBody))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.errorCode").value("FORBIDDEN"))
                .andExpect(jsonPath("$.error.message").value("iam.adult_gate.birth_year_invalid"));
    }

    @Test
    @DisplayName("测试 9: 缺 Idempotency-Key 或键非法抛 400")
    void missingOrInvalidIdempotencyKeyReturns400() throws Exception {
        String validBody = """
                {
                    "confirmed": true,
                    "birthYear": 1995,
                    "policyVersion": "b30-adult-v1"
                }
                """;

        // 缺 Idempotency-Key
        mockMvc.perform(post("/api/v1/iam/adult-gate")
                        .principal(authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.errorCode").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.message").value("iam.idempotency.invalid"));

        // 键太短 (< 16 字符)
        mockMvc.perform(post("/api/v1/iam/adult-gate")
                        .principal(authToken)
                        .header("Idempotency-Key", "short-key")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.errorCode").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.message").value("iam.idempotency.invalid"));
    }

    @Test
    @DisplayName("测试 10: 拒绝后换键成年年份仍 REJECTED，再登录 claim 仍是 REJECTED，会话仍 ACTIVE")
    void rejectedGateStaysRejectedAcrossNewKeyAndRelogin() throws Exception {
        String minorBody = """
                {
                    "confirmed": true,
                    "birthYear": 2015,
                    "policyVersion": "b30-adult-v1"
                }
                """;
        String adultBody = """
                {
                    "confirmed": true,
                    "birthYear": 1995,
                    "policyVersion": "b30-adult-v1"
                }
                """;
        String minorKey = "idemp-adult-gate-0000000010";
        String adultKey = "idemp-adult-gate-000000010b";

        MvcResult rejected = mockMvc.perform(post("/api/v1/iam/adult-gate")
                        .principal(authToken)
                        .header("Idempotency-Key", minorKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(minorBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"))
                .andExpect(jsonPath("$.data.learningAccess").value("RESTRICTED"))
                .andReturn();
        JsonNode rejectedData = objectMapper.readTree(rejected.getResponse().getContentAsString()).get("data");
        Instant rejectedAt = adultGateFacts.find(principalId, NOW).evaluatedAt();
        long gateAudits = audit.decisions().stream().filter(decision -> "adult_gate".equals(decision.decisionType())).count();

        MvcResult held = mockMvc.perform(post("/api/v1/iam/adult-gate")
                        .principal(authToken)
                        .header("Idempotency-Key", adultKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(adultBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"))
                .andExpect(jsonPath("$.data.learningAccess").value("RESTRICTED"))
                .andExpect(jsonPath("$.data.evidenceStatus").value("REJECTED"))
                .andExpect(jsonPath("$.data.retryAllowed").value(false))
                .andReturn();
        JsonNode heldData = objectMapper.readTree(held.getResponse().getContentAsString()).get("data");
        assertEquals(rejectedData.get("effectiveAt").asText(), heldData.get("effectiveAt").asText());
        assertFalse(held.getResponse().getContentAsString().contains("1995"));
        assertFalse(held.getResponse().getContentAsString().contains("2015"));

        AdultGateFact fact = adultGateFacts.find(principalId, NOW);
        assertEquals("REJECTED", fact.status());
        assertEquals(rejectedAt, fact.evaluatedAt());
        assertEquals(gateAudits, audit.decisions().stream().filter(decision -> "adult_gate".equals(decision.decisionType())).count());
        assertTrue(audit.decisions().stream().anyMatch(decision ->
                decision.code() == IamDecisionCode.ADULT_AGE_BELOW_MINIMUM && !decision.allowed()));
        assertEquals(0, audit.decisions().stream().filter(decision ->
                "adult_gate".equals(decision.decisionType()) && decision.allowed()).count());
        assertEquals(SessionStatus.ACTIVE, sessions.find(session.sessionId()).status());
        assertNull(sessions.find(session.sessionId()).revokedAt());
        assertNotNull(passwords.find(principalId));

        mockMvc.perform(get("/api/v1/iam/principal/me").principal(authToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RESTRICTED"))
                .andExpect(jsonPath("$.data.adultGate.status").value("REJECTED"))
                .andExpect(jsonPath("$.data.adultGate.learningAccess").value("RESTRICTED"));

        MvcResult minorReplay = mockMvc.perform(post("/api/v1/iam/adult-gate")
                        .principal(authToken)
                        .header("Idempotency-Key", minorKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(minorBody))
                .andExpect(status().isOk())
                .andReturn();
        MvcResult adultReplay = mockMvc.perform(post("/api/v1/iam/adult-gate")
                        .principal(authToken)
                        .header("Idempotency-Key", adultKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(adultBody))
                .andExpect(status().isOk())
                .andReturn();
        assertEquals(rejectedData, objectMapper.readTree(minorReplay.getResponse().getContentAsString()).get("data"));
        assertEquals(heldData, objectMapper.readTree(adultReplay.getResponse().getContentAsString()).get("data"));
        assertEquals(SessionStatus.ACTIVE, sessions.find(session.sessionId()).status());

        mockMvc.perform(post("/api/v1/auth/logout")
                        .principal(authToken)
                        .header("Idempotency-Key", "idemp-adult-gate-logout-10"))
                .andExpect(status().isOk());

        String loginBody = """
                {
                    "identifier": "adult-learner@example.com",
                    "password": "ValidPassword123!",
                    "device": {
                        "deviceType": "WEB",
                        "deviceName": "Chrome Browser",
                        "clientVersion": "1.0.0"
                    }
                }
                """;
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .header("Idempotency-Key", "idemp-adult-gate-login-010")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andExpect(status().isOk())
                .andReturn();
        String accessToken = objectMapper.readTree(login.getResponse().getContentAsString())
                .get("data").get("accessToken").asText();
        Jwt loginJwt = decodeAccessToken(accessToken);
        assertEquals("REJECTED", loginJwt.getClaimAsString("adult_gate"));
        assertFalse("NOT_EVALUATED".equals(loginJwt.getClaimAsString("adult_gate")));
        assertFalse("PASSED".equals(loginJwt.getClaimAsString("adult_gate")));

        JwtAuthenticationToken reloginAuth = new JwtAuthenticationToken(loginJwt,
                List.of(new SimpleGrantedAuthority("TOKEN_TYPE_access")));
        mockMvc.perform(get("/api/v1/iam/principal/me").principal(reloginAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.adultGate.status").value("REJECTED"))
                .andExpect(jsonPath("$.data.adultGate.learningAccess").value("RESTRICTED"))
                .andExpect(jsonPath("$.data.consentState.learningAccess").value("RESTRICTED"))
                .andExpect(jsonPath("$.data.status").value("RESTRICTED"));

        SessionRecord reloginSession = sessions.find(new SessionId(UUID.fromString(loginJwt.getClaimAsString("session_id"))));
        assertEquals(SessionStatus.ACTIVE, reloginSession.status());
        assertNull(reloginSession.revokedAt());
        assertEquals(0, audit.decisions().stream().filter(decision ->
                "adult_gate".equals(decision.decisionType()) && decision.allowed()).count());
        assertNotNull(passwords.find(principalId));
    }

    private Jwt decodeAccessToken(String token) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withPublicKey(signingKeys.publicKey()).build();
        decoder.setJwtValidator(jwt -> OAuth2TokenValidatorResult.success());
        return decoder.decode(token);
    }
}
