package com.englishflow.iam.domain;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.Objects;

/**
 * Produces a keyed, versioned request binding for an idempotency key.
 *
 * <p>The persisted value must not become a cheap password oracle when a credential-bearing
 * request is fingerprinted. HMAC provides that boundary while the purpose and version prefix
 * prevent the same key material from being reused as an undifferentiated digest elsewhere.</p>
 */
public final class IdempotencyRequestFingerprint {
    public static final String CURRENT_VERSION = "hmac-sha256-v1";
    public static final String LEGACY_INVALIDATED_VERSION = "legacy-invalidated-v0";
    public static final String CREDENTIAL_BINDING_VERSION = "credential-hmac-sha256-v1";

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String REQUEST_PURPOSE = "yuxuexing:iam:idempotency:request-binding";
    private static final byte[] REQUEST_DOMAIN = (REQUEST_PURPOSE + "\u0000" + CURRENT_VERSION + "\u0000")
            .getBytes(StandardCharsets.UTF_8);
    private static final String CREDENTIAL_PURPOSE = "yuxuexing:iam:idempotency:credential-binding";
    private static final byte[] CREDENTIAL_DOMAIN = (CREDENTIAL_PURPOSE + "\u0000"
            + CREDENTIAL_BINDING_VERSION + "\u0000")
            .getBytes(StandardCharsets.UTF_8);
    private static final int MIN_SECRET_CHARS = 32;
    private static final int DIGEST_BYTES = 32;

    private final byte[] keyMaterial;

    public IdempotencyRequestFingerprint(String secret) {
        if (!isStrongSecret(secret)) {
            throw new IllegalStateException(
                    "IAM idempotency fingerprint secret must contain at least 32 non-control characters");
        }
        this.keyMaterial = secret.getBytes(StandardCharsets.UTF_8);
    }

    public String fingerprint(ObjectMapper objectMapper, Object... components) {
        return encode(CURRENT_VERSION, hmac(objectMapper, REQUEST_DOMAIN, components));
    }

    /**
     * Binds a replay reference to the current password epoch and exact session generation without
     * persisting either the password hash or refresh digest. The purpose-separated HMAC lets the
     * controller revalidate current facts even when the idempotency table is readable by an
     * attacker.
     */
    public String credentialBinding(ObjectMapper objectMapper, AccountRecord account,
                                    SessionRecord session) {
        Objects.requireNonNull(account, "account");
        Objects.requireNonNull(session, "session");
        return HexFormat.of().formatHex(hmac(objectMapper, CREDENTIAL_DOMAIN,
                account.principalId().toString(), account.identifier(), account.passwordHash(),
                account.roles().stream().sorted().toList(),
                account.permissions().stream().sorted().toList(),
                session.sessionId().toString(), session.principalId().toString(),
                session.scope().tenantId(), session.scope().owner().toString(),
                session.deviceId().value(), session.tokenFamilyId(), session.refreshTokenDigest(),
                session.rotation(), session.createdAt(), session.updatedAt(), session.expiresAt()));
    }

    /** Strictly parses both operands before comparing their decoded bytes in constant time. */
    public boolean credentialBindingMatches(ObjectMapper objectMapper, AccountRecord account,
                                            SessionRecord session, String presented) {
        byte[] expected = parseCredentialBinding(credentialBinding(objectMapper, account, session));
        byte[] actual = parseCredentialBinding(presented);
        return MessageDigest.isEqual(expected, actual);
    }

    /** Strict public-boundary validation for a currently supported persisted request binding. */
    static String requireCurrent(String value) {
        parseCurrent(value);
        return value;
    }

    private byte[] hmac(ObjectMapper objectMapper, byte[] domain, Object... components) {
        Objects.requireNonNull(objectMapper, "objectMapper");
        try {
            byte[] payload = objectMapper.writeValueAsBytes(Arrays.asList(components));
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(keyMaterial, HMAC_ALGORITHM));
            mac.update(domain);
            return mac.doFinal(payload);
        } catch (JsonProcessingException | GeneralSecurityException exception) {
            throw new IamPolicyException(IamDecisionCode.INVALID_REQUEST, "iam.idempotency.invalid");
        }
    }

    public static boolean isStrongSecret(String secret) {
        return secret != null && secret.length() >= MIN_SECRET_CHARS
                && secret.chars().noneMatch(Character::isISOControl);
    }

    /** Parses only fingerprints emitted by the current keyed implementation. */
    static StoredFingerprint parseCurrent(String value) {
        StoredFingerprint parsed = parse(value);
        if (!CURRENT_VERSION.equals(parsed.version()) || allZero(parsed.digest())) {
            throw new IllegalArgumentException("request fingerprint version");
        }
        return parsed;
    }

    /** Rebuilds the opaque in-memory representation from the versioned JDBC columns. */
    static String fromStored(String version, byte[] digest) {
        if (!CURRENT_VERSION.equals(version) && !LEGACY_INVALIDATED_VERSION.equals(version)) {
            throw new IllegalArgumentException("request fingerprint version");
        }
        if ((CURRENT_VERSION.equals(version) && allZero(digest))
                || (LEGACY_INVALIDATED_VERSION.equals(version) && !allZero(digest))) {
            throw new IllegalArgumentException("request fingerprint tombstone");
        }
        return encode(version, digest);
    }

    /** A legacy-invalidated row always conflicts with a new request until retention purges it. */
    static boolean matchesCurrent(String stored, String presented) {
        StoredFingerprint existing = parse(stored);
        StoredFingerprint current = parseCurrent(presented);
        return CURRENT_VERSION.equals(existing.version())
                && MessageDigest.isEqual(existing.digest(), current.digest());
    }

    private static StoredFingerprint parse(String value) {
        if (value == null) throw new IllegalArgumentException("request fingerprint");
        int separator = value.indexOf(':');
        if (separator <= 0 || separator == value.length() - 1) {
            throw new IllegalArgumentException("request fingerprint");
        }
        String version = value.substring(0, separator);
        String encoded = value.substring(separator + 1);
        if (encoded.length() != DIGEST_BYTES * 2 || !encoded.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException("request fingerprint");
        }
        return new StoredFingerprint(version, HexFormat.of().parseHex(encoded));
    }

    private static byte[] parseCredentialBinding(String value) {
        if (value == null || !value.matches("[0-9a-f]{64}")) {
            throw new IllegalArgumentException("credential replay binding");
        }
        return HexFormat.of().parseHex(value);
    }

    private static String encode(String version, byte[] digest) {
        if (digest == null || digest.length != DIGEST_BYTES) {
            throw new IllegalArgumentException("request fingerprint digest");
        }
        return version + ":" + HexFormat.of().formatHex(digest);
    }

    private static boolean allZero(byte[] digest) {
        if (digest == null || digest.length != DIGEST_BYTES) return false;
        int combined = 0;
        for (byte value : digest) combined |= value;
        return combined == 0;
    }

    record StoredFingerprint(String version, byte[] digest) {
        StoredFingerprint {
            Objects.requireNonNull(version, "version");
            digest = Objects.requireNonNull(digest, "digest").clone();
        }

        @Override
        public byte[] digest() {
            return digest.clone();
        }
    }
}
