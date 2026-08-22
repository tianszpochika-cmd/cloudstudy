package com.englishflow.iam.domain;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;

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
        ConsentRecord record = new ConsentRecord(
                context.principalId(),
                context.scope(),
                command.type(),
                command.version(),
                true,
                Instant.now(clock));
        ConsentRecord saved = consents.save(record);
        appendAudit(context.scope(), IamDecisionCode.CONSENT_RECORDED, "consent_recorded");
        return saved;
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
        ConsentRecord saved = consents.save(withdrawn);
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
