package com.englishflow.media.port;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Durable boundary for registration idempotency. Local-real must provide a non-memory
 * implementation so a process restart cannot change the meaning of an Idempotency-Key.
 *
 * <p>Receipt fingerprints are always SHA-256 hex of the draft rendering: the rendering
 * itself is unbounded and the durable column is CHAR(64). Both memory and JDBC
 * implementations store the hex form, so replay comparison is identical.
 */
public interface MediaRegistrationIdempotencyPort {

    Optional<RegistrationReceipt> find(String tenantId, String subjectId, String idempotencyKey);

    void save(String tenantId, String subjectId, String idempotencyKey, RegistrationReceipt receipt);

    record RegistrationReceipt(String fingerprint, String assetId) {
    }

    static String fingerprintHex(String fingerprint) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest((fingerprint == null ? "" : fingerprint).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is required", impossible);
        }
    }
}
