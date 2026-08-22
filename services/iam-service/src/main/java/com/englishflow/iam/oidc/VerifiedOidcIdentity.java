package com.englishflow.iam.oidc;

import com.englishflow.iam.domain.ExternalIdentity;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

/**
 * Identity returned by an adapter only after ID-token signature, issuer, audience and nonce
 * verification. It is the trust boundary for principal mapping and the adult gate.
 */
public record VerifiedOidcIdentity(
        ExternalIdentity externalIdentity,
        String nonce,
        Optional<TrustedIdpAgeClaim> trustedAgeClaim,
        Instant verifiedAt) {

    public VerifiedOidcIdentity {
        Objects.requireNonNull(externalIdentity, "externalIdentity");
        Objects.requireNonNull(nonce, "nonce");
        if (nonce.isBlank() || nonce.length() > 128) {
            throw new IllegalArgumentException("nonce is invalid");
        }
        trustedAgeClaim = trustedAgeClaim == null ? Optional.empty() : trustedAgeClaim;
        Objects.requireNonNull(verifiedAt, "verifiedAt");
    }
}
