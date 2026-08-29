package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.Objects;

/** Age evidence created by a separately authenticated server-side verification boundary. */
public final class TrustedAgeEvidence {
    public enum Source { TRUSTED_SERVER_ATTESTATION }

    private final int age;
    private final Source source;
    private final String evidenceType;
    private final Instant verifiedAt;

    private TrustedAgeEvidence(int age, String evidenceType, Instant verifiedAt) {
        if (age < 0 || age > 150) throw new IllegalArgumentException("age is outside the supported range");
        if (evidenceType == null || evidenceType.isBlank() || evidenceType.length() > 64) throw new IllegalArgumentException("evidence type is invalid");
        this.age = age;
        this.source = Source.TRUSTED_SERVER_ATTESTATION;
        this.evidenceType = evidenceType;
        this.verifiedAt = Objects.requireNonNull(verifiedAt, "verifiedAt");
    }

    /** Only a separately authenticated server-side age service may call this factory. */
    public static TrustedAgeEvidence fromServerAttestation(int age, String evidenceType, Instant verifiedAt) {
        return new TrustedAgeEvidence(age, evidenceType, verifiedAt);
    }
    public int age() { return age; }
    public Source source() { return source; }
    public String evidenceType() { return evidenceType; }
    public Instant verifiedAt() { return verifiedAt; }
}
