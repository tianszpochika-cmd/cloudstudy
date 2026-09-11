package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Immutable consent history entry. Rows recorded before V11 carry no server-published
 * document/policy digest. They stay readable as explicit legacy facts so replay and audit paths
 * can explain them, but they never authorize and never fabricate a published digest.
 */
public record ConsentHistoryEntry(
        UUID consentId,
        PrincipalId principalId,
        TenantScope scope,
        ConsentType type,
        String purpose,
        String requirementScope,
        boolean required,
        ConsentVersion documentVersion,
        String documentDigest,
        ConsentVersion policyVersion,
        String policyDigest,
        boolean accepted,
        Instant recordedAt,
        Instant effectiveAt,
        ConsentPolicyDescriptor.WithdrawalEffect withdrawalEffect,
        boolean revokeSessions,
        boolean legacy) {

    public ConsentHistoryEntry {
        Objects.requireNonNull(consentId, "consentId");
        Objects.requireNonNull(principalId, "principalId");
        Objects.requireNonNull(scope, "scope");
        if (!principalId.equals(scope.subject())) {
            throw new IllegalArgumentException("consent principal must match scope subject");
        }
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(purpose, "purpose");
        if (!type.purpose().equals(purpose)) {
            throw new IllegalArgumentException("consent purpose must match type");
        }
        if (requirementScope == null) {
            throw new IllegalArgumentException("consent requirement scope is required");
        }
        try {
            ConsentPolicyDescriptor.Requirement.valueOf(requirementScope);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("consent requirement scope is invalid", exception);
        }
        Objects.requireNonNull(documentVersion, "documentVersion");
        Objects.requireNonNull(policyVersion, "policyVersion");
        Objects.requireNonNull(recordedAt, "recordedAt");
        Objects.requireNonNull(effectiveAt, "effectiveAt");
        Objects.requireNonNull(withdrawalEffect, "withdrawalEffect");
        // A legacy entry never carries a digest, and a verified entry never hides one. This keeps
        // every caller able to distinguish "no published document was ever confirmed" from a real
        // server-published fact without inspecting a nullable field.
        if (legacy && (documentDigest != null || policyDigest != null)) {
            throw new IllegalArgumentException("legacy consent entries cannot carry published digests");
        }
        if (!legacy && (documentDigest == null || policyDigest == null)) {
            throw new IllegalArgumentException("verified consent entries require published digests");
        }
    }

    /** Projects a verified domain fact into a history entry. */
    public static ConsentHistoryEntry verified(ConsentRecord record) {
        Objects.requireNonNull(record, "record");
        return new ConsentHistoryEntry(record.consentId(), record.principalId(), record.scope(), record.type(),
                record.purpose(), record.requirementScope(), record.required(), record.documentVersion(),
                record.documentDigest(), record.policyVersion(), record.policyDigest(), record.accepted(),
                record.recordedAt(), record.effectiveAt(), record.withdrawalEffect(), record.revokeSessions(), false);
    }

    /**
     * Returns the verified authorization fact. A legacy entry fails closed instead of
     * manufacturing a published document or policy fact.
     */
    public ConsentRecord verifiedRecord() {
        if (legacy) {
            throw new IllegalStateException("legacy consent entries cannot be used as authorization facts");
        }
        return new ConsentRecord(consentId, principalId, scope, type, purpose, requirementScope, required,
                documentVersion, documentDigest, policyVersion, policyDigest, accepted, recordedAt, effectiveAt,
                withdrawalEffect, revokeSessions);
    }
}
