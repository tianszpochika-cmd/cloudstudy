package com.englishflow.iam.domain;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Strict remote PDP for the three contract-approved escalation reasons only. It re-derives every
 * allow-relevant principal fact from IAM stores and treats any unsupported fact as a DENY.
 */
public final class PdpDecisionService {
    private static final PrincipalId SYSTEM_AUDIT_PRINCIPAL = new PrincipalId(new UUID(0L, 0L));
    private static final Duration RESOURCE_FACT_MAX_AGE = Duration.ofMinutes(5);
    private static final Duration RESPONSE_CACHE_TTL = Duration.ofSeconds(60);
    /** B8 purpose-to-durable-fact mapping is server-owned; the request body is never authoritative. */
    private static final Map<String, ConsentType> DURABLE_CONSENT_PURPOSES = Map.of(
            "ACCOUNT_TERMS", ConsentType.TERMS_OF_SERVICE,
            "PRIVACY_NOTICE", ConsentType.PRIVACY_NOTICE,
            "ADULT_LEARNING_ELIGIBILITY", ConsentType.ADULT_LEARNING,
            "PRODUCT_ANALYTICS", ConsentType.PRODUCT_ANALYTICS,
            "ADULT_VOICE_RECORDING_REMOTE_STORAGE_AND_REPLAY", ConsentType.VOICE_RECORDING);

    private final PolicyControlService policies;
    private final AccountStore accounts;
    private final SessionService sessions;
    private final AdultGateFactStore adultGates;
    private final ConsentStore consents;
    private final ConsentPolicyPort consentPolicy;
    private final AuditFactPort audit;
    private final Clock clock;

    public PdpDecisionService(PolicyControlService policies, AccountStore accounts, SessionService sessions,
                              AdultGateFactStore adultGates, ConsentStore consents, AuditFactPort audit, Clock clock) {
        this(policies, accounts, sessions, adultGates, consents,
                StaticConsentPolicy.legacyCompatibility(), audit, clock);
    }

    public PdpDecisionService(PolicyControlService policies, AccountStore accounts, SessionService sessions,
                              AdultGateFactStore adultGates, ConsentStore consents,
                              ConsentPolicyPort consentPolicy, AuditFactPort audit, Clock clock) {
        this.policies = Objects.requireNonNull(policies, "policies");
        this.accounts = Objects.requireNonNull(accounts, "accounts");
        this.sessions = Objects.requireNonNull(sessions, "sessions");
        this.adultGates = Objects.requireNonNull(adultGates, "adultGates");
        this.consents = Objects.requireNonNull(consents, "consents");
        this.consentPolicy = Objects.requireNonNull(consentPolicy, "consentPolicy");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public PdpDecision decide(PdpAuthorizationRequest request, VerifiedServiceIdentity caller,
                              String requestId, String traceId) {
        Instant now = Instant.now(clock);
        PrincipalId auditPrincipal = requestedPrincipal(request);
        PolicyVersionRecord active = null;
        try {
            if (!validInvocation(request)) return denied("CONTEXT_MISSING", null, auditPrincipal, now, requestId, traceId);
            if (!matchesServiceIdentity(request.serviceIdentity(), caller)) {
                return denied("INVALID_SERVICE_IDENTITY", null, auditPrincipal, now, requestId, traceId);
            }
            // Consent policy provisioning is a prerequisite for every PDP authorization
            // decision. A deployment with only local candidate descriptors must not allow an
            // unrelated policy rule to bypass the missing published consent facts.
            if (!consentPolicy.evaluationEnabled()) {
                return denied("POLICY_UNAVAILABLE", null, auditPrincipal, now, requestId, traceId);
            }
            active = policies.activePolicy();
            String policyIssue = policyContextIssue(request.policy(), active);
            if (policyIssue != null) return denied(policyIssue, active, auditPrincipal, now, requestId, traceId);
            Validation principal = validatePrincipal(request.principal(), now);
            if (principal.reasonCode() != null) {
                return denied(principal.reasonCode(), active, principal.principal(), now, requestId, traceId);
            }
            String resourceIssue = resourceIssue(request.resource(), caller, now);
            if (resourceIssue != null) return denied(resourceIssue, active, principal.principal(), now, requestId, traceId);
            String ruleResult = evaluate(active.document(), request, principal.account(), now);
            return "ALLOWED".equals(ruleResult)
                    ? allowed(active, principal.principal(), now, requestId, traceId)
                    : denied(ruleResult, active, principal.principal(), now, requestId, traceId);
        } catch (IamPolicyException exception) {
            if (exception.code() == IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE
                    || exception.code() == IamDecisionCode.AUDIT_UNAVAILABLE
                    || exception.code() == IamDecisionCode.SESSION_STORE_UNAVAILABLE) {
                throw exception;
            }
            return denied(reasonFor(exception.code()), active, auditPrincipal, now, requestId, traceId);
        } catch (RuntimeException exception) {
            return denied("PDP_ERROR", active, auditPrincipal, now, requestId, traceId);
        }
    }

    private static boolean validInvocation(PdpAuthorizationRequest request) {
        return request != null && Set.of("HIGH_RISK_OPERATION", "DYNAMIC_POLICY", "SECURITY_CACHE_MISS")
                .contains(request.invocationReason()) && safeText(request.action(), 128)
                && request.principal() != null && request.resource() != null && request.policy() != null
                && request.serviceIdentity() != null;
    }

    private static boolean matchesServiceIdentity(PdpAuthorizationRequest.ServiceIdentityContext body,
                                                  VerifiedServiceIdentity caller) {
        return body != null && caller != null && caller.serviceId().equals(body.serviceId())
                && "VALIDATED_SERVICE_JWT_BOUND_TO_PEP".equals(body.credentialBinding())
                && caller.audiences().contains(body.audience()) && caller.issuedAt().equals(body.authenticatedAt());
    }

    private static String policyContextIssue(PdpAuthorizationRequest.PolicyContext context,
                                             PolicyVersionRecord active) {
        if (context == null || context.policy() == null || !safeText(context.bundleVersion(), 128)) return "CONTEXT_MISSING";
        if ("EXPIRED".equals(context.cacheState())) return "POLICY_VERSION_EXPIRED";
        if (!Set.of("CURRENT", "MISS").contains(context.cacheState())) return "REVOCATION_UNCERTAIN";
        if (!"CONFIRMED_NOT_REVOKED".equals(context.revocationState())) return "REVOCATION_UNCERTAIN";
        PdpAuthorizationRequest.PolicyVersion policy = context.policy();
        if (!active.policyVersionId().toString().equals(policy.policyVersionId())
                || !active.version().equals(policy.version()) || !"ACTIVE".equals(policy.status())
                || active.activatedAt() == null || !active.activatedAt().equals(policy.effectiveAt())
                || !"NOT_REVOKED".equals(policy.revocationState())
                || !"IAM_ACTIVE_POLICY_CONTROL_PLANE".equals(policy.provenance())
                || !active.version().equals(context.bundleVersion())) {
            return "POLICY_VERSION_EXPIRED";
        }
        return null;
    }

    private Validation validatePrincipal(PdpAuthorizationRequest.PrincipalContext context, Instant now) {
        if (context == null || context.subject() == null || context.tenant() == null || context.phase() == null
                || context.adultGate() == null || context.consent() == null || context.deviceTrust() == null
                || context.authorityProvenance() == null) return Validation.denied("CONTEXT_MISSING");
        PrincipalId principal = parsePrincipal(context.subject().subjectId());
        if (principal == null) return Validation.denied("CONTEXT_MISSING");
        AccountRecord account = accounts.findByPrincipalId(principal).orElse(null);
        if (account == null || account.status() != AccountStatus.ACTIVE) return Validation.denied(principal, "SESSION_REVOKED");
        if (!"IAM_VALIDATED_JWT_AND_SESSION".equals(context.subject().source()) || context.subject().derivedAt() == null
                || !platformTenant(context.tenant()) || !sameSet(context.roles(), account.roles())
                || !sameSet(context.permissions(), account.permissions()) || !authorityValid(context.authorityProvenance())) {
            return Validation.denied(principal, "CONTEXT_MISSING");
        }
        if (!phaseValid(context.phase())) return Validation.denied(principal, "POLICY_DENIED");
        String adultIssue = adultIssue(principal, context.adultGate(), now);
        if (adultIssue != null) return Validation.denied(principal, adultIssue);
        String deviceIssue = deviceIssue(principal, context.deviceTrust(), now);
        if (deviceIssue != null) return Validation.denied(principal, deviceIssue);
        return new Validation(principal, account, null);
    }

    private String adultIssue(PrincipalId principal, PdpAuthorizationRequest.AdultGate context, Instant now) {
        AdultGateFact fact = adultGates.find(principal, now);
        if (!"APPROVED".equals(fact.status())) return "ADULT_GATE_REQUIRED";
        if (context == null || !"PASSED".equals(context.status()) || !"ELIGIBLE".equals(context.learningAccess())
                || !fact.policyVersion().equals(context.policyVersion()) || !fact.evaluatedAt().equals(context.effectiveAt())
                || !fact.evaluatedAt().equals(context.policyAsOf()) || !Integer.valueOf(18).equals(context.minimumAge())
                || !"SERVER_VERIFIED".equals(context.evidenceStatus()) || !safeDigest(context.evidenceDigest())
                || context.evaluationProvenance() == null || context.revalidation() == null) {
            return "ADULT_GATE_REQUIRED";
        }
        PdpAuthorizationRequest.AdultProvenance provenance = context.evaluationProvenance();
        PdpAuthorizationRequest.Revalidation revalidation = context.revalidation();
        if (!"IAM_SERVER_DERIVED".equals(provenance.authority()) || !"iam-service".equals(provenance.evaluator())
                || !"SERVER_RECOGNIZED_EVIDENCE".equals(provenance.evidenceSource())
                || !fact.evaluatedAt().equals(provenance.evaluatedAt()) || !Boolean.FALSE.equals(provenance.rawEvidenceReturned())
                || !"CURRENT".equals(revalidation.status()) || !Boolean.FALSE.equals(revalidation.required())
                || !fact.evaluatedAt().equals(revalidation.evaluatedAt())) {
            return "ADULT_GATE_REQUIRED";
        }
        return null;
    }

    private String consentIssue(PrincipalId principal, PdpAuthorizationRequest.Consent context,
                                Set<String> requiredPurposes, Instant now) {
        if (!consentPolicy.evaluationEnabled()) return "POLICY_UNAVAILABLE";
        if (context == null || !Boolean.TRUE.equals(context.required()) || !Boolean.TRUE.equals(context.accepted())
                || !"ELIGIBLE".equals(context.learningAccess()) || !safeText(context.version(), 128)
                || !safeText(context.policyVersion(), 128) || context.evaluatedAt() == null
                || context.evaluatedAt().isAfter(now.plusSeconds(5))
                || context.evaluatedAt().isBefore(now.minus(Duration.ofMinutes(5)))
                || context.revalidation() == null || context.provenance() == null
                || !sameSet(context.requiredPurposes(), requiredPurposes)
                || !sameSet(context.unsatisfiedPurposes(), Set.of())) return "CONSENT_REQUIRED";
        for (String purpose : requiredPurposes) {
            ConsentType type = DURABLE_CONSENT_PURPOSES.get(purpose);
            if (type == null) return "CONSENT_REQUIRED";
            ConsentPolicyDescriptor descriptor;
            try {
                descriptor = consentPolicy.descriptor(type);
            } catch (RuntimeException exception) {
                return "CONSENT_REQUIRED";
            }
            if (!descriptor.isPublishedAt(now)
                    || !descriptor.documentVersion().value().equals(context.version())
                    || !descriptor.policyVersion().value().equals(context.policyVersion())) {
                return "CONSENT_REQUIRED";
            }
            Optional<ConsentRecord> record = consents.find(principal, type);
            if (record.isEmpty() || !record.get().accepted()
                    || !sameConsentFact(record.get(), descriptor)) {
                return "CONSENT_REQUIRED";
            }
        }
        PdpAuthorizationRequest.Revalidation revalidation = context.revalidation();
        PdpAuthorizationRequest.ConsentProvenance provenance = context.provenance();
        if (!"CURRENT".equals(revalidation.status()) || !Boolean.FALSE.equals(revalidation.required())
                || revalidation.evaluatedAt() == null
                || !context.evaluatedAt().equals(revalidation.evaluatedAt())
                || !"IAM_SERVER_RECORDED_CONSENT".equals(provenance.authority())
                || provenance.recordedAt() == null || !"PUBLISHED_DOCUMENT_VERSION_AND_DIGEST".equals(provenance.documentSource())
                || !"IAM_ACTIVE_POLICY_CONTROL_PLANE".equals(provenance.policySource())) return "CONSENT_REQUIRED";
        return null;
    }

    private String deviceIssue(PrincipalId principal, PdpAuthorizationRequest.DeviceTrust context, Instant now) {
        if (context == null || !"REGISTERED".equals(context.trustLevel()) || !"ACTIVE".equals(context.sessionStatus())
                || !"IAM_SERVER_OWNED_DEVICE_AND_SESSION".equals(context.provenance()) || context.evaluatedAt() == null) {
            return "SESSION_REVOKED";
        }
        try {
            DeviceId device = new DeviceId(context.deviceId());
            return sessions.findByDevice(principal, device).stream()
                    .anyMatch(session -> session.status() == SessionStatus.ACTIVE
                            && session.expiresAt().isAfter(now)
                            && TenantScope.PLATFORM_TENANT.equals(session.scope().tenantId())) ? null : "SESSION_REVOKED";
        } catch (RuntimeException exception) {
            return "SESSION_REVOKED";
        }
    }

    private static boolean phaseValid(PdpAuthorizationRequest.Phase phase) {
        return "P1".equals(phase.currentPhase()) && "ELIGIBLE".equals(phase.learningAccess())
                && "IAM_SERVER_DERIVED_PHASE_GATE".equals(phase.provenance());
    }

    private static boolean authorityValid(PdpAuthorizationRequest.AuthorityProvenance provenance) {
        return "IAM_SERVER_DERIVED".equals(provenance.authority()) && provenance.derivedAt() != null
                && "VALIDATED_IAM_RS256_JWT".equals(provenance.jwtValidation())
                && "IAM_SERVER_DERIVED_TENANT".equals(provenance.tenantSource())
                && "IAM_ROLE_PERMISSION_ASSIGNMENTS".equals(provenance.rolePermissionSource())
                && "IAM_ACTIVE_VERSIONED_POLICY".equals(provenance.policySource())
                && "CONFIRMED_NOT_REVOKED".equals(provenance.revocationState());
    }

    private static boolean platformTenant(PdpAuthorizationRequest.Tenant tenant) {
        return TenantScope.PLATFORM_TENANT.equals(tenant.tenantId()) && tenant.derivedAt() != null
                && "IAM_PLATFORM_TENANT".equals(tenant.provenance());
    }

    private static String resourceIssue(PdpAuthorizationRequest.ResourceContext resource,
                                         VerifiedServiceIdentity caller, Instant now) {
        if (resource == null || !safeText(resource.resourceType(), 128) || !safeText(resource.resourceId(), 256)
                || resource.owner() == null || resource.tenant() == null || resource.provenance() == null) {
            return "RESOURCE_PROVENANCE_MISSING";
        }
        if (!Objects.equals("RESOURCE_OWNER_SERVICE", resource.owner().provenance()) || !safeText(resource.owner().ownerId(), 256)
                || !platformTenant(resource.tenant())) return "TENANT_PROVENANCE_MISMATCH";
        if (!"P1".equals(resource.phase()) || !Set.of("VALID", "NOT_APPLICABLE").contains(resource.contentRights())) {
            return "POLICY_DENIED";
        }
        PdpAuthorizationRequest.ResourceProvenance provenance = resource.provenance();
        if (!caller.serviceId().equals(provenance.ownerService()) || provenance.resolvedAt() == null
                || provenance.resolvedAt().isAfter(now.plusSeconds(5))
                || provenance.resolvedAt().isBefore(now.minus(RESOURCE_FACT_MAX_AGE)) || !safeDigest(provenance.factDigest())) {
            return "OWNER_PROVENANCE_MISMATCH";
        }
        return null;
    }

    private String evaluate(PolicyDocument document, PdpAuthorizationRequest request, AccountRecord account,
                            Instant now) {
        Set<String> boundPermissions = new LinkedHashSet<>();
        for (PolicyDocument.RoleBinding binding : document.roleBindings()) {
            if (account.roles().contains(binding.roleCode())) boundPermissions.addAll(binding.permissions());
        }
        String deferred = "POLICY_DENIED";
        boolean allowMatched = false;
        boolean denyMatched = false;
        for (PolicyDocument.PolicyRule rule : document.rules()) {
            if (!rule.actions().contains(request.action()) || !rule.resourceTypes().contains(request.resource().resourceType())
                    || !account.permissions().containsAll(rule.requiredPermissions())
                    || !boundPermissions.containsAll(rule.requiredPermissions())) continue;
            String condition = conditionIssue(rule.conditions(), request, account, account.principalId(), now);
            if (condition != null) {
                if (!"POLICY_DENIED".equals(condition)) deferred = condition;
                continue;
            }
            // Deny-overrides is deliberate: a reordered JSON array must never turn a denied
            // action into an allow. Continue scanning rather than returning the first match.
            if ("DENY".equals(rule.effect())) denyMatched = true;
            else allowMatched = true;
        }
        return denyMatched ? "POLICY_DENIED" : allowMatched ? "ALLOWED" : deferred;
    }

    private String conditionIssue(PolicyDocument.Conditions conditions, PdpAuthorizationRequest request,
                                  AccountRecord account, PrincipalId principal, Instant now) {
        if (!conditions.phases().isEmpty() && !conditions.phases().contains("P1")) return "POLICY_DENIED";
        if (Boolean.TRUE.equals(conditions.requiresAdultEligibility())
                && !"ELIGIBLE".equals(request.principal().adultGate().learningAccess())) return "ADULT_GATE_REQUIRED";
        if (!conditions.requiredConsentPurposes().isEmpty()) {
            String consentIssue = consentIssue(principal, request.principal().consent(),
                    Set.copyOf(conditions.requiredConsentPurposes()), now);
            if (consentIssue != null) return consentIssue;
        }
        if ("VERIFIED".equals(conditions.minimumDeviceTrust())) return "SESSION_REVOKED";
        if (!conditions.contentRights().isEmpty() && !conditions.contentRights().contains(request.resource().contentRights())) {
            return "POLICY_DENIED";
        }
        if (Boolean.TRUE.equals(conditions.ownerMatchRequired())
                && !account.principalId().toString().equals(request.resource().owner().ownerId())) return "OWNER_PROVENANCE_MISMATCH";
        if (Boolean.TRUE.equals(conditions.tenantMatchRequired())
                && !TenantScope.PLATFORM_TENANT.equals(request.resource().tenant().tenantId())) {
            return "TENANT_PROVENANCE_MISMATCH";
        }
        return null;
    }

    private static boolean sameConsentFact(ConsentRecord record, ConsentPolicyDescriptor descriptor) {
        return record != null && record.type() == descriptor.type()
                && descriptor.purpose().equals(record.purpose())
                && descriptor.requirement().name().equals(record.requirementScope())
                && descriptor.requiredFor("LEARNING") == record.required()
                && descriptor.documentVersion().equals(record.documentVersion())
                && SecretDigests.constantTimeEquals(record.documentDigest(), descriptor.documentDigest())
                && descriptor.policyVersion().equals(record.policyVersion())
                && SecretDigests.constantTimeEquals(record.policyDigest(), descriptor.policyDigest())
                && descriptor.withdrawalEffect() == record.withdrawalEffect()
                && descriptor.revokeSessions() == record.revokeSessions();
    }

    private PdpDecision allowed(PolicyVersionRecord active, PrincipalId principal, Instant now,
                                String requestId, String traceId) {
        return decision("ALLOW", "ALLOWED", active, principal, now, now.plus(RESPONSE_CACHE_TTL), requestId, traceId);
    }

    private PdpDecision denied(String reason, PolicyVersionRecord active, PrincipalId principal, Instant now,
                               String requestId, String traceId) {
        return decision("DENY", reason, active, principal, now, null, requestId, traceId);
    }

    private PdpDecision decision(String decision, String reason, PolicyVersionRecord active, PrincipalId principal,
                                 Instant now, Instant cacheUntil, String requestId, String traceId) {
        UUID decisionId = UUID.randomUUID();
        UUID policyId = active == null ? UUID.randomUUID() : active.policyVersionId();
        int revision = active == null ? 1 : active.revision();
        String version = active == null ? "unavailable" : active.version();
        PolicyAuditRecord link = new PolicyAuditRecord(decisionId, policyId, revision, "iam.authorization.pdp_decided.v1",
                principal == null ? SYSTEM_AUDIT_PRINCIPAL : principal, TenantScope.PLATFORM_TENANT,
                correlation(requestId), correlation(traceId), SecretDigests.sha256Hex("pdp:" + reason), now);
        try {
            audit.append(new AuditDecision(decisionId, "iam.authorization.pdp_decided.v1", codeFor(reason),
                    "ALLOW".equals(decision), link.actor(), TenantScope.PLATFORM_TENANT, now,
                    Set.of("pdp.decision"), Set.of(), Map.of("policy.version", version)));
        } catch (IamPolicyException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new IamPolicyException(IamDecisionCode.AUDIT_UNAVAILABLE, "iam.audit.unavailable");
        }
        return new PdpDecision(decisionId, decision, reason, version, now, cacheUntil, link);
    }

    private static IamDecisionCode codeFor(String reason) {
        return switch (reason) {
            case "ALLOWED" -> IamDecisionCode.POLICY_ACTIVATED;
            case "POLICY_UNAVAILABLE" -> IamDecisionCode.POLICY_UNAVAILABLE;
            case "POLICY_VERSION_EXPIRED" -> IamDecisionCode.POLICY_VERSION_EXPIRED;
            case "REVOCATION_UNCERTAIN" -> IamDecisionCode.POLICY_REVOKED;
            case "INVALID_SERVICE_IDENTITY" -> IamDecisionCode.PDP_INVALID_SERVICE_IDENTITY;
            case "RESOURCE_PROVENANCE_MISSING" -> IamDecisionCode.PDP_RESOURCE_PROVENANCE_MISSING;
            case "TENANT_PROVENANCE_MISMATCH" -> IamDecisionCode.PDP_TENANT_PROVENANCE_MISMATCH;
            case "OWNER_PROVENANCE_MISMATCH" -> IamDecisionCode.PDP_OWNER_PROVENANCE_MISMATCH;
            case "CONTEXT_MISSING" -> IamDecisionCode.PDP_CONTEXT_MISSING;
            case "PDP_ERROR" -> IamDecisionCode.PDP_ERROR;
            default -> IamDecisionCode.POLICY_PERMISSION_DENIED;
        };
    }

    private static String reasonFor(IamDecisionCode code) {
        return switch (code) {
            case POLICY_UNAVAILABLE -> "POLICY_UNAVAILABLE";
            case POLICY_VERSION_EXPIRED -> "POLICY_VERSION_EXPIRED";
            case POLICY_REVOKED -> "REVOCATION_UNCERTAIN";
            case PDP_INVALID_SERVICE_IDENTITY -> "INVALID_SERVICE_IDENTITY";
            case PDP_RESOURCE_PROVENANCE_MISSING -> "RESOURCE_PROVENANCE_MISSING";
            case PDP_TENANT_PROVENANCE_MISMATCH -> "TENANT_PROVENANCE_MISMATCH";
            case PDP_OWNER_PROVENANCE_MISMATCH -> "OWNER_PROVENANCE_MISMATCH";
            case PDP_CONTEXT_MISSING -> "CONTEXT_MISSING";
            default -> "PDP_ERROR";
        };
    }

    private static PrincipalId requestedPrincipal(PdpAuthorizationRequest request) {
        if (request == null || request.principal() == null || request.principal().subject() == null) return SYSTEM_AUDIT_PRINCIPAL;
        PrincipalId principal = parsePrincipal(request.principal().subject().subjectId());
        return principal == null ? SYSTEM_AUDIT_PRINCIPAL : principal;
    }

    private static PrincipalId parsePrincipal(String raw) {
        try { return raw == null ? null : new PrincipalId(UUID.fromString(raw)); }
        catch (IllegalArgumentException exception) { return null; }
    }

    private static boolean sameSet(List<String> supplied, Set<String> expected) {
        if (supplied == null || supplied.stream().anyMatch(value -> value == null || value.isBlank())) return false;
        Set<String> actual = new LinkedHashSet<>(supplied);
        return actual.size() == supplied.size() && actual.equals(expected);
    }

    private static boolean safeText(String value, int max) {
        return value != null && !value.isBlank() && value.length() <= max
                && value.chars().noneMatch(Character::isISOControl);
    }

    private static boolean safeDigest(String value) {
        return value != null && value.matches("[0-9a-fA-F]{16,160}");
    }

    private static String correlation(String value) {
        return safeText(value, 128) ? value : UUID.randomUUID().toString();
    }

    private record Validation(PrincipalId principal, AccountRecord account, String reasonCode) {
        private static Validation denied(String reason) { return new Validation(SYSTEM_AUDIT_PRINCIPAL, null, reason); }
        private static Validation denied(PrincipalId principal, String reason) { return new Validation(principal, null, reason); }
    }
}
