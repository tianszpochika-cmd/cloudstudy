package com.englishflow.iam.oidc;

import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;

import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

/** Pure policy checks for provider JWKS snapshots; it performs no network access. */
public final class JwksKeySetValidator {

    private JwksKeySetValidator() {
    }

    public static void assertUsable(
            JwksKeySet keySet,
            URI expectedIssuer,
            Clock clock,
            Duration maxAge) {
        Objects.requireNonNull(expectedIssuer, "expectedIssuer");
        Objects.requireNonNull(clock, "clock");
        Objects.requireNonNull(maxAge, "maxAge");
        if (maxAge.isNegative() || maxAge.isZero()) {
            throw new IllegalArgumentException("maxAge must be positive");
        }
        if (keySet == null || !expectedIssuer.toString().equals(keySet.issuer())) {
            reject();
        }
        Instant now = Instant.now(clock);
        if (keySet.fetchedAt().isAfter(now)
                || !now.isBefore(keySet.fetchedAt().plus(maxAge))) {
            reject();
        }
        if (keySet.keys().isEmpty()) {
            reject();
        }
    }

    private static void reject() {
        throw new IamPolicyException(IamDecisionCode.OIDC_JWKS_INVALID, "iam.oidc.jwks_invalid");
    }
}
