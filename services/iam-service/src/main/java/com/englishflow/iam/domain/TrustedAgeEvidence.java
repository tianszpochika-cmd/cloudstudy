package com.englishflow.iam.domain;

import com.englishflow.iam.oidc.TrustedIdpAgeClaim;

import java.time.Instant;
import java.util.Objects;

/**
 * Trusted age evidence. The factories are intended for a verified server boundary or provider
 * adapter only; no HTTP DTO exposes this type and no client age is converted into it.
 */
public final class TrustedAgeEvidence {

    public enum Source {
        VERIFIED_IDP_CLAIM,
        TRUSTED_SERVER_ATTESTATION
    }

    private final int age;
    private final Source source;
    private final String evidenceType;
    private final Instant verifiedAt;

    private TrustedAgeEvidence(int age, Source source, String evidenceType, Instant verifiedAt) {
        if (age < 0 || age > 150) {
            throw new IllegalArgumentException("age is outside the supported range");
        }
        this.age = age;
        this.source = Objects.requireNonNull(source, "source");
        this.evidenceType = Objects.requireNonNull(evidenceType, "evidenceType");
        this.verifiedAt = Objects.requireNonNull(verifiedAt, "verifiedAt");
    }

    public static TrustedAgeEvidence fromVerifiedIdpClaim(TrustedIdpAgeClaim claim) {
        Objects.requireNonNull(claim, "claim");
        return new TrustedAgeEvidence(
                claim.age(),
                Source.VERIFIED_IDP_CLAIM,
                claim.claimName(),
                claim.verifiedAt());
    }

    /** Only a separately authenticated server-side age service may call this factory. */
    public static TrustedAgeEvidence fromServerAttestation(int age, String evidenceType, Instant verifiedAt) {
        if (evidenceType == null || evidenceType.isBlank() || evidenceType.length() > 64) {
            throw new IllegalArgumentException("evidenceType is invalid");
        }
        return new TrustedAgeEvidence(age, Source.TRUSTED_SERVER_ATTESTATION, evidenceType, verifiedAt);
    }

    public int age() {
        return age;
    }

    public Source source() {
        return source;
    }

    public String evidenceType() {
        return evidenceType;
    }

    public Instant verifiedAt() {
        return verifiedAt;
    }
}
