package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

/** Immutable consent event snapshot. Withdrawal creates a new record and never erases history. */
public record ConsentRecord(
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
        boolean revokeSessions) {

    private static final Pattern SHA256 = Pattern.compile("[0-9a-fA-F]{64}");

    public ConsentRecord {
        Objects.requireNonNull(consentId, "consentId");
        Objects.requireNonNull(principalId, "principalId");
        Objects.requireNonNull(scope, "scope");
        if (!principalId.equals(scope.subject())) {
            throw new IllegalArgumentException("consent principal must match scope subject");
        }
        Objects.requireNonNull(type, "type");
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
        if (documentDigest == null || !SHA256.matcher(documentDigest).matches()) {
            throw new IllegalArgumentException("consent document digest must be SHA-256 hex");
        }
        Objects.requireNonNull(policyVersion, "policyVersion");
        if (policyDigest == null || !SHA256.matcher(policyDigest).matches()) {
            throw new IllegalArgumentException("consent policy digest must be SHA-256 hex");
        }
        Objects.requireNonNull(recordedAt, "recordedAt");
        Objects.requireNonNull(effectiveAt, "effectiveAt");
        Objects.requireNonNull(withdrawalEffect, "withdrawalEffect");
    }

    /** Compatibility constructor for the pre-M2-002 six-field in-process model. */
    public ConsentRecord(PrincipalId principalId, TenantScope scope, ConsentType type,
                         ConsentVersion version, boolean accepted, Instant recordedAt) {
        this(UUID.randomUUID(), principalId, scope, type, type.purpose(),
                ConsentPolicyDescriptor.legacyCandidate(type, version).requirement().name(),
                ConsentPolicyDescriptor.legacyCandidate(type, version).requiredFor("LEARNING"), version,
                ConsentPolicyDescriptor.legacyCandidate(type, version).documentDigest(),
                ConsentPolicyDescriptor.legacyCandidate(type, version).policyVersion(),
                ConsentPolicyDescriptor.legacyCandidate(type, version).policyDigest(), accepted, recordedAt, recordedAt,
                ConsentPolicyDescriptor.legacyCandidate(type, version).withdrawalEffect(),
                ConsentPolicyDescriptor.legacyCandidate(type, version).revokeSessions());
    }

    /** The historical accessor name remains document version for old callers. */
    public ConsentVersion version() {
        return documentVersion;
    }

    public Instant decidedAt() {
        return recordedAt;
    }

    public ConsentPolicyDescriptor.Requirement requirement() {
        return ConsentPolicyDescriptor.Requirement.valueOf(requirementScope);
    }
}
