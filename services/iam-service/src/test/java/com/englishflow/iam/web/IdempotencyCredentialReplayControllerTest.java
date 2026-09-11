package com.englishflow.iam.web;

import com.englishflow.iam.auth.JwtSigningKeyProvider;
import com.englishflow.iam.auth.JwtTokenService;
import com.englishflow.iam.config.IamServiceProperties;
import com.englishflow.iam.domain.AccountRecord;
import com.englishflow.iam.domain.AccountStatus;
import com.englishflow.iam.domain.AdultGateService;
import com.englishflow.iam.domain.ClientAuthorityClaims;
import com.englishflow.iam.domain.ConsentCommand;
import com.englishflow.iam.domain.ConsentService;
import com.englishflow.iam.domain.ConsentType;
import com.englishflow.iam.domain.DeviceId;
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
import com.englishflow.iam.domain.ServerPrincipalContext;
import com.englishflow.iam.domain.SessionId;
import com.englishflow.iam.domain.SessionService;
import com.englishflow.iam.domain.StaticConsentPolicy;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Verifies the real controller callbacks selected by the credential replay policy. */
class IdempotencyCredentialReplayControllerTest {
    private static final String PASSWORD = "correct horse battery staple!";
    private static final String NATIVE = "NATIVE_SECURE_STORAGE";
    private static final String WEB = "WEB_COOKIE";

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
                && firstCookie.contains("SameSite=Lax") && firstCookie.contains("Path=/api/v1/auth"));
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

    private static IamAuthenticationController.LoginRequest nativeLogin(String deviceId) {
        return new IamAuthenticationController.LoginRequest("replay@example.com", PASSWORD,
                new IamAuthenticationController.DeviceInput(deviceId, "IOS", "test-device", "1", "1"));
    }

    private static AccountRecord currentAccount(Fixture fixture) {
        return fixture.accounts().findByPrincipalId(fixture.account().principalId()).orElseThrow();
    }

    private static void setAccountStatus(Fixture fixture, AccountStatus status) {
        AccountRecord current = currentAccount(fixture);
        fixture.accounts().replace(new AccountRecord(current.principalId(), current.identifier(),
                current.passwordHash(), current.roles(), current.permissions(), status,
                status == AccountStatus.LOCKED ? 5 : current.failedAttempts(),
                status == AccountStatus.LOCKED ? fixture.clock().instant().plusSeconds(900) : null,
                current.createdAt(), fixture.clock().instant()));
    }

    private static void assertUnavailable(org.junit.jupiter.api.function.Executable operation) {
        IamPolicyException failure = assertThrows(IamPolicyException.class, operation);
        assertEquals(IamDecisionCode.IDEMPOTENCY_RESULT_UNAVAILABLE, failure.code());
    }

    private static Fixture fixture() {
        return fixture(Duration.ofMinutes(15), Duration.ofDays(30));
    }

    private static Fixture fixture(Duration accessTtl) {
        return fixture(accessTtl, Duration.ofDays(30));
    }

    private static Fixture fixture(Duration accessTtl, Duration refreshTtl) {
        MutableClock clock = new MutableClock(Instant.parse("2026-09-04T00:00:00Z"));
        IamServiceProperties properties = new IamServiceProperties();
        properties.getJwt().setEphemeralKeysAllowed(true);
        properties.getJwt().setRefreshCookieSecure(true);
        properties.getJwt().setAccessTokenTtl(accessTtl);
        properties.getJwt().setRefreshTokenTtl(refreshTtl);
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
        InMemoryDeviceRegistry deviceRegistry = new InMemoryDeviceRegistry();
        DeviceService devices = new DeviceService(deviceRegistry, audit, clock);
        InMemoryAdultGateFactStore adultGateFacts = new InMemoryAdultGateFactStore();
        AdultGateService adultGates = new AdultGateService(audit, clock, adultGateFacts, sessions,
                IamTransactionRunner.direct());
        InMemoryConsentStore consentStore = new InMemoryConsentStore();
        ConsentService consents = new ConsentService(consentStore, StaticConsentPolicy.localCandidate(true),
                audit, clock, sessions, IamTransactionRunner.direct());
        PasswordResetService passwordResets = new PasswordResetService(accounts,
                new InMemoryPasswordResetChallengeStore(), passwords, audit, clock, properties,
                sessions, IamTransactionRunner.direct(), rateLimits,
                new InMemoryPasswordResetDelivery(), properties.getIdempotency().getFingerprintSecret());

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
                passwords, devices, adultGateFacts, consents, account, clock, properties);
    }

    private record Fixture(IamAuthenticationController controller, SessionService sessions,
                           IdempotencyService idempotency,
                           InMemoryIdempotencyStore idempotencyStore,
                           InMemoryAccountStore accounts,
                           PasswordAccountService passwords,
                           DeviceService devices,
                           InMemoryAdultGateFactStore adultGateFacts,
                           ConsentService consents,
                           AccountRecord account,
                           MutableClock clock,
                           IamServiceProperties properties) {}

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
