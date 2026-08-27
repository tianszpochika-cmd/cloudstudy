package com.englishflow.iam.domain;

import java.time.Clock;
import java.time.Instant;
import java.util.Arrays;
import java.util.Objects;
import java.util.Optional;

/** Versioned consent service scoped to an authenticated platform principal. */
public final class ConsentService {

    private final ConsentStore consents;
    private final ConsentPolicyPort policy;
    private final AuditFactPort audit;
    private final Clock clock;

    public ConsentService(
            ConsentStore consents,
            ConsentPolicyPort policy,
            AuditFactPort audit,
            Clock clock) {
        this.consents = Objects.requireNonNull(consents, "consents");
        this.policy = Objects.requireNonNull(policy, "policy");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public ConsentRecord record(ServerPrincipalContext context, ConsentCommand command) {
        Objects.requireNonNull(context, "context");
        Objects.requireNonNull(command, "command");
        context.rejectClientAuthority(command.clientAuthorityClaims());
        if (!command.accepted()) {
            throw new IamPolicyException(
                    IamDecisionCode.CONSENT_REQUIRES_EXPLICIT_ACCEPTANCE,
                    "iam.consent.explicit_acceptance_required");
        }
        if (!policy.currentVersion(command.type()).equals(command.version())) {
            throw new IamPolicyException(
                    IamDecisionCode.CONSENT_VERSION_MISMATCH,
                    "iam.consent.version_mismatch");
        }
        // The browser may retry onboarding after a callback refresh or a transient response.
        // A previously granted version is the same durable fact, not a new write, so replaying
        // this command must return the existing record without creating a duplicate audit fact.
        Optional<ConsentRecord> current = consents.find(context.principalId(), command.type());
        if (current.isPresent()
                && current.get().accepted()
                && current.get().version().equals(command.version())) {
            return current.get();
        }
        ConsentRecord record = new ConsentRecord(
                context.principalId(),
                context.scope(),
                command.type(),
                command.version(),
                true,
                Instant.now(clock));
        ConsentRecord saved = consents.append(record);
        appendAudit(context.scope(), IamDecisionCode.CONSENT_RECORDED, "consent_recorded");
        return saved;
    }

    /** Returns the current IAM consent Gate state for a principal. */
    public boolean hasAllRequiredConsent(PrincipalId principalId) {
        Objects.requireNonNull(principalId, "principalId");
        return Arrays.stream(ConsentType.values())
                .allMatch(type -> consents.find(principalId, type)
                        .map(record -> record.accepted() && policy.currentVersion(type).equals(record.version()))
                        .orElse(false));
    }

    public ConsentRecord withdraw(ServerPrincipalContext context, ConsentType type) {
        Objects.requireNonNull(context, "context");
        Objects.requireNonNull(type, "type");
        ConsentRecord current = consents.find(context.principalId(), type)
                .orElseThrow(() -> new IamPolicyException(
                        IamDecisionCode.CONSENT_VERSION_MISMATCH,
                        "iam.consent.not_found"));
        ConsentRecord withdrawn = new ConsentRecord(
                context.principalId(),
                context.scope(),
                type,
                current.version(),
                false,
                Instant.now(clock));
        ConsentRecord saved = consents.append(withdrawn);
        appendAudit(context.scope(), IamDecisionCode.CONSENT_WITHDRAWN, "consent_withdrawn");
        return saved;
    }

    private void appendAudit(TenantScope scope, IamDecisionCode code, String type) {
        try {
            audit.append(AuditDecision.of(type, code, true, scope, Instant.now(clock),
                    java.util.Set.of(), java.util.Set.of()));
        } catch (RuntimeException exception) {
            throw new IamPolicyException(IamDecisionCode.AUDIT_UNAVAILABLE, "iam.audit.unavailable");
        }
    }
}
