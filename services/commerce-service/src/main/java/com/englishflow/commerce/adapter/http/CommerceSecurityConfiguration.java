package com.englishflow.commerce.adapter.http;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
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
import com.englishflow.commerce.security.CommerceJwtAuthenticationConverter;
import com.englishflow.commerce.security.IamEnvelopedJwkSource;

import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.access.intercept.AuthorizationFilter;

@Configuration
public class CommerceSecurityConfiguration {
    @Bean
    @ConditionalOnProperty(prefix = "commerce.security", name = "resource-server-enabled", havingValue = "true")
    JwtDecoder commerceJwtDecoder(
            @Value("${commerce.security.issuer-uri:}") String issuerUri,
            @Value("${commerce.security.jwk-set-uri:}") String jwkSetUri,
            @Value("${commerce.security.audience:yuxuexing-api}") String audience) {
        if (issuerUri.isBlank() || jwkSetUri.isBlank() || audience.isBlank()) {
            throw new IllegalStateException("commerce resource server requires issuer-uri, jwk-set-uri and audience");
        }
        NimbusJwtDecoder decoder = IamEnvelopedJwkSource.decoder(jwkSetUri, java.time.Clock.systemUTC());
        OAuth2TokenValidator<Jwt> validator = jwtValidator(issuerUri, audience);
        decoder.setJwtValidator(validator);
        return decoder;
    }

    @Bean UntrustedCommerceFactsFilter untrustedCommerceFactsFilter() { return new UntrustedCommerceFactsFilter(); }

    @Bean CommerceJwtAuthenticationConverter commerceJwtAuthenticationConverter() {
        return new CommerceJwtAuthenticationConverter();
    }

    @Bean SecurityFilterChain commerceSecurityFilterChain(HttpSecurity http, UntrustedCommerceFactsFilter untrusted,
            CommerceJwtAuthenticationConverter jwtAuthenticationConverter,
            ObjectProvider<JwtDecoder> decoderProvider,
            @Value("${commerce.security.resource-server-enabled:false}") boolean resourceServerEnabled) throws Exception {
        AuthenticationEntryPoint entryPoint = (request, response, exception) -> write(response, 401, "UNAUTHORIZED", "verified JWT is required");
        AccessDeniedHandler denied = (request, response, exception) -> write(response, 403, "FORBIDDEN", "commerce policy denied this operation");
        http.csrf(csrf -> csrf.disable())
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .exceptionHandling(exceptions -> exceptions.authenticationEntryPoint(entryPoint).accessDeniedHandler(denied))
                .addFilterBefore(untrusted, AuthorizationFilter.class)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/internal/v1/commerce/public/catalog").permitAll()
                        .requestMatchers("/actuator/health", "/actuator/health/**", "/internal/v1/commerce/readiness").permitAll()
                        .requestMatchers("/internal/v1/commerce/providers/*/callbacks", "/internal/v1/commerce/refunds/callbacks").authenticated()
                        .requestMatchers("/internal/v1/commerce/**").authenticated()
                        .anyRequest().denyAll());
        if (resourceServerEnabled) {
            JwtDecoder decoder = decoderProvider.getIfAvailable(() -> {
                throw new IllegalStateException("commerce resource server is enabled without a JwtDecoder");
            });
            http.oauth2ResourceServer(oauth -> oauth
                    .jwt(jwt -> jwt.decoder(decoder).jwtAuthenticationConverter(jwtAuthenticationConverter))
                    .authenticationEntryPoint(entryPoint).accessDeniedHandler(denied));
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

    private static void write(jakarta.servlet.http.HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json");
        response.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
    }
}
