package com.englishflow.iam.web;

import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.domain.IdempotencyRecord;
import com.englishflow.iam.domain.IdempotencyService;
import com.englishflow.iam.domain.PdpAuthorizationRequest;
import com.englishflow.iam.domain.PdpDecision;
import com.englishflow.iam.domain.PdpDecisionService;
import com.englishflow.iam.domain.PolicyActor;
import com.englishflow.iam.domain.PolicyAccessAuthenticationVerifier;
import com.englishflow.iam.domain.PolicyAuditRecord;
import com.englishflow.iam.domain.PolicyBundle;
import com.englishflow.iam.domain.PolicyCacheInvalidationReceipt;
import com.englishflow.iam.domain.PolicyControlService;
import com.englishflow.iam.domain.PolicyDocument;
import com.englishflow.iam.domain.PolicyMutation;
import com.englishflow.iam.domain.PolicyVersionRecord;
import com.englishflow.iam.domain.PrincipalId;
import com.englishflow.iam.domain.VerifiedServiceIdentity;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.type.TypeReference;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;

/** Public B8 policy lifecycle endpoints; permissions and actors come only from verified access JWTs. */
@RestController
@RequestMapping("/api/v1/iam/policy-versions")
public final class IamPolicyControlController {
    private static final TypeReference<SuccessEnvelope<PolicyMutationResponse>> MUTATION_TYPE = new TypeReference<>() {};
    private final PolicyControlService policies;
    private final IdempotencyService idempotency;
    private final PolicyAccessAuthenticationVerifier accessVerifier;

    public IamPolicyControlController(PolicyControlService policies, IdempotencyService idempotency,
                                      PolicyAccessAuthenticationVerifier accessVerifier) {
        this.policies = Objects.requireNonNull(policies, "policies");
        this.idempotency = Objects.requireNonNull(idempotency, "idempotency");
        this.accessVerifier = Objects.requireNonNull(accessVerifier, "accessVerifier");
    }

    @GetMapping
    public ResponseEntity<CursorEnvelope<PolicyListResponse>> list(Authentication authentication,
                                                                    @RequestParam(value = "cursor", required = false) String cursor,
                                                                    @RequestParam(value = "pageSize", required = false) Integer pageSize) {
        PolicyActor actor = accessActor(authentication);
        int size = pageSize == null ? 50 : pageSize;
        if (size < 1 || size > 100) throw invalid();
        int offset = decodeCursor(cursor);
        List<PolicyVersionRecord> all = policies.list(actor);
        if (offset > all.size()) throw invalid();
        int end = Math.min(all.size(), offset + size);
        List<PolicyVersionResponse> items = all.subList(offset, end).stream()
                .map(policy -> policyResponse(policy, auditLinks(policies.audits(policy.policyVersionId(), actor))))
                .toList();
        String next = end < all.size() ? encodeCursor(end) : null;
        Meta meta = meta();
        return cursorResponse(HttpStatus.OK, new PolicyListResponse(items),
                new PageMeta(meta.requestId(), meta.traceId(), meta.apiVersion(), meta.schemaVersion(), meta.serverTime(),
                        next, meta.serverTime(), end < all.size(), size));
    }

    @PostMapping
    public ResponseEntity<SuccessEnvelope<PolicyMutationResponse>> create(Authentication authentication,
                                                                             @RequestBody PolicyCreateRequest request,
                                                                             @RequestHeader("Idempotency-Key") String key) {
        PolicyActor actor = accessActor(authentication);
        if (request == null || request.policyDocument() == null) throw invalid();
        return mutation("policy:create:" + actor.principalId(), key,
                idempotency.fingerprint("policy-create", actor.principalId().toString(), request), HttpStatus.CREATED,
                () -> policies.create(actor, request.policyDocument(), request.changeReason(), requestId(), traceId()));
    }

    @GetMapping("/{policyVersionId}")
    public ResponseEntity<SuccessEnvelope<PolicyVersionResponse>> get(Authentication authentication,
                                                                         @PathVariable String policyVersionId) {
        PolicyActor actor = accessActor(authentication);
        PolicyVersionRecord record = policies.get(policyId(policyVersionId), actor);
        return success(HttpStatus.OK, policyResponse(record, auditLinks(policies.audits(record.policyVersionId(), actor))));
    }

    @PutMapping("/{policyVersionId}")
    public ResponseEntity<SuccessEnvelope<PolicyMutationResponse>> update(Authentication authentication,
                                                                             @PathVariable String policyVersionId,
                                                                             @RequestBody PolicyUpdateRequest request,
                                                                             @RequestHeader("Idempotency-Key") String key) {
        PolicyActor actor = accessActor(authentication);
        if (request == null || request.policyDocument() == null) throw invalid();
        UUID id = policyId(policyVersionId);
        return mutation(scope("update", id, actor), key,
                idempotency.fingerprint("policy-update", id.toString(), actor.principalId().toString(), request), HttpStatus.OK,
                () -> policies.update(id, request.expectedRevision(), request.policyDocument(), request.changeReason(), actor,
                        requestId(), traceId()));
    }

    @PostMapping("/{policyVersionId}/submit")
    public ResponseEntity<SuccessEnvelope<PolicyMutationResponse>> submit(Authentication authentication,
                                                                             @PathVariable String policyVersionId,
                                                                             @RequestBody PolicySubmitRequest request,
                                                                             @RequestHeader("Idempotency-Key") String key) {
        PolicyActor actor = accessActor(authentication);
        if (request == null) throw invalid();
        UUID id = policyId(policyVersionId);
        return mutation(scope("submit", id, actor), key,
                idempotency.fingerprint("policy-submit", id.toString(), actor.principalId().toString(), request), HttpStatus.OK,
                () -> policies.submit(id, request.expectedRevision(), request.submissionReason(), actor, requestId(), traceId()));
    }

    @PostMapping("/{policyVersionId}/approvals")
    public ResponseEntity<SuccessEnvelope<PolicyMutationResponse>> approve(Authentication authentication,
                                                                              @PathVariable String policyVersionId,
                                                                              @RequestBody PolicyApprovalRequest request,
                                                                              @RequestHeader("Idempotency-Key") String key) {
        PolicyActor actor = accessActor(authentication);
        if (request == null) throw invalid();
        UUID id = policyId(policyVersionId);
        return mutation(scope("approve", id, actor), key,
                idempotency.fingerprint("policy-approve", id.toString(), actor.principalId().toString(), request), HttpStatus.OK,
                () -> policies.approve(id, request.expectedRevision(), request.approvalNote(), actor, requestId(), traceId()));
    }

    @PostMapping("/{policyVersionId}/activate")
    public ResponseEntity<SuccessEnvelope<PolicyMutationResponse>> activate(Authentication authentication,
                                                                               @PathVariable String policyVersionId,
                                                                               @RequestBody PolicyActivationRequest request,
                                                                               @RequestHeader("Idempotency-Key") String key) {
        PolicyActor actor = accessActor(authentication);
        if (request == null) throw invalid();
        UUID id = policyId(policyVersionId);
        return mutation(scope("activate", id, actor), key,
                idempotency.fingerprint("policy-activate", id.toString(), actor.principalId().toString(), request), HttpStatus.OK,
                () -> policies.activate(id, request.expectedRevision(), request.activationReason(), actor, requestId(), traceId()));
    }

    @PostMapping("/{policyVersionId}/revoke")
    public ResponseEntity<SuccessEnvelope<PolicyMutationResponse>> revoke(Authentication authentication,
                                                                             @PathVariable String policyVersionId,
                                                                             @RequestBody PolicyRevocationRequest request,
                                                                             @RequestHeader("Idempotency-Key") String key) {
        PolicyActor actor = accessActor(authentication);
        if (request == null) throw invalid();
        UUID id = policyId(policyVersionId);
        return mutation(scope("revoke", id, actor), key,
                idempotency.fingerprint("policy-revoke", id.toString(), actor.principalId().toString(), request), HttpStatus.OK,
                () -> policies.revoke(id, request.expectedRevision(), request.revocationReason(), actor, requestId(), traceId()));
    }

    private ResponseEntity<SuccessEnvelope<PolicyMutationResponse>> mutation(String scope, String key, String hash,
                                                                                HttpStatus status, Supplier<PolicyMutation> operation) {
        return idempotency.execute(scope, key, hash, MUTATION_TYPE, () -> {
            PolicyMutation mutation = operation.get();
            PolicyMutationResponse result = new PolicyMutationResponse(
                    policyResponse(mutation.policy(), List.of(auditLink(mutation.audit()))),
                    auditLink(mutation.audit()), invalidation(mutation.cacheInvalidation()));
            ResponseEntity<SuccessEnvelope<PolicyMutationResponse>> response = success(status, result);
            return new IdempotencyService.Execution<>(response, mutation.policy().policyVersionId().toString());
        }, record -> {
            // V9 stores an encrypted exact response snapshot. Returning a status-only response
            // would violate B8 replay if a legacy/corrupt record has no recoverable snapshot.
            throw new IamPolicyException(IamDecisionCode.IDEMPOTENCY_RESULT_UNAVAILABLE,
                    "iam.idempotency.result_unavailable");
        });
    }

    private PolicyActor accessActor(Authentication authentication) { return accessVerifier.verify(authentication); }

    static VerifiedServiceIdentity serviceIdentity(Authentication authentication) {
        JwtAuthenticationToken token = jwtAuthentication(authentication, "service");
        Jwt jwt = token.getToken();
        return new VerifiedServiceIdentity(jwt.getClaimAsString("service_id"), Set.copyOf(jwt.getAudience()), jwt.getIssuedAt());
    }

    private static JwtAuthenticationToken jwtAuthentication(Authentication authentication, String expectedType) {
        if (!(authentication instanceof JwtAuthenticationToken token)
                || !expectedType.equals(token.getToken().getClaimAsString("token_type"))) {
            throw new IamPolicyException(IamDecisionCode.JWT_TOKEN_TYPE_INVALID, "iam.jwt.token_type_invalid");
        }
        return token;
    }

    static PolicyVersionResponse policyResponse(PolicyVersionRecord policy, List<AuditLinkResponse> auditLinks) {
        return new PolicyVersionResponse(policy.policyVersionId().toString(), policy.version(), policy.status().name(), policy.revision(),
                tenant(policy.tenantId(), policy.updatedAt()), policy.document(), policy.artifactDigest(), policy.createdAt(),
                policy.updatedAt(), subject(policy.createdBy(), policy.createdAt()), subject(policy.submittedBy(), policy.updatedAt()),
                subject(policy.approvedBy(), policy.updatedAt()), subject(policy.activatedBy(), policy.activatedAt()),
                subject(policy.revokedBy(), policy.revokedAt()), separation(policy), auditLinks, invalidation(policy.cacheInvalidation()));
    }

    static AuditLinkResponse auditLink(PolicyAuditRecord record) {
        return new AuditLinkResponse(record.auditId().toString(), null, record.requestId(), record.traceId(), record.recordedAt());
    }

    static CacheInvalidationResponse invalidation(PolicyCacheInvalidationReceipt receipt) {
        return new CacheInvalidationResponse(receipt.invalidationId().toString(), receipt.required(), receipt.status(),
                receipt.scope(), receipt.issuedAt(), receipt.completedAt(), receipt.denyUntilCurrentVersionProven());
    }

    private static List<AuditLinkResponse> auditLinks(List<PolicyAuditRecord> records) {
        return records.stream().map(IamPolicyControlController::auditLink).toList();
    }
    private static TenantResponse tenant(String tenant, Instant at) {
        return new TenantResponse(tenant, "IAM_PLATFORM_TENANT", at == null ? Instant.now() : at);
    }
    private static SubjectResponse subject(PrincipalId subject, Instant at) {
        return subject == null ? null : new SubjectResponse(subject.toString(), "IAM_VALIDATED_JWT_AND_SESSION",
                at == null ? Instant.now() : at);
    }
    private static SeparationOfDutiesResponse separation(PolicyVersionRecord policy) {
        boolean satisfied = policy.approvedBy() != null && !policy.authorOrContributor(policy.approvedBy())
                && !policy.approvedBy().equals(policy.submittedBy());
        return new SeparationOfDutiesResponse(true, false, false, satisfied);
    }

    static <T> ResponseEntity<SuccessEnvelope<T>> success(HttpStatus status, T data) {
        Meta meta = meta();
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore())
                .header("X-Request-Id", meta.requestId()).header("X-Trace-Id", meta.traceId())
                .header("X-API-Version", meta.apiVersion()).body(new SuccessEnvelope<>(data, meta));
    }
    private static <T> ResponseEntity<CursorEnvelope<T>> cursorResponse(HttpStatus status, T data, PageMeta meta) {
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore())
                .header("X-Request-Id", meta.requestId()).header("X-Trace-Id", meta.traceId())
                .header("X-API-Version", meta.apiVersion()).body(new CursorEnvelope<>(data, meta));
    }
    static Meta meta() {
        IamRequestCorrelationContext.Correlation correlation = IamRequestCorrelationContext.current().orElse(null);
        return new Meta(correlation == null ? UUID.randomUUID().toString() : correlation.requestId(),
                correlation == null ? UUID.randomUUID().toString() : correlation.traceId(), "v1", "1.0.0", Instant.now());
    }
    private static String requestId() { return meta().requestId(); }
    private static String traceId() { return meta().traceId(); }
    private static UUID policyId(String raw) {
        try { return UUID.fromString(raw); }
        catch (IllegalArgumentException | NullPointerException exception) { throw invalid(); }
    }
    private static int decodeCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) return 0;
        try {
            String decoded = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            int offset = Integer.parseInt(decoded);
            if (offset < 0) throw invalid();
            return offset;
        } catch (IllegalArgumentException exception) { throw invalid(); }
    }
    private static String encodeCursor(int offset) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(Integer.toString(offset).getBytes(StandardCharsets.UTF_8));
    }
    private static String scope(String action, UUID policyVersionId, PolicyActor actor) {
        return "policy:" + action + ":" + policyVersionId + ":" + actor.principalId();
    }
    static IamPolicyException invalid() { return new IamPolicyException(IamDecisionCode.INVALID_REQUEST, "iam.policy.request_invalid"); }

    @ExceptionHandler(IamPolicyException.class)
    public ResponseEntity<ErrorEnvelope> policyError(IamPolicyException exception, HttpServletRequest request) {
        return errorResponse(exception);
    }

    static ResponseEntity<ErrorEnvelope> errorResponse(IamPolicyException exception) {
        HttpStatus status = switch (exception.code()) {
            case JWT_TOKEN_TYPE_INVALID, JWT_ISSUER_INVALID, JWT_AUDIENCE_INVALID, JWT_SIGNATURE_INVALID,
                    JWT_ALGORITHM_INVALID, JWT_TIME_INVALID, JWT_SCOPE_INVALID, SESSION_REVOKED,
                    SESSION_NOT_FOUND, SESSION_EXPIRED -> HttpStatus.UNAUTHORIZED;
            case POLICY_PERMISSION_DENIED, POLICY_SEPARATION_OF_DUTIES, PDP_INVALID_SERVICE_IDENTITY,
                    CLIENT_AUTHORITY_OVERRIDE, CLIENT_TRUSTED_INPUT_REJECTED -> HttpStatus.FORBIDDEN;
            case POLICY_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case POLICY_REVISION_CONFLICT, POLICY_LIFECYCLE_INVALID -> HttpStatus.CONFLICT;
            case POLICY_UNAVAILABLE, IAM_PERSISTENCE_UNAVAILABLE, AUDIT_UNAVAILABLE,
                    SESSION_STORE_UNAVAILABLE, IDEMPOTENCY_RESULT_UNAVAILABLE -> HttpStatus.SERVICE_UNAVAILABLE;
            default -> HttpStatus.BAD_REQUEST;
        };
        Meta meta = meta();
        ErrorEnvelope body = new ErrorEnvelope(new ApiError(errorCode(exception.code()), exception.messageKey(),
                status.is5xxServerError(), null), meta);
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore())
                .header("X-Request-Id", meta.requestId()).header("X-Trace-Id", meta.traceId())
                .header("X-API-Version", meta.apiVersion()).body(body);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorEnvelope> invalidBody(HttpServletRequest request) { return errorResponse(invalid()); }

    private static String errorCode(IamDecisionCode code) {
        return switch (code) {
            case POLICY_PERMISSION_DENIED, POLICY_SEPARATION_OF_DUTIES, PDP_INVALID_SERVICE_IDENTITY,
                    CLIENT_AUTHORITY_OVERRIDE, CLIENT_TRUSTED_INPUT_REJECTED -> "FORBIDDEN";
            case POLICY_NOT_FOUND -> "NOT_FOUND";
            case POLICY_REVISION_CONFLICT, POLICY_LIFECYCLE_INVALID -> "CONFLICT";
            case POLICY_UNAVAILABLE, IAM_PERSISTENCE_UNAVAILABLE, AUDIT_UNAVAILABLE,
                    SESSION_STORE_UNAVAILABLE, IDEMPOTENCY_RESULT_UNAVAILABLE -> "SERVICE_UNAVAILABLE";
            case JWT_TOKEN_TYPE_INVALID, JWT_ISSUER_INVALID, JWT_AUDIENCE_INVALID, JWT_SIGNATURE_INVALID,
                    JWT_ALGORITHM_INVALID, JWT_TIME_INVALID, JWT_SCOPE_INVALID, SESSION_REVOKED,
                    SESSION_NOT_FOUND, SESSION_EXPIRED -> "AUTH_REQUIRED";
            default -> "VALIDATION_ERROR";
        };
    }

    public record PolicyCreateRequest(PolicyDocument policyDocument, String changeReason) {}
    public record PolicyUpdateRequest(int expectedRevision, PolicyDocument policyDocument, String changeReason) {}
    public record PolicySubmitRequest(int expectedRevision, String submissionReason) {}
    public record PolicyApprovalRequest(int expectedRevision, String approvalNote) {}
    public record PolicyActivationRequest(int expectedRevision, String activationReason) {}
    public record PolicyRevocationRequest(int expectedRevision, String revocationReason) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SuccessEnvelope<T>(T data, Meta meta) {}
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CursorEnvelope<T>(T data, PageMeta meta) {}
    public record Meta(String requestId, String traceId, String apiVersion, String schemaVersion, Instant serverTime) {}
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record PageMeta(String requestId, String traceId, String apiVersion, String schemaVersion, Instant serverTime,
                           String nextCursor, Instant snapshotAt, boolean hasMore, int pageSize) {}
    public record PolicyListResponse(List<PolicyVersionResponse> items) {}
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record PolicyMutationResponse(PolicyVersionResponse policy, AuditLinkResponse auditLink,
                                         CacheInvalidationResponse cacheInvalidation) {}
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record PolicyVersionResponse(String policyVersionId, String version, String status, int revision,
                                        TenantResponse tenant, PolicyDocument document, String artifactDigest,
                                        Instant createdAt, Instant updatedAt, SubjectResponse createdBy,
                                        SubjectResponse submittedBy, SubjectResponse approvedBy,
                                        SubjectResponse activatedBy, SubjectResponse revokedBy,
                                        SeparationOfDutiesResponse separationOfDuties,
                                        List<AuditLinkResponse> auditLinks,
                                        CacheInvalidationResponse cacheInvalidation) {}
    public record TenantResponse(String tenantId, String provenance, Instant derivedAt) {}
    public record SubjectResponse(String subjectId, String source, Instant derivedAt) {}
    public record SeparationOfDutiesResponse(boolean independentApprovalRequired, boolean authorMayApprove,
                                             boolean submitterMayApprove, boolean satisfied) {}
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record AuditLinkResponse(String auditId, String decisionId, String requestId, String traceId, Instant recordedAt) {}
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CacheInvalidationResponse(String invalidationId, boolean required, String status, String scope,
                                            Instant issuedAt, Instant completedAt,
                                            boolean denyUntilCurrentVersionProven) {}
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ErrorEnvelope(ApiError error, Meta meta) {}
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ApiError(String errorCode, String message, boolean retryable, Map<String, Object> details) {}
}

/** Internal B8 PEP/PDP endpoints. Service identity is verified before request data is evaluated. */
@RestController
@RequestMapping("/internal/v1/iam")
final class IamPolicyPdpController {
    private final PolicyControlService policies;
    private final PdpDecisionService pdp;

    IamPolicyPdpController(PolicyControlService policies, PdpDecisionService pdp) {
        this.policies = Objects.requireNonNull(policies, "policies");
        this.pdp = Objects.requireNonNull(pdp, "pdp");
    }

    @GetMapping("/policy-bundles/active")
    ResponseEntity<IamPolicyControlController.SuccessEnvelope<PolicyBundleResponse>> activeBundle(Authentication authentication) {
        IamPolicyControlController.serviceIdentity(authentication);
        PolicyBundle bundle = policies.activeBundle();
        PolicyVersionRecord policy = bundle.policy();
        PolicyBundleResponse data = new PolicyBundleResponse(bundle.bundleId().toString(),
                new PolicyVersionContextResponse(policy.policyVersionId().toString(), policy.version(), "ACTIVE",
                        policy.activatedAt(), "NOT_REVOKED", "IAM_ACTIVE_POLICY_CONTROL_PLANE"), policy.document(),
                bundle.issuedAt(), bundle.expiresAt(), bundle.cacheMaxAgeSeconds(), "CONFIRMED_NOT_REVOKED",
                "IAM_SIGNED_VERSIONED_POLICY_BUNDLE");
        return IamPolicyControlController.success(HttpStatus.OK, data);
    }

    @PostMapping("/pdp/decisions")
    ResponseEntity<IamPolicyControlController.SuccessEnvelope<PdpDecisionResponse>> decide(Authentication authentication,
                                                                                              @RequestBody PdpAuthorizationRequest request) {
        VerifiedServiceIdentity identity = IamPolicyControlController.serviceIdentity(authentication);
        PdpDecision decision = pdp.decide(request, identity, requestId(), traceId());
        PdpDecisionResponse data = new PdpDecisionResponse(decision.decisionId().toString(), decision.decision(),
                decision.reasonCode(), decision.policyVersion(), decision.evaluatedAt(), decision.cacheUntil(),
                new EnforcementResponse("DENY", "FAIL_CLOSED", true, "REMOTE_PDP"),
                IamPolicyControlController.auditLink(decision.audit()));
        return IamPolicyControlController.success(HttpStatus.OK, data);
    }

    @ExceptionHandler(IamPolicyException.class)
    ResponseEntity<IamPolicyControlController.ErrorEnvelope> policyError(IamPolicyException exception,
                                                                           HttpServletRequest request) {
        return IamPolicyControlController.errorResponse(exception);
    }
    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<IamPolicyControlController.ErrorEnvelope> invalid(HttpServletRequest request) {
        return IamPolicyControlController.errorResponse(IamPolicyControlController.invalid());
    }

    private static String requestId() { return IamPolicyControlController.meta().requestId(); }
    private static String traceId() { return IamPolicyControlController.meta().traceId(); }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record PolicyBundleResponse(String bundleId, PolicyVersionContextResponse policy, PolicyDocument policyDocument,
                                Instant issuedAt, Instant expiresAt, int cacheMaxAgeSeconds, String revocationState,
                                String provenance) {}
    record PolicyVersionContextResponse(String policyVersionId, String version, String status, Instant effectiveAt,
                                        String revocationState, String provenance) {}
    @JsonInclude(JsonInclude.Include.NON_NULL)
    record PdpDecisionResponse(String decisionId, String decision, String reasonCode, String policyVersion,
                               Instant evaluatedAt, Instant cacheUntil, EnforcementResponse enforcement,
                               IamPolicyControlController.AuditLinkResponse auditLink) {}
    record EnforcementResponse(String defaultDecision, String failureMode, boolean localPepRequired, String decisionSource) {}
}
