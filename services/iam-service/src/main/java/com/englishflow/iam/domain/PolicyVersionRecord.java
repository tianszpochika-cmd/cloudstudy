package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/** Immutable snapshot of one policy control-plane version at its current revision. */
public record PolicyVersionRecord(
        UUID policyVersionId,
        String version,
        PolicyLifecycleStatus status,
        int revision,
        String tenantId,
        PolicyDocument document,
        String artifactDigest,
        Instant createdAt,
        Instant updatedAt,
        PrincipalId createdBy,
        Set<PrincipalId> contributors,
        PrincipalId submittedBy,
        PrincipalId approvedBy,
        PrincipalId activatedBy,
        PrincipalId revokedBy,
        Instant activatedAt,
        Instant revokedAt,
        PolicyCacheInvalidationReceipt cacheInvalidation) {

    public PolicyVersionRecord {
        Objects.requireNonNull(policyVersionId, "policyVersionId");
        if (version == null || version.isBlank() || version.length() > 128
                || version.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException("policy version is invalid");
        }
        Objects.requireNonNull(status, "status");
        if (revision < 1 || !TenantScope.PLATFORM_TENANT.equals(tenantId)) {
            throw new IllegalArgumentException("policy revision or tenant is invalid");
        }
        Objects.requireNonNull(document, "document");
        if (artifactDigest == null || !artifactDigest.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException("policy artifact digest is invalid");
        }
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
        Objects.requireNonNull(createdBy, "createdBy");
        LinkedHashSet<PrincipalId> copy = new LinkedHashSet<>();
        if (contributors != null) copy.addAll(contributors);
        copy.remove(createdBy);
        contributors = Set.copyOf(copy);
        Objects.requireNonNull(cacheInvalidation, "cacheInvalidation");
        validateLifecycle(status, submittedBy, approvedBy, activatedBy, revokedBy, activatedAt, revokedAt);
    }

    private static void validateLifecycle(PolicyLifecycleStatus status, PrincipalId submittedBy,
                                          PrincipalId approvedBy, PrincipalId activatedBy,
                                          PrincipalId revokedBy, Instant activatedAt, Instant revokedAt) {
        if (status.ordinal() >= PolicyLifecycleStatus.SUBMITTED.ordinal() && submittedBy == null) {
            throw new IllegalArgumentException("submitted policy needs submitter");
        }
        if (status.ordinal() >= PolicyLifecycleStatus.APPROVED.ordinal() && approvedBy == null) {
            throw new IllegalArgumentException("approved policy needs approver");
        }
        if (status.ordinal() >= PolicyLifecycleStatus.ACTIVE.ordinal() && activatedBy == null) {
            throw new IllegalArgumentException("active policy needs activator");
        }
        if ((status == PolicyLifecycleStatus.ACTIVE || status == PolicyLifecycleStatus.REVOKED) && activatedAt == null) {
            throw new IllegalArgumentException("active or revoked policy needs activation time");
        }
        if (status == PolicyLifecycleStatus.REVOKED && (revokedBy == null || revokedAt == null)) {
            throw new IllegalArgumentException("revoked policy needs revocation facts");
        }
    }

    public boolean authorOrContributor(PrincipalId actor) {
        return createdBy.equals(actor) || contributors.contains(actor);
    }
}
