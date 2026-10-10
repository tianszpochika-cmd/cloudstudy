package com.englishflow.iam.web;

import com.englishflow.iam.auth.JwtSigningKeyProvider;
import com.englishflow.iam.auth.JwtTokenService;
import com.englishflow.iam.config.IamServiceProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.englishflow.iam.domain.AccountRecord;
import com.englishflow.iam.domain.AccountStatus;
import com.englishflow.iam.domain.AdultGateService;
import com.englishflow.iam.domain.ClientAuthorityClaims;
import com.englishflow.iam.domain.ConsentCommand;
import com.englishflow.iam.domain.ConsentPolicyDescriptor;
import com.englishflow.iam.domain.ConsentPolicyPort;
import com.englishflow.iam.domain.ConsentService;
import com.englishflow.iam.domain.ConsentType;
import com.englishflow.iam.domain.DeviceId;
import com.englishflow.iam.domain.DeviceRegistration;
import com.englishflow.iam.domain.DeviceRegistryPort;
import com.englishflow.iam.domain.DeviceService;
import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.domain.IamTransactionRunner;
import com.englishflow.iam.domain.IdempotencyRecord;
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
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.EnumMap;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Verifies the real controller callbacks selected by the credential replay policy. */
class IdempotencyCredentialReplayControllerTest {
    private static final String PASSWORD = "correct horse battery staple!";
    private static final String NATIVE = "NATIVE_SECURE_STORAGE";
    private static final String WEB = "WEB_COOKIE";

    @Test
    void unavailablePublishedConsentLeavesNoRegistrationOrLoginFacts() {
        Fixture fixture = fixture(Duration.ofMinutes(15), Duration.ofDays(30),
                "local-unverified", false);
        String identifier = "consent-outage@example.com";
        var registration = new IamAuthenticationController.RegisterRequest(identifier, PASSWORD,
                new IamAuthenticationController.DeviceInput(UUID.randomUUID().toString(),
                        "IOS", "registration-device", "1", "1"));

        for (String key : List.of("consent-outage-register-first", "consent-outage-register-retry")) {
            IamPolicyException failure = assertThrows(IamPolicyException.class,
                    () -> fixture.controller().register(registration, NATIVE, key));
            assertEquals(IamDecisionCode.POLICY_UNAVAILABLE, failure.code());
            assertTrue(fixture.accounts().findByIdentifier(identifier).isEmpty());
            assertEquals(0, fixture.deviceRegistry().saveCount());
            assertTrue(fixture.sessions().findByPrincipal(fixture.account().principalId()).isEmpty());
        }

        IamPolicyException loginFailure = assertThrows(IamPolicyException.class,
                () -> fixture.controller().login(nativeLogin(UUID.randomUUID().toString()),
                        NATIVE, "consent-outage-login"));
        assertEquals(IamDecisionCode.POLICY_UNAVAILABLE, loginFailure.code());
        assertEquals(0, fixture.deviceRegistry().saveCount());
        assertTrue(fixture.sessions().findByPrincipal(fixture.account().principalId()).isEmpty());
    }

    @Test
    void optionalPoliciesDoNotBlockRestrictedCredentialLifecycleOrPrincipalRead() {
        MutableConsentPolicy policy = publishedPolicy(ConsentType.TERMS_OF_SERVICE,
                ConsentType.PRIVACY_NOTICE, ConsentType.ADULT_LEARNING);
        Fixture fixture = fixture(Duration.ofMinutes(15), Duration.ofDays(30),
                "local-unverified", policy);

        String registeredIdentifier = "learning-only-register@example.com";
        String registerDevice = UUID.randomUUID().toString();
        var registration = new IamAuthenticationController.RegisterRequest(registeredIdentifier, PASSWORD,
                new IamAuthenticationController.DeviceInput(registerDevice,
                        "IOS", "learning-only-registration", "1", "1"));
        var registered = fixture.controller().register(registration, NATIVE,
                "learning-only-register-key-1234");
        assertEquals(201, registered.getStatusCode().value());
        assertEquals("UNKNOWN", decodeAccessToken(fixture, registered.getBody().data().accessToken())
                .getClaimAsString("consent_state"));

        String loginDevice = UUID.randomUUID().toString();
        var login = fixture.controller().login(nativeLogin(loginDevice), NATIVE,
                "learning-only-login-key-123456");
        assertEquals(200, login.getStatusCode().value());
        assertEquals("UNKNOWN", decodeAccessToken(fixture, login.getBody().data().accessToken())
                .getClaimAsString("consent_state"));

        ServerPrincipalContext consentContext = ServerPrincipalContext.forPlatform(
                fixture.account().principalId(), fixture.account().roles());
        for (ConsentType type : List.of(ConsentType.TERMS_OF_SERVICE, ConsentType.PRIVACY_NOTICE)) {
            ConsentPolicyDescriptor descriptor = fixture.consents().policyDescriptor(type);
            fixture.consents().record(consentContext, new ConsentCommand(type,
                    descriptor.documentVersion(), true, ClientAuthorityClaims.none(),
                    descriptor.documentDigest()));
        }
        assertTrue(fixture.consents().hasRequiredConsentFor(fixture.account().principalId(), "ANALYTICS"),
                "the absent optional PRODUCT_ANALYTICS document must not become a global capability gate");

        var refreshRequest = new IamAuthenticationController.RefreshRequest(
                login.getBody().data().refreshToken(), loginDevice);
        var refreshed = fixture.controller().refresh(refreshRequest, new MockHttpServletRequest(), NATIVE,
                "learning-only-refresh-key-1234");
        assertEquals(200, refreshed.getStatusCode().value());
        Jwt refreshedJwt = decodeAccessToken(fixture, refreshed.getBody().data().accessToken());
        assertEquals("UNKNOWN", refreshedJwt.getClaimAsString("consent_state"));

        var principal = fixture.controller().principalMe(new JwtAuthenticationToken(refreshedJwt))
                .getBody().data();
        assertEquals("RESTRICTED", principal.status());
        assertFalse(principal.consentState().accepted(), "missing adult-learning consent must not grant learning access");
        assertEquals(Set.of("ACCOUNT_TERMS", "PRIVACY_NOTICE", "ADULT_LEARNING_ELIGIBILITY"),
                Set.copyOf(principal.consentState().requiredPurposes()));
        assertEquals(Set.of("ADULT_LEARNING_ELIGIBILITY"),
                Set.copyOf(principal.consentState().unsatisfiedPurposes()));
        assertFalse(principal.consentState().requiredPurposes().contains("PRODUCT_ANALYTICS"));
        assertFalse(principal.consentState().requiredPurposes()
                .contains("ADULT_VOICE_RECORDING_REMOTE_STORAGE_AND_REPLAY"));
        assertFalse(fixture.consents().hasRequiredConsentFor(fixture.account().principalId(), "VOICE_REMOTE_RECORD"),
                "a missing voice policy must keep voice capability denied");
    }

    @Test
    void acceptedLearningConsentAndAdultGateMatchLoginRefreshTokensAndPrincipalState() {
        MutableConsentPolicy policy = publishedPolicy(ConsentType.TERMS_OF_SERVICE,
                ConsentType.PRIVACY_NOTICE, ConsentType.ADULT_LEARNING);
        Fixture fixture = fixture(Duration.ofMinutes(15), Duration.ofDays(30),
                "local-unverified", policy);
        fixture.adultGateFacts().approve(fixture.account().principalId(),
                "b30-adult-v1", fixture.clock().instant());

        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(
                fixture.account().principalId(), fixture.account().roles());
        for (ConsentType type : List.of(ConsentType.TERMS_OF_SERVICE,
                ConsentType.PRIVACY_NOTICE, ConsentType.ADULT_LEARNING)) {
            ConsentPolicyDescriptor descriptor = fixture.consents().policyDescriptor(type);
            fixture.consents().record(context, new ConsentCommand(type,
                    descriptor.documentVersion(), true, ClientAuthorityClaims.none(),
                    descriptor.documentDigest()));
        }

        String deviceId = UUID.randomUUID().toString();
        var login = fixture.controller().login(nativeLogin(deviceId), NATIVE,
                "accepted-learning-login-key-1234");
        assertEquals(200, login.getStatusCode().value());
        Jwt loginJwt = decodeAccessToken(fixture, login.getBody().data().accessToken());
        assertEquals("PASSED", loginJwt.getClaimAsString("adult_gate"));
        assertEquals("GRANTED", loginJwt.getClaimAsString("consent_state"));
        assertEquals("granted", loginJwt.getClaimAsString("media_consent"));

        var loginPrincipal = fixture.controller().principalMe(new JwtAuthenticationToken(loginJwt))
                .getBody().data();
        assertEquals("ACTIVE", loginPrincipal.status());
        assertEquals("PASSED", loginPrincipal.adultGate().status());
        assertEquals("ELIGIBLE", loginPrincipal.adultGate().learningAccess());
        assertTrue(loginPrincipal.consentState().accepted());
        assertEquals("ELIGIBLE", loginPrincipal.consentState().learningAccess());
        assertEquals(Set.of("ACCOUNT_TERMS", "PRIVACY_NOTICE", "ADULT_LEARNING_ELIGIBILITY"),
                Set.copyOf(loginPrincipal.consentState().requiredPurposes()));
        assertTrue(loginPrincipal.consentState().unsatisfiedPurposes().isEmpty());
        assertFalse(loginPrincipal.consentState().requiredPurposes().contains("PRODUCT_ANALYTICS"));
        assertFalse(loginPrincipal.consentState().requiredPurposes()
                .contains("ADULT_VOICE_RECORDING_REMOTE_STORAGE_AND_REPLAY"));
        assertTrue(fixture.consents().hasRequiredConsentFor(fixture.account().principalId(), "ANALYTICS"),
                "optional analytics consent must not block its base authenticated capability");
        assertFalse(fixture.consents().hasRequiredConsentFor(fixture.account().principalId(), "VOICE_REMOTE_RECORD"),
                "missing voice consent must remain scoped to remote voice capabilities");

        var refreshed = fixture.controller().refresh(new IamAuthenticationController.RefreshRequest(
                        login.getBody().data().refreshToken(), deviceId),
                new MockHttpServletRequest(), NATIVE, "accepted-learning-refresh-key-1234");
        assertEquals(200, refreshed.getStatusCode().value());
        Jwt refreshedJwt = decodeAccessToken(fixture, refreshed.getBody().data().accessToken());
        assertEquals("PASSED", refreshedJwt.getClaimAsString("adult_gate"));
        assertEquals("GRANTED", refreshedJwt.getClaimAsString("consent_state"));
        assertEquals("granted", refreshedJwt.getClaimAsString("media_consent"));

        var refreshedPrincipal = fixture.controller().principalMe(new JwtAuthenticationToken(refreshedJwt))
                .getBody().data();
        assertEquals("ACTIVE", refreshedPrincipal.status());
        assertEquals("PASSED", refreshedPrincipal.adultGate().status());
        assertEquals("ELIGIBLE", refreshedPrincipal.adultGate().learningAccess());
        assertTrue(refreshedPrincipal.consentState().accepted());
        assertEquals("ELIGIBLE", refreshedPrincipal.consentState().learningAccess());
        assertTrue(refreshedPrincipal.consentState().unsatisfiedPurposes().isEmpty());
    }

    @Test
    void missingLearningRequiredPolicyStillBlocksRegisterLoginAndRefresh() {
        MutableConsentPolicy policy = publishedPolicy(ConsentType.TERMS_OF_SERVICE,
                ConsentType.PRIVACY_NOTICE, ConsentType.ADULT_LEARNING);
        Fixture fixture = fixture(Duration.ofMinutes(15), Duration.ofDays(30),
                "local-unverified", policy);
        String loginDevice = UUID.randomUUID().toString();
        var initialLogin = fixture.controller().login(nativeLogin(loginDevice), NATIVE,
                "required-policy-login-key-1234");
        SessionId sessionId = new SessionId(UUID.fromString(initialLogin.getBody().data().sessionId()));
        SessionRecord before = fixture.sessions().find(sessionId);

        policy.remove(ConsentType.ADULT_LEARNING);
        String rejectedIdentifier = "missing-adult-policy@example.com";
        var registration = new IamAuthenticationController.RegisterRequest(rejectedIdentifier, PASSWORD,
                new IamAuthenticationController.DeviceInput(UUID.randomUUID().toString(),
                        "IOS", "missing-required-registration", "1", "1"));
        IamPolicyException registerFailure = assertThrows(IamPolicyException.class,
                () -> fixture.controller().register(registration, NATIVE,
                        "required-policy-register-key-1234"));
        assertEquals(IamDecisionCode.POLICY_UNAVAILABLE, registerFailure.code());
        assertTrue(fixture.accounts().findByIdentifier(rejectedIdentifier).isEmpty());

        IamPolicyException loginFailure = assertThrows(IamPolicyException.class,
                () -> fixture.controller().login(nativeLogin(UUID.randomUUID().toString()), NATIVE,
                        "required-policy-second-login-key-1234"));
        assertEquals(IamDecisionCode.POLICY_UNAVAILABLE, loginFailure.code());

        IamPolicyException refreshFailure = assertThrows(IamPolicyException.class,
                () -> fixture.controller().refresh(new IamAuthenticationController.RefreshRequest(
                                initialLogin.getBody().data().refreshToken(), loginDevice),
                        new MockHttpServletRequest(), NATIVE, "required-policy-refresh-key-1234"));
        assertEquals(IamDecisionCode.POLICY_UNAVAILABLE, refreshFailure.code());
        SessionRecord after = fixture.sessions().find(sessionId);
        assertEquals(before.rotation(), after.rotation(), "a rejected refresh must not rotate the session");
        assertEquals(before.refreshTokenDigest(), after.refreshTokenDigest());
        assertEquals(1, fixture.deviceRegistry().saveCount(),
                "failed registration/login must not register additional devices");
    }

    @Test
    void revokedSessionMakesCompletedLoginKeyUnavailableInsteadOfReturningOldCredentials() {
        Fixture fixture = fixture();
        String deviceId = UUID.randomUUID().toString();
        String key = "login-replay-key-123456";
        IamAuthenticationController.LoginRequest request = new IamAuthenticationController.LoginRequest(
                "replay@example.com", PASSWORD,
                new IamAuthenticationController.DeviceInput(deviceId, "IOS", "test-device", "1", "1"));

        var first = fixture.controller().login(request, NATIVE, key);
        IamAuthenticationController.AuthTokenResponse issued = first.getBody().data();
        assertNotNull(issued.accessToken());
        assertNotNull(issued.refreshToken());

        String fingerprint = fixture.idempotency().fingerprint("/api/v1/auth/login",
                IamAuthenticationController.AuthTransport.NATIVE_SECURE_STORAGE, request, request.password());
        IdempotencyRecord record = fixture.idempotencyStore().claim("/api/v1/auth/login", key, fingerprint);
        assertFalse(record.hasResponseSnapshot(), "login credentials must not have a restorable snapshot");
        assertTrue(record.resultReference().startsWith("credential-replay-v1|"));
        assertFalse(record.resultReference().contains(PASSWORD));
        assertFalse(record.resultReference().contains(currentAccount(fixture).passwordHash()),
                "the versioned replay reference must carry only a keyed credential binding");

        fixture.sessions().revoke(new SessionId(UUID.fromString(issued.sessionId())), "test_revocation");
        IamPolicyException failure = assertThrows(IamPolicyException.class,
                () -> fixture.controller().login(request, NATIVE, key));
        assertEquals(IamDecisionCode.IDEMPOTENCY_RESULT_UNAVAILABLE, failure.code());
    }

    @Test
    void laterRefreshRotationMakesOldCompletedRefreshKeyUnavailable() {
        Fixture fixture = fixture();
        String deviceId = UUID.randomUUID().toString();
        IamAuthenticationController.LoginRequest login = new IamAuthenticationController.LoginRequest(
                "replay@example.com", PASSWORD,
                new IamAuthenticationController.DeviceInput(deviceId, "IOS", "test-device", "1", "1"));
        IamAuthenticationController.AuthTokenResponse initial = fixture.controller()
                .login(login, NATIVE, "refresh-login-key-1234").getBody().data();
        MockHttpServletRequest servletRequest = new MockHttpServletRequest();

        String firstKey = "refresh-replay-key-12345";
        IamAuthenticationController.RefreshRequest firstRequest =
                new IamAuthenticationController.RefreshRequest(initial.refreshToken(), deviceId);
        IamAuthenticationController.AuthTokenResponse firstRotation = fixture.controller()
                .refresh(firstRequest, servletRequest, NATIVE, firstKey).getBody().data();
        String firstFingerprint = fixture.idempotency().fingerprint("/api/v1/auth/token/refresh",
                IamAuthenticationController.AuthTransport.NATIVE_SECURE_STORAGE,
                firstRequest, firstRequest.refreshToken());
        assertFalse(fixture.idempotencyStore().claim(
                        "/api/v1/auth/token/refresh", firstKey, firstFingerprint).hasResponseSnapshot(),
                "refresh credentials must not have a restorable snapshot");

        IamAuthenticationController.RefreshRequest secondRequest =
                new IamAuthenticationController.RefreshRequest(firstRotation.refreshToken(), deviceId);
        IamAuthenticationController.AuthTokenResponse secondRotation = fixture.controller()
                .refresh(secondRequest, servletRequest, NATIVE, "refresh-next-key-123456").getBody().data();
        assertNotEquals(firstRotation.refreshToken(), secondRotation.refreshToken());
        assertNotEquals(firstRotation.accessToken(), secondRotation.accessToken());

        IamPolicyException failure = assertThrows(IamPolicyException.class,
                () -> fixture.controller().refresh(firstRequest, servletRequest, NATIVE, firstKey));
        assertEquals(IamDecisionCode.IDEMPOTENCY_RESULT_UNAVAILABLE, failure.code());
    }

    @Test
    void registerAndRefreshReplayRemainDeterministicWhileCurrentFactsAreValid() {
        Fixture fixture = fixture();
        String registerDevice = UUID.randomUUID().toString();
        var register = new IamAuthenticationController.RegisterRequest(
                "new-replay@example.com", PASSWORD,
                new IamAuthenticationController.DeviceInput(registerDevice, "IOS", "new-device", "1", "1"));
        String registerKey = "register-valid-replay-key-1234";
        var registered = fixture.controller().register(register, NATIVE, registerKey).getBody().data();
        var registeredReplay = fixture.controller().register(register, NATIVE, registerKey).getBody().data();
        assertEquals(registered.accessToken(), registeredReplay.accessToken());
        assertEquals(registered.refreshToken(), registeredReplay.refreshToken());

        String loginDevice = UUID.randomUUID().toString();
        var login = fixture.controller().login(nativeLogin(loginDevice), NATIVE,
                "refresh-valid-login-key-1234").getBody().data();
        var refresh = new IamAuthenticationController.RefreshRequest(login.refreshToken(), loginDevice);
        String refreshKey = "refresh-valid-replay-key-1234";
        var rotated = fixture.controller().refresh(refresh, new MockHttpServletRequest(), NATIVE,
                refreshKey).getBody().data();
        var rotatedReplay = fixture.controller().refresh(refresh, new MockHttpServletRequest(), NATIVE,
                refreshKey).getBody().data();
        assertEquals(rotated.accessToken(), rotatedReplay.accessToken());
        assertEquals(rotated.refreshToken(), rotatedReplay.refreshToken());
    }

    @Test
    void passwordResetHttpFlowChangesPasswordRevokesSessionsAndDoesNotEnumerateAccounts() throws Exception {
        Fixture fixture = fixture();
        MockMvc http = MockMvcBuilders.standaloneSetup(fixture.controller()).build();
        ObjectMapper json = new ObjectMapper().findAndRegisterModules();
        String identifier = fixture.account().identifier();
        String oldPassword = PASSWORD;
        String newPassword = "new correct horse battery staple!";

        var priorSession = fixture.sessions().open(
                ServerPrincipalContext.forPlatform(fixture.account().principalId(), fixture.account().roles()),
                new DeviceId("reset-http-old-session")).session();
        assertEquals(SessionStatus.ACTIVE, priorSession.status());

        String unknownIdentifier = "missing-reset-" + UUID.randomUUID() + "@example.com";
        MvcResult unknownRequest = http.perform(post("/api/v1/auth/password-reset/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Idempotency-Key", "reset-unknown-" + UUID.randomUUID())
                        .header("X-Auth-Transport", NATIVE)
                        .content(json.writeValueAsString(java.util.Map.of("identifier", unknownIdentifier))))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.accepted").value(true))
                .andReturn();
        assertEquals(0, fixture.resetDelivery().deliveredCount(),
                "an unknown identifier must not receive a reset challenge");

        MvcResult knownRequest = http.perform(post("/api/v1/auth/password-reset/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Idempotency-Key", "reset-known-" + UUID.randomUUID())
                        .header("X-Auth-Transport", NATIVE)
                        .content(json.writeValueAsString(java.util.Map.of("identifier", identifier))))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.accepted").value(true))
                .andReturn();
        JsonNode unknownData = json.readTree(unknownRequest.getResponse().getContentAsString()).path("data");
        JsonNode knownData = json.readTree(knownRequest.getResponse().getContentAsString()).path("data");
        assertEquals(unknownData, knownData, "known and unknown identifiers must have the same public data");
        assertEquals(1, fixture.resetDelivery().deliveredCount());

        // The raw token stays inside this in-memory test handoff and is never emitted in an HTTP response.
        String resetToken = fixture.resetDelivery().deliveries().get(0).rawToken();
        assertFalse(knownRequest.getResponse().getContentAsString().contains(resetToken));
        assertFalse(unknownRequest.getResponse().getContentAsString().contains(resetToken));
        assertFalse(knownRequest.getResponse().getContentAsString().contains(identifier));
        assertFalse(unknownRequest.getResponse().getContentAsString().contains(unknownIdentifier));

        String confirmBody = json.writeValueAsString(java.util.Map.of(
                "identifier", identifier,
                "resetToken", resetToken,
                "newPassword", newPassword));
        http.perform(post("/api/v1/auth/password-reset/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Idempotency-Key", "reset-confirm-" + UUID.randomUUID())
                        .header("X-Auth-Transport", NATIVE)
                        .content(confirmBody))
                .andExpect(status().isNoContent());
        assertEquals(SessionStatus.REVOKED,
                fixture.sessions().find(priorSession.sessionId()).status());

        String replayBody = json.writeValueAsString(java.util.Map.of(
                "identifier", identifier,
                "resetToken", resetToken,
                "newPassword", "another correct horse battery staple!"));
        http.perform(post("/api/v1/auth/password-reset/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Idempotency-Key", "reset-replay-" + UUID.randomUUID())
                        .header("X-Auth-Transport", NATIVE)
                        .content(replayBody))
                .andExpect(status().isUnauthorized());

        String loginDevice = UUID.randomUUID().toString();
        var newPasswordLogin = new IamAuthenticationController.LoginRequest(identifier, newPassword,
                new IamAuthenticationController.DeviceInput(loginDevice, "IOS", "reset-http-test", "1", "1"));
        http.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Idempotency-Key", "reset-new-login-" + UUID.randomUUID())
                        .header("X-Auth-Transport", NATIVE)
                        .content(json.writeValueAsString(newPasswordLogin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty());

        var oldPasswordLogin = new IamAuthenticationController.LoginRequest(identifier, oldPassword,
                new IamAuthenticationController.DeviceInput(UUID.randomUUID().toString(), "IOS", "reset-http-test", "1", "1"));
        http.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Idempotency-Key", "reset-old-login-" + UUID.randomUUID())
                        .header("X-Auth-Transport", NATIVE)
                        .content(json.writeValueAsString(oldPasswordLogin)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void lockedOrDisabledAccountMakesCompletedLoginReplayUnavailable() {
        for (AccountStatus status : List.of(AccountStatus.LOCKED, AccountStatus.DISABLED)) {
            Fixture fixture = fixture();
            String deviceId = UUID.randomUUID().toString();
            String key = "account-state-replay-" + status.name().toLowerCase() + "-1234";
            IamAuthenticationController.LoginRequest request = nativeLogin(deviceId);
            fixture.controller().login(request, NATIVE, key);

            setAccountStatus(fixture, status);
            IamPolicyException failure = assertThrows(IamPolicyException.class,
                    () -> fixture.controller().login(request, NATIVE, key));
            assertEquals(IamDecisionCode.IDEMPOTENCY_RESULT_UNAVAILABLE, failure.code());
        }
    }

    @Test
    void passwordEpochPermissionAndEligibilityChangesInvalidateCompletedCredentialReplay() {
        Fixture passwordFixture = fixture();
        String passwordDevice = UUID.randomUUID().toString();
        IamAuthenticationController.LoginRequest passwordRequest = nativeLogin(passwordDevice);
        String passwordKey = "password-epoch-replay-key-1234";
        passwordFixture.controller().login(passwordRequest, NATIVE, passwordKey);
        passwordFixture.passwords().changePassword(passwordFixture.account().principalId(),
                "a new correct horse battery staple!");
        assertUnavailable(() -> passwordFixture.controller().login(passwordRequest, NATIVE, passwordKey));

        Fixture claimsFixture = fixture();
        String claimsDevice = UUID.randomUUID().toString();
        IamAuthenticationController.LoginRequest claimsRequest = nativeLogin(claimsDevice);
        String claimsKey = "permission-claims-replay-key-1234";
        claimsFixture.controller().login(claimsRequest, NATIVE, claimsKey);
        AccountRecord current = currentAccount(claimsFixture);
        claimsFixture.accounts().replace(current.withPermissions(Set.of(
                "iam.self.read", "iam.self.write", "iam.new.permission")));
        assertUnavailable(() -> claimsFixture.controller().login(claimsRequest, NATIVE, claimsKey));

        Fixture eligibilityFixture = fixture();
        String eligibilityDevice = UUID.randomUUID().toString();
        IamAuthenticationController.LoginRequest eligibilityRequest = nativeLogin(eligibilityDevice);
        String eligibilityKey = "eligibility-claims-replay-key-1234";
        eligibilityFixture.controller().login(eligibilityRequest, NATIVE, eligibilityKey);
        AccountRecord eligibilityAccount = currentAccount(eligibilityFixture);
        eligibilityFixture.adultGateFacts().approve(eligibilityAccount.principalId(),
                "b30-adult-v1", eligibilityFixture.clock().instant());
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(
                eligibilityAccount.principalId(), eligibilityAccount.roles());
        for (ConsentType type : ConsentType.values()) {
            var descriptor = eligibilityFixture.consents().policyDescriptor(type);
            if (descriptor.requiredFor("LEARNING")) {
                eligibilityFixture.consents().record(context, new ConsentCommand(type,
                        descriptor.documentVersion(), true, ClientAuthorityClaims.none(),
                        descriptor.documentDigest()));
            }
        }
        assertUnavailable(() -> eligibilityFixture.controller()
                .login(eligibilityRequest, NATIVE, eligibilityKey));
    }

    @Test
    void notificationPreferenceScopesAreIssuedOnlyAfterAdultGateAndRequiredConsentPass() {
        Fixture fixture = fixture();
        Set<String> preferenceScopes = Set.of(
                "notification.preference.read.self", "notification.preference.write.self");

        String beforeGateToken = fixture.controller().login(
                nativeLogin(UUID.randomUUID().toString()), NATIVE,
                "notification-pref-pre-gate-key-1234").getBody().data().accessToken();
        Jwt beforeGate = decodeAccessToken(fixture, beforeGateToken);
        assertTrue(java.util.Collections.disjoint(
                beforeGate.getClaimAsStringList("permissions"), preferenceScopes));

        AccountRecord account = currentAccount(fixture);
        fixture.adultGateFacts().approve(account.principalId(), "b30-adult-v1", fixture.clock().instant());
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(account.principalId(), account.roles());
        for (ConsentType type : ConsentType.values()) {
            var descriptor = fixture.consents().policyDescriptor(type);
            if (descriptor.requiredFor("LEARNING")) {
                fixture.consents().record(context, new ConsentCommand(type,
                        descriptor.documentVersion(), true, ClientAuthorityClaims.none(),
                        descriptor.documentDigest()));
            }
        }

        String afterGateToken = fixture.controller().login(
                nativeLogin(UUID.randomUUID().toString()), NATIVE,
                "notification-pref-post-gate-key-1234").getBody().data().accessToken();
        Jwt afterGate = decodeAccessToken(fixture, afterGateToken);
        assertTrue(afterGate.getClaimAsStringList("permissions").containsAll(preferenceScopes));
        assertFalse(afterGate.getClaimAsStringList("permissions").contains("notification.trusted-event.write"));
    }

    @Test
    void revokedDeviceInvalidatesCompletedLoginReplay() {
        Fixture fixture = fixture();
        String deviceId = UUID.randomUUID().toString();
        IamAuthenticationController.LoginRequest request = nativeLogin(deviceId);
        String key = "device-fact-replay-key-1234";
        fixture.controller().login(request, NATIVE, key);
        AccountRecord current = currentAccount(fixture);
        fixture.devices().kick(ServerPrincipalContext.forPlatform(current.principalId(), current.roles()),
                new DeviceId(deviceId));

        assertUnavailable(() -> fixture.controller().login(request, NATIVE, key));
    }

    @Test
    void expiredSessionInvalidatesReplayEvenWhileOriginalAccessWindowRemains() {
        Fixture fixture = fixture(Duration.ofMinutes(5), Duration.ofMinutes(1));
        String deviceId = UUID.randomUUID().toString();
        IamAuthenticationController.LoginRequest request = nativeLogin(deviceId);
        String key = "session-expiry-replay-key-1234";
        fixture.controller().login(request, NATIVE, key);
        fixture.clock().advance(Duration.ofSeconds(61));

        assertUnavailable(() -> fixture.controller().login(request, NATIVE, key));
    }

    @Test
    void firstRefreshRejectsLockedOrDisabledAccountBeforeRotation() {
        for (AccountStatus status : List.of(AccountStatus.LOCKED, AccountStatus.DISABLED)) {
            Fixture fixture = fixture();
            String deviceId = UUID.randomUUID().toString();
            IamAuthenticationController.AuthTokenResponse login = fixture.controller()
                    .login(nativeLogin(deviceId), NATIVE,
                            "initial-refresh-login-" + status.name().toLowerCase())
                    .getBody().data();
            SessionId sessionId = new SessionId(UUID.fromString(login.sessionId()));
            setAccountStatus(fixture, status);

            IamPolicyException failure = assertThrows(IamPolicyException.class, () ->
                    fixture.controller().refresh(
                            new IamAuthenticationController.RefreshRequest(login.refreshToken(), deviceId),
                            new MockHttpServletRequest(), NATIVE,
                            "initial-refresh-state-" + status.name().toLowerCase()));
            assertEquals(status == AccountStatus.LOCKED
                    ? IamDecisionCode.ACCOUNT_LOCKED : IamDecisionCode.INVALID_CREDENTIALS,
                    failure.code());
            assertEquals(0, fixture.sessions().find(sessionId).rotation(),
                    "an inactive account must be rejected before refresh-token rotation");
        }
    }

    @Test
    void validWebReplayUsesRemainingTtlAndExpiredReplayReturnsCookieFree503() {
        Fixture fixture = fixture(Duration.ofMinutes(2));
        IamAuthenticationController.LoginRequest request = new IamAuthenticationController.LoginRequest(
                "replay@example.com", PASSWORD,
                new IamAuthenticationController.DeviceInput(null, "WEB", "browser", "1", "1"));
        String key = "web-access-expiry-replay-key-1234";

        var first = fixture.controller().login(request, WEB, key);
        IamAuthenticationController.AuthTokenResponse firstBody = first.getBody().data();
        String firstCookie = first.getHeaders().getFirst("Set-Cookie");
        assertNotNull(firstCookie);
        assertEquals(1, first.getHeaders().get("Set-Cookie").size());
        assertTrue(firstCookie.contains("HttpOnly") && firstCookie.contains("Secure")
                && firstCookie.contains("SameSite=None") && firstCookie.contains("Partitioned")
                && firstCookie.contains("Path=/api/v1/auth"));
        assertNull(firstBody.refreshToken(), "web responses must never expose the refresh token in JSON");
        assertEquals(120, firstBody.expiresIn());

        fixture.clock().advance(Duration.ofSeconds(30));
        var replay = fixture.controller().login(request, WEB, key);
        assertEquals(firstBody.accessToken(), replay.getBody().data().accessToken());
        assertEquals(90, replay.getBody().data().expiresIn(),
                "a replay reports remaining access lifetime, not the original total TTL");
        assertEquals(1, replay.getHeaders().get("Set-Cookie").size());
        assertTrue(replay.getHeaders().getFirst("Set-Cookie").contains("Max-Age=2591970"));

        fixture.clock().advance(Duration.ofSeconds(91));
        IamPolicyException expired = assertThrows(IamPolicyException.class,
                () -> fixture.controller().login(request, WEB, key));
        assertEquals(IamDecisionCode.IDEMPOTENCY_RESULT_UNAVAILABLE, expired.code());
        var error = fixture.controller().handlePolicy(expired, new MockHttpServletRequest());
        assertEquals(503, error.getStatusCode().value());
        assertFalse(error.getHeaders().containsHeader("Set-Cookie"),
                "an unavailable credential replay must not refresh the browser cookie");
        assertTrue(error.getHeaders().getCacheControl().contains("no-store"));
        assertNotNull(error.getBody());
        assertFalse(error.getBody().toString().contains(firstBody.accessToken()));
        assertFalse(error.getBody().toString().contains(firstCookie));
    }

    @Test
    void rateLimitedPolicyErrorsCarryCanonicalRetryAfter() {
        Fixture fixture = fixture();
        var response = fixture.controller().handlePolicy(
                new IamPolicyException(IamDecisionCode.RATE_LIMITED, "iam.password_reset.rate_limited"),
                new MockHttpServletRequest());
        assertEquals(429, response.getStatusCode().value());
        assertEquals("60", response.getHeaders().getFirst("Retry-After"));
        assertTrue(response.getHeaders().getCacheControl().contains("no-store"));
    }

    @Test
    void nativeTransportIsDeniedByDefaultUntilServerVerifiableProofExists() {
        Fixture fixture = fixture(Duration.ofMinutes(15), Duration.ofDays(30), "deny");
        IamAuthenticationController.LoginRequest nativeRequest = nativeLogin("denied-native-device");
        IamPolicyException failure = assertThrows(IamPolicyException.class,
                () -> fixture.controller().login(nativeRequest, NATIVE, "deny-native-login-key-123456"));
        assertEquals(IamDecisionCode.INVALID_REQUEST, failure.code());
        var denial = fixture.controller().handlePolicy(failure, new MockHttpServletRequest());
        assertEquals(400, denial.getStatusCode().value());
        assertEquals("VALIDATION_ERROR", denial.getBody().error().errorCode());

        // Register and refresh use the same trusted-context boundary.
        IamAuthenticationController.RegisterRequest nativeRegister =
                new IamAuthenticationController.RegisterRequest("native-deny@example.com", PASSWORD,
                        new IamAuthenticationController.DeviceInput(null, "ANDROID", "deny-device", "1", "1"));
        IamPolicyException registerDenied = assertThrows(IamPolicyException.class,
                () -> fixture.controller().register(nativeRegister, NATIVE, "deny-native-register-key-1234"));
        assertEquals(IamDecisionCode.INVALID_REQUEST, registerDenied.code());

        // The Web cookie transport keeps its ordinary non-enumerating behavior.
        var web = fixture.controller().login(new IamAuthenticationController.LoginRequest(
                        "replay@example.com", PASSWORD,
                        new IamAuthenticationController.DeviceInput(null, "WEB", "test-browser", "1", "1")),
                WEB, "deny-web-login-key-123456");
        assertEquals(200, web.getStatusCode().value());
        assertNull(web.getBody().data().refreshToken(),
                "web transport must never expose the refresh token in JSON");
    }

    @Test
    void webRefreshAcceptsAContractValidMissingBody() {
        Fixture fixture = fixture();
        var login = fixture.controller().login(new IamAuthenticationController.LoginRequest(
                        "replay@example.com", PASSWORD,
                        new IamAuthenticationController.DeviceInput(null, "WEB", "missing-body-browser", "1", "1")),
                WEB, "web-missing-body-login-key-1234");
        assertEquals(200, login.getStatusCode().value());
        String setCookie = login.getHeaders().getFirst("Set-Cookie");
        assertNotNull(setCookie);
        String pair = setCookie.substring(0, setCookie.indexOf(';'));
        int separator = pair.indexOf('=');
        MockHttpServletRequest servletRequest = new MockHttpServletRequest();
        servletRequest.setCookies(new jakarta.servlet.http.Cookie(
                pair.substring(0, separator), pair.substring(separator + 1)));

        // The contract marks the refresh request body optional for WEB_COOKIE, so a missing body
        // must rotate the session instead of surfacing an internal failure.
        var refreshed = fixture.controller().refresh(null, servletRequest, WEB, "web-missing-body-refresh-key-1");
        assertEquals(200, refreshed.getStatusCode().value());
        assertNotNull(refreshed.getHeaders().getFirst("Set-Cookie"), "rotation must issue a new cookie");
        assertNull(refreshed.getBody().data().refreshToken(),
                "web transport must never expose the refresh token in JSON");
    }

    @Test
    void unsupportedMediaTypeOnAPublicRequestIsAClientError() {
        Fixture fixture = fixture();
        var response = fixture.controller().handleUnexpected(
                new org.springframework.web.HttpMediaTypeNotSupportedException(
                        org.springframework.http.MediaType.APPLICATION_FORM_URLENCODED,
                        java.util.List.of(org.springframework.http.MediaType.APPLICATION_JSON)),
                new MockHttpServletRequest());
        assertEquals(400, response.getStatusCode().value());
        assertEquals("VALIDATION_ERROR", response.getBody().error().errorCode());
    }

    private static IamAuthenticationController.LoginRequest nativeLogin(String deviceId) {
        return new IamAuthenticationController.LoginRequest("replay@example.com", PASSWORD,
                new IamAuthenticationController.DeviceInput(deviceId, "IOS", "test-device", "1", "1"));
    }

    private static AccountRecord currentAccount(Fixture fixture) {
        return fixture.accounts().findByPrincipalId(fixture.account().principalId()).orElseThrow();
    }

    private static Jwt decodeAccessToken(Fixture fixture, String token) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withPublicKey(fixture.keys().publicKey()).build();
        decoder.setJwtValidator(jwt -> OAuth2TokenValidatorResult.success());
        return decoder.decode(token);
    }

    private static void setAccountStatus(Fixture fixture, AccountStatus status) {
        AccountRecord current = currentAccount(fixture);
        fixture.accounts().replace(new AccountRecord(current.principalId(), current.identifier(),
                current.passwordHash(), current.roles(), current.permissions(), status,
                status == AccountStatus.LOCKED ? 5 : current.failedAttempts(),
                status == AccountStatus.LOCKED ? fixture.clock().instant().plusSeconds(900) : null,
                current.createdAt(), fixture.clock().instant()));
    }

    @Test
    void principalSessionUsesInjectedClockAndRejectsExactExpiry() {
        Fixture fixture = fixture(Duration.ofMinutes(15), Duration.ofDays(30));
        var login = fixture.controller().login(nativeLogin(UUID.randomUUID().toString()), NATIVE,
                "session-clock-boundary-key-1234");
        Jwt jwt = decodeAccessToken(fixture, login.getBody().data().accessToken());
        var authentication = new JwtAuthenticationToken(jwt);
        fixture.clock().advance(Duration.ofDays(30).minusSeconds(1));
        assertEquals(200, fixture.controller().principalMe(authentication).getStatusCode().value());
        fixture.clock().advance(Duration.ofSeconds(1));
        IamPolicyException expired = assertThrows(IamPolicyException.class,
                () -> fixture.controller().principalMe(authentication));
        assertEquals(IamDecisionCode.SESSION_EXPIRED, expired.code());
        fixture.clock().advance(Duration.ofSeconds(1));
        assertEquals(IamDecisionCode.SESSION_EXPIRED, assertThrows(IamPolicyException.class,
                () -> fixture.controller().principalMe(authentication)).code());
    }

    private static void assertUnavailable(org.junit.jupiter.api.function.Executable operation) {
        IamPolicyException failure = assertThrows(IamPolicyException.class, operation);
        assertEquals(IamDecisionCode.IDEMPOTENCY_RESULT_UNAVAILABLE, failure.code());
    }

    private static MutableConsentPolicy publishedPolicy(ConsentType... types) {
        return new MutableConsentPolicy(Set.of(types));
    }

    private static Fixture fixture() {
        return fixture(Duration.ofMinutes(15), Duration.ofDays(30));
    }

    private static Fixture fixture(Duration accessTtl) {
        return fixture(accessTtl, Duration.ofDays(30));
    }

    private static Fixture fixture(Duration accessTtl, Duration refreshTtl) {
        return fixture(accessTtl, refreshTtl, "local-unverified");
    }

    private static Fixture fixture(Duration accessTtl, Duration refreshTtl, String nativeTransportPolicy) {
        return fixture(accessTtl, refreshTtl, nativeTransportPolicy, true);
    }

    private static Fixture fixture(Duration accessTtl, Duration refreshTtl,
                                   String nativeTransportPolicy, boolean publishedConsentAvailable) {
        return fixture(accessTtl, refreshTtl, nativeTransportPolicy,
                StaticConsentPolicy.localCandidate(publishedConsentAvailable));
    }

    private static Fixture fixture(Duration accessTtl, Duration refreshTtl,
                                   String nativeTransportPolicy, ConsentPolicyPort consentPolicy) {
        MutableClock clock = new MutableClock(Instant.parse("2026-09-04T00:00:00Z"));
        IamServiceProperties properties = new IamServiceProperties();
        properties.getJwt().setEphemeralKeysAllowed(true);
        properties.getJwt().setRefreshCookieSecure(true);
        properties.getJwt().setAccessTokenTtl(accessTtl);
        properties.getJwt().setRefreshTokenTtl(refreshTtl);
        properties.getAuth().setNativeTransportPolicy(nativeTransportPolicy);
        properties.getIdempotency().setReplaySecret("controller-replay-secret-for-idempotency-2026");
        properties.getIdempotency().setFingerprintSecret("controller-fingerprint-secret-for-idempotency-2026");

        InMemoryAuditFactPort audit = new InMemoryAuditFactPort();
        InMemoryRateLimitStore rateLimits = new InMemoryRateLimitStore();
        InMemoryAccountStore accounts = new InMemoryAccountStore();
        PasswordAccountService passwords = new PasswordAccountService(accounts,
                new BCryptPasswordEncoder(12), audit, clock, properties, rateLimits);
        AccountRecord account = passwords.register("replay@example.com", PASSWORD,
                ClientAuthorityClaims.none());

        SessionService sessions = new SessionService(new InMemorySessionStore(), audit, clock, properties);
        TrackingDeviceRegistry deviceRegistry = new TrackingDeviceRegistry();
        DeviceService devices = new DeviceService(deviceRegistry, audit, clock);
        InMemoryAdultGateFactStore adultGateFacts = new InMemoryAdultGateFactStore();
        AdultGateService adultGates = new AdultGateService(audit, clock, adultGateFacts, sessions,
                IamTransactionRunner.direct());
        InMemoryConsentStore consentStore = new InMemoryConsentStore();
        ConsentService consents = new ConsentService(consentStore,
                consentPolicy,
                audit, clock, sessions, IamTransactionRunner.direct());
        InMemoryPasswordResetDelivery resetDelivery = new InMemoryPasswordResetDelivery();
        PasswordResetService passwordResets = new PasswordResetService(accounts,
                new InMemoryPasswordResetChallengeStore(), passwords, audit, clock, properties,
                sessions, IamTransactionRunner.direct(), rateLimits,
                resetDelivery, properties.getIdempotency().getFingerprintSecret());

        JwtSigningKeyProvider keys = new JwtSigningKeyProvider(properties);
        JWKSource<SecurityContext> source = (selector, context) -> List.of(keys.signingKey());
        JwtTokenService tokens = new JwtTokenService(new NimbusJwtEncoder(source), keys, properties, clock);
        InMemoryIdempotencyStore idempotencyStore = new InMemoryIdempotencyStore();
        IdempotencyService idempotency = new IdempotencyService(idempotencyStore,
                new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules(),
                IamTransactionRunner.direct(), properties.getIdempotency().getReplaySecret(),
                properties.getIdempotency().getFingerprintSecret(), Duration.ofHours(24));

        IamAuthenticationController controller = new IamAuthenticationController(properties, passwords,
                passwordResets, tokens, keys, sessions, devices, adultGates, adultGateFacts,
                consents, consentStore, idempotency, clock);
        return new Fixture(controller, sessions, idempotency, idempotencyStore, accounts,
                passwords, devices, deviceRegistry, adultGateFacts, consents, account, clock, properties, keys,
                resetDelivery);
    }

    private record Fixture(IamAuthenticationController controller, SessionService sessions,
                           IdempotencyService idempotency,
                           InMemoryIdempotencyStore idempotencyStore,
                           InMemoryAccountStore accounts,
                           PasswordAccountService passwords,
                           DeviceService devices,
                           TrackingDeviceRegistry deviceRegistry,
                           InMemoryAdultGateFactStore adultGateFacts,
                           ConsentService consents,
                           AccountRecord account,
                           MutableClock clock,
                           IamServiceProperties properties,
                           JwtSigningKeyProvider keys,
                           InMemoryPasswordResetDelivery resetDelivery) {}

    private static final class TrackingDeviceRegistry implements DeviceRegistryPort {
        private final InMemoryDeviceRegistry delegate = new InMemoryDeviceRegistry();
        private int saves;

        int saveCount() { return saves; }
        @Override public DeviceRegistration save(DeviceRegistration registration) {
            saves++;
            return delegate.save(registration);
        }
        @Override public Optional<DeviceRegistration> find(PrincipalId principalId, DeviceId deviceId) {
            return delegate.find(principalId, deviceId);
        }
        @Override public List<DeviceRegistration> findByPrincipal(PrincipalId principalId) {
            return delegate.findByPrincipal(principalId);
        }
        @Override public List<DeviceRegistration> history(PrincipalId principalId, DeviceId deviceId) {
            return delegate.history(principalId, deviceId);
        }
        @Override public Optional<DeviceRegistration> revoke(PrincipalId principalId, DeviceId deviceId, Instant at) {
            return delegate.revoke(principalId, deviceId, at);
        }
    }

    private static final class MutableConsentPolicy implements ConsentPolicyPort {
        private final EnumMap<ConsentType, ConsentPolicyDescriptor> descriptors =
                new EnumMap<>(ConsentType.class);

        private MutableConsentPolicy(Set<ConsentType> types) {
            for (ConsentType type : types) {
                descriptors.put(type, ConsentPolicyDescriptor.localCandidate(type));
            }
        }

        @Override public ConsentPolicyDescriptor descriptor(ConsentType type) {
            ConsentPolicyDescriptor descriptor = descriptors.get(type);
            if (descriptor == null) {
                throw new IamPolicyException(IamDecisionCode.POLICY_UNAVAILABLE,
                        "iam.consent.version_unavailable");
            }
            return descriptor;
        }

        @Override public Set<ConsentPolicyDescriptor> descriptors() {
            return Set.copyOf(descriptors.values());
        }

        @Override public boolean evaluationEnabled() { return true; }
        @Override public boolean writesEnabled() { return true; }

        private void remove(ConsentType type) {
            descriptors.remove(type);
        }
    }

    private static final class MutableClock extends Clock {
        private Instant current;

        private MutableClock(Instant current) {
            this.current = current;
        }

        void advance(Duration duration) {
            current = current.plus(duration);
        }

        @Override public ZoneId getZone() { return java.time.ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) {
            if (!java.time.ZoneOffset.UTC.equals(zone)) throw new IllegalArgumentException("UTC only");
            return this;
        }
        @Override public Instant instant() { return current; }
    }
}
