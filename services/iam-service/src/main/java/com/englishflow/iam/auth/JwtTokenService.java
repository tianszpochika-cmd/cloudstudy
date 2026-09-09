package com.englishflow.iam.auth;

import com.englishflow.iam.config.IamServiceProperties;
import com.englishflow.iam.domain.AccountRecord;
import com.englishflow.iam.domain.AccountStatus;
import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.domain.SecretDigests;
import com.englishflow.iam.domain.SessionRecord;
import com.englishflow.iam.domain.SessionStatus;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Signs the platform access JWT. Refresh credentials never pass through this class. */
public final class JwtTokenService {
    private final JwtEncoder encoder;
    private final JwtSigningKeyProvider keys;
    private final IamServiceProperties.JwtProperties properties;
    private final Clock clock;

    public JwtTokenService(JwtEncoder encoder, JwtSigningKeyProvider keys,
                           IamServiceProperties properties, Clock clock) {
        this.encoder = Objects.requireNonNull(encoder, "encoder");
        this.keys = Objects.requireNonNull(keys, "keys");
        this.properties = Objects.requireNonNull(properties, "properties").getJwt();
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public IssuedAccessToken issue(AccountRecord account, SessionRecord session) {
        return issue(account, session, null);
    }

    /**
     * Issues a deterministic access token for a durable idempotency replay. The seed is never
     * persisted or returned as a claim; only its SHA-256-derived JTI is used. The session's
     * update timestamp is the stable issuance instant, so a retry does not mint a second JWT.
     */
    public IssuedAccessToken issue(AccountRecord account, SessionRecord session, String replaySeed) {
        Objects.requireNonNull(account, "account");
        Objects.requireNonNull(session, "session");
        if (account.status() != AccountStatus.ACTIVE) {
            throw new IamPolicyException(account.status() == AccountStatus.LOCKED
                    ? IamDecisionCode.ACCOUNT_LOCKED : IamDecisionCode.INVALID_CREDENTIALS,
                    account.status() == AccountStatus.LOCKED ? "iam.account.locked" : "iam.credentials.invalid");
        }
        if (!account.principalId().equals(session.principalId())
                || session.status() != SessionStatus.ACTIVE) {
            throw new IamPolicyException(IamDecisionCode.SESSION_REVOKED, "iam.session.revoked");
        }
        Instant issuedAt = replaySeed == null ? Instant.now(clock) : session.updatedAt();
        Instant expiresAt = issuedAt.plus(positive(properties.getAccessTokenTtl(), java.time.Duration.ofMinutes(15)));
        if (replaySeed != null && !expiresAt.isAfter(Instant.now(clock))) {
            throw new IamPolicyException(IamDecisionCode.IDEMPOTENCY_RESULT_UNAVAILABLE,
                    "iam.idempotency.result_unavailable");
        }
        String jti = replaySeed == null ? UUID.randomUUID().toString()
                : SecretDigests.sha256Hex(replaySeed + "|access|" + session.sessionId() + "|" + session.rotation());
        List<String> roles = account.roles().stream().sorted().toList();
        List<String> permissions = account.permissions().stream().sorted().toList();
        String scope = String.join(" ", permissions);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(properties.getIssuer())
                .subject(account.principalId().toString())
                .audience(List.of(properties.getAudience()))
                .issuedAt(issuedAt)
                .notBefore(issuedAt)
                .expiresAt(expiresAt)
                .id(jti)
                .claim("token_type", "access")
                .claim("scope", scope)
                .claim("roles", roles)
                .claim("permissions", permissions)
                .claim("tenant_id", session.scope().tenantId())
                .claim("owner_id", session.scope().owner().toString())
                .claim("session_id", session.sessionId().toString())
                .claim("amr", List.of("pwd"))
                .build();
        JwsHeader header = JwsHeader.with(SignatureAlgorithm.RS256)
                .keyId(keys.signingKey().getKeyID()).type("JWT").build();
        return new IssuedAccessToken(encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue(),
                issuedAt, expiresAt, jti);
    }

    private static java.time.Duration positive(java.time.Duration value, java.time.Duration fallback) {
        return value == null || value.isNegative() || value.isZero() ? fallback : value;
    }

    public record IssuedAccessToken(String value, Instant issuedAt, Instant expiresAt, String jti) {}
}
