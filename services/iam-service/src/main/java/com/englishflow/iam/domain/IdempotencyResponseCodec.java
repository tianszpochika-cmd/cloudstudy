package com.englishflow.iam.domain;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.NullNode;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Encrypts an idempotent response snapshot before it crosses the persistence boundary.
 *
 * <p>Credential-producing IAM responses contain access tokens, refresh tokens and sometimes a
 * {@code Set-Cookie} header. A deterministic token recipe cannot replay a completed response
 * after the session has rotated, so the exact response is retained as AES-GCM ciphertext. The
 * stable replay secret is injected from the deployment secret boundary; no plaintext response,
 * cookie or credential is handed to a JDBC store.</p>
 */
public final class IdempotencyResponseCodec {
    public static final String KEY_VERSION = "v1";
    private static final int NONCE_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final int MIN_SECRET_CHARS = 32;

    private final ObjectMapper objectMapper;
    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public IdempotencyResponseCodec(ObjectMapper objectMapper, String replaySecret) {
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
        if (!isStrongSecret(replaySecret)) {
            throw new IllegalStateException("IAM idempotency replay secret must contain at least 32 non-control characters");
        }
        try {
            this.key = new SecretKeySpec(MessageDigest.getInstance("SHA-256")
                    .digest(replaySecret.getBytes(StandardCharsets.UTF_8)), "AES");
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    public static boolean isStrongSecret(String replaySecret) {
        return replaySecret != null && replaySecret.length() >= MIN_SECRET_CHARS
                && replaySecret.chars().noneMatch(Character::isISOControl);
    }

    /** Captures status, body and all response headers without retaining them in plaintext. */
    public IdempotencyRecord.ResponseSnapshot capture(String scope, String keyValue, String requestHash,
                                                       ResponseEntity<?> response) {
        Objects.requireNonNull(response, "response");
        try {
            JsonNode body = response.getBody() == null
                    ? NullNode.getInstance() : objectMapper.valueToTree(response.getBody());
            Map<String, List<String>> headers = new LinkedHashMap<>();
            response.getHeaders().forEach((name, values) -> headers.put(name, List.copyOf(values)));
            byte[] clear = objectMapper.writeValueAsBytes(new Snapshot(
                    response.getStatusCode().value(), headers, body));
            byte[] nonce = new byte[NONCE_BYTES];
            random.nextBytes(nonce);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, nonce));
            cipher.updateAAD(aad(scope, keyValue, requestHash));
            byte[] ciphertext = cipher.doFinal(clear);
            return new IdempotencyRecord.ResponseSnapshot(
                    Base64.getEncoder().encodeToString(ciphertext),
                    Base64.getEncoder().encodeToString(nonce), KEY_VERSION);
        } catch (java.io.IOException | GeneralSecurityException | IllegalArgumentException exception) {
            throw unavailable(exception);
        }
    }

    /** Restores the exact response, including credential-bearing headers, for a safe retry. */
    public <T> ResponseEntity<T> restore(String scope, String keyValue, String requestHash,
                                         IdempotencyRecord record, TypeReference<T> responseType) {
        Objects.requireNonNull(record, "record");
        Objects.requireNonNull(responseType, "responseType");
        if (!record.hasResponseSnapshot()
                || !KEY_VERSION.equals(record.responseKeyVersion())) {
            throw unavailable(null);
        }
        try {
            byte[] ciphertext = Base64.getDecoder().decode(record.responseCiphertext());
            byte[] nonce = Base64.getDecoder().decode(record.responseNonce());
            if (nonce.length != NONCE_BYTES) throw new IllegalArgumentException("nonce");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, nonce));
            cipher.updateAAD(aad(scope, keyValue, requestHash));
            Snapshot snapshot = objectMapper.readValue(cipher.doFinal(ciphertext), Snapshot.class);
            HttpHeaders headers = new HttpHeaders();
            if (snapshot.headers() != null) {
                snapshot.headers().forEach((name, values) -> {
                    if (name != null && values != null) values.forEach(value -> headers.add(name, value));
                });
            }
            HttpStatusCode status = HttpStatusCode.valueOf(snapshot.status());
            if (snapshot.body() == null || snapshot.body().isNull()) {
                return ResponseEntity.status(status).headers(headers).build();
            }
            T body = objectMapper.convertValue(snapshot.body(), responseType);
            return ResponseEntity.status(status).headers(headers).body(body);
        } catch (java.io.IOException | GeneralSecurityException | IllegalArgumentException exception) {
            throw unavailable(exception);
        }
    }

    private static byte[] aad(String scope, String key, String requestHash) {
        return (KEY_VERSION + "|" + scope + "|" + key + "|" + requestHash)
                .getBytes(StandardCharsets.UTF_8);
    }

    private static IamPolicyException unavailable(Exception exception) {
        return new IamPolicyException(IamDecisionCode.IDEMPOTENCY_RESULT_UNAVAILABLE,
                "iam.idempotency.result_unavailable");
    }

    private record Snapshot(int status, Map<String, List<String>> headers, JsonNode body) {}
}
