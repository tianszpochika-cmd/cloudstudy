package com.englishflow.iam.domain;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.Set;

/**
 * Phase 1 adult-only gate. It accepts only trusted server-side evidence plus explicit
 * adult confirmation. It has no child, guardian, K12 or payment repository by design.
 */
public final class AdultGateService {

    public static final int MINIMUM_ADULT_AGE = 18;
    public static final Set<String> PROHIBITED_PHASE_1_FACTS = Set.of(
            "child_account",
            "guardian_relationship",
            "k12_profile",
            "minor_payment_profile");

    private final AuditFactPort audit;
    private final Clock clock;

    public AdultGateService(AuditFactPort audit, Clock clock) {
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public AdultGateResult evaluate(AdultGateCommand command) {
        Objects.requireNonNull(command, "command");
        TenantScope scope = TenantScope.derive(command.principalId());

        if (command.containsClientTrustedInput()) {
            return reject(scope, IamDecisionCode.CLIENT_TRUSTED_INPUT_REJECTED,
                    "iam.adult_gate.client_age_rejected");
        }
        if (command.clientAuthorityClaims() != null && command.clientAuthorityClaims().hasOverride()) {
            return reject(scope, IamDecisionCode.CLIENT_AUTHORITY_OVERRIDE,
                    "iam.authority.client_override_rejected");
        }
        if (!command.explicitAdultConfirmation()) {
            return reject(scope, IamDecisionCode.ADULT_CONFIRMATION_REQUIRED,
                    "iam.adult_gate.confirmation_required");
        }
        if (command.trustedAgeEvidence() == null) {
            return reject(scope, IamDecisionCode.ADULT_AGE_EVIDENCE_MISSING,
                    "iam.adult_gate.trusted_age_required");
        }
        if (command.trustedAgeEvidence().verifiedAt().isAfter(Instant.now(clock))) {
            return reject(scope, IamDecisionCode.ADULT_AGE_EVIDENCE_INVALID,
                    "iam.adult_gate.trusted_age_invalid");
        }
        if (command.trustedAgeEvidence().age() < MINIMUM_ADULT_AGE) {
            return reject(scope, IamDecisionCode.ADULT_AGE_BELOW_MINIMUM,
                    "iam.adult_gate.adult_only");
        }

        return decide(scope, IamDecisionCode.ADULT_GATE_ALLOWED, true, "iam.adult_gate.allowed");
    }

    private AdultGateResult reject(TenantScope scope, IamDecisionCode code, String messageKey) {
        return decide(scope, code, false, messageKey);
    }

    private AdultGateResult decide(
            TenantScope scope,
            IamDecisionCode code,
            boolean allowed,
            String messageKey) {
        Instant now = Instant.now(clock);
        AuditDecision decision = AuditDecision.of(
                "adult_gate",
                code,
                allowed,
                scope,
                now,
                Set.of(),
                PROHIBITED_PHASE_1_FACTS);
        try {
            audit.append(decision);
        } catch (RuntimeException exception) {
            throw new IamPolicyException(IamDecisionCode.AUDIT_UNAVAILABLE, "iam.audit.unavailable");
        }
        return new AdultGateResult(allowed, code, messageKey, scope, decision);
    }
}
