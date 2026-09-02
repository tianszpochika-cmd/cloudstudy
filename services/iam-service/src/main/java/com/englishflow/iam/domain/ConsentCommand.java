package com.englishflow.iam.domain;

import java.util.Objects;

public record ConsentCommand(
        ConsentType type,
        ConsentVersion version,
        boolean accepted,
        ClientAuthorityClaims clientAuthorityClaims,
        String expectedDocumentDigest) {

    public ConsentCommand {
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(version, "version");
        if (expectedDocumentDigest != null
                && (expectedDocumentDigest.isBlank() || expectedDocumentDigest.length() < 16
                || expectedDocumentDigest.length() > 160
                || expectedDocumentDigest.chars().anyMatch(Character::isISOControl))) {
            throw new IamPolicyException(IamDecisionCode.CONSENT_VERSION_MISMATCH,
                    "iam.consent.document_digest_mismatch");
        }
    }

    /** Compatibility constructor for callers before B8 optimistic document assertions. */
    public ConsentCommand(ConsentType type, ConsentVersion version, boolean accepted,
                          ClientAuthorityClaims clientAuthorityClaims) {
        this(type, version, accepted, clientAuthorityClaims, null);
    }
}
