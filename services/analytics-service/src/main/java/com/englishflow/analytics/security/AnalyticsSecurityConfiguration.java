package com.englishflow.analytics.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
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

/** Self-owned JWT Resource Server seam with health-only anonymous access and default-deny routes. */
@Configuration(proxyBeanMethods = false)
public class AnalyticsSecurityConfiguration {

    @Bean
    UntrustedSecurityFactsFilter untrustedSecurityFactsFilter() {
        return new UntrustedSecurityFactsFilter();
    }

    @Bean
    AnalyticsJwtAuthenticationConverter analyticsJwtAuthenticationConverter() {
        return new AnalyticsJwtAuthenticationConverter();
    }

    @Bean
    @ConditionalOnProperty(prefix = "analytics.security", name = "resource-server-enabled", havingValue = "true")
    JwtDecoder analyticsJwtDecoder(
            @Value("${analytics.security.issuer-uri:}") String issuerUri,
            @Value("${analytics.security.jwk-set-uri:}") String jwkSetUri,
            @Value("${analytics.security.audience:yuxuexing-api}") String audience) {
        if (issuerUri.isBlank() || jwkSetUri.isBlank() || audience.isBlank()) {
            throw new IllegalStateException("analytics resource server requires issuer-uri, jwk-set-uri and audience");
        }
        NimbusJwtDecoder decoder = IamEnvelopedJwkSource.decoder(jwkSetUri, java.time.Clock.systemUTC());
        OAuth2TokenValidator<Jwt> validator = jwtValidator(issuerUri, audience);
        decoder.setJwtValidator(validator);
        return decoder;
    }

    @Bean
    SecurityFilterChain analyticsSecurityFilterChain(HttpSecurity http,
            UntrustedSecurityFactsFilter untrustedHeaders,
            AnalyticsJwtAuthenticationConverter jwtAuthenticationConverter,
            ObjectProvider<JwtDecoder> decoderProvider,
            @Value("${analytics.security.resource-server-enabled:false}") boolean resourceServerEnabled)
            throws Exception {
        AuthenticationEntryPoint entryPoint = (request, response, exception) -> write(response, 401,
                "UNAUTHENTICATED", "verified JWT is required");
        AccessDeniedHandler deniedHandler = (request, response, exception) -> write(response, 403,
                "FORBIDDEN", "analytics policy denied this operation");

        http.csrf(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(errors -> errors.authenticationEntryPoint(entryPoint).accessDeniedHandler(deniedHandler))
                .addFilterBefore(untrustedHeaders, AuthorizationFilter.class)
                .authorizeHttpRequests(auth -> {
                    auth.requestMatchers("/health", "/actuator/health", "/actuator/health/**").permitAll();
                    if (resourceServerEnabled) {
                        auth.anyRequest().authenticated();
                    } else {
                        auth.anyRequest().denyAll();
                    }
                });
        if (resourceServerEnabled) {
            JwtDecoder decoder = decoderProvider.getIfAvailable(() -> {
                throw new IllegalStateException("analytics resource server is enabled without a JwtDecoder");
            });
            http.oauth2ResourceServer(oauth -> oauth
                    .jwt(jwt -> jwt.decoder(decoder).jwtAuthenticationConverter(jwtAuthenticationConverter))
                    .authenticationEntryPoint(entryPoint).accessDeniedHandler(deniedHandler));
        }
        return http.build();
    }

    private static OAuth2TokenValidator<Jwt> jwtValidator(String issuer, String audience) {
        OAuth2TokenValidator<Jwt> algorithm = jwt -> "RS256".equals(jwt.getHeaders().get("alg"))
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "JWT algorithm is not allowed", null));
        OAuth2TokenValidator<Jwt> authorityClaims = jwt -> hasValues(jwt.getClaim("permissions"))
                || hasValues(jwt.getClaim("roles"))
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "JWT authority claims are missing", null));
        return new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(issuer),
                new JwtAudienceValidator(audience),
                new JwtTimestampValidator(Duration.ofSeconds(60)),
                algorithm,
                new JwtClaimValidator<String>("token_type", "access"::equals),
                new JwtClaimValidator<String>("scope", value -> value != null && !value.isBlank()),
                authorityClaims);
    }

    private static boolean hasValues(Object value) {
        return value instanceof java.util.Collection<?> collection && !collection.isEmpty()
                || value instanceof String text && !text.isBlank();
    }

    private static void write(jakarta.servlet.http.HttpServletResponse response, int status,
            String code, String message) throws IOException {
        response.setStatus(status);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json");
        response.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
    }
}
