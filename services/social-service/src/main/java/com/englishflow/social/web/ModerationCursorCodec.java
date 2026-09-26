package com.englishflow.social.web;

import com.englishflow.social.domain.SocialException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.nio.ByteBuffer;
import java.util.Base64;
import java.util.HexFormat;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/** Tenant- and filter-bound, server-signed cursor for the admin report queue. */
final class ModerationCursorCodec {
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();
    private static final SecureRandom RANDOM = new SecureRandom();
    private final byte[] key;

    ModerationCursorCodec(String secret) {
        this.key = secret == null ? new byte[0] : secret.getBytes(StandardCharsets.UTF_8);
    }

    boolean configured() {
        return key.length >= 32;
    }

    String reference(String tenantId, String prefix, String rawValue) {
        requireKey();
        if (rawValue == null || rawValue.isBlank()) return null;
        byte[] digest = signature(tenantId, (prefix + "\u0000" + rawValue).getBytes(StandardCharsets.UTF_8));
        return prefix + "-" + HexFormat.of().formatHex(digest, 0, 8);
    }

    String encode(String tenantId, String status, long lastId) {
        requireKey();
        if (lastId <= 0) throw SocialException.invalid("MODERATION_CURSOR_INVALID", "invalid report cursor");
        String payload = "v1:" + status + ":" + lastId;
        byte[] nonce = new byte[12];
        RANDOM.nextBytes(nonce);
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, aesKey(), new GCMParameterSpec(128, nonce));
            cipher.updateAAD(tenantId.getBytes(StandardCharsets.UTF_8));
            byte[] encrypted = cipher.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return ENCODER.encodeToString(ByteBuffer.allocate(nonce.length + encrypted.length)
                    .put(nonce).put(encrypted).array());
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("AES-GCM is unavailable", exception);
        }
    }

    long decode(String cursor, String tenantId, String status) {
        requireKey();
        if (cursor == null || cursor.isBlank() || cursor.length() > 512) {
            throw SocialException.invalid("MODERATION_CURSOR_INVALID", "invalid report cursor");
        }
        try {
            byte[] sealed = DECODER.decode(cursor);
            if (sealed.length < 29) throw SocialException.invalid("MODERATION_CURSOR_INVALID", "invalid report cursor");
            byte[] nonce = new byte[12];
            byte[] ciphertext = new byte[sealed.length - nonce.length];
            System.arraycopy(sealed, 0, nonce, 0, nonce.length);
            System.arraycopy(sealed, nonce.length, ciphertext, 0, ciphertext.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, aesKey(), new GCMParameterSpec(128, nonce));
            cipher.updateAAD(tenantId.getBytes(StandardCharsets.UTF_8));
            byte[] payloadBytes = cipher.doFinal(ciphertext);
            String[] fields = new String(payloadBytes, StandardCharsets.UTF_8).split(":", -1);
            if (fields.length != 3 || !"v1".equals(fields[0]) || !status.equals(fields[1])) {
                throw SocialException.invalid("MODERATION_CURSOR_INVALID", "invalid report cursor");
            }
            long lastId = Long.parseLong(fields[2]);
            if (lastId <= 0) throw SocialException.invalid("MODERATION_CURSOR_INVALID", "invalid report cursor");
            return lastId;
        } catch (IllegalArgumentException | GeneralSecurityException exception) {
            throw SocialException.invalid("MODERATION_CURSOR_INVALID", "invalid report cursor");
        }
    }

    private SecretKeySpec aesKey() throws NoSuchAlgorithmException {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        digest.update("moderation-cursor-aes-v1".getBytes(StandardCharsets.UTF_8));
        digest.update((byte) 0);
        return new SecretKeySpec(digest.digest(key), "AES");
    }

    private void requireKey() {
        if (!configured()) {
            throw new SocialException("MODERATION_CURSOR_UNAVAILABLE", "report queue is temporarily unavailable", 503, true);
        }
    }

    private byte[] signature(String tenantId, byte[] payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            mac.update(tenantId.getBytes(StandardCharsets.UTF_8));
            mac.update((byte) 0);
            return mac.doFinal(payload);
        } catch (java.security.InvalidKeyException | NoSuchAlgorithmException exception) {
            throw new IllegalStateException("HmacSHA256 is unavailable", exception);
        }
    }
}
