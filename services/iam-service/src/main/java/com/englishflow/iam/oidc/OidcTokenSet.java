package com.englishflow.iam.oidc;

import com.englishflow.iam.domain.ProviderSessionReference;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

/**
 * Provider-issued token material kept only in the in-process exchange boundary.
 *
 * <p>IAM never signs or mints these values. A persistence adapter may only retain a digest of a
 * refresh token through {@code SessionService}. The controlled JSON callback/refresh boundary may
 * relay the provider-issued values over TLS to an authenticated product client; this record must
 * never be logged, persisted in plaintext, or emitted in events.</p>
 */
public record OidcTokenSet(
        VerifiedOidcIdentity identity,
        Optional<String> accessToken,
        Optional<String> refreshToken,
        Optional<Instant> accessTokenExpiresAt,
        Optional<ProviderSessionReference> providerSessionReference) {

    public OidcTokenSet {
        Objects.requireNonNull(identity, "identity");
        accessToken = accessToken == null ? Optional.empty() : accessToken;
        refreshToken = refreshToken == null ? Optional.empty() : refreshToken;
        accessTokenExpiresAt = accessTokenExpiresAt == null ? Optional.empty() : accessTokenExpiresAt;
        providerSessionReference = providerSessionReference == null
                ? Optional.empty()
                : providerSessionReference;
        accessToken.ifPresent(OidcTokenSet::requireToken);
        refreshToken.ifPresent(OidcTokenSet::requireToken);
        accessTokenExpiresAt.ifPresent(value -> Objects.requireNonNull(value, "accessTokenExpiresAt"));
    }

    public static OidcTokenSet identityOnly(VerifiedOidcIdentity identity) {
        return new OidcTokenSet(identity, Optional.empty(), Optional.empty(), Optional.empty(), Optional.empty());
    }

    private static void requireToken(String value) {
        Objects.requireNonNull(value, "token");
        if (value.isBlank() || value.length() > 16384 || value.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException("provider token is invalid");
        }
    }
}
