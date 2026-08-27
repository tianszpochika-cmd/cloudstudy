package com.englishflow.iam.oidc;

import java.util.Objects;

/** Public-key metadata only; key material is fetched and verified by the provider adapter. */
public record JwksKeyDescriptor(String keyId, String keyType, String algorithm, String use) {

    public JwksKeyDescriptor {
        require(keyId, "keyId");
        require(keyType, "keyType");
        require(algorithm, "algorithm");
        require(use, "use");
        if (!"sig".equals(use) || "none".equalsIgnoreCase(algorithm)) {
            throw new IllegalArgumentException("JWKS key must be a signing key with an explicit algorithm");
        }
    }

    private static void require(String value, String name) {
        Objects.requireNonNull(value, name);
        if (value.isBlank() || value.length() > 128) {
            throw new IllegalArgumentException(name + " is invalid");
        }
    }
}
