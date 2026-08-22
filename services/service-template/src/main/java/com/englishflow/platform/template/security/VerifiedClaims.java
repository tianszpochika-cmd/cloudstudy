package com.englishflow.platform.template.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Normalized claims from a JWT that has already passed Spring Resource Server verification.
 *
 * <p>This type intentionally has no tenant, owner or client-header field. Tenant scope is
 * derived from the verified subject by {@link VerifiedPrincipal}; resource owner facts come from
 * a service-owned read model or a trusted PDP result.</p>
 */
public record VerifiedClaims(
        String subjectId,
        String issuer,
        Instant issuedAt,
        Instant expiresAt,
        String tokenId,
        Set<String> roles,
        Set<String> permissions,
        String phase,
        Set<String> contentRights,
        ConsentState consent,
        RevocationStatus revocationStatus
) {

    public VerifiedClaims {
        requireText(subjectId, "subjectId");
        requireText(issuer, "issuer");
        Objects.requireNonNull(issuedAt, "issuedAt is required");
        Objects.requireNonNull(expiresAt, "expiresAt is required");
        if (!expiresAt.isAfter(issuedAt)) {
            throw new IllegalArgumentException("expiresAt must be after issuedAt");
        }
        requireText(tokenId, "tokenId");
        roles = immutableSet(roles);
        permissions = immutableSet(permissions);
        contentRights = immutableSet(contentRights);
        consent = consent == null ? ConsentState.UNKNOWN : consent;
        revocationStatus = revocationStatus == null ? RevocationStatus.UNKNOWN : revocationStatus;
    }

    /**
     * Build facts only after the Resource Server decoder has verified the JWT signature and
     * issuer. This method is not a decoder and must not be called with an unverified token map.
     */
    public static VerifiedClaims fromVerifiedJwt(Jwt jwt) {
        Objects.requireNonNull(jwt, "verified jwt is required");
        Map<String, Object> claims = jwt.getClaims();
        String tokenId = jwt.getId();
        if (tokenId == null || tokenId.isBlank()) {
            tokenId = sha256(jwt.getTokenValue());
        }
        return new VerifiedClaims(
                jwt.getSubject(),
                jwt.getIssuer() == null ? null : jwt.getIssuer().toString(),
                jwt.getIssuedAt(),
                jwt.getExpiresAt(),
                tokenId,
                claimSet(claims, "roles", "role"),
                claimSet(claims, "permissions", "permission"),
                claimString(claims, "phase"),
                claimSet(claims, "contentRights", "content_rights"),
                parseConsent(claims),
                parseRevocation(claims));
    }

    public boolean hasUsablePhase() {
        return phase != null && !phase.isBlank();
    }

    private static ConsentState parseConsent(Map<String, Object> claims) {
        Object value = firstClaim(claims, "consent", "consent_status");
        if (value instanceof Boolean booleanValue) {
            return booleanValue ? ConsentState.GRANTED : ConsentState.DENIED;
        }
        if (value instanceof String stringValue) {
            return switch (stringValue.trim().toLowerCase()) {
                case "granted", "true", "approved" -> ConsentState.GRANTED;
                case "denied", "false", "revoked" -> ConsentState.DENIED;
                default -> ConsentState.UNKNOWN;
            };
        }
        return ConsentState.UNKNOWN;
    }

    private static RevocationStatus parseRevocation(Map<String, Object> claims) {
        Object value = firstClaim(claims, "revocation_status", "revocationStatus");
        if (value instanceof String stringValue) {
            return switch (stringValue.trim().toLowerCase()) {
                case "active", "confirmed_active", "confirmed-active" -> RevocationStatus.CONFIRMED_ACTIVE;
                case "revoked" -> RevocationStatus.REVOKED;
                default -> RevocationStatus.UNKNOWN;
            };
        }
        return RevocationStatus.UNKNOWN;
    }

    private static Set<String> claimSet(Map<String, Object> claims, String... names) {
        Object value = firstClaim(claims, names);
        if (value instanceof Collection<?> collection) {
            Set<String> result = new LinkedHashSet<>();
            for (Object item : collection) {
                if (item instanceof String stringValue && !stringValue.isBlank()) {
                    result.add(stringValue.trim());
                }
            }
            return result;
        }
        if (value instanceof String stringValue && !stringValue.isBlank()) {
            Set<String> result = new LinkedHashSet<>();
            for (String item : stringValue.split("[, ]+")) {
                if (!item.isBlank()) {
                    result.add(item.trim());
                }
            }
            return result;
        }
        return Set.of();
    }

    private static String claimString(Map<String, Object> claims, String... names) {
        Object value = firstClaim(claims, names);
        return value instanceof String stringValue && !stringValue.isBlank() ? stringValue.trim() : null;
    }

    private static Object firstClaim(Map<String, Object> claims, String... names) {
        for (String name : names) {
            if (claims.containsKey(name)) {
                return claims.get(name);
            }
        }
        return null;
    }

    private static Set<String> immutableSet(Set<String> values) {
        if (values == null || values.isEmpty()) {
            return Set.of();
        }
        return Collections.unmodifiableSet(new LinkedHashSet<>(values));
    }

    private static void requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(bytes.length * 2);
            for (byte item : bytes) {
                result.append(String.format("%02x", item));
            }
            return result.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required by the runtime", exception);
        }
    }
}
