package com.englishflow.iam.auth;

import com.englishflow.iam.config.IamServiceProperties;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Issues the short-lived service tokens internal callers use, in exchange for service client credentials.
 *
 * <p>The acceptance side of this already existed: IAM's security configuration requires the
 * {@code TOKEN_TYPE_service} authority on {@code /internal/v1/**}, and nothing anywhere issued such a token, so
 * every internal call was either anonymous or self-signed. ADR-0016 records the decision that IAM issues them,
 * which keeps the rule that IAM is the only issuer intact rather than adding an exception to it.
 *
 * <p>Two things this deliberately does not do. It does not hand out a token on a wrong secret, and it does not
 * compare secrets in a way whose duration depends on how much of the secret was right: the comparison is over
 * digests and is constant-time, the same discipline a password check needs. And it does not issue a refresh
 * token: a service that needs another token asks again, so a leaked token expires rather than renewing itself.
 */
public final class ServiceTokenService {

    /** What a caller receives. */
    public record IssuedServiceToken(String value, Instant issuedAt, Instant expiresAt, String jti, String serviceId,
                                     List<String> permissions) {
    }

    /** Raised when the credentials do not identify a known client, carrying nothing about which part was wrong. */
    public static final class CredentialsRejected extends RuntimeException {
        public CredentialsRejected() {
            super("service credentials are not accepted");
        }
    }

    private final JwtEncoder encoder;
    private final JwtSigningKeyProvider keys;
    private final IamServiceProperties properties;
    private final java.time.Clock clock;

    public ServiceTokenService(JwtEncoder encoder, JwtSigningKeyProvider keys, IamServiceProperties properties) {
        this(encoder, keys, properties, java.time.Clock.systemUTC());
    }

    ServiceTokenService(JwtEncoder encoder, JwtSigningKeyProvider keys, IamServiceProperties properties,
                        java.time.Clock clock) {
        this.encoder = encoder;
        this.keys = keys;
        this.properties = properties;
        this.clock = clock;
    }

    /** Issues a token for the named client, or refuses. */
    public IssuedServiceToken issue(String clientId, String clientSecret) {
        Map<String, IamServiceProperties.ServiceClientProperties> clients = properties.getServiceClients();
        IamServiceProperties.ServiceClientProperties client = clients.get(clientId);
        // The refusal is the same for an unknown client and a wrong secret: telling them apart tells an attacker
        // which half of the guess was right.
        if (client == null || clientSecret == null || !digestMatches(client.getSecretDigest(), clientSecret)) {
            throw new CredentialsRejected();
        }
        if (client.getPermissions().isEmpty()) {
            // A client with no permissions cannot do anything, so issuing it a token would only produce a
            // confusing 403 later. Configuration that grants nothing is almost certainly a mistake.
            throw new IllegalStateException("service client " + clientId + " has no permissions configured");
        }

        Instant issuedAt = Instant.now(clock);
        Duration ttl = positive(client.getTokenTtl(), Duration.ofMinutes(5));
        Instant expiresAt = issuedAt.plus(ttl);
        String jti = UUID.randomUUID().toString();

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(properties.getJwt().getIssuer())
                // Subject-bound service identity: the IAM resource server only
                // accepts token_type=service when service_id equals the subject
                // (pinned by IamJwtAuthenticationTest). token_type still keeps a
                // service token unmistakable from a human access token.
                .subject(clientId)
                .claim("service_id", clientId)
                .audience(List.of(properties.getJwt().getAudience()))
                .issuedAt(issuedAt)
                .notBefore(issuedAt)
                .expiresAt(expiresAt)
                .id(jti)
                // The same claim names the user tokens carry, with a different value: every existing authority
                // mapping continues to work, and a service token can never be mistaken for a human one.
                .claim("token_type", "service")
                // A space-delimited String, which is what a scope claim is: audit validates it as a String, and a List here made
                // an otherwise valid token fail validation with "authentication required". The permissions claim
                // below keeps the list form, because the validators that read it accept either.
                .claim("scope", String.join(" ", client.getPermissions()))
                .claim("roles", List.of())
                .claim("permissions", client.getPermissions())
                .claim("tenant_id", properties.getPlatformTenant())
                .build();

        String value = encoder.encode(JwtEncoderParameters.from(
                org.springframework.security.oauth2.jwt.JwsHeader
                        .with(org.springframework.security.oauth2.jose.jws.SignatureAlgorithm.RS256)
                        .keyId(properties.getJwt().getKeyId())
                        // The resource-server typ gate requires "JWT", same as user tokens.
                        .type("JWT")
                        .build(), claims)).getTokenValue();
        return new IssuedServiceToken(value, issuedAt, expiresAt, jti, clientId, client.getPermissions());
    }

    private static Duration positive(Duration configured, Duration fallback) {
        return configured == null || configured.isZero() || configured.isNegative() ? fallback : configured;
    }

    /** Constant-time digest comparison, so the time taken does not reveal how much of a secret was correct. */
    private static boolean digestMatches(String expectedDigest, String presented) {
        if (expectedDigest == null || expectedDigest.isBlank()) return false;
        byte[] expected = expectedDigest.toLowerCase(java.util.Locale.ROOT).getBytes(StandardCharsets.UTF_8);
        byte[] actual = sha256(presented).getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(expected, actual);
    }

    /** The digest form a configured secret digest uses. */
    public static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder(digest.length * 2);
            for (byte b : digest) out.append(String.format("%02x", b));
            return out.toString();
        } catch (java.security.NoSuchAlgorithmException missing) {
            throw new IllegalStateException("SHA-256 is required", missing);
        }
    }
}
