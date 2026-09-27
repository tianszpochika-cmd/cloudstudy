package com.englishflow.audit.security;

import java.time.Duration;
import java.time.Clock;
import java.util.Set;

import com.englishflow.audit.config.AuditServiceProperties;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtAudienceValidator;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.access.intercept.AuthorizationFilter;

import tools.jackson.databind.ObjectMapper;

@Configuration
public class AuditSecurityConfiguration {

    @Bean
    AuditAuthorityAttemptFilter auditAuthorityAttemptFilter() {
        return new AuditAuthorityAttemptFilter();
    }

    @Bean
    AuditJwtAuthenticationConverter auditJwtAuthenticationConverter() {
        return new AuditJwtAuthenticationConverter();
    }

    @Bean
    @ConditionalOnProperty(prefix = "audit.security", name = "resource-server-enabled", havingValue = "true", matchIfMissing = true)
    JwtDecoder verifiedJwtDecoder(AuditServiceProperties properties) {
        AuditServiceProperties.Security security = properties.getSecurity();
        if (security.getIssuerUri().isBlank() || security.getJwkSetUri().isBlank()
                || security.getAudience().isBlank()) {
            throw new IllegalStateException("audit resource server requires issuer-uri, jwk-set-uri and audience");
        }
        NimbusJwtDecoder decoder = IamEnvelopedJwkSource.decoder(security.getJwkSetUri(), Clock.systemUTC());
        decoder.setJwtValidator(jwtValidator(security.getIssuerUri(), security.getAudience()));
        return decoder;
    }

    @Bean
    SecurityFilterChain auditSecurityFilterChain(
            HttpSecurity http,
            ObjectProvider<JwtDecoder> decoderProvider,
            AuditAuthorityAttemptFilter authorityAttemptFilter,
            AuditJwtAuthenticationConverter jwtAuthenticationConverter,
            ObjectMapper objectMapper,
            AuditServiceProperties properties) throws Exception {
        AuthenticationEntryPoint entryPoint = (request, response, exception) -> {
            response.setStatus(401);
            response.setContentType("application/json");
            objectMapper.writeValue(response.getWriter(),
                    new ErrorEnvelope("UNAUTHENTICATED", "authentication required"));
        };
        AccessDeniedHandler deniedHandler = (request, response, exception) -> {
            response.setStatus(403);
            response.setContentType("application/json");
            objectMapper.writeValue(response.getWriter(), new ErrorEnvelope("FORBIDDEN", "access denied"));
        };
        http.csrf(csrf -> csrf.disable())
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint(entryPoint)
                        .accessDeniedHandler(deniedHandler))
                .authorizeHttpRequests(auth -> auth
                        // Error forwards must render the honest framework error (400/404/405):
                        // denying them here masks every binding failure as opaque 403.
                        // Error bodies carry no secrets (domain messages exclude payloads;
                        // Boot sanitizes the rest), so permitting the forward is safe.
                        .dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ERROR).permitAll()
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers("/internal/v1/audit/**").authenticated()
                        .anyRequest().denyAll())
                .addFilterBefore(authorityAttemptFilter, AuthorizationFilter.class);
        if (properties.getSecurity().isResourceServerEnabled()) {
            JwtDecoder decoder = decoderProvider.getIfAvailable(() -> {
                throw new IllegalStateException("audit resource server is enabled without a JwtDecoder");
            });
            http.oauth2ResourceServer(oauth -> oauth
                    .jwt(jwt -> jwt.decoder(decoder).jwtAuthenticationConverter(jwtAuthenticationConverter))
                    .authenticationEntryPoint(entryPoint)
                    .accessDeniedHandler(deniedHandler));
        }
        return http.build();
    }

    private static OAuth2TokenValidator<Jwt> jwtValidator(String issuer, String audience) {
        OAuth2TokenValidator<Jwt> algorithm = jwt -> "RS256".equals(jwt.getHeaders().get("alg"))
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(
                        new OAuth2Error("invalid_token", "JWT algorithm is not allowed", null));
        OAuth2TokenValidator<Jwt> authorityClaims = jwt -> hasValues(jwt.getClaim("permissions"))
                || hasValues(jwt.getClaim("roles"))
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(
                        new OAuth2Error("invalid_token", "JWT authority claims are missing", null));
        return new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(issuer),
                new JwtAudienceValidator(audience),
                new JwtTimestampValidator(Duration.ofSeconds(60)),
                algorithm,
                // Both token types, because this service is written to by other services as well as by people. ADR-0016
                // issues a short-lived service token for exactly that, and until this accepted it the Gateway's ingest
                // was refused at the decoder: a valid token, issued by the only issuer, rejected because its
                // token_type said "service". A service token still has to carry a scope and an authority claim, and
                // anyRequest().denyAll() keeps everything except the ingest closed to it.
                new JwtClaimValidator<String>("token_type", value -> "access".equals(value) || "service".equals(value)),
                new JwtClaimValidator<String>("scope", value -> value != null && !value.isBlank()),
                authorityClaims);
    }

    private static boolean hasValues(Object value) {
        return value instanceof java.util.Collection<?> collection && !collection.isEmpty()
                || value instanceof String text && !text.isBlank();
    }

    private record ErrorEnvelope(String code, String message) {
    }
}
