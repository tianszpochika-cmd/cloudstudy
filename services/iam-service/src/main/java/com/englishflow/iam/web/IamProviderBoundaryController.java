package com.englishflow.iam.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.englishflow.iam.config.IamServiceProperties;
import com.englishflow.iam.domain.DeviceId;
import com.englishflow.iam.domain.DeviceRegistration;
import com.englishflow.iam.domain.DeviceRegistrationCommand;
import com.englishflow.iam.domain.DeviceService;
import com.englishflow.iam.domain.AdultGateCommand;
import com.englishflow.iam.domain.AdultGateFact;
import com.englishflow.iam.domain.AdultGateFactStore;
import com.englishflow.iam.domain.AdultGateResult;
import com.englishflow.iam.domain.AdultGateService;
import com.englishflow.iam.domain.ClientAuthorityClaims;
import com.englishflow.iam.domain.ConsentCommand;
import com.englishflow.iam.domain.ConsentRecord;
import com.englishflow.iam.domain.ConsentService;
import com.englishflow.iam.domain.ConsentStore;
import com.englishflow.iam.domain.ConsentType;
import com.englishflow.iam.domain.ConsentVersion;
import com.englishflow.iam.domain.ExternalIdentity;
import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.domain.PrincipalMapping;
import com.englishflow.iam.domain.PrincipalMappingPort;
import com.englishflow.iam.domain.PrincipalMappingService;
import com.englishflow.iam.domain.ProviderSessionReference;
import com.englishflow.iam.domain.ServerPrincipalContext;
import com.englishflow.iam.domain.SessionRecord;
import com.englishflow.iam.domain.SessionRotationResult;
import com.englishflow.iam.domain.SessionId;
import com.englishflow.iam.domain.SessionService;
import com.englishflow.iam.domain.SessionStatus;
import com.englishflow.iam.domain.ServerPrincipalContext;
import com.englishflow.iam.domain.TrustedAgeEvidence;
import com.englishflow.iam.oidc.AuthorizationCallback;
import com.englishflow.iam.oidc.AuthorizationStartCommand;
import com.englishflow.iam.oidc.AuthorizationTransaction;
import com.englishflow.iam.oidc.AuthorizationTransactionPort;
import com.englishflow.iam.oidc.OidcAuthorizationRequest;
import com.englishflow.iam.oidc.OidcClientPort;
import com.englishflow.iam.oidc.OidcProviderMetadata;
import com.englishflow.iam.oidc.OidcTokenSet;
import com.englishflow.iam.oidc.TrustedIdpAgeClaim;
import com.englishflow.iam.oidc.VerifiedOidcIdentity;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.DeleteMapping;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** HTTP adapter for the external OIDC relying-party boundary. IAM never mints tokens. */
@RestController
@RequestMapping("/api/v1")
public class IamProviderBoundaryController {

    private static final Duration SESSION_COOKIE_MAX_AGE = Duration.ofDays(30);

    private final IamServiceProperties properties;
    private final OidcClientPort oidc;
    private final AuthorizationTransactionPort transactions;
    private final PrincipalMappingService principalMapping;
    private final PrincipalMappingPort mappings;
    private final SessionService sessions;
    private final DeviceService devices;
    private final AdultGateService adultGates;
    private final AdultGateFactStore adultGateFacts;
    private final ConsentService consents;
    private final ConsentStore consentStore;

    public IamProviderBoundaryController(
            IamServiceProperties properties,
            OidcClientPort oidc,
            AuthorizationTransactionPort transactions,
            PrincipalMappingService principalMapping,
            PrincipalMappingPort mappings,
            SessionService sessions,
            DeviceService devices,
            AdultGateService adultGates,
            AdultGateFactStore adultGateFacts,
            ConsentService consents,
            ConsentStore consentStore) {
        this.properties = Objects.requireNonNull(properties, "properties");
        this.oidc = Objects.requireNonNull(oidc, "oidc");
        this.transactions = Objects.requireNonNull(transactions, "transactions");
        this.principalMapping = Objects.requireNonNull(principalMapping, "principalMapping");
        this.mappings = Objects.requireNonNull(mappings, "mappings");
        this.sessions = Objects.requireNonNull(sessions, "sessions");
        this.devices = Objects.requireNonNull(devices, "devices");
        this.adultGates = Objects.requireNonNull(adultGates, "adultGates");
        this.adultGateFacts = Objects.requireNonNull(adultGateFacts, "adultGateFacts");
        this.consents = Objects.requireNonNull(consents, "consents");
        this.consentStore = Objects.requireNonNull(consentStore, "consentStore");
    }

    @GetMapping("/auth/oidc/{provider}/authorization/start")
    public ResponseEntity<AuthorizationStartResponse> authorizationStart(
            @PathVariable String provider,
            @RequestParam URI redirectUri,
            @RequestParam(defaultValue = "login") String intent,
            @RequestParam(required = false) String returnTo,
            @RequestParam(required = false) String uiLocale,
            @RequestParam(required = false) String theme) {
        if (!"login".equals(intent) && !"register".equals(intent)) {
            throw badRequest(IamDecisionCode.OIDC_PROVIDER_REJECTED, "iam.oidc.intent_invalid");
        }
        OidcAuthorizationRequest request = oidc.begin(new AuthorizationStartCommand(provider, redirectUri));
        Instant expiresAt = Instant.now().plus(transactionTtl());
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(new AuthorizationStartResponse(
                        authorizationUrl(request),
                        "oidc_tx_" + request.state(),
                        provider,
                        expiresAt,
                        intent));
    }

    @GetMapping("/auth/oidc/{provider}/callback")
    public ResponseEntity<Void> browserCallback(
            @PathVariable String provider,
            @RequestParam(required = false) String code,
            @RequestParam String state,
            @RequestParam(required = false) String error,
            @RequestParam(required = false) String errorDescription,
            @RequestParam(required = false) URI errorUri) {
        AuthorizationTransaction transaction = transactions.find(state)
                .orElseThrow(() -> new IamPolicyException(IamDecisionCode.OIDC_STATE_INVALID,
                        "iam.oidc.state_invalid"));
        CallbackResult result = complete(provider,
                new CallbackRequest(code, state, transaction.redirectUri(), error, errorDescription, errorUri));
        ResponseCookie cookie = sessionCookie(result.session());
        HttpHeaders headers = new HttpHeaders();
        headers.setLocation(transaction.redirectUri());
        headers.add(HttpHeaders.SET_COOKIE, cookie.toString());
        return new ResponseEntity<>(headers, HttpStatus.SEE_OTHER);
    }

    @PostMapping("/auth/oidc/{provider}/callback")
    public ResponseEntity<CallbackResponse> callback(
            @PathVariable String provider,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestBody CallbackRequest request) {
        CallbackResult result = complete(provider, request);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.SET_COOKIE, sessionCookie(result.session()).toString())
                .body(result.response());
    }

    @GetMapping("/auth/oidc/{provider}/metadata")
    public ResponseEntity<ProviderMetadataResponse> metadata(@PathVariable String provider) {
        OidcProviderMetadata metadata = oidc.metadata();
        requireProvider(provider, metadata);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new ProviderMetadataResponse(
                metadata.issuer(), metadata.authorizationEndpoint(), metadata.jwksUri(),
                metadata.codeChallengeMethods()));
    }

    @GetMapping("/auth/oidc/{provider}/jwks")
    public ResponseEntity<?> jwks(@PathVariable String provider) {
        OidcProviderMetadata metadata = oidc.metadata();
        requireProvider(provider, metadata);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(oidc.currentJwks());
    }

    @GetMapping("/iam/principal/me")
    public ResponseEntity<PrincipalResponse> principalMe(Authentication authentication) {
        PrincipalMapping mapping = authenticatedMapping(authentication);
        return ResponseEntity.ok(principalResponse(mapping, properties.getOidc().getProviderId()));
    }

    @PostMapping("/iam/session/refresh")
    public ResponseEntity<SessionTokenResponse> refresh(@RequestBody SessionRefreshRequest request) {
        if (request == null || request.refreshToken() == null || request.refreshToken().isBlank()) {
            throw badRequest(IamDecisionCode.OIDC_TOKEN_INVALID, "iam.oidc.refresh_token_missing");
        }
        SessionRotationResult rotation = sessions.rotateByRefreshToken(request.refreshToken());
        String accessToken = rotation.nextProviderAccessToken();
        if (accessToken == null || accessToken.isBlank()) {
            throw new IamPolicyException(IamDecisionCode.SESSION_PROVIDER_REJECTED,
                    "iam.session.provider_access_token_missing");
        }
        Instant now = Instant.now();
        long expiresIn = Math.max(1L, Duration.between(now, rotation.accessTokenExpiresAt()).toSeconds());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new SessionTokenResponse(
                accessToken,
                rotation.nextProviderRefreshToken(),
                expiresIn,
                SESSION_COOKIE_MAX_AGE.toSeconds(),
                rotation.deviceId().value(),
                rotation.sessionId().toString(),
                "Bearer",
                properties.getOidc().getExpectedIssuer()));
    }

    @PostMapping("/iam/session/logout")
    public ResponseEntity<SessionRevocationResponse> logout(
            Authentication authentication,
            @RequestHeader(value = "X-Session-Id", required = false) String headerSessionId,
            @CookieValue(value = "yuxuexing_session", required = false) String cookieSessionId,
            @RequestBody(required = false) LogoutRequest request) {
        PrincipalMapping mapping = authenticatedMapping(authentication);
        String sessionValue = firstNonBlank(headerSessionId, cookieSessionId);
        if (sessionValue == null) {
            throw new IamPolicyException(IamDecisionCode.SESSION_NOT_FOUND, "iam.session.not_found");
        }
        SessionRecord revoked = sessions.revokeOwned(
                mapping.principalId(), parseSessionId(sessionValue), "logout");
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(revocationResponse(revoked));
    }

    @PostMapping("/iam/sessions/{sessionId}/revoke")
    public ResponseEntity<SessionRevocationResponse> revoke(
            Authentication authentication,
            @PathVariable String sessionId) {
        PrincipalMapping mapping = authenticatedMapping(authentication);
        SessionRecord revoked = sessions.revokeOwned(
                mapping.principalId(), parseSessionId(sessionId), "explicit_revoke");
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(revocationResponse(revoked));
    }

    @GetMapping("/iam/permissions")
    public ResponseEntity<PermissionsResponse> permissions(Authentication authentication) {
        PrincipalMapping mapping = authenticatedMapping(authentication);
        AdultGateResponse gate = principalAdultGate(mapping);
        Set<String> providerRoles = providerRoles(authentication);
        List<String> roles = new ArrayList<>(List.of("learner"));
        List<String> permissions = new ArrayList<>(List.of(
                "learner.profile.read",
                "learner.profile.write",
                "learning.plan.read",
                "learning.plan.write",
                "assessment.session.read",
                "assessment.session.write",
                "content.read",
                "iam.self.read",
                "iam.self.write"));
        if (providerRoles.contains("content-editor")
                || providerRoles.contains("review-l1")
                || providerRoles.contains("review-l2")
                || providerRoles.contains("content-publisher")) {
            roles.add("content-admin");
            permissions.addAll(List.of("admin.content.read", "admin.content.write"));
        }
        if (providerRoles.contains("review-l1")) {
            permissions.add("admin.content.review.l1");
        }
        if (providerRoles.contains("review-l2")) {
            permissions.add("admin.content.review.l2");
        }
        if (providerRoles.contains("content-publisher")) {
            permissions.add("admin.content.publish");
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new PermissionsResponse(
                mapping.principalId().toString(),
                roles,
                permissions,
                gate,
                "b30-rbac-v1"));
    }

    @GetMapping("/iam/devices")
    public ResponseEntity<DeviceListResponse> deviceList(Authentication authentication) {
        PrincipalMapping mapping = authenticatedMapping(authentication);
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(
                mapping.principalId(), Set.of("learner"));
        List<DeviceResponse> items = devices.list(context).stream()
                .map(device -> deviceResponse(mapping, device))
                .toList();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(new DeviceListResponse(items, items.size()));
    }

    @PostMapping("/iam/devices/{deviceId}/kickout")
    public ResponseEntity<SessionRevocationResponse> kickDevice(
            Authentication authentication,
            @PathVariable String deviceId) {
        PrincipalMapping mapping = authenticatedMapping(authentication);
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(
                mapping.principalId(), Set.of("learner"));
        DeviceRegistration registration = devices.kick(context, new DeviceId(deviceId));
        SessionRecord session = sessions.findByDevice(mapping.principalId(), registration.deviceId()).stream()
                .findFirst()
                .orElseThrow(() -> new IamPolicyException(IamDecisionCode.SESSION_NOT_FOUND,
                        "iam.session.not_found"));
        SessionRecord revoked = session.status() == SessionStatus.REVOKED
                ? session : sessions.revokeOwned(mapping.principalId(), session.sessionId(), "device_kicked");
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(revocationResponse(revoked));
    }

    @PostMapping("/iam/adult-gate")
    public ResponseEntity<AdultGateResponse> adultGate(
            Authentication authentication,
            @RequestBody AdultGateRequest request) {
        PrincipalMapping mapping = authenticatedMapping(authentication);
        if (request == null || !request.adultDeclaration()) {
            throw new IamPolicyException(IamDecisionCode.ADULT_CONFIRMATION_REQUIRED,
                    "iam.adult_gate.confirmation_required");
        }
        if (!properties.isLocalAdultGateEnabled()) {
            throw new IamPolicyException(IamDecisionCode.ADULT_AGE_EVIDENCE_MISSING,
                    "iam.adult_gate.trusted_age_required");
        }
        int age = java.time.Year.now().getValue() - request.birthYear();
        AdultGateResult result = adultGates.evaluate(new AdultGateCommand(
                mapping.principalId(), true,
                TrustedAgeEvidence.fromServerAttestation(age, "local-test-idp-adult-declaration", Instant.now()),
                null, null, ClientAuthorityClaims.none()));
        if (!result.allowed()) {
            throw new IamPolicyException(result.code(), result.messageKey());
        }
        AdultGateFact fact = adultGateFacts.approve(
                mapping.principalId(), "b30-adult-v1", result.auditDecision().occurredAt());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(adultGateResponse(fact));
    }

    @GetMapping("/iam/consents")
    public ResponseEntity<ConsentListResponse> consentList(Authentication authentication) {
        PrincipalMapping mapping = authenticatedMapping(authentication);
        List<ConsentResponse> items = java.util.Arrays.stream(ConsentType.values())
                .map(type -> consentStore.find(mapping.principalId(), type)
                        .map(this::consentResponse)
                        .orElse(null))
                .filter(Objects::nonNull)
                .toList();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new ConsentListResponse(items));
    }

    @org.springframework.web.bind.annotation.PutMapping("/iam/consents")
    public ResponseEntity<ConsentResponse> updateConsent(
            Authentication authentication,
            @RequestBody ConsentUpdateRequest request) {
        PrincipalMapping mapping = authenticatedMapping(authentication);
        if (request == null || !request.accepted()) {
            throw new IamPolicyException(IamDecisionCode.CONSENT_REQUIRES_EXPLICIT_ACCEPTANCE,
                    "iam.consent.explicit_acceptance_required");
        }
        ConsentRecord record = consents.record(
                ServerPrincipalContext.forPlatform(mapping.principalId(), Set.of("learner")),
                        new ConsentCommand(request.type(), new ConsentVersion(request.version()), true,
                        ClientAuthorityClaims.none()));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(consentResponse(record));
    }

    private CallbackResult complete(String provider, CallbackRequest request) {
        if (request == null || request.error() != null && !request.error().isBlank()) {
            throw new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_REJECTED, "iam.oidc.provider_denied");
        }
        if (request.code() == null || request.code().isBlank() || request.state() == null
                || request.state().isBlank() || request.redirectUri() == null) {
            throw badRequest(IamDecisionCode.OIDC_TOKEN_INVALID, "iam.oidc.callback_invalid");
        }
        OidcTokenSet tokenSet = oidc.completeForSession(
                new AuthorizationCallback(provider, request.state(), request.code(), request.redirectUri()));
        VerifiedOidcIdentity identity = tokenSet.identity();
        PrincipalMapping mapping = principalMapping.mapVerifiedIdentity(identity);
        ProviderSessionReference reference = tokenSet.providerSessionReference().orElseThrow(() ->
                new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_REJECTED,
                        "iam.oidc.session_reference_missing"));
        String refreshToken = tokenSet.refreshToken().orElseThrow(() ->
                new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_REJECTED,
                        "iam.oidc.refresh_token_missing"));
        DeviceId deviceId = new DeviceId(UUID.randomUUID().toString());
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(mapping.principalId(),
                java.util.Set.of("learner"));
        devices.register(context, new DeviceRegistrationCommand(
                deviceId, devicePlatform(request.redirectUri()), "browser", ClientAuthorityClaims.none()));
        SessionRecord session = sessions.open(
                context, deviceId, oidc.metadata().issuer(), oidc.clientIdForRedirect(request.redirectUri()),
                reference, refreshToken);
        String accessToken = tokenSet.accessToken().orElseThrow(() ->
                new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_REJECTED,
                        "iam.oidc.access_token_missing"));
        Instant accessTokenExpiresAt = tokenSet.accessTokenExpiresAt().orElseThrow(() ->
                new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_REJECTED,
                        "iam.oidc.expiry_missing"));
        return new CallbackResult(session, callbackResponse(
                mapping, session, identity, accessToken, refreshToken, accessTokenExpiresAt));
    }

    private CallbackResponse callbackResponse(
            PrincipalMapping mapping,
            SessionRecord session,
            VerifiedOidcIdentity identity,
            String accessToken,
            String refreshToken,
            Instant accessTokenExpiresAt) {
        AdultGateResponse adultGate = adultGate(identity);
        ConsentState consent = principalConsent(mapping);
        return new CallbackResponse(
                new SessionEstablished(
                        session.sessionId().toString(), session.deviceId().value(),
                        properties.getOidc().getProviderId(), "ACTIVE", session.createdAt(),
                        session.createdAt().plus(SESSION_COOKIE_MAX_AGE), accessToken, refreshToken,
                        accessTokenExpiresAt, "Bearer", oidc.metadata().issuer()),
                principalResponse(mapping, properties.getOidc().getProviderId(), adultGate, consent),
                adultGate,
                consent);
    }

    private PrincipalResponse principalResponse(PrincipalMapping mapping, String provider) {
        return principalResponse(mapping, provider,
                principalAdultGate(mapping),
                principalConsent(mapping));
    }

    private ConsentState principalConsent(PrincipalMapping mapping) {
        final String currentVersion = "b30-consent-v1";
        return new ConsentState(true, consents.hasAllRequiredConsent(mapping.principalId()), currentVersion);
    }

    private PrincipalResponse principalResponse(
            PrincipalMapping mapping,
            String provider,
            AdultGateResponse adultGate,
            ConsentState consent) {
        return new PrincipalResponse(
                mapping.principalId().toString(), "ADULT_LEARNER", provider,
                adultGate.status().equals("APPROVED") && consent.accepted() ? "ACTIVE" : "RESTRICTED",
                adultGate, consent, "b30-rbac-v1");
    }

    private AdultGateResponse adultGate(VerifiedOidcIdentity identity) {
        Optional<TrustedIdpAgeClaim> claim = identity.trustedAgeClaim();
        if (claim.isEmpty()) {
            return new AdultGateResponse("PENDING", "b30-adult-v1", identity.verifiedAt(), true);
        }
        return new AdultGateResponse(
                claim.get().age() >= 18 ? "APPROVED" : "REJECTED",
                "b30-adult-v1", claim.get().verifiedAt(), claim.get().age() < 18);
    }

    private AdultGateResponse principalAdultGate(PrincipalMapping mapping) {
        return adultGateResponse(adultGateFacts.find(mapping.principalId(), mapping.createdAt()));
    }

    private static AdultGateResponse adultGateResponse(AdultGateFact fact) {
        return new AdultGateResponse(fact.status(), fact.policyVersion(), fact.evaluatedAt(), fact.retryAllowed());
    }

    private PrincipalMapping authenticatedMapping(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken jwt)) {
            throw new IamPolicyException(IamDecisionCode.OIDC_TOKEN_INVALID, "iam.unauthorized");
        }
        java.net.URL issuerUrl = jwt.getToken().getIssuer();
        URI issuer = issuerUrl == null ? null : URI.create(issuerUrl.toString());
        String subject = jwt.getToken().getSubject();
        if (issuer == null || subject == null || subject.isBlank()) {
            throw new IamPolicyException(IamDecisionCode.OIDC_IDENTITY_INVALID, "iam.oidc.identity_invalid");
        }
        return mappings.findByExternalIdentity(new ExternalIdentity(issuer, subject))
                .orElseThrow(() -> new IamPolicyException(IamDecisionCode.OIDC_IDENTITY_INVALID,
                        "iam.principal.not_mapped"));
    }

    private static Set<String> providerRoles(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken jwt)) {
            return Set.of();
        }
        Set<String> roles = new LinkedHashSet<>();
        addClaimValues(jwt.getToken().getClaims().get("roles"), roles);
        addNestedClaimValues(jwt.getToken().getClaims().get("realm_access"), roles);
        addNestedClaimValues(jwt.getToken().getClaims().get("resource_access"), roles);
        return Set.copyOf(roles);
    }

    private static void addNestedClaimValues(Object value, Set<String> target) {
        if (!(value instanceof Map<?, ?> map)) {
            return;
        }
        addClaimValues(map.get("roles"), target);
        for (Object nested : map.values()) {
            if (nested instanceof Map<?, ?> nestedMap) {
                addClaimValues(nestedMap.get("roles"), target);
            }
        }
    }

    private static void addClaimValues(Object value, Set<String> target) {
        if (value instanceof java.util.Collection<?> values) {
            values.stream()
                    .filter(String.class::isInstance)
                    .map(String.class::cast)
                    .filter(item -> !item.isBlank())
                    .forEach(target::add);
        } else if (value instanceof String string && !string.isBlank()) {
            for (String item : string.split("[ ,]+")) {
                if (!item.isBlank()) {
                    target.add(item);
                }
            }
        }
    }

    private AdultGateResponse adultGateResponse(PrincipalMapping mapping) {
        return principalAdultGate(mapping);
    }

    private DeviceResponse deviceResponse(PrincipalMapping mapping, DeviceRegistration device) {
        String sessionId = sessions.findByDevice(mapping.principalId(), device.deviceId()).stream()
                .filter(session -> session.status() == SessionStatus.ACTIVE)
                .findFirst()
                .map(session -> session.sessionId().toString())
                .orElse("");
        return new DeviceResponse(
                device.deviceId().value(), sessionId, normalizePlatform(device.platform()),
                device.active() ? "ACTIVE" : "REVOKED", device.registeredAt(), true);
    }

    private SessionRevocationResponse revocationResponse(SessionRecord session) {
        return new SessionRevocationResponse(
                session.sessionId().toString(), "REVOKED",
                session.revokedAt() == null ? Instant.now() : session.revokedAt());
    }

    private ConsentResponse consentResponse(ConsentRecord record) {
        return new ConsentResponse(
                consentWireType(record.type()), record.version().value(),
                record.accepted() ? "ACCEPTED" : "WITHDRAWN", record.recordedAt());
    }

    private static String consentWireType(ConsentType type) {
        return type == ConsentType.TERMS_OF_SERVICE ? "TERMS" : "PRIVACY";
    }

    private static String devicePlatform(URI redirectUri) {
        if (redirectUri != null && "englishflow".equalsIgnoreCase(redirectUri.getScheme())) {
            return "ANDROID";
        }
        return "WEB";
    }

    private static String normalizePlatform(String platform) {
        return switch (platform.toUpperCase(java.util.Locale.ROOT)) {
            case "ANDROID", "IOS", "WEB", "PWA", "MINIAPP" -> platform.toUpperCase(java.util.Locale.ROOT);
            default -> "WEB";
        };
    }

    private static String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) return first;
        if (second != null && !second.isBlank()) return second;
        return null;
    }

    private static SessionId parseSessionId(String value) {
        try {
            return new SessionId(UUID.fromString(value));
        } catch (RuntimeException exception) {
            throw new IamPolicyException(IamDecisionCode.SESSION_NOT_FOUND, "iam.session.not_found");
        }
    }

    private ResponseCookie sessionCookie(SessionRecord session) {
        return ResponseCookie.from("yuxuexing_session", session.sessionId().toString())
                .httpOnly(true).secure(false).sameSite("Lax").path("/")
                .maxAge(SESSION_COOKIE_MAX_AGE).build();
    }

    private String authorizationUrl(OidcAuthorizationRequest request) {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("response_type", "code");
        values.put("client_id", request.clientId());
        values.put("redirect_uri", request.redirectUri().toString());
        values.put("scope", String.join(" ", request.scopes()));
        values.put("state", request.state());
        values.put("nonce", request.nonce());
        values.put("code_challenge", request.codeChallenge());
        values.put("code_challenge_method", "S256");
        String query = values.entrySet().stream()
                .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
                .reduce((left, right) -> left + "&" + right).orElseThrow();
        return request.authorizationEndpoint() + "?" + query;
    }

    private Duration transactionTtl() {
        Duration value = properties.getOidc().getTransactionTtl();
        return value == null || value.isNegative() || value.isZero() ? Duration.ofMinutes(5) : value;
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static void requireProvider(String provider, OidcProviderMetadata metadata) {
        if (!provider.equals("standard-oidc") && !provider.equals("local-idp")
                && !provider.equals(metadata.clientId())) {
            throw new IamPolicyException(IamDecisionCode.OIDC_PROVIDER_REJECTED, "iam.oidc.provider_rejected");
        }
    }

    private static IamPolicyException badRequest(IamDecisionCode code, String message) {
        return new IamPolicyException(code, message);
    }

    @ExceptionHandler(IamPolicyException.class)
    public ResponseEntity<ErrorEnvelope> handlePolicy(
            IamPolicyException exception,
            HttpServletRequest request) {
        HttpStatus status = switch (exception.code()) {
            case OIDC_PROVIDER_NOT_CONFIGURED, OIDC_PROVIDER_UNAVAILABLE,
                    IAM_PERSISTENCE_UNAVAILABLE, AUDIT_UNAVAILABLE -> HttpStatus.SERVICE_UNAVAILABLE;
            case OIDC_CALLBACK_REPLAY, PRINCIPAL_MAPPING_CONFLICT -> HttpStatus.CONFLICT;
            case ADULT_CONFIRMATION_REQUIRED, ADULT_AGE_BELOW_MINIMUM,
                    ADULT_AGE_EVIDENCE_MISSING, CLIENT_AUTHORITY_OVERRIDE -> HttpStatus.FORBIDDEN;
            case SESSION_NOT_FOUND, SESSION_REVOKED, SESSION_REPLAY,
                    SESSION_PROVIDER_REJECTED, SESSION_STORE_UNAVAILABLE -> HttpStatus.UNAUTHORIZED;
            case OIDC_TOKEN_INVALID, OIDC_IDENTITY_INVALID -> HttpStatus.UNAUTHORIZED;
            default -> HttpStatus.BAD_REQUEST;
        };
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(
                ErrorEnvelope.of(request, exception.code().wireValue(), exception.messageKey(),
                        status.is5xxServerError()));
    }

    public record AuthorizationStartResponse(
            String authorizationUrl, String transactionId, String provider,
            Instant expiresAt, String intent) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CallbackRequest(
            String code, String state, URI redirectUri, String error,
            String errorDescription, URI errorUri) {}

    public record CallbackResponse(
            SessionEstablished session, PrincipalResponse principal,
            AdultGateResponse adultGate, ConsentState consentState) {}

    public record SessionEstablished(
            String sessionId, String deviceId, String provider, String status,
            Instant establishedAt, Instant expiresAt, String accessToken, String refreshToken,
            Instant accessTokenExpiresAt, String tokenType, URI issuer) {}

    public record SessionRefreshRequest(String refreshToken) {}

    public record SessionTokenResponse(
            String accessToken, String refreshToken, long expiresIn, long refreshExpiresIn,
            String deviceId, String sessionId, String tokenType, String issuer) {}

    public record LogoutRequest(Boolean allDevices) {}

    public record SessionRevocationResponse(String sessionId, String status, Instant revokedAt) {}

    public record PermissionsResponse(
            String principalId, List<String> roles, List<String> permissions,
            AdultGateResponse adultGate, String policyVersion) {}

    public record DeviceResponse(
            String deviceId, String sessionId, String platform, String status,
            Instant lastActiveAt, boolean current) {}

    public record DeviceListResponse(List<DeviceResponse> items, int total) {}

    public record AdultGateRequest(int birthYear, String policyVersion, boolean adultDeclaration) {}

    public record ConsentListResponse(List<ConsentResponse> items) {}

    public record ConsentUpdateRequest(String consentType, String consentVersion, String decision) {
        boolean accepted() {
            return "ACCEPTED".equalsIgnoreCase(decision);
        }

        String version() {
            return consentVersion;
        }

        ConsentType type() {
            return switch (consentType == null ? "" : consentType.toUpperCase(java.util.Locale.ROOT)) {
                case "TERMS", "TERMS_OF_SERVICE" -> ConsentType.TERMS_OF_SERVICE;
                case "PRIVACY", "PRIVACY_NOTICE" -> ConsentType.PRIVACY_NOTICE;
                default -> throw new IamPolicyException(IamDecisionCode.CONSENT_VERSION_MISMATCH,
                        "iam.consent.type_invalid");
            };
        }
    }

    public record ConsentResponse(
            String consentType, String consentVersion, String decision, Instant updatedAt) {}

    public record PrincipalResponse(
            String principalId, String subjectType, String provider, String status,
            AdultGateResponse adultGate, ConsentState consentState, String policyVersion) {}

    public record AdultGateResponse(
            String status, String policyVersion, Instant evaluatedAt, boolean retryAllowed) {}

    public record ConsentState(boolean required, boolean accepted, String version) {}

    public record ProviderMetadataResponse(
            URI issuer, URI authorizationEndpoint, URI jwksUri,
            java.util.Set<String> codeChallengeMethods) {}

    public record ErrorEnvelope(String requestId, String traceId, ErrorDetail error) {
        static ErrorEnvelope of(HttpServletRequest request, String code, String message, boolean retryable) {
            return new ErrorEnvelope(
                    headerOrUuid(request.getHeader("X-Request-Id")),
                    headerOrUuid(request.getHeader("X-Trace-Id")),
                    new ErrorDetail(code, message, retryable));
        }

        private static String headerOrUuid(String value) {
            return value == null || value.isBlank() ? UUID.randomUUID().toString() : value;
        }
    }

    public record ErrorDetail(String code, String message, boolean retryable) {}

    private record CallbackResult(SessionRecord session, CallbackResponse response) {}
}
