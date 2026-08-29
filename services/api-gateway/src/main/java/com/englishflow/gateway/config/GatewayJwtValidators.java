package com.englishflow.gateway.config;

import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtAudienceValidator;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.JwtValidators;

import java.time.Duration;
import java.util.Objects;

/** Gateway independently validates the platform JWT boundary before routing. */
final class GatewayJwtValidators {
    private GatewayJwtValidators() {}

    static OAuth2TokenValidator<Jwt> forSecurity(GatewayProperties.Security security) {
        Objects.requireNonNull(security, "security");
        OAuth2TokenValidator<Jwt> algorithm = jwt -> "RS256".equals(jwt.getHeaders().get("alg"))
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "JWT algorithm is not allowed", null));
        return new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(security.issuerUri()),
                new JwtAudienceValidator(security.audience()),
                new JwtTimestampValidator(Duration.ofSeconds(60)),
                algorithm,
                new JwtClaimValidator<String>("token_type", "access"::equals),
                new JwtClaimValidator<String>("scope", value -> value != null && !value.isBlank())
        );
    }
}
