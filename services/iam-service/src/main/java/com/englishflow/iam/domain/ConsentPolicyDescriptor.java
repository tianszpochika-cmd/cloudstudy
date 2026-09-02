package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * The server-published policy facts needed to evaluate one consent type.  A document version and
 * digest are deliberately separate from the active IAM policy version and digest.  The local
 * candidate descriptors are explicit fixtures only; they are never presented as runtime proof.
 */
public record ConsentPolicyDescriptor(
        ConsentType type,
        String purpose,
        ConsentVersion documentVersion,
        String documentDigest,
        Instant publishedAt,
        ConsentVersion policyVersion,
        String policyDigest,
        Requirement requirement,
        Set<String> capabilities,
        WithdrawalEffect withdrawalEffect,
        boolean revokeSessions,
        String policyRef,
        String runtimeStatus) {

    private static final Pattern DIGEST = Pattern.compile("[0-9a-fA-F]{64}");
    // B8 treats policyRef as an opaque server reference (not a lower-case slug), so preserve
    // case while still rejecting control characters and delimiter/injection characters.
    private static final Pattern SAFE_REF = Pattern.compile("[A-Za-z][A-Za-z0-9:/._-]{2,191}");

    public ConsentPolicyDescriptor {
        Objects.requireNonNull(type, "type");
        if (!type.purpose().equals(purpose)) {
            throw new IllegalArgumentException("consent purpose must match the B8 type");
        }
        Objects.requireNonNull(documentVersion, "documentVersion");
        requireDigest(documentDigest, "documentDigest");
        Objects.requireNonNull(publishedAt, "publishedAt");
        Objects.requireNonNull(policyVersion, "policyVersion");
        requireDigest(policyDigest, "policyDigest");
        Objects.requireNonNull(requirement, "requirement");
        capabilities = capabilities == null
                ? Set.of()
                : Set.copyOf(new LinkedHashSet<>(capabilities));
        if (capabilities.stream().anyMatch(value -> value == null || value.isBlank()
                || value.length() > 128 || value.chars().anyMatch(Character::isISOControl))) {
            throw new IllegalArgumentException("consent capabilities must be safe identifiers");
        }
        Objects.requireNonNull(withdrawalEffect, "withdrawalEffect");
        if (policyRef == null || !SAFE_REF.matcher(policyRef).matches()) {
            throw new IllegalArgumentException("consent policy reference is invalid");
        }
        if (!"NOT_RUNTIME_VERIFIED".equals(runtimeStatus)
                && !"RUNTIME_VERIFIED".equals(runtimeStatus)) {
            throw new IllegalArgumentException("consent runtime status is invalid");
        }
        if (revokeSessions && requirement == Requirement.OPTIONAL) {
            throw new IllegalArgumentException("optional consent cannot revoke all sessions");
        }
    }

    public boolean requiredFor(String capability) {
        String requested = capability == null ? "" : capability;
        return switch (requirement) {
            case BASE_REQUIRED -> true;
            case LEARNING_REQUIRED -> "LEARNING".equals(requested);
            case OPTIONAL -> false;
            case CAPABILITY_REQUIRED -> capabilities.contains(requested);
        };
    }

    public boolean isPublishedAt(Instant now) {
        return now != null && !publishedAt.isAfter(now);
    }

    public boolean runtimeVerified() {
        return "RUNTIME_VERIFIED".equals(runtimeStatus);
    }

    private static void requireDigest(String value, String field) {
        if (value == null || !DIGEST.matcher(value).matches()) {
            throw new IllegalArgumentException(field + " must be a SHA-256 hex digest");
        }
    }

    public enum Requirement {
        BASE_REQUIRED,
        LEARNING_REQUIRED,
        OPTIONAL,
        CAPABILITY_REQUIRED
    }

    public enum WithdrawalEffect {
        NO_ACTION,
        RESTRICT_PROTECTED_CAPABILITY,
        RESTRICT_ALL_LEARNING_ACCESS,
        REVOKE_SENSITIVE_SESSION_SCOPE
    }

    /**
     * Explicit local/test candidate descriptor.  The values are fixed source facts, not a digest
     * generated from request text.  A deployment must replace them with published documents.
     */
    public static ConsentPolicyDescriptor localCandidate(ConsentType type) {
        ConsentVersion documentVersion = new ConsentVersion("b30-consent-v1");
        ConsentVersion policyVersion = new ConsentVersion("b30-consent-policy-v1");
        return switch (type) {
            case TERMS_OF_SERVICE -> new ConsentPolicyDescriptor(type, type.purpose(), documentVersion,
                    "eb74b7254589589f61f5f3747d83379bc6f1e950ab7d8fd52f64f3ab50fb39fb",
                    Instant.parse("2026-08-30T00:00:00Z"), policyVersion,
                    "718e235dab2c1854fe9c650eeade24d4f67666db8e5fa1bff08036dc2ebf1358",
                    Requirement.BASE_REQUIRED, Set.of("ACCOUNT", "LEARNING"),
                    WithdrawalEffect.RESTRICT_ALL_LEARNING_ACCESS, true,
                    "iam://consent/ACCOUNT_TERMS", "NOT_RUNTIME_VERIFIED");
            case PRIVACY_NOTICE -> new ConsentPolicyDescriptor(type, type.purpose(), documentVersion,
                    "4ab15e31c11c9ef99b267ae620910420fdb8a9b6f720b988afeb59d5262ddd84",
                    Instant.parse("2026-08-30T00:00:00Z"), policyVersion,
                    "718e235dab2c1854fe9c650eeade24d4f67666db8e5fa1bff08036dc2ebf1358",
                    Requirement.BASE_REQUIRED, Set.of("ACCOUNT", "LEARNING"),
                    WithdrawalEffect.RESTRICT_ALL_LEARNING_ACCESS, true,
                    "iam://consent/PRIVACY_NOTICE", "NOT_RUNTIME_VERIFIED");
            case ADULT_LEARNING -> new ConsentPolicyDescriptor(type, type.purpose(), documentVersion,
                    "9702cd4fe3e50613f84030998f65c0c8e7961f058176b24f8a9e82006abea189",
                    Instant.parse("2026-08-30T00:00:00Z"), policyVersion,
                    "718e235dab2c1854fe9c650eeade24d4f67666db8e5fa1bff08036dc2ebf1358",
                    Requirement.LEARNING_REQUIRED, Set.of("LEARNING"),
                    WithdrawalEffect.RESTRICT_ALL_LEARNING_ACCESS, true,
                    "iam://consent/ADULT_LEARNING_ELIGIBILITY", "NOT_RUNTIME_VERIFIED");
            case PRODUCT_ANALYTICS -> new ConsentPolicyDescriptor(type, type.purpose(), documentVersion,
                    "5fccd02376d4426e18b36ffb43743e33a844d37d5fb92e505801b5095f56f6f7",
                    Instant.parse("2026-08-30T00:00:00Z"), policyVersion,
                    "718e235dab2c1854fe9c650eeade24d4f67666db8e5fa1bff08036dc2ebf1358",
                    Requirement.OPTIONAL, Set.of("ANALYTICS"),
                    WithdrawalEffect.RESTRICT_PROTECTED_CAPABILITY, false,
                    "iam://consent/PRODUCT_ANALYTICS", "NOT_RUNTIME_VERIFIED");
            case VOICE_RECORDING -> new ConsentPolicyDescriptor(type, type.purpose(), documentVersion,
                    "c1ee1e5753e50b67aaab24d92f68f8f50f3c95772c5ba619b7a96856f297ccdc",
                    Instant.parse("2026-08-30T00:00:00Z"), policyVersion,
                    "718e235dab2c1854fe9c650eeade24d4f67666db8e5fa1bff08036dc2ebf1358",
                    Requirement.CAPABILITY_REQUIRED,
                    Set.of("VOICE_REMOTE_RECORD", "VOICE_REMOTE_UPLOAD", "VOICE_REMOTE_PROCESS",
                            "VOICE_REMOTE_REPLAY"),
                    WithdrawalEffect.RESTRICT_PROTECTED_CAPABILITY, false,
                    "iam://consent/ADULT_VOICE_RECORDING_REMOTE_STORAGE_AND_REPLAY", "NOT_RUNTIME_VERIFIED");
        };
    }

    /** Compatibility descriptor for pre-M2-002 in-process fixtures. */
    static ConsentPolicyDescriptor legacyCandidate(ConsentType type, ConsentVersion version) {
        ConsentPolicyDescriptor candidate = localCandidate(type);
        return new ConsentPolicyDescriptor(type, type.purpose(), version, candidate.documentDigest(),
                candidate.publishedAt(), version, candidate.policyDigest(),
                candidate.requirement(), candidate.capabilities(), candidate.withdrawalEffect(),
                candidate.revokeSessions(), candidate.policyRef(), "NOT_RUNTIME_VERIFIED");
    }
}
