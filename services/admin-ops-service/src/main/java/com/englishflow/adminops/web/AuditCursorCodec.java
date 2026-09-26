package com.englishflow.adminops.web;

import com.englishflow.adminops.domain.AdminOpsException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Opaque audit keyset cursor sealed for one verified tenant. */
@Component
public final class AuditCursorCodec {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();
    private final byte[] secret;

    public AuditCursorCodec(@Value("${admin-ops.audit-cursor-key:}") String secret) {
        this.secret = secret == null ? new byte[0] : secret.getBytes(StandardCharsets.UTF_8);
    }

    public void requireConfigured() {
        if (secret.length < 32) {
            throw new AdminOpsException("ADMIN_AUDIT_CURSOR_UNAVAILABLE",
                    "audit paging is temporarily unavailable", 503, true);
        }
    }

    public String encode(String tenantRef, long lastSequence) {
        requireConfigured();
        if (lastSequence <= 0) throw invalid();
        byte[] nonce = new byte[12];
        RANDOM.nextBytes(nonce);
        try {
            Cipher cipher = cipher(Cipher.ENCRYPT_MODE, nonce);
            cipher.updateAAD(tenantRef.getBytes(StandardCharsets.UTF_8));
            byte[] payload = ByteBuffer.allocate(9).put((byte) 1).putLong(lastSequence).array();
            byte[] encrypted = cipher.doFinal(payload);
            return ENCODER.encodeToString(ByteBuffer.allocate(nonce.length + encrypted.length)
                    .put(nonce).put(encrypted).array());
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("audit cursor encryption is unavailable", exception);
        }
    }

    public long decode(String cursor, String tenantRef) {
        requireConfigured();
        if (cursor == null || cursor.length() < 8 || cursor.length() > 512
                || !cursor.matches("[A-Za-z0-9_-]+")) throw invalid();
        try {
            byte[] sealed = DECODER.decode(cursor);
            if (sealed.length != 37) throw invalid();
            byte[] nonce = new byte[12];
            System.arraycopy(sealed, 0, nonce, 0, nonce.length);
            Cipher cipher = cipher(Cipher.DECRYPT_MODE, nonce);
            cipher.updateAAD(tenantRef.getBytes(StandardCharsets.UTF_8));
            ByteBuffer payload = ByteBuffer.wrap(cipher.doFinal(sealed, nonce.length, sealed.length - nonce.length));
            if (payload.get() != 1) throw invalid();
            long sequence = payload.getLong();
            if (sequence <= 0) throw invalid();
            return sequence;
        } catch (GeneralSecurityException | IllegalArgumentException exception) {
            throw invalid();
        }
    }

    private Cipher cipher(int mode, byte[] nonce) throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(mode, new SecretKeySpec(key(), "AES"), new GCMParameterSpec(128, nonce));
        return cipher;
    }

    private byte[] key() throws NoSuchAlgorithmException {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        digest.update("admin-audit-cursor-v1".getBytes(StandardCharsets.UTF_8));
        digest.update((byte) 0);
        return digest.digest(secret);
    }

    private static AdminOpsException invalid() {
        return AdminOpsException.invalid("ADMIN_AUDIT_CURSOR_INVALID", "invalid audit cursor");
    }
}
