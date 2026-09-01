package com.englishflow.gateway.config;

import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtAudienceValidator;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.JwtValidators;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.function.Predicate;

/** Gateway independently validates the platform JWT boundary before routing. */
final class GatewayJwtValidators {
    private static final Duration CLOCK_SKEW = Duration.ofSeconds(60);

    private GatewayJwtValidators() {}

    static OAuth2TokenValidator<Jwt> forSecurity(GatewayProperties.Security security) {
        Objects.requireNonNull(security, "security");
        OAuth2TokenValidator<Jwt> algorithm = jwt -> "RS256".equals(jwt.getHeaders().get("alg"))
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "JWT algorithm is not allowed", null));
        return new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(security.issuerUri()),
                new JwtAudienceValidator(security.audience()),
                new JwtTimestampValidator(CLOCK_SKEW),
                algorithm,
                requiredClaim("iss", jwt -> nonBlank(jwt.getClaim("iss"))),
                requiredClaim("sub", jwt -> nonBlank(jwt.getClaim("sub"))),
                requiredClaim("aud", GatewayJwtValidators::hasAudience),
                requiredClaim("exp", jwt -> jwt.getClaim("exp") instanceof Instant),
                requiredClaim("iat", GatewayJwtValidators::hasAcceptableIssuedAt),
                requiredClaim("nbf", jwt -> jwt.getClaim("nbf") instanceof Instant),
                requiredClaim("jti", jwt -> nonBlank(jwt.getClaim("jti"))),
                requiredClaim("token_type", jwt -> "access".equals(jwt.getClaim("token_type"))),
                requiredClaim("scope", jwt -> nonBlank(jwt.getClaim("scope")))
        );
    }

    private static OAuth2TokenValidator<Jwt> requiredClaim(String name, Predicate<Jwt> accepted) {
        return jwt -> accepted.test(jwt)
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error(
                        "invalid_token",
                        "JWT claim " + name + " is required and invalid or missing",
                        null
                ));
    }

    private static boolean hasAudience(Jwt jwt) {
        var audience = jwt.getAudience();
        return audience != null && audience.stream().anyMatch(value -> value != null && !value.isBlank());
    }

    private static boolean hasAcceptableIssuedAt(Jwt jwt) {
        Object claim = jwt.getClaim("iat");
        return claim instanceof Instant issuedAt && !issuedAt.isAfter(Instant.now().plus(CLOCK_SKEW));
    }

    private static boolean nonBlank(Object claim) {
        return claim instanceof String value && !value.isBlank();
    }
}
