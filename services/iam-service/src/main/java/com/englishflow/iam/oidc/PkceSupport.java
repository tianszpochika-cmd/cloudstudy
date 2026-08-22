package com.englishflow.iam.oidc;

import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

/** RFC 7636 S256 helper with server-generated state, nonce and verifier values. */
public final class PkceSupport {

    private static final SecureRandom RANDOM = new SecureRandom();

    private PkceSupport() {
    }

    public static String randomUrlValue(int bytes) {
        if (bytes < 32) {
            throw new IllegalArgumentException("security value must contain at least 256 bits");
        }
        byte[] value = new byte[bytes];
        RANDOM.nextBytes(value);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    public static String s256Challenge(String codeVerifier) {
        requireVerifier(codeVerifier);
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(codeVerifier.getBytes(StandardCharsets.US_ASCII));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required by the JDK", exception);
        }
    }

    public static void assertVerifierMatches(String codeVerifier, String expectedChallenge) {
        requireVerifier(codeVerifier);
        if (expectedChallenge == null || !constantTimeEquals(s256Challenge(codeVerifier), expectedChallenge)) {
            throw new IamPolicyException(IamDecisionCode.OIDC_PKCE_INVALID, "iam.oidc.pkce_invalid");
        }
    }

    public static boolean constantTimeEquals(String left, String right) {
        if (left == null || right == null) {
            return false;
        }
        return MessageDigest.isEqual(
                left.getBytes(StandardCharsets.US_ASCII),
                right.getBytes(StandardCharsets.US_ASCII));
    }

    private static void requireVerifier(String codeVerifier) {
        if (codeVerifier == null || codeVerifier.length() < 43 || codeVerifier.length() > 128
                || !codeVerifier.matches("[A-Za-z0-9._~-]+")) {
            throw new IamPolicyException(IamDecisionCode.OIDC_PKCE_INVALID, "iam.oidc.pkce_invalid");
        }
    }
}
