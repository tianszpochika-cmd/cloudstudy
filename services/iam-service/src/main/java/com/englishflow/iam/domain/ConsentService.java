package com.englishflow.iam.domain;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/** Versioned consent service scoped to an authenticated platform principal. */
public final class ConsentService {

    private static final Set<String> SUPPORTED_CAPABILITIES = Set.of(
            "ACCOUNT", "LEARNING", "ANALYTICS", "VOICE_REMOTE_RECORD", "VOICE_REMOTE_UPLOAD",
            "VOICE_REMOTE_PROCESS", "VOICE_REMOTE_REPLAY");

    private final ConsentStore consents;
    private final ConsentPolicyPort policy;
    private final AuditFactPort audit;
    private final Clock clock;
    private final SessionService sessions;
    private final IamTransactionRunner transactions;

    public ConsentService(
            ConsentStore consents,
            ConsentPolicyPort policy,
            AuditFactPort audit,
            Clock clock) {
        this(consents, policy, audit, clock, null, IamTransactionRunner.direct());
    }

    public ConsentService(
            ConsentStore consents,
            ConsentPolicyPort policy,
            AuditFactPort audit,
            Clock clock,
            SessionService sessions,
            IamTransactionRunner transactions) {
        this.consents = Objects.requireNonNull(consents, "consents");
        this.policy = Objects.requireNonNull(policy, "policy");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.sessions = sessions;
        this.transactions = Objects.requireNonNull(transactions, "transactions");
    }

    public ConsentRecord record(ServerPrincipalContext context, ConsentCommand command) {
        RecordOutcome outcome = transactions.execute(() -> {
            try {
                return new RecordOutcome(recordWithinTransaction(context, command), null);
            } catch (IamPolicyException exception) {
                if (infrastructureFailure(exception.code())) throw exception;
                // Return a value from the transaction callback so an expected rejection is
                // committed by the outer idempotency boundary rather than becoming rollback-only.
                return new RecordOutcome(null, exception);
            }
        });
        if (outcome.failure() != null) throw outcome.failure();
        return outcome.record();
    }

    private ConsentRecord recordWithinTransaction(ServerPrincipalContext context, ConsentCommand command) {
        Objects.requireNonNull(context, "context");
        Objects.requireNonNull(command, "command");
        context.rejectClientAuthority(command.clientAuthorityClaims());
        ConsentPolicyDescriptor descriptor = policyDescriptor(command.type());
        if (!policy.writesEnabled()) {
            throw new IamPolicyException(IamDecisionCode.POLICY_UNAVAILABLE,
                    "iam.consent.policy_not_provisioned");
        }
        if (!descriptor.isPublishedAt(Instant.now(clock))) {
            throw new IamPolicyException(IamDecisionCode.POLICY_UNAVAILABLE,
                    "iam.consent.document_not_published");
        }
        if (!command.accepted()) {
            throw new IamPolicyException(
                    IamDecisionCode.CONSENT_REQUIRES_EXPLICIT_ACCEPTANCE,
                    "iam.consent.explicit_acceptance_required");
        }
        if (!descriptor.documentVersion().equals(command.version())) {
            throw new IamPolicyException(
                    IamDecisionCode.CONSENT_VERSION_MISMATCH,
                    "iam.consent.version_mismatch");
        }
        assertExpectedDigest(command.expectedDocumentDigest(), descriptor.documentDigest());
        // The browser may retry onboarding after a callback refresh or a transient response.
        // A previously granted version is the same durable fact, not a new write, so replaying
        // this command must return the existing record without creating a duplicate audit fact.
        Optional<ConsentRecord> current = consents.findForUpdate(context.principalId(), command.type());
        if (current.isPresent()
                && current.get().accepted()
                && current.get().version().equals(command.version())
                && samePublishedFact(current.get(), descriptor)) {
            return current.get();
        }
        // A changed document/policy digest is an explicit re-consent, not a replay. The new
        // server-published fact is appended after the CAS, while the stale record remains in
        // immutable history. The optional client digest assertion above still rejects a caller
        // that observed a different document than the server currently publishes.
        Instant recordedAt = Instant.now(clock);
        ConsentRecord record = new ConsentRecord(
                java.util.UUID.randomUUID(),
                context.principalId(),
                context.scope(),
                command.type(),
                descriptor.purpose(),
                descriptor.requirement().name(),
                descriptor.requiredFor("LEARNING"),
                descriptor.documentVersion(),
                descriptor.documentDigest(),
                descriptor.policyVersion(),
                descriptor.policyDigest(),
                true,
                recordedAt,
                recordedAt,
                descriptor.withdrawalEffect(),
                descriptor.revokeSessions());
        appendAudit(context.scope(), IamDecisionCode.CONSENT_RECORDED, "consent_recorded");
        ConsentRecord saved = consents.appendIfCurrent(record, current.orElse(null));
        return saved;
    }

    /** Returns whether base and learning-scoped required consents are current. */
    public boolean hasAllRequiredConsent(PrincipalId principalId) {
        return hasRequiredConsentFor(principalId, "LEARNING");
    }

    /**
     * Checks only the consent purposes required for one server-selected capability. Optional
     * analytics consent and capability-specific voice consent therefore cannot become global
     * account gates.
     */
    public boolean hasRequiredConsentFor(PrincipalId principalId, String capability) {
        Objects.requireNonNull(principalId, "principalId");
        try {
            if (!policy.evaluationEnabled() || capability == null
                    || !SUPPORTED_CAPABILITIES.contains(capability)) return false;
            return policy.descriptors().stream()
                    .filter(descriptor -> descriptor.requiredFor(capability)
                            && descriptor.isPublishedAt(Instant.now(clock)))
                    .allMatch(descriptor -> consents.find(principalId, descriptor.type())
                            .map(record -> samePublishedFact(record, descriptor) && record.accepted())
                            .orElse(false));
        } catch (RuntimeException unavailable) {
            // A missing policy or store must restrict the capability rather than accidentally
            // issuing a fully-authorized token.
            return false;
        }
    }

    public ConsentRecord withdraw(ServerPrincipalContext context, ConsentType type) {
        return withdraw(context, type, policy.currentVersion(type));
    }

    /**
     * Withdraws the currently published document only when the caller's version assertion is
     * still current. A stale client must re-read the policy before changing the durable fact.
     */
    public ConsentRecord withdraw(ServerPrincipalContext context, ConsentType type, ConsentVersion expectedVersion) {
        return withdraw(context, type, expectedVersion, null);
    }

    public ConsentRecord withdraw(ServerPrincipalContext context, ConsentType type,
                                  ConsentVersion expectedVersion, String expectedDocumentDigest) {
        WithdrawalOutcome outcome = transactions.execute(() -> {
            try {
                return new WithdrawalOutcome(withdrawWithinTransaction(context, type, expectedVersion,
                        expectedDocumentDigest), null);
            } catch (IamPolicyException exception) {
                if (infrastructureFailure(exception.code())) throw exception;
                // Return a value from the transaction callback so a stale version rejection is
                // committed by the outer idempotency boundary rather than becoming rollback-only.
                return new WithdrawalOutcome(null, exception);
            }
        });
        if (outcome.failure() != null) throw outcome.failure();
        return outcome.record();
    }

    private ConsentRecord withdrawWithinTransaction(ServerPrincipalContext context, ConsentType type,
                                                    ConsentVersion expectedVersion,
                                                    String expectedDocumentDigest) {
        Objects.requireNonNull(context, "context");
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(expectedVersion, "expectedVersion");
        ConsentPolicyDescriptor descriptor = policyDescriptor(type);
        if (!policy.writesEnabled()) {
            throw new IamPolicyException(IamDecisionCode.POLICY_UNAVAILABLE,
                    "iam.consent.policy_not_provisioned");
        }
        if (!descriptor.isPublishedAt(Instant.now(clock))) {
            throw new IamPolicyException(IamDecisionCode.POLICY_UNAVAILABLE,
                    "iam.consent.document_not_published");
        }
        if (!descriptor.documentVersion().equals(expectedVersion)) {
            throw new IamPolicyException(IamDecisionCode.CONSENT_VERSION_MISMATCH,
                    "iam.consent.version_mismatch");
        }
        assertExpectedDigest(expectedDocumentDigest, descriptor.documentDigest());
        ConsentRecord current = consents.findForUpdate(context.principalId(), type)
                .orElseThrow(() -> new IamPolicyException(
                        IamDecisionCode.CONSENT_VERSION_MISMATCH,
                        "iam.consent.not_found"));
        if (!current.version().equals(expectedVersion) || !samePublishedFact(current, descriptor)) {
            throw new IamPolicyException(IamDecisionCode.CONSENT_VERSION_MISMATCH,
                    "iam.consent.version_mismatch");
        }
        if (!current.accepted()) {
            return current;
        }
        Instant recordedAt = Instant.now(clock);
        ConsentRecord withdrawn = new ConsentRecord(
                java.util.UUID.randomUUID(),
                context.principalId(),
                context.scope(),
                type,
                descriptor.purpose(),
                descriptor.requirement().name(),
                descriptor.requiredFor("LEARNING"),
                descriptor.documentVersion(),
                descriptor.documentDigest(),
                descriptor.policyVersion(),
                descriptor.policyDigest(),
                false,
                recordedAt,
                recordedAt,
                descriptor.withdrawalEffect(),
                descriptor.revokeSessions());
        appendAudit(context.scope(), IamDecisionCode.CONSENT_WITHDRAWN, "consent_withdrawn");
        ConsentRecord saved = consents.appendIfCurrent(withdrawn, current);
        if (sessions != null && descriptor.revokeSessions()) {
            sessions.revokeAll(context.principalId(), "consent_withdrawn:" + descriptor.purpose());
        }
        return saved;
    }

    public ConsentPolicyDescriptor policyDescriptor(ConsentType type) {
        try {
            ConsentPolicyDescriptor descriptor = policy.descriptor(type);
            if (descriptor == null || descriptor.type() != type || !type.purpose().equals(descriptor.purpose())) {
                throw new IamPolicyException(IamDecisionCode.POLICY_UNAVAILABLE,
                        "iam.consent.policy_invalid");
            }
            return descriptor;
        } catch (IamPolicyException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new IamPolicyException(IamDecisionCode.POLICY_UNAVAILABLE,
                    "iam.consent.policy_unavailable");
        }
    }

    public boolean policyEvaluationEnabled() {
        return policy.evaluationEnabled();
    }

    private static void assertExpectedDigest(String expected, String published) {
        if (expected != null
                && !SecretDigests.constantTimeEquals(expected, published)) {
            throw new IamPolicyException(IamDecisionCode.CONSENT_VERSION_MISMATCH,
                    "iam.consent.document_digest_mismatch");
        }
    }

    private static boolean samePublishedFact(ConsentRecord record, ConsentPolicyDescriptor descriptor) {
        return record != null
                && record.type() == descriptor.type()
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

    private void appendAudit(TenantScope scope, IamDecisionCode code, String type) {
        try {
            audit.append(AuditDecision.of(type, code, true, scope, Instant.now(clock),
                    java.util.Set.of(), java.util.Set.of()));
        } catch (RuntimeException exception) {
            throw new IamPolicyException(IamDecisionCode.AUDIT_UNAVAILABLE, "iam.audit.unavailable");
        }
    }

    private static boolean infrastructureFailure(IamDecisionCode code) {
        return switch (code) {
            case AUDIT_UNAVAILABLE, IAM_PERSISTENCE_UNAVAILABLE, SESSION_STORE_UNAVAILABLE,
                    IDEMPOTENCY_RESULT_UNAVAILABLE -> true;
            default -> false;
        };
    }

    private record WithdrawalOutcome(ConsentRecord record, IamPolicyException failure) {}
    private record RecordOutcome(ConsentRecord record, IamPolicyException failure) {}
}
