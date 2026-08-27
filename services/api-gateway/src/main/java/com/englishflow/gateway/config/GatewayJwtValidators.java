package com.englishflow.gateway.config;

import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtAudienceValidator;
import org.springframework.security.oauth2.jwt.JwtValidators;

import java.util.Objects;

/**
 * The Gateway accepts only JWTs issued by the configured OIDC issuer for the
 * configured API audience. Signature/JWKS verification is performed by the
 * Nimbus decoder; these validators enforce the token boundary after decoding.
 */
final class GatewayJwtValidators {

    private GatewayJwtValidators() {
    }

    static OAuth2TokenValidator<Jwt> forSecurity(GatewayProperties.Security security) {
        Objects.requireNonNull(security, "security");
        return new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(security.issuerUri()),
                new JwtAudienceValidator(security.audience())
        );
    }
}
