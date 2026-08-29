package com.englishflow.iam.auth;

import com.englishflow.iam.config.IamServiceProperties;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.KeyUse;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateCrtKey;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.util.Base64;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** Loads the IAM signing key from a secret boundary or creates a disposable local key. */
public final class JwtSigningKeyProvider {
    private final RSAKey signingKey;
    private final List<RSAKey> publishedKeys;

    public JwtSigningKeyProvider(IamServiceProperties properties) {
        Objects.requireNonNull(properties, "properties");
        IamServiceProperties.JwtProperties jwt = properties.getJwt();
        if (!"RS256".equals(jwt.getAlgorithm())) {
            throw new IllegalStateException("The current IAM key provider supports RS256 only");
        }
        this.signingKey = load(jwt);
        this.publishedKeys = loadPublishedKeys(jwt, signingKey);
    }

    public RSAKey signingKey() { return signingKey; }
    public RSAPublicKey publicKey() {
        try { return signingKey.toRSAPublicKey(); }
        catch (Exception exception) { throw new IllegalStateException("IAM public signing key is invalid", exception); }
    }
    public Map<String, Object> publicJwk() {
        try { return signingKey.toPublicJWK().toJSONObject(); }
        catch (Exception exception) { throw new IllegalStateException("IAM public JWKS cannot be rendered", exception); }
    }
    public List<Map<String, Object>> publicJwks() {
        return publishedKeys.stream().map(key -> {
            try { return key.toPublicJWK().toJSONObject(); }
            catch (Exception exception) { throw new IllegalStateException("IAM public JWKS cannot be rendered", exception); }
        }).toList();
    }
    public JWKSource<SecurityContext> jwkSource() {
        return (selector, context) -> selector.select(new JWKSet(new ArrayList<>(publishedKeys)));
    }

    private static List<RSAKey> loadPublishedKeys(IamServiceProperties.JwtProperties properties, RSAKey active) {
        List<RSAKey> keys = new ArrayList<>();
        keys.add(active);
        String previous = properties.getPreviousPublicKeysJson();
        if (previous == null || previous.isBlank()) return List.copyOf(keys);
        try {
            Set<String> ids = new HashSet<>();
            ids.add(active.getKeyID());
            for (JWK key : JWKSet.parse(previous).getKeys()) {
                if (!(key instanceof RSAKey rsa) || rsa.isPrivate()
                        || !JWSAlgorithm.RS256.equals(rsa.getAlgorithm())
                        || !KeyUse.SIGNATURE.equals(rsa.getKeyUse())
                        || rsa.getKeyID() == null || rsa.getKeyID().isBlank()
                        || !ids.add(rsa.getKeyID())) {
                    throw new IllegalStateException("IAM previous JWKS must contain unique public RS256 signing keys");
                }
                keys.add(rsa.toPublicJWK());
            }
            return List.copyOf(keys);
        } catch (IllegalStateException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalStateException("IAM previous JWKS cannot be parsed", exception);
        }
    }

    private static RSAKey load(IamServiceProperties.JwtProperties properties) {
        try {
            String pem = properties.getPrivateKeyPem();
            if (pem == null || pem.isBlank()) {
                String file = properties.getPrivateKeyFile();
                if (file != null && !file.isBlank()) pem = Files.readString(Path.of(file), StandardCharsets.US_ASCII);
            }
            if (pem == null || pem.isBlank()) {
                if (!properties.isEphemeralKeysAllowed()) {
                    throw new IllegalStateException("IAM signing key must come from a secret manager or mounted secret file");
                }
                KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
                generator.initialize(2048);
                KeyPair pair = generator.generateKeyPair();
                return new RSAKey.Builder((RSAPublicKey) pair.getPublic())
                        .privateKey((RSAPrivateKey) pair.getPrivate())
                        .keyUse(KeyUse.SIGNATURE).algorithm(JWSAlgorithm.RS256)
                        .keyID(properties.getKeyId()).build();
            }
            byte[] der = decodePem(pem);
            RSAPrivateKey privateKey = (RSAPrivateKey) KeyFactory.getInstance("RSA")
                    .generatePrivate(new PKCS8EncodedKeySpec(der));
            if (!(privateKey instanceof RSAPrivateCrtKey crt)) {
                throw new IllegalStateException("IAM signing key must expose RSA CRT parameters");
            }
            RSAPublicKey publicKey = (RSAPublicKey) KeyFactory.getInstance("RSA")
                    .generatePublic(new RSAPublicKeySpec(crt.getModulus(), crt.getPublicExponent()));
            return new RSAKey.Builder(publicKey).privateKey(privateKey)
                    .keyUse(KeyUse.SIGNATURE).algorithm(JWSAlgorithm.RS256)
                    .keyID(properties.getKeyId()).build();
        } catch (IllegalStateException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalStateException("IAM signing key cannot be loaded", exception);
        }
    }

    private static byte[] decodePem(String pem) {
        String normalized = pem.replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");
        try { return Base64.getDecoder().decode(normalized); }
        catch (IllegalArgumentException exception) { throw new IllegalStateException("IAM private key PEM is invalid", exception); }
    }
}
