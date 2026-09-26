package com.englishflow.workflow.security;

import jakarta.servlet.DispatcherType;
import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
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
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;

/**
 * P1R decision 1A: the recovery console needs an authenticated boundary, and the
 * service previously had none — Spring Boot's default chain rejected every
 * Bearer call before any controller ran. This wires the IAM enveloped-JWKS
 * resource server. Admin permissions are enforced here from verified JWT
 * claims and platform tenant at the HTTP boundary; the two-person rule remains
 * in the domain layer.
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
        JwtGrantedAuthoritiesConverter permissions = new JwtGrantedAuthoritiesConverter();
        permissions.setAuthoritiesClaimName("permissions");
        permissions.setAuthorityPrefix("PERM_");
        JwtAuthenticationConverter principal = new JwtAuthenticationConverter();
        principal.setJwtGrantedAuthoritiesConverter(permissions);
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
                        // The original REQUEST has already passed this chain. Let Spring
                        // render its 400/404/409 response instead of masking it as 403.
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers("/actuator/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/internal/v1/workflow/recoveries")
                            .access(platformPermission("admin.recovery.request"))
                        .requestMatchers(HttpMethod.POST, "/internal/v1/workflow/recoveries/*/approve",
                                "/internal/v1/workflow/recoveries/*/reject",
                                "/internal/v1/workflow/recoveries/*/execute",
                                "/internal/v1/workflow/sagas/*/compensate")
                            .access(platformPermission("admin.recovery.command"))
                        .requestMatchers(HttpMethod.GET, "/internal/v1/workflow/sagas/unfinished",
                                "/internal/v1/workflow/sagas/*")
                            .access(platformPermission("admin.recovery.read"))
                        .requestMatchers(HttpMethod.POST, "/internal/v1/workflow/sagas")
                            .access(platformPermission("workflow.saga.start"))
                        .anyRequest().denyAll())
                .oauth2ResourceServer(oauth2 -> oauth2
                        .authenticationEntryPoint(entryPoint)
                        .accessDeniedHandler(deniedHandler)
                        .jwt(jwt -> jwt.decoder(decoder).jwtAuthenticationConverter(principal)));
        return http.build();
    }

    private static AuthorizationManager<RequestAuthorizationContext> platformPermission(String permission) {
        return (authentication, context) -> {
            boolean allowed = authentication.get() instanceof JwtAuthenticationToken jwt
                    && "platform".equals(jwt.getToken().getClaimAsString("tenant_id"))
                    && jwt.getAuthorities().stream()
                            .anyMatch(authority -> ("PERM_" + permission).equals(authority.getAuthority()));
            return new AuthorizationDecision(allowed);
        };
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
