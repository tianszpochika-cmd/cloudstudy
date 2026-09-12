package com.englishflow.gamification.adapter.http;

import com.englishflow.gamification.security.FailClosedPep;
import com.englishflow.gamification.security.PdpActivationGuard;
import com.englishflow.gamification.security.PdpPort;
import com.englishflow.gamification.security.UnavailablePdpPort;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import com.englishflow.gamification.security.IamEnvelopedJwkSource;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
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

/** Resource-server seam and default-deny service-side PEP. */
@Configuration
public class GamificationSecurityConfiguration {

    @Bean

    PdpPort pdpPort() {

        // No dynamic PDP is provisioned in Phase 1 service slices yet; the fail-closed adapter

        // keeps every future dynamic-fact consultation deny-by-default.

        return new UnavailablePdpPort();

    }


    @Bean

    FailClosedPep failClosedPep(PdpPort pdpPort) {

        return new FailClosedPep(pdpPort, java.time.Clock.systemUTC());

    }


    @Bean

    Object pdpActivationGuard(PdpPort pdpPort,

            @Value("${security.pep.dynamic-facts-required:false}") boolean dynamicFactsRequired) {

        PdpActivationGuard.requireProvisioned(dynamicFactsRequired, pdpPort);

        return new Object();

    }


    @Bean
    @ConditionalOnProperty(prefix = "gamification.security", name = "resource-server-enabled", havingValue = "true")
    JwtDecoder gamificationJwtDecoder(
            @Value("${gamification.security.issuer-uri:}") String issuerUri,
            @Value("${gamification.security.jwk-set-uri:}") String jwkSetUri,
            @Value("${gamification.security.audience:yuxuexing-api}") String audience) {
        if (issuerUri.isBlank() || jwkSetUri.isBlank() || audience.isBlank()) {
            throw new IllegalStateException("gamification resource server requires issuer-uri, jwk-set-uri and audience");
        }
        NimbusJwtDecoder decoder = IamEnvelopedJwkSource.decoder(jwkSetUri, java.time.Clock.systemUTC());
        OAuth2TokenValidator<Jwt> validator = jwtValidator(issuerUri, audience);
        decoder.setJwtValidator(validator);
        return decoder;
    }

    @Bean
    GamificationJwtAuthenticationConverter gamificationJwtAuthenticationConverter() {
        return new GamificationJwtAuthenticationConverter();
    }

    @Bean
    UntrustedSecurityFactsFilter untrustedSecurityFactsFilter() {
        return new UntrustedSecurityFactsFilter();
    }

    @Bean
    SecurityFilterChain gamificationSecurityFilterChain(HttpSecurity http,
            UntrustedSecurityFactsFilter untrustedHeaders,
            ObjectProvider<JwtDecoder> decoderProvider,
            GamificationJwtAuthenticationConverter jwtAuthenticationConverter,
            @Value("${gamification.security.resource-server-enabled:false}") boolean resourceServerEnabled)
            throws Exception {
        AuthenticationEntryPoint authenticationEntryPoint = (request, response, exception) -> write(response, 401,
                "UNAUTHORIZED", "verified JWT is required");
        AccessDeniedHandler accessDeniedHandler = (request, response, exception) -> write(response, 403,
                "FORBIDDEN", "policy denied this operation");

        http.csrf(csrf -> csrf.disable())
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .addFilterBefore(untrustedHeaders, AuthorizationFilter.class)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers("/internal/v1/gamification/trusted-events/**")
                        .hasAnyAuthority("gamification.events.consume",
                                "PERM_gamification.events.consume",
                                "SCOPE_gamification.events.consume")
                        .requestMatchers("/internal/v1/gamification/**").authenticated()
                        .anyRequest().denyAll());
        if (resourceServerEnabled) {
            JwtDecoder decoder = decoderProvider.getIfAvailable(() -> {
                throw new IllegalStateException("gamification resource server is enabled without a JwtDecoder");
            });
            http.oauth2ResourceServer(oauth -> oauth.jwt(jwt -> jwt.decoder(decoder)
                            .jwtAuthenticationConverter(jwtAuthenticationConverter))
                    .authenticationEntryPoint(authenticationEntryPoint)
                    .accessDeniedHandler(accessDeniedHandler));
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
