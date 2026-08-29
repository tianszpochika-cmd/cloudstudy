package com.englishflow.iam.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.englishflow.iam.auth.JwtSigningKeyProvider;
import com.englishflow.iam.auth.JwtTokenService;
import com.englishflow.iam.config.IamServiceProperties;
import com.englishflow.iam.domain.AccountRecord;
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
import com.englishflow.iam.domain.DeviceId;
import com.englishflow.iam.domain.DeviceRegistration;
import com.englishflow.iam.domain.DeviceRegistrationCommand;
import com.englishflow.iam.domain.DeviceService;
import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.domain.PasswordAccountService;
import com.englishflow.iam.domain.PasswordResetService;
import com.englishflow.iam.domain.PrincipalId;
import com.englishflow.iam.domain.ServerPrincipalContext;
import com.englishflow.iam.domain.SessionId;
import com.englishflow.iam.domain.SessionRecord;
import com.englishflow.iam.domain.SessionRotationResult;
import com.englishflow.iam.domain.SessionService;
import com.englishflow.iam.domain.SessionStatus;
import com.englishflow.iam.domain.TrustedAgeEvidence;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.time.Year;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/** HTTP adapter for the platform-owned account/password and JWT authentication center. */
@RestController
@RequestMapping("/api/v1")
class IamAuthenticationController {
    private final IamServiceProperties properties;
    private final PasswordAccountService passwords;
    private final PasswordResetService passwordResets;
    private final JwtTokenService tokens;
    private final JwtSigningKeyProvider keys;
    private final SessionService sessions;
    private final DeviceService devices;
    private final AdultGateService adultGates;
    private final AdultGateFactStore adultGateFacts;
    private final ConsentService consents;
    private final ConsentStore consentStore;

    IamAuthenticationController(IamServiceProperties properties, PasswordAccountService passwords,
                                         PasswordResetService passwordResets, JwtTokenService tokens,
                                         JwtSigningKeyProvider keys, SessionService sessions,
                                         DeviceService devices, AdultGateService adultGates,
                                         AdultGateFactStore adultGateFacts, ConsentService consents,
                                         ConsentStore consentStore) {
        this.properties = Objects.requireNonNull(properties, "properties");
        this.passwords = Objects.requireNonNull(passwords, "passwords");
        this.passwordResets = Objects.requireNonNull(passwordResets, "passwordResets");
        this.tokens = Objects.requireNonNull(tokens, "tokens");
        this.keys = Objects.requireNonNull(keys, "keys");
        this.sessions = Objects.requireNonNull(sessions, "sessions");
        this.devices = Objects.requireNonNull(devices, "devices");
        this.adultGates = Objects.requireNonNull(adultGates, "adultGates");
        this.adultGateFacts = Objects.requireNonNull(adultGateFacts, "adultGateFacts");
        this.consents = Objects.requireNonNull(consents, "consents");
        this.consentStore = Objects.requireNonNull(consentStore, "consentStore");
    }

    @PostMapping("/auth/register")
    public ResponseEntity<AuthTokenResponse> register(@RequestBody RegisterRequest request,
                                                      @RequestHeader(value = "X-Client-Platform", required = false) String clientPlatform,
                                                      @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        requireIdempotencyKey(idempotencyKey);
        requireRequest(request);
        AccountRecord account = passwords.register(request.identifier(), request.password(), ClientAuthorityClaims.none());
        return establish(account, request.device(), clientPlatform, HttpStatus.CREATED);
    }

    @PostMapping("/auth/login")
    public ResponseEntity<AuthTokenResponse> login(@RequestBody LoginRequest request,
                                                   @RequestHeader(value = "X-Client-Platform", required = false) String clientPlatform,
                                                   @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        requireIdempotencyKey(idempotencyKey);
        requireRequest(request);
        AccountRecord account = passwords.authenticate(request.identifier(), request.password());
        return establish(account, request.device(), clientPlatform, HttpStatus.OK);
    }

    @PostMapping("/auth/token/refresh")
    public ResponseEntity<AuthTokenResponse> refresh(@RequestBody(required = false) RefreshRequest request,
                                                     HttpServletRequest httpRequest,
                                                     @RequestHeader(value = "X-Client-Platform", required = false) String clientPlatform,
                                                     @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        requireIdempotencyKey(idempotencyKey);
        String refreshCookie = readRefreshCookie(httpRequest);
        String presented = isNative(clientPlatform)
                ? bodyRefresh(request)
                : (refreshCookie != null && !refreshCookie.isBlank() ? refreshCookie : bodyRefresh(request));
        SessionRotationResult rotation = sessions.rotateByRefreshToken(presented);
        AccountRecord account = passwords.find(rotation.principalId());
        SessionRecord session = sessions.find(rotation.sessionId());
        JwtTokenService.IssuedAccessToken access = tokens.issue(account, session);
        AuthTokenResponse body = tokenResponse(access, rotation.nextRefreshToken(), session, isNative(clientPlatform));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header(HttpHeaders.SET_COOKIE, refreshCookie(session, rotation.nextRefreshToken()).toString())
                .body(body);
    }

    @PostMapping("/auth/logout")
    public ResponseEntity<SessionRevocationResponse> logout(Authentication authentication,
                                                            @RequestBody(required = false) LogoutRequest request,
                                                            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        requireIdempotencyKey(idempotencyKey);
        Jwt jwt = verifiedJwt(authentication);
        PrincipalId principal = principalId(jwt);
        boolean allDevices = request != null && Boolean.TRUE.equals(request.allDevices());
        if (allDevices) {
            sessions.revokeAll(principal, "logout_all_devices");
            return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                    .header(HttpHeaders.SET_COOKIE, clearRefreshCookie().toString())
                    .body(new SessionRevocationResponse(sessionClaim(jwt), "REVOKED", Instant.now()));
        }
        SessionRecord revoked = sessions.revokeOwned(principal, sessionId(jwt), "logout");
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header(HttpHeaders.SET_COOKIE, clearRefreshCookie().toString())
                .body(revocationResponse(revoked));
    }

    @PostMapping("/auth/sessions/{sessionId}/revoke")
    public ResponseEntity<SessionRevocationResponse> revoke(Authentication authentication,
                                                             @PathVariable String sessionId,
                                                             @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        requireIdempotencyKey(idempotencyKey);
        SessionRecord revoked = sessions.revokeOwned(principalId(verifiedJwt(authentication)),
                parseSessionId(sessionId), "explicit_revoke");
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(revocationResponse(revoked));
    }

    @GetMapping("/auth/jwks")
    public ResponseEntity<Map<String, Object>> jwks() {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(Map.of("keys", keys.publicJwks()));
    }

    @PostMapping("/auth/password-reset/request")
    public ResponseEntity<AcceptedResponse> resetRequest(@RequestBody PasswordResetRequest request,
                                                         @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        requireIdempotencyKey(idempotencyKey);
        if (request != null) passwordResets.request(request.identifier());
        return ResponseEntity.status(HttpStatus.ACCEPTED).cacheControl(CacheControl.noStore())
                .body(new AcceptedResponse("If the account exists, a reset message will be delivered."));
    }

    @PostMapping("/auth/password-reset/confirm")
    public ResponseEntity<Void> resetConfirm(@RequestBody PasswordResetConfirmRequest request,
                                             @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        requireIdempotencyKey(idempotencyKey);
        if (request == null) throw badRequest("iam.password_reset.invalid");
        AccountRecord account = passwordResets.confirm(request.identifier(), request.resetToken(), request.newPassword());
        sessions.revokeAll(account.principalId(), "password_reset");
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    @GetMapping("/iam/principal/me")
    public ResponseEntity<PrincipalResponse> principalMe(Authentication authentication) {
        Jwt jwt = verifiedJwt(authentication);
        AccountRecord account = passwords.find(principalId(jwt));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(principalResponse(account, jwt));
    }

    @GetMapping("/iam/permissions")
    public ResponseEntity<PermissionsResponse> permissions(Authentication authentication) {
        AccountRecord account = passwords.find(principalId(verifiedJwt(authentication)));
        AdultGateResponse gate = adultGateResponse(adultGateFacts.find(account.principalId(), account.createdAt()));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new PermissionsResponse(
                account.principalId().toString(), List.copyOf(account.roles()), List.copyOf(account.permissions()),
                gate, "b30-rbac-v1"));
    }

    @GetMapping("/iam/devices")
    public ResponseEntity<DeviceListResponse> deviceList(Authentication authentication) {
        AccountRecord account = passwords.find(principalId(verifiedJwt(authentication)));
        List<DeviceResponse> items = devices.list(ServerPrincipalContext.forPlatform(account.principalId(), account.roles()))
                .stream().map(device -> deviceResponse(account.principalId(), device)).toList();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new DeviceListResponse(items));
    }

    @PostMapping("/iam/devices/{deviceId}/kickout")
    public ResponseEntity<SessionRevocationResponse> kickDevice(Authentication authentication,
                                                                 @PathVariable String deviceId,
                                                                 @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        requireIdempotencyKey(idempotencyKey);
        AccountRecord account = passwords.find(principalId(verifiedJwt(authentication)));
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(account.principalId(), account.roles());
        DeviceRegistration registration = devices.kick(context, new DeviceId(deviceId));
        List<SessionRecord> revoked = sessions.findByDevice(account.principalId(), registration.deviceId()).stream()
                .filter(session -> session.status() == SessionStatus.ACTIVE)
                .map(session -> sessions.revoke(session.sessionId(), "device_kicked")).toList();
        SessionRecord last = revoked.isEmpty()
                ? sessions.findByDevice(account.principalId(), registration.deviceId()).stream().findFirst()
                    .orElseThrow(() -> new IamPolicyException(IamDecisionCode.SESSION_NOT_FOUND, "iam.session.not_found"))
                : revoked.getLast();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(revocationResponse(last));
    }

    @PostMapping("/iam/adult-gate")
    public ResponseEntity<AdultGateResponse> adultGate(Authentication authentication, @RequestBody AdultGateRequest request,
                                                       @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        requireIdempotencyKey(idempotencyKey);
        PrincipalId principal = principalId(verifiedJwt(authentication));
        if (request == null || !request.confirmed()) throw new IamPolicyException(
                IamDecisionCode.ADULT_CONFIRMATION_REQUIRED, "iam.adult_gate.confirmation_required");
        if (!properties.isLocalAdultGateEnabled()) throw new IamPolicyException(
                IamDecisionCode.ADULT_AGE_EVIDENCE_MISSING, "iam.adult_gate.trusted_age_required");
        int age = Year.now().getValue() - request.birthYear();
        AdultGateResult result = adultGates.evaluate(new AdultGateCommand(principal, true,
                TrustedAgeEvidence.fromServerAttestation(age, "local-development-attestation", Instant.now()),
                null, null, ClientAuthorityClaims.none()));
        if (!result.allowed()) throw new IamPolicyException(result.code(), result.messageKey());
        AdultGateFact fact = adultGateFacts.approve(principal, "b30-adult-v1", result.auditDecision().occurredAt());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(adultGateResponse(fact));
    }

    @GetMapping("/iam/consents")
    public ResponseEntity<ConsentListResponse> consentList(Authentication authentication) {
        PrincipalId principal = principalId(verifiedJwt(authentication));
        List<ConsentResponse> items = Arrays.stream(ConsentType.values())
                .map(type -> consentStore.find(principal, type).map(this::consentResponse).orElse(null))
                .filter(Objects::nonNull).toList();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new ConsentListResponse(items));
    }

    @PutMapping("/iam/consents")
    public ResponseEntity<ConsentResponse> updateConsent(Authentication authentication,
                                                         @RequestBody ConsentUpdateRequest request,
                                                         @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        requireIdempotencyKey(idempotencyKey);
        PrincipalId principal = principalId(verifiedJwt(authentication));
        if (request == null || !request.accepted()) throw new IamPolicyException(
                IamDecisionCode.CONSENT_REQUIRES_EXPLICIT_ACCEPTANCE, "iam.consent.explicit_acceptance_required");
        ConsentRecord record = consents.record(ServerPrincipalContext.forPlatform(principal, Set.of("learner")),
                new ConsentCommand(request.consentType(), new ConsentVersion(request.version()), true, ClientAuthorityClaims.none()));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(consentResponse(record));
    }

    private ResponseEntity<AuthTokenResponse> establish(AccountRecord account, DeviceInput input,
                                                         String clientPlatform, HttpStatus status) {
        DeviceInput device = input == null ? new DeviceInput(null, "WEB", "browser", null, "local") : input;
        DeviceId deviceId = device.deviceId() == null || device.deviceId().isBlank()
                ? new DeviceId(UUID.randomUUID().toString()) : new DeviceId(device.deviceId());
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(account.principalId(), account.roles());
        devices.register(context, new DeviceRegistrationCommand(deviceId, normalizePlatform(device.deviceType()),
                safeLabel(device.deviceName()), ClientAuthorityClaims.none()));
        SessionService.SessionCreation creation = sessions.open(context, deviceId);
        JwtTokenService.IssuedAccessToken access = tokens.issue(account, creation.session());
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.SET_COOKIE, refreshCookie(creation.session(), creation.refreshToken()).toString())
                .body(tokenResponse(access, creation.refreshToken(), creation.session(), isNative(clientPlatform, device.deviceType())));
    }

    private AuthTokenResponse tokenResponse(JwtTokenService.IssuedAccessToken access, String refresh,
                                            SessionRecord session, boolean nativeClient) {
        long accessSeconds = Math.max(1, Duration.between(access.issuedAt(), access.expiresAt()).toSeconds());
        long refreshSeconds = Math.max(1, Duration.between(Instant.now(), session.expiresAt()).toSeconds());
        return new AuthTokenResponse(access.value(), nativeClient ? refresh : null, "Bearer", accessSeconds,
                refreshSeconds, session.sessionId().toString(), session.deviceId().value());
    }

    private ResponseCookie refreshCookie(SessionRecord session, String value) {
        return ResponseCookie.from(properties.getJwt().getRefreshCookieName(), value).httpOnly(true)
                .secure(properties.getJwt().isRefreshCookieSecure()).sameSite("Lax").path("/api/v1/auth")
                .maxAge(Math.max(0, Duration.between(Instant.now(), session.expiresAt()).getSeconds())).build();
    }
    private ResponseCookie clearRefreshCookie() {
        return ResponseCookie.from(properties.getJwt().getRefreshCookieName(), "").httpOnly(true)
                .secure(properties.getJwt().isRefreshCookieSecure()).sameSite("Lax").path("/api/v1/auth").maxAge(0).build();
    }

    private Jwt verifiedJwt(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken token)) throw new IamPolicyException(
                IamDecisionCode.JWT_TOKEN_TYPE_INVALID, "iam.unauthorized");
        return token.getToken();
    }
    private PrincipalId principalId(Jwt jwt) {
        try { return new PrincipalId(UUID.fromString(jwt.getSubject())); }
        catch (RuntimeException exception) { throw new IamPolicyException(IamDecisionCode.PRINCIPAL_NOT_FOUND, "iam.principal.not_found"); }
    }
    private static SessionId sessionId(Jwt jwt) { try { return new SessionId(UUID.fromString(sessionClaim(jwt))); } catch (RuntimeException e) { throw new IamPolicyException(IamDecisionCode.SESSION_NOT_FOUND, "iam.session.not_found"); } }
    private static String sessionClaim(Jwt jwt) { String value = jwt.getClaimAsString("session_id"); if (value == null || value.isBlank()) throw new IamPolicyException(IamDecisionCode.SESSION_NOT_FOUND, "iam.session.not_found"); return value; }
    private static SessionId parseSessionId(String value) { try { return new SessionId(UUID.fromString(value)); } catch (RuntimeException e) { throw new IamPolicyException(IamDecisionCode.SESSION_NOT_FOUND, "iam.session.not_found"); } }
    private static void requireRequest(LoginRequest request) { if (request == null) throw badRequest("iam.request.invalid"); }
    private static void requireRequest(RegisterRequest request) { if (request == null) throw badRequest("iam.request.invalid"); }
    private static void requireIdempotencyKey(String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() < 16 || idempotencyKey.length() > 128) {
            throw badRequest("iam.idempotency.invalid");
        }
    }
    private static IamPolicyException badRequest(String key) { return new IamPolicyException(IamDecisionCode.INVALID_REQUEST, key); }
    private static String bodyRefresh(RefreshRequest request) { if (request == null || request.refreshToken() == null || request.refreshToken().isBlank()) throw new IamPolicyException(IamDecisionCode.SESSION_NOT_FOUND, "iam.session.not_found"); return request.refreshToken(); }
    private String readRefreshCookie(HttpServletRequest request) {
        if (request == null || request.getCookies() == null) return null;
        String expectedName = properties.getJwt().getRefreshCookieName();
        return Arrays.stream(request.getCookies())
                .filter(cookie -> expectedName.equals(cookie.getName()))
                .map(cookie -> cookie.getValue())
                .filter(value -> value != null && !value.isBlank())
                .findFirst().orElse(null);
    }
    private static boolean isNative(String platform) { return platform != null && Set.of("mobile", "native", "ios", "android").contains(platform.toLowerCase(java.util.Locale.ROOT)); }
    private static boolean isNative(String platform, String deviceType) { return isNative(platform) || Set.of("IOS", "ANDROID", "IPAD").contains(normalizePlatform(deviceType)); }
    private static String normalizePlatform(String value) { String upper = value == null ? "WEB" : value.toUpperCase(java.util.Locale.ROOT); return switch (upper) { case "IOS", "ANDROID", "WEB", "H5", "IPAD" -> upper; default -> "WEB"; }; }
    private static String safeLabel(String value) { return value == null || value.isBlank() ? "browser" : value.substring(0, Math.min(128, value.length())); }
    private PrincipalResponse principalResponse(AccountRecord account, Jwt jwt) {
        AdultGateResponse gate = adultGateResponse(adultGateFacts.find(account.principalId(), account.createdAt()));
        ConsentState consent = new ConsentState(true, consents.hasAllRequiredConsent(account.principalId()), "b30-consent-v1");
        String status = gate.status().equals("APPROVED") && consent.accepted() ? "ACTIVE" : "RESTRICTED";
        SessionRecord session = sessions.find(sessionId(jwt));
        if (!session.principalId().equals(account.principalId()) || session.status() != SessionStatus.ACTIVE) {
            throw new IamPolicyException(IamDecisionCode.SESSION_REVOKED, "iam.session.revoked");
        }
        return new PrincipalResponse(account.principalId().toString(), properties.getPlatformTenant(),
                session.sessionId().toString(), session.deviceId().value(), List.copyOf(account.roles()),
                List.copyOf(account.permissions()), "self-owned-jwt", status, gate, consent, "b30-rbac-v1");
    }
    private AdultGateResponse adultGateResponse(AdultGateFact fact) {
        String status = "APPROVED".equals(fact.status()) ? "PASSED" : "REJECTED";
        return new AdultGateResponse(status, fact.policyVersion(), fact.evaluatedAt(), fact.retryAllowed());
    }
    private DeviceResponse deviceResponse(PrincipalId principal, DeviceRegistration device) {
        return new DeviceResponse(device.deviceId().value(), normalizePlatform(device.platform()), device.active() ? "ACTIVE" : "REVOKED", device.registeredAt());
    }
    private SessionRevocationResponse revocationResponse(SessionRecord session) { return new SessionRevocationResponse(session.sessionId().toString(), "REVOKED", session.revokedAt() == null ? Instant.now() : session.revokedAt()); }
    private ConsentResponse consentResponse(ConsentRecord record) { return new ConsentResponse(record.type() == ConsentType.TERMS_OF_SERVICE ? "TERMS" : "PRIVACY", record.version().value(), record.accepted() ? "ACCEPTED" : "WITHDRAWN", record.recordedAt()); }

    @ExceptionHandler(IamPolicyException.class)
    public ResponseEntity<ErrorEnvelope> handlePolicy(IamPolicyException exception, HttpServletRequest request) {
        HttpStatus status = switch (exception.code()) {
            case ACCOUNT_LOCKED -> HttpStatus.LOCKED;
            case ACCOUNT_CONFLICT -> HttpStatus.CONFLICT;
            case INVALID_CREDENTIALS, PASSWORD_RESET_INVALID, SESSION_NOT_FOUND, SESSION_EXPIRED,
                    SESSION_REVOKED, SESSION_REPLAY, JWT_TOKEN_TYPE_INVALID -> HttpStatus.UNAUTHORIZED;
            case ADULT_CONFIRMATION_REQUIRED, ADULT_AGE_EVIDENCE_MISSING, ADULT_AGE_EVIDENCE_INVALID,
                    ADULT_AGE_BELOW_MINIMUM, CLIENT_AUTHORITY_OVERRIDE -> HttpStatus.FORBIDDEN;
            case AUDIT_UNAVAILABLE, IAM_PERSISTENCE_UNAVAILABLE, SESSION_STORE_UNAVAILABLE -> HttpStatus.SERVICE_UNAVAILABLE;
            default -> HttpStatus.BAD_REQUEST;
        };
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(ErrorEnvelope.of(request,
                exception.code().wireValue(), exception.messageKey(), status.is5xxServerError()));
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record RegisterRequest(String identifier, String password, DeviceInput device) {}
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record LoginRequest(String identifier, String password, DeviceInput device) {}
    public record DeviceInput(String deviceId, String deviceType, String deviceName, String osVersion, String clientVersion) {}
    public record RefreshRequest(String refreshToken) {}
    public record LogoutRequest(Boolean allDevices) {}
    public record PasswordResetRequest(String identifier) {}
    public record PasswordResetConfirmRequest(String identifier, String resetToken, String newPassword) {}
    public record AuthTokenResponse(String accessToken, String refreshToken, String tokenType, long expiresIn,
                                    long refreshExpiresIn, String sessionId, String deviceId) {}
    public record SessionRevocationResponse(String sessionId, String status, Instant revokedAt) {}
    public record AcceptedResponse(String message) {}
    public record PermissionsResponse(String principalId, List<String> roles, List<String> permissions,
                                      AdultGateResponse adultGate, String policyVersion) {}
    public record DeviceResponse(String deviceId, String deviceType, String status, Instant lastActiveAt) {}
    public record DeviceListResponse(List<DeviceResponse> devices) {}
    public record AdultGateRequest(boolean confirmed, int birthYear, String policyVersion) {}
    public record ConsentListResponse(List<ConsentResponse> items) {}
    public record ConsentUpdateRequest(String type, String version, String decision) {
        boolean accepted() { return "ACCEPTED".equalsIgnoreCase(decision); }
        public ConsentType consentType() { return switch (type == null ? "" : type.toUpperCase(java.util.Locale.ROOT)) { case "TERMS", "TERMS_OF_SERVICE" -> ConsentType.TERMS_OF_SERVICE; case "PRIVACY", "PRIVACY_NOTICE" -> ConsentType.PRIVACY_NOTICE; default -> throw new IamPolicyException(IamDecisionCode.CONSENT_VERSION_MISMATCH, "iam.consent.type_invalid"); }; }
    }
    public record ConsentResponse(String type, String version, String decision, Instant decidedAt) {}
    public record PrincipalResponse(String principalId, String tenantId, String sessionId, String deviceId,
                                    List<String> roles, List<String> permissions, String authMode, String status,
                                    AdultGateResponse adultGate, ConsentState consentState, String policyVersion) {}
    public record AdultGateResponse(String status, String policyVersion, Instant evaluatedAt, boolean retryAllowed) {}
    public record ConsentState(boolean required, boolean accepted, String version) {}
    public record ErrorEnvelope(String requestId, String traceId, ErrorDetail error) {
        static ErrorEnvelope of(HttpServletRequest request, String code, String message, boolean retryable) {
            return new ErrorEnvelope(headerOrUuid(request.getHeader("X-Request-Id")), headerOrUuid(request.getHeader("X-Trace-Id")), new ErrorDetail(code, message, retryable));
        }
        private static String headerOrUuid(String value) { return value == null || value.isBlank() ? UUID.randomUUID().toString() : value; }
    }
    public record ErrorDetail(String code, String message, boolean retryable) {}
}
