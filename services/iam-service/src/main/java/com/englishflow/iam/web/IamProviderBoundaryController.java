package com.englishflow.iam.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.type.TypeReference;
import com.englishflow.iam.auth.JwtSigningKeyProvider;
import com.englishflow.iam.auth.JwtTokenService;
import com.englishflow.iam.config.IamServiceProperties;
import com.englishflow.iam.domain.AccountRecord;
import com.englishflow.iam.domain.AccountStatus;
import com.englishflow.iam.domain.AdultGateCommand;
import com.englishflow.iam.domain.AdultGateFact;
import com.englishflow.iam.domain.AdultGateFactStore;
import com.englishflow.iam.domain.AdultGateResult;
import com.englishflow.iam.domain.AdultGateService;
import com.englishflow.iam.domain.ClientAuthorityClaims;
import com.englishflow.iam.domain.ConsentCommand;
import com.englishflow.iam.domain.ConsentHistoryEntry;
import com.englishflow.iam.domain.ConsentPolicyDescriptor;
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
import com.englishflow.iam.domain.IdempotencyRecord;
import com.englishflow.iam.domain.IdempotencyRequestFingerprint;
import com.englishflow.iam.domain.IdempotencyService;
import com.englishflow.iam.domain.PasswordAccountService;
import com.englishflow.iam.domain.PasswordResetService;
import com.englishflow.iam.domain.PrincipalId;
import com.englishflow.iam.domain.SecretDigests;
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
import org.springframework.http.converter.HttpMessageNotReadableException;

import java.time.Duration;
import java.time.Clock;
import java.time.Instant;
import java.time.Year;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;

/** HTTP adapter for the platform-owned account/password and JWT authentication center. */
@RestController
@RequestMapping("/api/v1")
class IamAuthenticationController {
    private static final String CREDENTIAL_REPLAY_REFERENCE_VERSION = "credential-replay-v1";
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
    private final IdempotencyService idempotency;
    private final Clock clock;

    IamAuthenticationController(IamServiceProperties properties, PasswordAccountService passwords,
                                         PasswordResetService passwordResets, JwtTokenService tokens,
                                         JwtSigningKeyProvider keys, SessionService sessions,
                                         DeviceService devices, AdultGateService adultGates,
                                         AdultGateFactStore adultGateFacts, ConsentService consents,
                                         ConsentStore consentStore, IdempotencyService idempotency,
                                         Clock clock) {
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
        this.idempotency = Objects.requireNonNull(idempotency, "idempotency");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @PostMapping("/auth/register")
    public ResponseEntity<ApiSuccessEnvelope<AuthTokenResponse>> register(@RequestBody RegisterRequest request,
                                                      @RequestHeader(value = "X-Auth-Transport", required = false) String authTransport,
                                                      @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        String key = requireIdempotencyKey(idempotencyKey);
        AuthTransport transport = parseTransport(authTransport);
        requireRequest(request, transport);
        String scope = "/api/v1/auth/register";
        String hash = fingerprint(scope, transport, request, request.password());
        return idempotent(scope, key, hash, new TypeReference<ApiSuccessEnvelope<AuthTokenResponse>>() {}, () -> {
                    AccountRecord account = passwords.register(request.identifier(), request.password(), ClientAuthorityClaims.none());
                    return establish(account, request.device(), transport, HttpStatus.CREATED,
                            replaySeed(scope, key, hash));
                }, record -> replayAuth(record, request.identifier(), transport, scope, key, hash));
    }

    @PostMapping("/auth/login")
    public ResponseEntity<ApiSuccessEnvelope<AuthTokenResponse>> login(@RequestBody LoginRequest request,
                                                   @RequestHeader(value = "X-Auth-Transport", required = false) String authTransport,
                                                   @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        String key = requireIdempotencyKey(idempotencyKey);
        AuthTransport transport = parseTransport(authTransport);
        requireRequest(request, transport);
        String scope = "/api/v1/auth/login";
        String hash = fingerprint(scope, transport, request, request.password());
        return idempotent(scope, key, hash, new TypeReference<ApiSuccessEnvelope<AuthTokenResponse>>() {}, () -> {
                    AccountRecord account = passwords.authenticate(request.identifier(), request.password());
                    return establish(account, request.device(), transport, HttpStatus.OK,
                            replaySeed(scope, key, hash));
                }, record -> replayAuth(record, request.identifier(), transport, scope, key, hash));
    }

    @PostMapping("/auth/token/refresh")
    public ResponseEntity<ApiSuccessEnvelope<AuthTokenResponse>> refresh(@RequestBody(required = false) RefreshRequest request,
                                                     HttpServletRequest httpRequest,
                                                     @RequestHeader(value = "X-Auth-Transport", required = false) String authTransport,
                                                     @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        String key = requireIdempotencyKey(idempotencyKey);
        AuthTransport transport = parseTransport(authTransport);
        String refreshCookie = readRefreshCookie(httpRequest);
        String presented = presentedRefresh(request, refreshCookie, transport);
        String scope = "/api/v1/auth/token/refresh";
        String hash = fingerprint(scope, transport, request, presented);
        return idempotent(scope, key, hash, new TypeReference<ApiSuccessEnvelope<AuthTokenResponse>>() {}, () -> {
                    // Bind the selected transport and native device before CAS rotation. A
                    // post-rotation check below closes the device-revocation race.
                    SessionRecord candidate = sessions.findByRefreshToken(presented);
                    validateRefreshBinding(candidate, request, transport);
                    requireActiveCredentialAccount(passwords.find(candidate.principalId()));
                    SessionRotationResult rotation = sessions.rotateByRefreshToken(presented, replaySeed(scope, key, hash));
                    SessionRecord session = sessions.find(rotation.sessionId());
                    try {
                        validateRefreshBinding(session, request, transport);
                    } catch (RuntimeException exception) {
                        try { sessions.revoke(session.sessionId(), "refresh_device_binding_failed"); }
                        catch (RuntimeException ignored) { /* fail closed even if the compensating write is unavailable */ }
                        throw exception;
                    }
                    AccountRecord account = passwords.find(rotation.principalId());
                    requireActiveCredentialAccount(account);
                    AccountRecord effectiveAccount = tokenAccount(account);
                    JwtTokenService.IssuedAccessToken access = tokens.issue(effectiveAccount, session,
                            replaySeed(scope, key, hash));
                    ApiResponseMeta meta = responseMeta();
                    ResponseEntity.BodyBuilder builder = ResponseEntity.ok().cacheControl(CacheControl.noStore());
                    addCorrelationHeaders(builder, meta);
                    if (transport == AuthTransport.WEB_COOKIE) {
                        builder.header(HttpHeaders.SET_COOKIE, refreshCookie(session, rotation.nextRefreshToken()).toString());
                    }
                    ResponseEntity<ApiSuccessEnvelope<AuthTokenResponse>> response = builder.body(new ApiSuccessEnvelope<>(
                            tokenResponse(access, rotation.nextRefreshToken(), session, transport), meta));
                    return executed(response, credentialReplayReference(effectiveAccount, session));
                }, record -> replayRefresh(record, request, transport, scope, key, hash));
    }

    @PostMapping("/auth/logout")
    public ResponseEntity<ApiSuccessEnvelope<SessionRevocationResponse>> logout(Authentication authentication,
                                                            @RequestBody(required = false) LogoutRequest request,
                                                            @RequestHeader(value = "X-Auth-Transport", required = false) String authTransport,
                                                            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        String key = requireIdempotencyKey(idempotencyKey);
        AuthTransport transport = parseTransport(authTransport);
        Jwt jwt = verifiedJwt(authentication);
        PrincipalId principal = principalId(jwt);
        boolean allDevices = request != null && Boolean.TRUE.equals(request.allDevices());
        String scope = "/api/v1/auth/logout";
        String hash = fingerprint(scope, transport, request, sessionClaim(jwt));
        return idempotent(scope, key, hash, new TypeReference<ApiSuccessEnvelope<SessionRevocationResponse>>() {}, () -> {
            trustedSession(principal, sessionId(jwt), transport);
            if (allDevices) {
                sessions.revokeAll(principal, "logout_all_devices");
                SessionRevocationResponse result = new SessionRevocationResponse(sessionClaim(jwt), "REVOKED",
                        "ALL_PRINCIPAL_SESSIONS_AND_TOKEN_FAMILIES", Instant.now(), "LOGOUT");
                ResponseEntity<ApiSuccessEnvelope<SessionRevocationResponse>> response = revocationSuccess(result, transport, true);
                return executed(response, "all:" + sessionClaim(jwt));
            }
            SessionRecord revoked = sessions.revokeOwned(principal, sessionId(jwt), "logout");
            ResponseEntity<ApiSuccessEnvelope<SessionRevocationResponse>> response =
                    revocationSuccess(revocationResponse(revoked, "CURRENT_SESSION_AND_TOKEN_FAMILY", "LOGOUT"), transport, true);
            return executed(response, revoked.sessionId().toString());
        }, record -> replayLogout(record, transport, allDevices, sessionClaim(jwt)));
    }

    @PostMapping("/auth/sessions/{sessionId}/revoke")
    public ResponseEntity<ApiSuccessEnvelope<SessionRevocationResponse>> revoke(Authentication authentication,
                                                             @PathVariable String sessionId,
                                                             @RequestHeader(value = "X-Auth-Transport", required = false) String authTransport,
                                                             @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        String key = requireIdempotencyKey(idempotencyKey);
        AuthTransport transport = parseTransport(authTransport);
        Jwt jwt = verifiedJwt(authentication);
        SessionId target = parseSessionId(sessionId);
        PrincipalId principal = principalId(jwt);
        String scope = "/api/v1/auth/sessions/{sessionId}/revoke";
        String hash = fingerprint(scope, transport, target.toString(), sessionClaim(jwt));
        return idempotent(scope, key, hash, new TypeReference<ApiSuccessEnvelope<SessionRevocationResponse>>() {}, () -> {
            trustedSession(principal, sessionId(jwt), transport);
            SessionRecord revoked = sessions.revokeOwned(principal, target, "explicit_revoke");
            boolean current = target.equals(sessionId(jwt));
            ResponseEntity<ApiSuccessEnvelope<SessionRevocationResponse>> response = revocationSuccess(
                    revocationResponse(revoked, "TARGET_SESSION_AND_TOKEN_FAMILY", "EXPLICIT_REVOKE"), transport, current);
            return executed(response, revoked.sessionId().toString());
        }, record -> replayRevoke(record, transport, target.equals(sessionId(jwt))));
    }

    @GetMapping("/auth/jwks")
    public ResponseEntity<ApiSuccessEnvelope<JwksResponse>> jwks() {
        return success(HttpStatus.OK, new JwksResponse(keys.publicJwks()),
                CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic());
    }

    @PostMapping("/auth/password-reset/request")
    public ResponseEntity<ApiSuccessEnvelope<AcceptedResponse>> resetRequest(@RequestBody PasswordResetRequest request,
                                                         @RequestHeader(value = "X-Auth-Transport", required = false) String authTransport,
                                                         @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        String key = requireIdempotencyKey(idempotencyKey);
        AuthTransport transport = parseTransport(authTransport);
        if (request == null || request.identifier() == null || request.identifier().isBlank()) {
            throw badRequest("iam.password_reset.invalid");
        }
        String scope = "/api/v1/auth/password-reset/request";
        String hash = fingerprint(scope, transport, request.identifier());
        return idempotent(scope, key, hash, new TypeReference<ApiSuccessEnvelope<AcceptedResponse>>() {}, () -> {
            passwordResets.request(request.identifier());
            ResponseEntity<ApiSuccessEnvelope<AcceptedResponse>> response =
                    success(HttpStatus.ACCEPTED, new AcceptedResponse(true), CacheControl.noStore());
            return executed(response, "accepted");
        }, record -> success(HttpStatus.ACCEPTED, new AcceptedResponse(true), CacheControl.noStore()));
    }

    @PostMapping("/auth/password-reset/confirm")
    public ResponseEntity<Void> resetConfirm(@RequestBody PasswordResetConfirmRequest request,
                                             @RequestHeader(value = "X-Auth-Transport", required = false) String authTransport,
                                             @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        String key = requireIdempotencyKey(idempotencyKey);
        AuthTransport transport = parseTransport(authTransport);
        if (request == null) throw badRequest("iam.password_reset.invalid");
        String scope = "/api/v1/auth/password-reset/confirm";
        String hash = fingerprint(scope, transport, request.identifier(), request.resetToken(), request.newPassword());
        return idempotent(scope, key, hash, new TypeReference<Void>() {}, () -> {
            AccountRecord account = passwordResets.confirm(request.identifier(), request.resetToken(), request.newPassword());
            return executed(resetConfirmResponse(transport), account.principalId().toString());
        }, record -> resetConfirmResponse(transport));
    }

    @GetMapping("/iam/principal/me")
    public ResponseEntity<ApiSuccessEnvelope<PrincipalResponse>> principalMe(Authentication authentication) {
        Jwt jwt = verifiedJwt(authentication);
        AccountRecord account = authenticatedAccount(jwt);
        return success(HttpStatus.OK, principalResponse(account, jwt), CacheControl.noStore());
    }

    @GetMapping("/iam/permissions")
    public ResponseEntity<ApiSuccessEnvelope<PermissionsResponse>> permissions(Authentication authentication) {
        AccountRecord account = authenticatedAccount(verifiedJwt(authentication));
        AccountRecord effective = tokenAccount(account);
        AdultGateResponse gate = adultGateResponse(adultGateFacts.find(account.principalId(), account.createdAt()));
        return success(HttpStatus.OK, new PermissionsResponse(
                account.principalId().toString(), List.copyOf(effective.roles()), List.copyOf(effective.permissions()),
                gate, "b30-rbac-v1"), CacheControl.noStore());
    }

    @GetMapping("/iam/devices")
    public ResponseEntity<ApiCursorPageEnvelope<DeviceListResponse>> deviceList(Authentication authentication,
                                                                                  @org.springframework.web.bind.annotation.RequestParam(value = "cursor", required = false) String cursor,
                                                                                  @org.springframework.web.bind.annotation.RequestParam(value = "pageSize", required = false) Integer pageSize) {
        AccountRecord account = authenticatedAccount(verifiedJwt(authentication));
        List<DeviceResponse> items = devices.list(ServerPrincipalContext.forPlatform(account.principalId(), account.roles()))
                .stream().map(device -> deviceResponse(account.principalId(), device)).toList();
        int requestedPageSize = pageSize == null ? 20 : pageSize;
        if (requestedPageSize < 1 || requestedPageSize > 100) throw badRequest("iam.pagination.page_size_invalid");
        if (cursor != null && !cursor.isBlank()) throw badRequest("iam.pagination.cursor_invalid");
        return cursorSuccess(HttpStatus.OK, new DeviceListResponse(items), requestedPageSize,
                CacheControl.noStore());
    }

    @PostMapping("/iam/devices/{deviceId}/kickout")
    public ResponseEntity<ApiSuccessEnvelope<SessionRevocationResponse>> kickDevice(Authentication authentication,
                                                                 @PathVariable String deviceId,
                                                                 @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        String key = requireIdempotencyKey(idempotencyKey);
        Jwt jwt = verifiedJwt(authentication);
        AccountRecord account = authenticatedAccount(jwt);
        DeviceId targetDevice = parseDeviceId(deviceId);
        String scope = "/api/v1/iam/devices/{deviceId}/kickout";
        String hash = fingerprint(scope, account.principalId(), targetDevice.value());
        return idempotent(scope, key, hash, new TypeReference<ApiSuccessEnvelope<SessionRevocationResponse>>() {}, () -> {
            ServerPrincipalContext context = ServerPrincipalContext.forPlatform(account.principalId(), account.roles());
            DeviceRegistration registration = devices.kick(context, targetDevice);
            List<SessionRecord> revoked = sessions.findByDevice(account.principalId(), registration.deviceId()).stream()
                    .filter(session -> session.status() == SessionStatus.ACTIVE)
                    .map(session -> sessions.revoke(session.sessionId(), "device_kicked")).toList();
            SessionRecord last = revoked.isEmpty()
                    ? sessions.findByDevice(account.principalId(), registration.deviceId()).stream().findFirst()
                        .orElseThrow(() -> new IamPolicyException(IamDecisionCode.SESSION_NOT_FOUND, "iam.session.not_found"))
                    : revoked.getLast();
            ResponseEntity<ApiSuccessEnvelope<SessionRevocationResponse>> response = success(HttpStatus.OK,
                    revocationResponse(last, "TARGET_SESSION_AND_TOKEN_FAMILY", "EXPLICIT_REVOKE"), CacheControl.noStore());
            return executed(response, last.sessionId().toString());
        }, record -> replayKickout(record, account.principalId()));
    }

    @PostMapping("/iam/adult-gate")
    public ResponseEntity<ApiSuccessEnvelope<AdultGateResponse>> adultGate(Authentication authentication, @RequestBody AdultGateRequest request,
                                                       @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        String key = requireIdempotencyKey(idempotencyKey);
        PrincipalId principal = principalId(verifiedJwt(authentication));
        authenticatedAccount(verifiedJwt(authentication));
        if (request == null || !request.confirmed()) throw new IamPolicyException(
                IamDecisionCode.ADULT_CONFIRMATION_REQUIRED, "iam.adult_gate.confirmation_required");
        if (request.policyVersion() == null || !"b30-adult-v1".equals(request.policyVersion())) throw new IamPolicyException(
                IamDecisionCode.ADULT_AGE_EVIDENCE_INVALID, "iam.adult_gate.policy_version_invalid");
        if (!properties.isLocalAdultGateEnabled()) throw new IamPolicyException(
                IamDecisionCode.ADULT_AGE_EVIDENCE_MISSING, "iam.adult_gate.trusted_age_required");
        String scope = "/api/v1/iam/adult-gate";
        String hash = fingerprint(scope, principal, request);
        return idempotent(scope, key, hash, new TypeReference<ApiSuccessEnvelope<AdultGateResponse>>() {}, () -> {
            int age = Year.now().getValue() - request.birthYear();
            AdultGateResult result = adultGates.evaluate(new AdultGateCommand(principal, true,
                    TrustedAgeEvidence.fromServerAttestation(age, "local-development-attestation", Instant.now()),
                    null, null, ClientAuthorityClaims.none()));
            if (!result.allowed()) {
                adultGates.invalidate(principal, "b30-adult-v1");
                throw new IamPolicyException(result.code(), result.messageKey());
            }
            AdultGateFact fact = adultGateFacts.approve(principal, "b30-adult-v1", result.auditDecision().occurredAt());
            ResponseEntity<ApiSuccessEnvelope<AdultGateResponse>> response = success(HttpStatus.OK,
                    adultGateResponse(fact), CacheControl.noStore());
            return executed(response, principal.toString());
        }, record -> replayAdultGate(principal));
    }

    @GetMapping("/iam/consents")
    public ResponseEntity<ApiCursorPageEnvelope<ConsentListResponse>> consentList(Authentication authentication,
                                                                                   @org.springframework.web.bind.annotation.RequestParam(value = "cursor", required = false) String cursor,
                                                                                   @org.springframework.web.bind.annotation.RequestParam(value = "pageSize", required = false) Integer pageSize) {
        Jwt jwt = verifiedJwt(authentication);
        PrincipalId principal = principalId(jwt);
        authenticatedAccount(jwt);
        List<ConsentResponse> items = Arrays.stream(ConsentType.values())
                .map(type -> consentStore.find(principal, type).map(this::consentResponse).orElse(null))
                .filter(Objects::nonNull).toList();
        int requestedPageSize = pageSize == null ? 20 : pageSize;
        if (requestedPageSize < 1 || requestedPageSize > 100) throw badRequest("iam.pagination.page_size_invalid");
        if (cursor != null && !cursor.isBlank()) throw badRequest("iam.pagination.cursor_invalid");
        return cursorSuccess(HttpStatus.OK, new ConsentListResponse(items), requestedPageSize,
                CacheControl.noStore());
    }

    @PutMapping("/iam/consents")
    public ResponseEntity<ApiSuccessEnvelope<ConsentResponse>> updateConsent(Authentication authentication,
                                                         @RequestBody ConsentUpdateRequest request,
                                                         @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        String key = requireIdempotencyKey(idempotencyKey);
        Jwt jwt = verifiedJwt(authentication);
        PrincipalId principal = principalId(jwt);
        authenticatedAccount(jwt);
        if (request == null || request.type() == null || request.version() == null || request.decision() == null) {
            throw badRequest("iam.consent.invalid");
        }
        // Validate the closed B8 wire enums before claiming idempotency. This keeps an unknown
        // type/decision a 400 shape error even when both fields are malformed together.
        ConsentType consentType = request.consentType();
        if (!request.accepted() && !request.withdrawn()) {
            throw badRequest("iam.consent.decision_invalid");
        }
        String scope = "/api/v1/iam/consents";
        String hash = fingerprint(scope, principal, request);
        return idempotent(scope, key, hash, new TypeReference<ApiSuccessEnvelope<ConsentResponse>>() {}, () -> {
            ServerPrincipalContext context = ServerPrincipalContext.forPlatform(principal, Set.of("learner"));
            ConsentRecord record;
            if (request.accepted()) {
                record = consents.record(context, new ConsentCommand(consentType,
                        consentVersion(request.version()), true, ClientAuthorityClaims.none(),
                        request.expectedDocumentDigest()));
            } else if (request.withdrawn()) {
                record = consents.withdraw(context, consentType, consentVersion(request.version()),
                        request.expectedDocumentDigest());
            } else {
                throw badRequest("iam.consent.decision_invalid");
            }
            ResponseEntity<ApiSuccessEnvelope<ConsentResponse>> response = success(HttpStatus.OK,
                    consentResponse(record), CacheControl.noStore());
            return executed(response, record.consentId().toString());
        }, record -> replayConsent(record, principal, consentType));
    }

    /**
     * B8 deliberately leaves the version token opaque (only a maximum length is specified),
     * while the domain value has a conservative safe-token grammar. A token that is shaped
     * legally at the wire boundary but cannot be represented by the domain is an unknown
     * published version and therefore a canonical 409 revalidation outcome, never an
     * uncaught IllegalArgumentException/500.
     */
    private static ConsentVersion consentVersion(String value) {
        try {
            return new ConsentVersion(value);
        } catch (IllegalArgumentException exception) {
            throw new IamPolicyException(IamDecisionCode.CONSENT_VERSION_MISMATCH,
                    "iam.consent.version_mismatch");
        }
    }

    private <T> ResponseEntity<T> idempotent(String scope, String key, String hash,
                                              TypeReference<T> responseType,
                                              Supplier<IdempotencyService.Execution<T>> operation,
                                              Function<IdempotencyRecord, ResponseEntity<T>> replay) {
        return idempotency.execute(scope, key, hash, responseType, operation, replay);
    }

    private static <T> IdempotencyService.Execution<T> executed(ResponseEntity<T> response,
                                                                 String resultReference) {
        return new IdempotencyService.Execution<>(response, resultReference);
    }

    private String fingerprint(String scope, Object... components) {
        Object[] values = new Object[components.length + 1];
        values[0] = scope;
        System.arraycopy(components, 0, values, 1, components.length);
        return idempotency.fingerprint(values);
    }

    private static String replaySeed(String scope, String key, String requestHash) {
        return scope + "|" + key + "|" + requestHash;
    }

    private String credentialReplayReference(AccountRecord effectiveAccount, SessionRecord session) {
        return String.join("|", CREDENTIAL_REPLAY_REFERENCE_VERSION,
                session.sessionId().toString(), Long.toString(session.rotation()),
                session.deviceId().value(), IdempotencyRequestFingerprint.CREDENTIAL_BINDING_VERSION,
                idempotency.credentialBinding(effectiveAccount, session));
    }

    private static CredentialReplayReference credentialReplayReference(String encoded) {
        if (encoded == null) throw idempotencyResultUnavailable();
        String[] parts = encoded.split("\\|", -1);
        if (parts.length != 6 || !CREDENTIAL_REPLAY_REFERENCE_VERSION.equals(parts[0])
                || !IdempotencyRequestFingerprint.CREDENTIAL_BINDING_VERSION.equals(parts[4])
                || !parts[5].matches("[0-9a-f]{64}")) {
            throw idempotencyResultUnavailable();
        }
        try {
            UUID sessionUuid = UUID.fromString(parts[1]);
            if (!sessionUuid.toString().equals(parts[1])) throw new IllegalArgumentException();
            long rotation = Long.parseLong(parts[2]);
            if (rotation < 0 || !Long.toString(rotation).equals(parts[2])) throw new IllegalArgumentException();
            UUID deviceUuid = UUID.fromString(parts[3]);
            if (!deviceUuid.toString().equals(parts[3])) throw new IllegalArgumentException();
            return new CredentialReplayReference(new SessionId(sessionUuid), rotation,
                    new DeviceId(deviceUuid.toString()), parts[5]);
        } catch (RuntimeException exception) {
            throw idempotencyResultUnavailable();
        }
    }

    private static void requireCurrentCredentialFacts(CredentialReplayReference reference,
                                                       AccountRecord account,
                                                       SessionRecord session) {
        if (account.status() != AccountStatus.ACTIVE
                || !session.principalId().equals(account.principalId())
                || session.rotation() != reference.rotation()
                || !session.deviceId().equals(reference.deviceId())
                || session.status() != SessionStatus.ACTIVE) {
            throw idempotencyResultUnavailable();
        }
    }

    private static void requireActiveCredentialAccount(AccountRecord account) {
        if (account.status() == AccountStatus.LOCKED) {
            throw new IamPolicyException(IamDecisionCode.ACCOUNT_LOCKED, "iam.account.locked");
        }
        if (account.status() != AccountStatus.ACTIVE) {
            throw new IamPolicyException(IamDecisionCode.INVALID_CREDENTIALS, "iam.credentials.invalid");
        }
    }

    private static <T> T currentCredentialReplay(Supplier<T> operation) {
        try {
            return operation.get();
        } catch (IamPolicyException exception) {
            if (exception.code() == IamDecisionCode.IDEMPOTENCY_RESULT_UNAVAILABLE) throw exception;
            throw idempotencyResultUnavailable();
        } catch (RuntimeException exception) {
            throw idempotencyResultUnavailable();
        }
    }

    private static IamPolicyException idempotencyResultUnavailable() {
        return new IamPolicyException(IamDecisionCode.IDEMPOTENCY_RESULT_UNAVAILABLE,
                "iam.idempotency.result_unavailable");
    }

    private record CredentialReplayReference(SessionId sessionId, long rotation, DeviceId deviceId,
                                             String credentialBinding) {}

    private AccountRecord authenticatedAccount(Jwt jwt) {
        PrincipalId principal = principalId(jwt);
        AccountRecord account = passwords.find(principal);
        SessionRecord session = trustedSession(principal, sessionId(jwt), null);
        if (session.expiresAt().isBefore(Instant.now())) {
            throw new IamPolicyException(IamDecisionCode.SESSION_EXPIRED, "iam.session.expired");
        }
        return account;
    }

    /** A JWT may be cryptographically valid while its IAM session has been revoked. */
    private SessionRecord trustedSession(PrincipalId principal, SessionId sessionId, AuthTransport transport) {
        SessionRecord session = sessions.find(sessionId);
        if (!session.principalId().equals(principal)) {
            throw new IamPolicyException(IamDecisionCode.SESSION_NOT_FOUND, "iam.session.not_found");
        }
        if (session.status() != SessionStatus.ACTIVE) {
            throw new IamPolicyException(IamDecisionCode.SESSION_REVOKED, "iam.session.revoked");
        }
        DeviceRegistration registration = devices.list(ServerPrincipalContext.forPlatform(principal, Set.of()))
                .stream().filter(value -> value.deviceId().equals(session.deviceId())).findFirst()
                .orElseThrow(() -> new IamPolicyException(IamDecisionCode.DEVICE_NOT_FOUND,
                        "iam.device.not_found"));
        if (!registration.active()) {
            throw new IamPolicyException(IamDecisionCode.DEVICE_NOT_FOUND, "iam.device.revoked");
        }
        if (transport != null) {
            boolean nativePlatform = isNativePlatform(registration.platform());
            if (nativePlatform != (transport == AuthTransport.NATIVE_SECURE_STORAGE)) {
                throw badRequest("iam.auth.transport_device_mismatch");
            }
        }
        return session;
    }

    private static boolean isNativePlatform(String platform) {
        return Set.of("IOS", "ANDROID", "IPAD").contains(normalizePlatform(platform));
    }

    /**
     * Before adult and required-consent facts are present, only self/account capabilities may
     * be placed in newly issued tokens. This is deliberately an allow-list boundary.
     */
    private AccountRecord tokenAccount(AccountRecord account) {
        AdultGateFact fact = adultGateFacts.find(account.principalId(), account.createdAt());
        boolean adultApproved = "APPROVED".equals(fact.status()) && "b30-adult-v1".equals(fact.policyVersion());
        boolean consentApproved = consents.hasAllRequiredConsent(account.principalId());
        if (adultApproved && consentApproved) return account;
        Set<String> restricted = account.permissions().stream()
                .filter(permission -> !isLearningPermission(permission)).collect(java.util.stream.Collectors.toUnmodifiableSet());
        return account.withPermissions(restricted);
    }

    private static boolean isLearningPermission(String permission) {
        return permission != null && (permission.startsWith("learning.")
                || permission.startsWith("assessment.") || permission.startsWith("content."));
    }

    private ResponseEntity<ApiSuccessEnvelope<AuthTokenResponse>> replayAuth(IdempotencyRecord record,
                                                                               String identifier,
                                                                               AuthTransport transport,
                                                                               String scope,
                                                                               String key,
                                                                               String hash) {
        return currentCredentialReplay(() -> {
            CredentialReplayReference reference = credentialReplayReference(record.resultReference());
            SessionRecord session = sessions.find(reference.sessionId());
            AccountRecord account = passwords.find(session.principalId());
            requireCurrentCredentialFacts(reference, account, session);
            if (!account.identifier().equals(AccountRecord.normalizeIdentifier(identifier))) {
                throw idempotencyResultUnavailable();
            }
            if (session.status() != SessionStatus.ACTIVE
                    || !session.expiresAt().isAfter(Instant.now(clock))) {
                throw idempotencyResultUnavailable();
            }
            validateTrustedTransport(session, transport);
            AccountRecord effectiveAccount = tokenAccount(account);
            if (!idempotency.credentialBindingMatches(effectiveAccount, session,
                    reference.credentialBinding())) {
                throw idempotencyResultUnavailable();
            }
            String refresh = sessions.replayRefreshToken(session, replaySeed(scope, key, hash));
            return authResponse(effectiveAccount, session, refresh, transport,
                    HttpStatus.valueOf(record.responseStatus() == null
                            ? HttpStatus.OK.value() : record.responseStatus()),
                    replaySeed(scope, key, hash));
        });
    }

    private ResponseEntity<ApiSuccessEnvelope<AuthTokenResponse>> replayRefresh(IdempotencyRecord record,
                                                                                  RefreshRequest request,
                                                                                  AuthTransport transport,
                                                                                  String scope,
                                                                                  String key,
                                                                                  String hash) {
        return currentCredentialReplay(() -> {
            CredentialReplayReference reference = credentialReplayReference(record.resultReference());
            SessionRecord session = sessions.find(reference.sessionId());
            AccountRecord account = passwords.find(session.principalId());
            requireCurrentCredentialFacts(reference, account, session);
            validateRefreshBinding(session, request, transport);
            AccountRecord effectiveAccount = tokenAccount(account);
            if (!idempotency.credentialBindingMatches(effectiveAccount, session,
                    reference.credentialBinding())) {
                throw idempotencyResultUnavailable();
            }
            String refresh = sessions.replayRefreshToken(session, replaySeed(scope, key, hash));
            return authResponse(effectiveAccount, session, refresh, transport, HttpStatus.OK,
                    replaySeed(scope, key, hash));
        });
    }

    private ResponseEntity<ApiSuccessEnvelope<SessionRevocationResponse>> replayLogout(IdempotencyRecord record,
                                                                                         AuthTransport transport,
                                                                                         boolean allDevices,
                                                                                         String currentSession) {
        if (allDevices) {
            SessionRevocationResponse result = new SessionRevocationResponse(currentSession, "REVOKED",
                    "ALL_PRINCIPAL_SESSIONS_AND_TOKEN_FAMILIES", Instant.now(), "LOGOUT");
            return revocationSuccess(result, transport, true);
        }
        SessionRecord session = sessions.find(parseSessionId(record.resultReference()));
        return revocationSuccess(revocationResponse(session, "CURRENT_SESSION_AND_TOKEN_FAMILY", "LOGOUT"), transport, true);
    }

    private ResponseEntity<ApiSuccessEnvelope<SessionRevocationResponse>> replayRevoke(IdempotencyRecord record,
                                                                                        AuthTransport transport,
                                                                                        boolean currentSession) {
        SessionRecord session = sessions.find(parseSessionId(record.resultReference()));
        return revocationSuccess(revocationResponse(session, "TARGET_SESSION_AND_TOKEN_FAMILY", "EXPLICIT_REVOKE"),
                transport, currentSession);
    }

    private ResponseEntity<Void> resetConfirmResponse(AuthTransport transport) {
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(HttpStatus.NO_CONTENT).cacheControl(CacheControl.noStore());
        addCorrelationHeaders(builder, responseMeta());
        if (transport == AuthTransport.WEB_COOKIE) builder.header(HttpHeaders.SET_COOKIE, clearRefreshCookie().toString());
        return builder.build();
    }

    private ResponseEntity<ApiSuccessEnvelope<SessionRevocationResponse>> replayKickout(IdempotencyRecord record,
                                                                                         PrincipalId principal) {
        SessionRecord session = sessions.find(parseSessionId(record.resultReference()));
        if (!session.principalId().equals(principal)) throw new IamPolicyException(IamDecisionCode.SESSION_NOT_FOUND,
                "iam.session.not_found");
        return success(HttpStatus.OK, revocationResponse(session, "TARGET_SESSION_AND_TOKEN_FAMILY", "EXPLICIT_REVOKE"),
                CacheControl.noStore());
    }

    private ResponseEntity<ApiSuccessEnvelope<AdultGateResponse>> replayAdultGate(PrincipalId principal) {
        AdultGateFact fact = adultGateFacts.find(principal, Instant.now());
        if (!"APPROVED".equals(fact.status())) throw new IamPolicyException(IamDecisionCode.IDEMPOTENCY_RESULT_UNAVAILABLE,
                "iam.idempotency.result_unavailable");
        return success(HttpStatus.OK, adultGateResponse(fact), CacheControl.noStore());
    }

    private ResponseEntity<ApiSuccessEnvelope<ConsentResponse>> replayConsent(IdempotencyRecord idempotencyRecord,
                                                                                 PrincipalId principal,
                                                                                 ConsentType type) {
        String resultReference = idempotencyRecord.resultReference();
        UUID consentId = null;
        try {
            consentId = resultReference == null ? null : UUID.fromString(resultReference);
        } catch (RuntimeException exception) {
            consentId = null;
        }
        UUID resolvedConsentId = consentId;
        ConsentHistoryEntry entry = resolvedConsentId == null ? null : consentStore.history(principal, type).stream()
                .filter(value -> value.consentId().equals(resolvedConsentId)).findFirst().orElse(null);
        if (entry == null) {
            // A pre-M2-002 idempotency row used a timestamp. Keep a read-only compatibility path
            // for those rows, but all new writes use the immutable consent_id above.
            long recordedAt = legacyConsentTimestamp(resultReference);
            if (recordedAt != Long.MIN_VALUE) {
                entry = consentStore.history(principal, type).stream()
                        .filter(value -> value.recordedAt() != null
                                && value.recordedAt().toEpochMilli() == recordedAt)
                        .findFirst().orElse(null);
            }
        }
        if (entry != null && entry.legacy()) {
            // The original answer depended on a pre-V11 row without a server-published digest.
            // Fabricating one is forbidden, so the caller must re-consent against the current
            // published document instead of receiving an unrecoverable internal failure.
            throw new IamPolicyException(IamDecisionCode.CONSENT_VERSION_MISMATCH,
                    "iam.consent.legacy_fact_revalidation_required");
        }
        ConsentRecord record = entry != null ? entry.verifiedRecord()
                : consentStore.find(principal, type).orElseThrow(() ->
                        new IamPolicyException(IamDecisionCode.IDEMPOTENCY_RESULT_UNAVAILABLE,
                                "iam.idempotency.result_unavailable"));
        if (!record.principalId().equals(principal) || record.type() != type) throw new IamPolicyException(
                IamDecisionCode.IDEMPOTENCY_RESULT_UNAVAILABLE, "iam.idempotency.result_unavailable");
        return success(HttpStatus.OK, consentResponse(record), CacheControl.noStore());
    }

    private static long legacyConsentTimestamp(String reference) {
        try {
            int separator = reference == null ? -1 : reference.lastIndexOf(':');
            return separator < 0 ? Long.MIN_VALUE : Long.parseLong(reference.substring(separator + 1));
        } catch (RuntimeException exception) {
            return Long.MIN_VALUE;
        }
    }

    private void validateTrustedTransport(SessionRecord session, AuthTransport transport) {
        DeviceRegistration registration = devices.list(ServerPrincipalContext.forPlatform(session.principalId(), Set.of()))
                .stream().filter(value -> value.deviceId().equals(session.deviceId())).findFirst()
                .orElseThrow(() -> new IamPolicyException(IamDecisionCode.DEVICE_NOT_FOUND, "iam.device.not_found"));
        if (!registration.active() || isNativePlatform(registration.platform())
                != (transport == AuthTransport.NATIVE_SECURE_STORAGE)) {
            throw new IamPolicyException(IamDecisionCode.DEVICE_NOT_FOUND, "iam.auth.transport_device_mismatch");
        }
    }

    private ResponseEntity<ApiSuccessEnvelope<AuthTokenResponse>> authResponse(AccountRecord account,
                                                                                 SessionRecord session,
                                                                                 String refresh,
                                                                                 AuthTransport transport,
                                                                                 HttpStatus status,
                                                                                 String replaySeed) {
        JwtTokenService.IssuedAccessToken access = tokens.issue(account, session, replaySeed);
        ApiResponseMeta meta = responseMeta();
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(status).cacheControl(CacheControl.noStore());
        addCorrelationHeaders(builder, meta);
        if (transport == AuthTransport.WEB_COOKIE) builder.header(HttpHeaders.SET_COOKIE,
                refreshCookie(session, refresh).toString());
        return builder.body(new ApiSuccessEnvelope<>(tokenResponse(access, refresh, session, transport), meta));
    }

    private IdempotencyService.Execution<ApiSuccessEnvelope<AuthTokenResponse>> establish(
            AccountRecord account, DeviceInput input, AuthTransport transport,
            HttpStatus status, String replaySeed) {
        DeviceInput device = requireDevice(input, transport);
        DeviceId deviceId = device.deviceId() == null || device.deviceId().isBlank()
                ? new DeviceId(UUID.randomUUID().toString()) : parseDeviceId(device.deviceId());
        ServerPrincipalContext context = ServerPrincipalContext.forPlatform(account.principalId(), account.roles());
        devices.register(context, new DeviceRegistrationCommand(deviceId, normalizePlatform(device.deviceType()),
                safeLabel(device.deviceName()), ClientAuthorityClaims.none()));
        SessionService.SessionCreation creation = sessions.open(context, deviceId, replaySeed);
        AccountRecord effectiveAccount = tokenAccount(account);
        JwtTokenService.IssuedAccessToken access = tokens.issue(effectiveAccount, creation.session(), replaySeed);
        ApiResponseMeta meta = responseMeta();
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(status).cacheControl(CacheControl.noStore());
        addCorrelationHeaders(builder, meta);
        if (transport == AuthTransport.WEB_COOKIE) {
            builder.header(HttpHeaders.SET_COOKIE, refreshCookie(creation.session(), creation.refreshToken()).toString());
        }
        ResponseEntity<ApiSuccessEnvelope<AuthTokenResponse>> response = builder.body(new ApiSuccessEnvelope<>(
                tokenResponse(access, creation.refreshToken(), creation.session(), transport), meta));
        return executed(response, credentialReplayReference(effectiveAccount, creation.session()));
    }

    private AuthTokenResponse tokenResponse(JwtTokenService.IssuedAccessToken access, String refresh,
                                            SessionRecord session, AuthTransport transport) {
        Instant now = Instant.now(clock);
        long accessSeconds = Math.max(1, Duration.between(now, access.expiresAt()).toSeconds());
        long refreshSeconds = Math.max(1, Duration.between(now, session.expiresAt()).toSeconds());
        return new AuthTokenResponse(transport.name(), access.value(),
                transport == AuthTransport.NATIVE_SECURE_STORAGE ? refresh : null,
                "Bearer", accessSeconds, refreshSeconds, session.sessionId().toString(), session.deviceId().value());
    }

    private ResponseCookie refreshCookie(SessionRecord session, String value) {
        return ResponseCookie.from(properties.getJwt().getRefreshCookieName(), value).httpOnly(true)
                .secure(properties.getJwt().isRefreshCookieSecure()).sameSite("Lax").path("/api/v1/auth")
                .maxAge(Math.max(0, Duration.between(Instant.now(clock), session.expiresAt()).getSeconds())).build();
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
    private static void requireRequest(LoginRequest request, AuthTransport transport) {
        if (request == null) throw badRequest("iam.request.invalid");
        requireCredentials(request.identifier(), request.password());
        requireDevice(request.device(), transport);
    }
    private static void requireRequest(RegisterRequest request, AuthTransport transport) {
        if (request == null) throw badRequest("iam.request.invalid");
        requireCredentials(request.identifier(), request.password());
        requireDevice(request.device(), transport);
    }
    private static void requireCredentials(String identifier, String password) {
        if (identifier == null || identifier.isBlank() || password == null || password.isEmpty()) {
            throw badRequest("iam.request.invalid");
        }
    }
    private static String requireIdempotencyKey(String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank() || !idempotencyKey.equals(idempotencyKey.trim())
                || idempotencyKey.length() < 16 || idempotencyKey.length() > 128
                || idempotencyKey.chars().anyMatch(Character::isISOControl)) {
            throw badRequest("iam.idempotency.invalid");
        }
        return idempotencyKey;
    }
    private static IamPolicyException badRequest(String key) { return new IamPolicyException(IamDecisionCode.INVALID_REQUEST, key); }
    private static String bodyRefresh(RefreshRequest request) {
        if (request == null || request.refreshToken() == null || request.refreshToken().isBlank()) {
            throw new IamPolicyException(IamDecisionCode.SESSION_NOT_FOUND, "iam.session.not_found");
        }
        return request.refreshToken();
    }
    private static String presentedRefresh(RefreshRequest request, String cookie, AuthTransport transport) {
        if (transport == AuthTransport.WEB_COOKIE) {
            if (request != null && ((request.refreshToken() != null && !request.refreshToken().isBlank())
                    || (request.deviceId() != null && !request.deviceId().isBlank()))) {
                throw badRequest("iam.auth.web_refresh_body_forbidden");
            }
            if (cookie == null || cookie.isBlank()) {
                throw new IamPolicyException(IamDecisionCode.SESSION_NOT_FOUND, "iam.session.not_found");
            }
            return cookie;
        }
        if (cookie != null && !cookie.isBlank()) throw badRequest("iam.auth.native_cookie_forbidden");
        return bodyRefresh(request);
    }

    private void validateRefreshBinding(SessionRecord session, RefreshRequest request, AuthTransport transport) {
        validateTrustedTransport(session, transport);
        if (transport == AuthTransport.NATIVE_SECURE_STORAGE) {
            if (request == null || request.deviceId() == null || request.deviceId().isBlank()) {
                throw badRequest("iam.device.id_required");
            }
            String requested;
            try { requested = UUID.fromString(request.deviceId()).toString(); }
            catch (IllegalArgumentException exception) { throw badRequest("iam.device.id_invalid"); }
            if (!requested.equals(session.deviceId().value())) {
                throw new IamPolicyException(IamDecisionCode.DEVICE_NOT_FOUND, "iam.device.not_found");
            }
        } else if (request != null && ((request.refreshToken() != null && !request.refreshToken().isBlank())
                || (request.deviceId() != null && !request.deviceId().isBlank()))) {
            throw badRequest("iam.auth.web_refresh_body_forbidden");
        }
        if (session.status() != SessionStatus.ACTIVE) {
            throw new IamPolicyException(IamDecisionCode.DEVICE_NOT_FOUND, "iam.device.not_found");
        }
    }
    private String readRefreshCookie(HttpServletRequest request) {
        if (request == null || request.getCookies() == null) return null;
        String expectedName = properties.getJwt().getRefreshCookieName();
        return Arrays.stream(request.getCookies())
                .filter(cookie -> expectedName.equals(cookie.getName()))
                .map(cookie -> cookie.getValue())
                .filter(value -> value != null && !value.isBlank())
                .findFirst().orElse(null);
    }
    private static AuthTransport parseTransport(String value) {
        if (value == null || value.isBlank()) return AuthTransport.WEB_COOKIE;
        try { return AuthTransport.valueOf(value.trim().toUpperCase(java.util.Locale.ROOT)); }
        catch (IllegalArgumentException exception) { throw badRequest("iam.auth.transport.invalid"); }
    }
    private static DeviceInput requireDevice(DeviceInput input, AuthTransport transport) {
        if (input == null || input.deviceType() == null || input.clientVersion() == null
                || input.clientVersion().isBlank() || input.clientVersion().length() > 32) {
            throw badRequest("iam.device.invalid");
        }
        String platform = normalizePlatform(input.deviceType());
        boolean nativeDevice = Set.of("IOS", "ANDROID", "IPAD").contains(platform);
        if ((transport == AuthTransport.NATIVE_SECURE_STORAGE) != nativeDevice) {
            throw badRequest("iam.auth.transport_device_mismatch");
        }
        if (input.deviceId() != null && !input.deviceId().isBlank()) {
            try { UUID.fromString(input.deviceId()); }
            catch (IllegalArgumentException exception) { throw badRequest("iam.device.id_invalid"); }
        }
        return input;
    }
    private static String normalizePlatform(String value) {
        if (value == null || value.isBlank()) throw badRequest("iam.device.invalid");
        String upper = value.toUpperCase(java.util.Locale.ROOT);
        return switch (upper) { case "IOS", "ANDROID", "WEB", "H5", "IPAD" -> upper;
            default -> throw badRequest("iam.device.invalid"); };
    }
    private static String safeLabel(String value) { return value == null || value.isBlank() ? "browser" : value.substring(0, Math.min(64, value.length())); }
    private static DeviceId parseDeviceId(String value) {
        if (value == null || value.isBlank()) throw badRequest("iam.device.id_invalid");
        try {
            return new DeviceId(UUID.fromString(value).toString());
        } catch (IllegalArgumentException exception) {
            throw badRequest("iam.device.id_invalid");
        }
    }
    private PrincipalResponse principalResponse(AccountRecord account, Jwt jwt) {
        AdultGateResponse gate = adultGateResponse(adultGateFacts.find(account.principalId(), account.createdAt()));
        ConsentState consent = consentState(account.principalId(), gate);
        String status = gate.learningAccess().equals("ELIGIBLE") && consent.accepted() ? "ACTIVE" : "RESTRICTED";
        SessionRecord session = sessions.find(sessionId(jwt));
        if (!session.principalId().equals(account.principalId()) || session.status() != SessionStatus.ACTIVE) {
            throw new IamPolicyException(IamDecisionCode.SESSION_REVOKED, "iam.session.revoked");
        }
        return new PrincipalResponse(account.principalId().toString(), properties.getPlatformTenant(),
                session.sessionId().toString(), session.deviceId().value(), List.copyOf(account.roles()),
                List.copyOf(tokenAccount(account).permissions()), "self-owned-jwt", status, gate, consent, "b30-rbac-v1");
    }

    private ConsentState consentState(PrincipalId principal, AdultGateResponse adultGate) {
        List<ConsentPolicyDescriptor> descriptors = Arrays.stream(ConsentType.values())
                .map(consents::policyDescriptor).toList();
        List<ConsentPolicyDescriptor> learningRequired = descriptors.stream()
                .filter(descriptor -> descriptor.requiredFor("LEARNING")).toList();
        List<String> required = learningRequired.stream().map(ConsentPolicyDescriptor::purpose).toList();
        List<String> unsatisfied = learningRequired.stream()
                .filter(descriptor -> !consentStore.find(principal, descriptor.type())
                        .map(record -> record.accepted()
                                && descriptor.type() == record.type()
                                && descriptor.purpose().equals(record.purpose())
                                && descriptor.requirement().name().equals(record.requirementScope())
                                && descriptor.requiredFor("LEARNING") == record.required()
                                && record.documentVersion().equals(descriptor.documentVersion())
                                && SecretDigests.constantTimeEquals(record.documentDigest(), descriptor.documentDigest())
                                && record.policyVersion().equals(descriptor.policyVersion())
                                && SecretDigests.constantTimeEquals(record.policyDigest(), descriptor.policyDigest())
                                && descriptor.withdrawalEffect() == record.withdrawalEffect()
                                && descriptor.revokeSessions() == record.revokeSessions())
                        .orElse(false))
                .map(ConsentPolicyDescriptor::purpose)
                .toList();
        boolean accepted = consents.policyEvaluationEnabled() && unsatisfied.isEmpty();
        Instant evaluatedAt = Instant.now();
        String policyVersion = descriptors.stream().map(value -> value.policyVersion().value()).findFirst()
                .orElseThrow(() -> new IamPolicyException(IamDecisionCode.POLICY_UNAVAILABLE,
                        "iam.consent.policy_unavailable"));
        String documentVersion = learningRequired.stream().map(value -> value.documentVersion().value()).findFirst()
                .orElse(policyVersion);
        return new ConsentState(true, accepted, documentVersion,
                adultGate.learningAccess().equals("ELIGIBLE") && accepted ? "ELIGIBLE" : "RESTRICTED",
                required, unsatisfied, evaluatedAt, policyVersion,
                new RevalidationRequirement(accepted ? "CURRENT" : "REVALIDATION_REQUIRED", !accepted,
                        evaluatedAt, null, unsatisfied),
                new ConsentProvenance(evaluatedAt));
    }
    private AdultGateResponse adultGateResponse(AdultGateFact fact) {
        String status = "APPROVED".equals(fact.status()) ? "PASSED"
                : "PENDING".equals(fact.status()) ? "NOT_EVALUATED" : "REJECTED";
        String access = "APPROVED".equals(fact.status()) ? "ELIGIBLE" : "RESTRICTED";
        String evidenceStatus = "APPROVED".equals(fact.status()) ? "SERVER_VERIFIED"
                : "PENDING".equals(fact.status()) ? "INSUFFICIENT" : "REJECTED";
        return new AdultGateResponse(status, access, fact.evaluatedAt(), fact.policyVersion(), 18,
                evidenceStatus, fact.retryAllowed());
    }
    private DeviceResponse deviceResponse(PrincipalId principal, DeviceRegistration device) {
        return new DeviceResponse(device.deviceId().value(), normalizePlatform(device.platform()), device.active() ? "ACTIVE" : "REVOKED", device.registeredAt());
    }
    private SessionRevocationResponse revocationResponse(SessionRecord session, String scope, String reasonCode) {
        return new SessionRevocationResponse(session.sessionId().toString(), "REVOKED", scope,
                session.revokedAt() == null ? Instant.now() : session.revokedAt(), reasonCode);
    }
    private ConsentResponse consentResponse(ConsentRecord record) {
        ConsentPolicyDescriptor descriptor = consents.policyDescriptor(record.type());
        String type = record.type().wireType();
        String purpose = descriptor.purpose();
        String state = record.accepted() ? "GRANTED" : "WITHDRAWN";
        String restriction = record.accepted() ? "NO_RESTRICTION" : descriptor.withdrawalEffect().name();
        String effect = record.accepted() ? "NO_ACTION" : descriptor.withdrawalEffect().name();
        String revalidation = record.accepted() ? "CURRENT" : "REVALIDATION_REQUIRED";
        List<String> reasons = record.accepted() ? List.of() : List.of("CONSENT_WITHDRAWN");
        return new ConsentResponse(type, record.documentVersion().value(), record.accepted() ? "ACCEPTED" : "WITHDRAWN",
                record.recordedAt(), purpose, record.required(),
                new ConsentDocument(record.documentVersion().value(), record.documentDigest(), descriptor.publishedAt()), state,
                record.effectiveAt(), restriction,
                new RevalidationRequirement(revalidation, !record.accepted(), record.recordedAt(), null, reasons),
                new ConsentWithdrawalEffect(effect, record.recordedAt(), !record.accepted()),
                new ConsentProvenance(record.recordedAt()), descriptor.policyRef(),
                record.policyVersion().value(), "consent:" + record.consentId());
    }

    private <T> ResponseEntity<ApiSuccessEnvelope<T>> success(HttpStatus status, T data, CacheControl cacheControl) {
        ApiResponseMeta meta = responseMeta();
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(status).cacheControl(cacheControl);
        addCorrelationHeaders(builder, meta);
        return builder.body(new ApiSuccessEnvelope<>(data, meta));
    }

    private <T> ResponseEntity<ApiCursorPageEnvelope<T>> cursorSuccess(HttpStatus status, T data,
                                                                         int pageSize,
                                                                         CacheControl cacheControl) {
        ApiResponseMeta base = responseMeta();
        ApiCursorPageMeta page = new ApiCursorPageMeta(base.requestId(), base.traceId(), base.apiVersion(),
                base.schemaVersion(), base.serverTime(), null, null, false, pageSize);
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(status).cacheControl(cacheControl);
        addCorrelationHeaders(builder, base);
        return builder.body(new ApiCursorPageEnvelope<>(data, page));
    }

    private ResponseEntity<ApiSuccessEnvelope<SessionRevocationResponse>> revocationSuccess(
            SessionRevocationResponse result, AuthTransport transport, boolean currentSession) {
        ApiResponseMeta meta = responseMeta();
        ResponseEntity.BodyBuilder builder = ResponseEntity.ok().cacheControl(CacheControl.noStore());
        addCorrelationHeaders(builder, meta);
        if (transport == AuthTransport.WEB_COOKIE && currentSession) {
            builder.header(HttpHeaders.SET_COOKIE, clearRefreshCookie().toString());
        }
        return builder.body(new ApiSuccessEnvelope<>(result, meta));
    }

    private static void addCorrelationHeaders(ResponseEntity.BodyBuilder builder, ApiResponseMeta meta) {
        builder.header("X-Request-Id", meta.requestId());
        builder.header("X-Trace-Id", meta.traceId());
        builder.header("X-API-Version", meta.apiVersion());
    }

    private static ApiResponseMeta responseMeta() {
        IamRequestCorrelationContext.Correlation correlation = IamRequestCorrelationContext.current().orElse(null);
        return new ApiResponseMeta(correlation == null ? UUID.randomUUID().toString() : correlation.requestId(),
                correlation == null ? UUID.randomUUID().toString() : correlation.traceId(),
                "v1", "1.0.0", Instant.now());
    }

    @ExceptionHandler(IamPolicyException.class)
    public ResponseEntity<ErrorEnvelope> handlePolicy(IamPolicyException exception, HttpServletRequest request) {
        HttpStatus status = switch (exception.code()) {
            case ACCOUNT_LOCKED -> HttpStatus.LOCKED;
            case ACCOUNT_CONFLICT, CONSENT_VERSION_MISMATCH -> HttpStatus.CONFLICT;
            case RATE_LIMITED -> HttpStatus.TOO_MANY_REQUESTS;
            case IDEMPOTENCY_KEY_REUSED, IDEMPOTENCY_IN_PROGRESS -> HttpStatus.CONFLICT;
            case IDEMPOTENCY_RESULT_UNAVAILABLE -> HttpStatus.SERVICE_UNAVAILABLE;
            case INVALID_CREDENTIALS, PASSWORD_RESET_INVALID, SESSION_NOT_FOUND, SESSION_EXPIRED,
                    SESSION_REVOKED, SESSION_REPLAY, JWT_ISSUER_INVALID, JWT_AUDIENCE_INVALID,
                    JWT_SIGNATURE_INVALID, JWT_ALGORITHM_INVALID, JWT_TIME_INVALID,
                    JWT_TOKEN_TYPE_INVALID, JWT_SCOPE_INVALID -> HttpStatus.UNAUTHORIZED;
            case ADULT_CONFIRMATION_REQUIRED, ADULT_AGE_EVIDENCE_MISSING, ADULT_AGE_EVIDENCE_INVALID,
                    ADULT_AGE_BELOW_MINIMUM, CLIENT_AUTHORITY_OVERRIDE, CLIENT_TRUSTED_INPUT_REJECTED,
                    CONSENT_REQUIRES_EXPLICIT_ACCEPTANCE -> HttpStatus.FORBIDDEN;
            case DEVICE_NOT_FOUND, PRINCIPAL_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case AUDIT_UNAVAILABLE, IAM_PERSISTENCE_UNAVAILABLE, SESSION_STORE_UNAVAILABLE,
                    POLICY_UNAVAILABLE -> HttpStatus.SERVICE_UNAVAILABLE;
            default -> HttpStatus.BAD_REQUEST;
        };
        ErrorEnvelope envelope = ErrorEnvelope.of(request, canonicalErrorCode(exception.code()),
                exception.messageKey(), status.is5xxServerError());
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(status).cacheControl(CacheControl.noStore());
        addCorrelationHeaders(builder, envelope.meta());
        return builder.body(envelope);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorEnvelope> handleUnexpected(Exception exception, HttpServletRequest request) {
        HttpStatus status = exception instanceof HttpMessageNotReadableException
                ? HttpStatus.BAD_REQUEST : HttpStatus.INTERNAL_SERVER_ERROR;
        ErrorEnvelope envelope = ErrorEnvelope.of(request,
                status == HttpStatus.BAD_REQUEST ? "VALIDATION_ERROR" : "INTERNAL_ERROR",
                status == HttpStatus.BAD_REQUEST ? "iam.request.invalid" : "iam.internal.error", status.is5xxServerError());
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(status).cacheControl(CacheControl.noStore());
        addCorrelationHeaders(builder, envelope.meta());
        return builder.body(envelope);
    }

    private static String canonicalErrorCode(IamDecisionCode code) {
        return switch (code) {
            case INVALID_REQUEST -> "VALIDATION_ERROR";
            case INVALID_CREDENTIALS, ACCOUNT_LOCKED -> "AUTH_REQUIRED";
            case RATE_LIMITED -> "RATE_LIMITED";
            case SESSION_NOT_FOUND -> "AUTH_INVALID_REFRESH_TOKEN";
            case SESSION_EXPIRED -> "AUTH_REFRESH_TOKEN_EXPIRED";
            case SESSION_REVOKED -> "AUTH_REFRESH_TOKEN_REVOKED";
            case SESSION_REPLAY -> "AUTH_REFRESH_REUSE_DETECTED";
            case DEVICE_NOT_FOUND -> "NOT_FOUND";
            case PRINCIPAL_NOT_FOUND -> "NOT_FOUND";
            case JWT_ISSUER_INVALID, JWT_AUDIENCE_INVALID, JWT_SIGNATURE_INVALID,
                    JWT_ALGORITHM_INVALID, JWT_TIME_INVALID, JWT_TOKEN_TYPE_INVALID,
                    JWT_SCOPE_INVALID -> "AUTH_REQUIRED";
            case ACCOUNT_CONFLICT, CONSENT_VERSION_MISMATCH -> "CONFLICT";
            case IDEMPOTENCY_KEY_REUSED, IDEMPOTENCY_IN_PROGRESS -> "IDEMPOTENCY_CONFLICT";
            case IDEMPOTENCY_RESULT_UNAVAILABLE -> "SERVICE_UNAVAILABLE";
            case CLIENT_AUTHORITY_OVERRIDE, CLIENT_TRUSTED_INPUT_REJECTED,
                    ADULT_CONFIRMATION_REQUIRED, ADULT_AGE_EVIDENCE_MISSING,
                    ADULT_AGE_EVIDENCE_INVALID, ADULT_AGE_BELOW_MINIMUM,
                    CONSENT_REQUIRES_EXPLICIT_ACCEPTANCE -> "FORBIDDEN";
            case AUDIT_UNAVAILABLE, IAM_PERSISTENCE_UNAVAILABLE, SESSION_STORE_UNAVAILABLE,
                    POLICY_UNAVAILABLE -> "SERVICE_UNAVAILABLE";
            default -> "INTERNAL_ERROR";
        };
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record RegisterRequest(String identifier, String password, DeviceInput device) {}
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record LoginRequest(String identifier, String password, DeviceInput device) {}
    public record DeviceInput(String deviceId, String deviceType, String deviceName, String osVersion, String clientVersion) {}
    public record RefreshRequest(String refreshToken, String deviceId) {
        public RefreshRequest(String refreshToken) { this(refreshToken, null); }
    }
    public record LogoutRequest(Boolean allDevices) {}
    public record PasswordResetRequest(String identifier) {}
    public record PasswordResetConfirmRequest(String identifier, String resetToken, String newPassword) {}
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record AuthTokenResponse(String authTransport, String accessToken, String refreshToken, String tokenType,
                                    long expiresIn, long refreshExpiresIn, String sessionId, String deviceId) {}
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SessionRevocationResponse(String sessionId, String status, String revocationScope,
                                            Instant revokedAt, String reasonCode) {
        public SessionRevocationResponse(String sessionId, String status, Instant revokedAt) {
            this(sessionId, status, null, revokedAt, null);
        }
    }
    public record AcceptedResponse(boolean accepted) {}
    public record JwksResponse(List<Map<String, Object>> keys) {}
    public record PermissionsResponse(String principalId, List<String> roles, List<String> permissions,
                                      AdultGateResponse adultGate, String policyVersion) {}
    public record DeviceResponse(String deviceId, String deviceType, String status, Instant lastActiveAt) {}
    public record DeviceListResponse(List<DeviceResponse> devices) {}
    public record AdultGateRequest(boolean confirmed, int birthYear, String policyVersion) {}
    public record ConsentListResponse(List<ConsentResponse> items) {}
    public record ConsentUpdateRequest(String type, String version, String decision,
                                       String expectedDocumentDigest) {
        public ConsentUpdateRequest(String type, String version, String decision) {
            this(type, version, decision, null);
        }
        boolean accepted() { return "ACCEPTED".equals(decision); }
        boolean withdrawn() { return "WITHDRAWN".equals(decision); }
        public ConsentType consentType() { return ConsentType.fromWire(type); }
    }
    public record ConsentResponse(String type, String version, String decision, Instant decidedAt,
                                  String purpose, boolean required, ConsentDocument document,
                                  String state, Instant effectiveAt, String restrictionEffect,
                                  RevalidationRequirement revalidation,
                                  ConsentWithdrawalEffect withdrawalEffect,
                                  ConsentProvenance provenance, String policyRef,
                                  String policyVersion, String decisionRef) {}
    public record ConsentDocument(String version, String digest, Instant publishedAt) {}
    public record RevalidationRequirement(String status, boolean required, Instant evaluatedAt,
                                         Instant dueAt, List<String> reasonCodes) {}
    public record ConsentWithdrawalEffect(String effect, Instant appliesAt,
                                          boolean cacheInvalidationRequired) {}
    public record ConsentProvenance(String authority, Instant recordedAt,
                                    String documentSource, String policySource) {
        public ConsentProvenance(Instant recordedAt) {
            this("IAM_SERVER_RECORDED_CONSENT", recordedAt,
                    "PUBLISHED_DOCUMENT_VERSION_AND_DIGEST", "IAM_ACTIVE_POLICY_CONTROL_PLANE");
        }
    }
    public record PrincipalResponse(String principalId, String tenantId, String sessionId, String deviceId,
                                    List<String> roles, List<String> permissions, String authMode, String status,
                                    AdultGateResponse adultGate, ConsentState consentState, String policyVersion) {}
    public record AdultGateResponse(String status, String learningAccess, Instant effectiveAt, String policyVersion,
                                    int minimumAge, String evidenceStatus, boolean retryAllowed) {
        public AdultGateResponse(String status, String policyVersion, Instant effectiveAt, boolean retryAllowed) {
            this(status, "PASSED".equals(status) ? "ELIGIBLE" : "RESTRICTED", effectiveAt,
                    policyVersion, 18, "PASSED".equals(status) ? "SERVER_VERIFIED" : "INSUFFICIENT", retryAllowed);
        }
        public Instant evaluatedAt() { return effectiveAt; }
    }
    public record ConsentState(boolean required, boolean accepted, String version,
                               String learningAccess, List<String> requiredPurposes,
                               List<String> unsatisfiedPurposes, Instant evaluatedAt,
                               String policyVersion, RevalidationRequirement revalidation,
                               ConsentProvenance provenance) {}
    public record ApiSuccessEnvelope<T>(T data, ApiResponseMeta meta) {}
    public record ApiCursorPageEnvelope<T>(T data, ApiCursorPageMeta meta) {}
    public record ApiCursorPageMeta(String requestId, String traceId, String apiVersion,
                                    String schemaVersion, Instant serverTime, String nextCursor,
                                    Instant snapshotAt, boolean hasMore, int pageSize) {}
    public record ApiResponseMeta(String requestId, String traceId, String apiVersion,
                                  String schemaVersion, Instant serverTime) {}
    public record ErrorEnvelope(ApiError error, ApiResponseMeta meta) {
        static ErrorEnvelope of(HttpServletRequest request, String code, String message, boolean retryable) {
            IamRequestCorrelationContext.Correlation correlation = IamRequestCorrelationContext.current().orElse(null);
            String requestId = correlation == null ? headerOrUuid(request == null ? null : request.getHeader("X-Request-Id")) : correlation.requestId();
            String traceId = correlation == null ? headerOrUuid(request == null ? null : request.getHeader("X-Trace-Id")) : correlation.traceId();
            return new ErrorEnvelope(new ApiError(code, message, retryable, null),
                    new ApiResponseMeta(requestId, traceId, "v1", "1.0.0", Instant.now()));
        }
        private static String headerOrUuid(String value) { return value == null || value.isBlank() ? UUID.randomUUID().toString() : value; }
    }
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ApiError(String errorCode, String message, boolean retryable, Map<String, Object> details) {}
    public enum AuthTransport { WEB_COOKIE, NATIVE_SECURE_STORAGE }
}
