package com.englishflow.workflow.security;

import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;

/**
 * P1R decision 1A: the recovery console needs an authenticated boundary, and the
 * service previously had none — Spring Boot's default chain rejected every
 * Bearer call before any controller ran. This wires the IAM enveloped-JWKS
 * resource server like every other domain service: verified JWTs authenticate,
 * the two-person rule and tenant scoping stay in the domain layer.
 */
@Configuration(proxyBeanMethods = false)
public class WorkflowSecurityConfiguration {

    @Bean
    JwtDecoder verifiedJwtDecoder(
            @Value("${workflow.security.jwk-set-uri:http://127.0.0.1:18087/api/v1/auth/jwks}") String jwkSetUri,
            @Value("${workflow.security.issuer-uri:http://127.0.0.1:18087}") String issuer,
            @Value("${workflow.security.audience:yuxuexing-api}") String audience) {
        NimbusJwtDecoder decoder = IamEnvelopedJwkSource.decoder(jwkSetUri, java.time.Clock.systemUTC());
        OAuth2TokenValidator<Jwt> validator = new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(issuer),
                new JwtAudienceValidator(audience),
                new JwtTimestampValidator(Duration.ofSeconds(60)),
                new JwtClaimValidator<String>("token_type", "access"::equals));
        decoder.setJwtValidator(validator);
        return decoder;
    }

    @Bean
    SecurityFilterChain workflowSecurityFilterChain(HttpSecurity http, JwtDecoder decoder) throws Exception {
        AuthenticationEntryPoint entryPoint = (request, response, exception) -> {
            response.setStatus(401);
            response.setContentType("application/json");
            response.getWriter().write("{\"code\":\"UNAUTHENTICATED\",\"message\":\"authentication required\"}");
        };
        AccessDeniedHandler deniedHandler = (request, response, exception) -> {
            response.setStatus(403);
            response.setContentType("application/json");
            response.getWriter().write("{\"code\":\"FORBIDDEN\",\"message\":\"access denied\"}");
        };
        http.csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint(entryPoint)
                        .accessDeniedHandler(deniedHandler))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/**").permitAll()
                        .requestMatchers("/internal/v1/**").authenticated()
                        .anyRequest().denyAll())
                .oauth2ResourceServer(oauth2 -> oauth2
                        .authenticationEntryPoint(entryPoint)
                        .accessDeniedHandler(deniedHandler)
                        .jwt(jwt -> jwt.decoder(decoder)));
        return http.build();
    }

    private static final class JwtAudienceValidator implements OAuth2TokenValidator<Jwt> {
        private final String audience;

        JwtAudienceValidator(String audience) {
            this.audience = audience;
        }

        @Override
        public OAuth2TokenValidatorResult validate(Jwt jwt) {
            if (jwt.getAudience() != null && jwt.getAudience().contains(audience)) {
                return OAuth2TokenValidatorResult.success();
            }
            return OAuth2TokenValidatorResult.failure(
                    new OAuth2Error("invalid_token", "JWT audience is not allowed", null));
        }
    }
}
