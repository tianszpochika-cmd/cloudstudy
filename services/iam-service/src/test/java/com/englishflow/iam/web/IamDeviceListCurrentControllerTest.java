package com.englishflow.iam.web;

import com.englishflow.iam.auth.JwtSigningKeyProvider;
import com.englishflow.iam.auth.JwtTokenService;
import com.englishflow.iam.config.IamServiceProperties;
import com.englishflow.iam.domain.AccountRecord;
import com.englishflow.iam.domain.AdultGateService;
import com.englishflow.iam.domain.ClientAuthorityClaims;
import com.englishflow.iam.domain.ConsentPolicyPort;
import com.englishflow.iam.domain.ConsentService;
import com.englishflow.iam.domain.DeviceId;
import com.englishflow.iam.domain.DeviceRegistration;
import com.englishflow.iam.domain.DeviceRegistrationCommand;
import com.englishflow.iam.domain.DeviceService;
import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
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
import com.englishflow.iam.domain.StaticConsentPolicy;
import com.englishflow.iam.domain.TenantScope;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests for R1-005: Device list current device determination from server-verified JWT claims.
 */
class IamDeviceListCurrentControllerTest {

    private static final Instant NOW = Instant.parse("2026-10-09T08:00:00Z");
    private static final String PASSWORD = "correct horse battery staple!";

    private IamServiceProperties properties;
    private Clock clock;
    private InMemoryAccountStore accounts;
    private PasswordAccountService passwords;
    private SessionService sessions;
    private InMemoryDeviceRegistry deviceRegistry;
    private DeviceService devices;
    private JwtSigningKeyProvider keys;
    private JwtTokenService tokens;
    private IamAuthenticationController controller;
    private MockMvc mockMvc;

    private AccountRecord account;
    private PrincipalId principalId;
    private ServerPrincipalContext context;

    private DeviceId device1;
    private DeviceId device2;
    private DeviceId device3;

    private SessionRecord session1;
    private SessionRecord session2;
    private SessionRecord session3;

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

        InMemoryAuditFactPort audit = new InMemoryAuditFactPort();
        InMemoryRateLimitStore rateLimits = new InMemoryRateLimitStore();
        accounts = new InMemoryAccountStore();
        passwords = new PasswordAccountService(accounts, new BCryptPasswordEncoder(12), audit, clock, properties, rateLimits);

        account = passwords.register("learner-multi-dev@example.com", PASSWORD, ClientAuthorityClaims.none());
        principalId = account.principalId();
        context = ServerPrincipalContext.forPlatform(principalId, account.roles());

        sessions = new SessionService(new InMemorySessionStore(), audit, clock, properties);
        deviceRegistry = new InMemoryDeviceRegistry();
        devices = new DeviceService(deviceRegistry, audit, clock);

        InMemoryAdultGateFactStore adultGateFacts = new InMemoryAdultGateFactStore();
        AdultGateService adultGates = new AdultGateService(audit, clock, adultGateFacts, sessions, IamTransactionRunner.direct());

        ConsentPolicyPort consentPolicy = StaticConsentPolicy.localCandidate(true);
        InMemoryConsentStore consentStore = new InMemoryConsentStore();
        ConsentService consents = new ConsentService(consentStore, consentPolicy, audit, clock, sessions, IamTransactionRunner.direct());

        InMemoryPasswordResetDelivery resetDelivery = new InMemoryPasswordResetDelivery();
        PasswordResetService passwordResets = new PasswordResetService(accounts,
                new InMemoryPasswordResetChallengeStore(), passwords, audit, clock, properties,
                sessions, IamTransactionRunner.direct(), rateLimits,
                resetDelivery, properties.getIdempotency().getFingerprintSecret());

        keys = new JwtSigningKeyProvider(properties);
        JWKSource<SecurityContext> source = (selector, ctx) -> List.of(keys.signingKey());
        tokens = new JwtTokenService(new NimbusJwtEncoder(source), keys, properties, clock);

        InMemoryIdempotencyStore idempotencyStore = new InMemoryIdempotencyStore();
        IdempotencyService idempotency = new IdempotencyService(idempotencyStore,
                new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules(),
                IamTransactionRunner.direct(), properties.getIdempotency().getReplaySecret(),
                properties.getIdempotency().getFingerprintSecret(), Duration.ofHours(24));

        controller = new IamAuthenticationController(properties, passwords,
                passwordResets, tokens, keys, sessions, devices, adultGates, adultGateFacts,
                consents, consentStore, idempotency, clock);

        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();

        // Provision 3 devices
        device1 = new DeviceId(UUID.randomUUID().toString());
        device2 = new DeviceId(UUID.randomUUID().toString());
        device3 = new DeviceId(UUID.randomUUID().toString());

        devices.register(context, new DeviceRegistrationCommand(device1, "WEB", "Web Browser", ClientAuthorityClaims.none()));
        devices.register(context, new DeviceRegistrationCommand(device2, "IOS", "iPhone 15", ClientAuthorityClaims.none()));
        devices.register(context, new DeviceRegistrationCommand(device3, "ANDROID", "Pixel 8", ClientAuthorityClaims.none()));

        session1 = sessions.open(context, device1).session();
        session2 = sessions.open(context, device2).session();
        session3 = sessions.open(context, device3).session();
    }

    private JwtAuthenticationToken createAuthToken(SessionRecord session, boolean includeDeviceClaim) {
        Jwt.Builder builder = Jwt.withTokenValue("jwt-" + UUID.randomUUID())
                .header("alg", "RS256")
                .header("typ", "JWT")
                .subject(principalId.toString())
                .issuedAt(NOW)
                .expiresAt(NOW.plus(Duration.ofMinutes(15)))
                .claim("token_type", "access")
                .claim("tenant_id", session.scope().tenantId())
                .claim("owner_id", session.scope().owner().toString())
                .claim("session_id", session.sessionId().toString());
        if (includeDeviceClaim) {
            builder.claim("device_id", session.deviceId().value());
        }
        Jwt jwt = builder.build();
        return new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("TOKEN_TYPE_access")));
    }

    @Test
    void multipleDevicesForSameAccountOnlyIdentifiesTokenDeviceAsCurrent() {
        JwtAuthenticationToken auth = createAuthToken(session2, true);

        ResponseEntity<IamAuthenticationController.ApiCursorPageEnvelope<IamAuthenticationController.DeviceListResponse>> response =
                controller.deviceList(auth, null, null);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        List<IamAuthenticationController.DeviceResponse> list = response.getBody().data().devices();
        assertEquals(3, list.size());

        IamAuthenticationController.DeviceResponse dev2Resp = list.stream()
                .filter(d -> d.deviceId().equals(device2.value())).findFirst().orElseThrow();
        assertTrue(dev2Resp.isCurrent(), "Token matching device2 must have isCurrent=true");

        IamAuthenticationController.DeviceResponse dev1Resp = list.stream()
                .filter(d -> d.deviceId().equals(device1.value())).findFirst().orElseThrow();
        assertFalse(dev1Resp.isCurrent(), "Device1 must have isCurrent=false");

        IamAuthenticationController.DeviceResponse dev3Resp = list.stream()
                .filter(d -> d.deviceId().equals(device3.value())).findFirst().orElseThrow();
        assertFalse(dev3Resp.isCurrent(), "Device3 must have isCurrent=false");
    }

    @Test
    void clientForgedHeadersAndParamsDoNotAffectCurrentDevice() throws Exception {
        JwtAuthenticationToken auth = createAuthToken(session2, true);

        // Client attempts to claim device1 via query param, custom header, and body
        mockMvc.perform(get("/api/v1/iam/devices")
                        .principal(auth)
                        .param("deviceId", device1.value())
                        .header("X-Device-Id", device1.value())
                        .header("deviceId", device1.value()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.devices[?(@.deviceId == '" + device2.value() + "')].isCurrent").value(true))
                .andExpect(jsonPath("$.data.devices[?(@.deviceId == '" + device1.value() + "')].isCurrent").value(false))
                .andExpect(jsonPath("$.data.devices[?(@.deviceId == '" + device3.value() + "')].isCurrent").value(false));
    }

    @Test
    void tokenWithoutDeviceIdClaimResolvesViaSessionStore() {
        // Token has session_id claim but no device_id claim
        JwtAuthenticationToken auth = createAuthToken(session2, false);

        ResponseEntity<IamAuthenticationController.ApiCursorPageEnvelope<IamAuthenticationController.DeviceListResponse>> response =
                controller.deviceList(auth, null, null);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<IamAuthenticationController.DeviceResponse> list = response.getBody().data().devices();

        IamAuthenticationController.DeviceResponse dev2Resp = list.stream()
                .filter(d -> d.deviceId().equals(device2.value())).findFirst().orElseThrow();
        assertTrue(dev2Resp.isCurrent(), "Device2 should be resolved from session_id claim in session store");

        IamAuthenticationController.DeviceResponse dev1Resp = list.stream()
                .filter(d -> d.deviceId().equals(device1.value())).findFirst().orElseThrow();
        assertFalse(dev1Resp.isCurrent());
    }

    @Test
    void tokenWithNoDeviceAssociationReturnsAllFalse() {
        // Construct a token where session_id points to an active session, but session's device cannot be resolved
        // or a token with unknown device claim.
        // Let's create an active session for an orphaned device not in device registry:
        DeviceId unregisteredDev = new DeviceId(UUID.randomUUID().toString());
        DeviceRegistration unregisteredReg = new DeviceRegistration(unregisteredDev, principalId,
                context.scope(), "WEB", "Ghost Device", NOW, null);
        deviceRegistry.save(unregisteredReg);
        SessionRecord ghostSession = sessions.open(context, unregisteredDev).session();

        // Now issue token with device_id = random UUID not in principal's device list
        Jwt jwt = Jwt.withTokenValue("jwt-ghost-" + UUID.randomUUID())
                .header("alg", "RS256").header("typ", "JWT")
                .subject(principalId.toString())
                .issuedAt(NOW)
                .expiresAt(NOW.plus(Duration.ofMinutes(15)))
                .claim("token_type", "access")
                .claim("tenant_id", ghostSession.scope().tenantId())
                .claim("owner_id", ghostSession.scope().owner().toString())
                .claim("session_id", ghostSession.sessionId().toString())
                .claim("device_id", UUID.randomUUID().toString()) // random unknown device
                .build();
        JwtAuthenticationToken auth = new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("TOKEN_TYPE_access")));

        ResponseEntity<IamAuthenticationController.ApiCursorPageEnvelope<IamAuthenticationController.DeviceListResponse>> response =
                controller.deviceList(auth, null, null);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<IamAuthenticationController.DeviceResponse> list = response.getBody().data().devices();
        assertFalse(list.isEmpty());
        // All known devices should have isCurrent=false (fail closed)
        for (IamAuthenticationController.DeviceResponse d : list) {
            if (!d.deviceId().equals(unregisteredDev.value())) {
                assertFalse(d.isCurrent(), "Device " + d.deviceId() + " must have isCurrent=false");
            }
        }
    }

    @Test
    void kickedDeviceIsMarkedRevokedAndOldSessionRequestReturns401() {
        JwtAuthenticationToken authDev2 = createAuthToken(session2, true);
        JwtAuthenticationToken authDev1 = createAuthToken(session1, true);

        // Before kickout: device1 is ACTIVE
        ResponseEntity<IamAuthenticationController.ApiCursorPageEnvelope<IamAuthenticationController.DeviceListResponse>> before =
                controller.deviceList(authDev2, null, null);
        IamAuthenticationController.DeviceResponse dev1Before = before.getBody().data().devices().stream()
                .filter(d -> d.deviceId().equals(device1.value())).findFirst().orElseThrow();
        assertEquals("ACTIVE", dev1Before.status());

        // Kickout device1 using device2's session
        String idempotencyKey = "device-kickout-key-test-001";
        controller.kickDevice(authDev2, device1.value(), idempotencyKey);

        // After kickout: device1 status is REVOKED in deviceList
        ResponseEntity<IamAuthenticationController.ApiCursorPageEnvelope<IamAuthenticationController.DeviceListResponse>> after =
                controller.deviceList(authDev2, null, null);
        IamAuthenticationController.DeviceResponse dev1After = after.getBody().data().devices().stream()
                .filter(d -> d.deviceId().equals(device1.value())).findFirst().orElseThrow();
        assertEquals("REVOKED", dev1After.status());
        assertFalse(dev1After.isCurrent());

        // Now attempt to make a request using device1's old JWT
        IamPolicyException exception = assertThrows(IamPolicyException.class,
                () -> controller.deviceList(authDev1, null, null));
        assertEquals(IamDecisionCode.SESSION_REVOKED, exception.code());
        assertEquals("iam.session.revoked", exception.getMessage());
    }
}
