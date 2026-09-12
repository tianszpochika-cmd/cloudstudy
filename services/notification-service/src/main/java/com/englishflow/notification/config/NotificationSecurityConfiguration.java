package com.englishflow.notification.config;

import com.englishflow.notification.security.FailClosedPep;
import com.englishflow.notification.security.PdpActivationGuard;
import com.englishflow.notification.security.PdpPort;
import com.englishflow.notification.security.UnavailablePdpPort;

import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
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
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.englishflow.notification.security.IamEnvelopedJwkSource;
import com.englishflow.notification.security.NotificationAuthorityAttemptFilter;
import com.englishflow.notification.security.NotificationJwtAuthenticationConverter;
import com.englishflow.notification.security.NotificationSecurityErrorWriter;

import tools.jackson.databind.ObjectMapper;

/**
 * Gateway authentication is not enough: the service independently validates a
 * self-owned JWT at its resource-server
 * seam and denies unauthenticated business requests by default.
 */
@Configuration
public class NotificationSecurityConfiguration {

    private static final Logger LOGGER = LoggerFactory.getLogger(NotificationSecurityConfiguration.class);

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
    @ConditionalOnProperty(prefix = "notification.security", name = "resource-server-enabled", havingValue = "true")
    JwtDecoder notificationJwtDecoder(
            @Value("${notification.security.issuer-uri:}") String issuerUri,
            @Value("${notification.security.jwk-set-uri:}") String jwkSetUri,
            @Value("${notification.security.audience:yuxuexing-api}") String audience) {
        if (issuerUri.isBlank() || jwkSetUri.isBlank() || audience.isBlank()) {
            throw new IllegalStateException("notification resource server requires issuer-uri, jwk-set-uri and audience");
        }
        NimbusJwtDecoder decoder = IamEnvelopedJwkSource.decoder(jwkSetUri, java.time.Clock.systemUTC());
        OAuth2TokenValidator<Jwt> validator = jwtValidator(issuerUri, audience);
        decoder.setJwtValidator(validator);
        return decoder;
    }

    @Bean
    NotificationSecurityErrorWriter notificationSecurityErrorWriter(ObjectMapper objectMapper) {
        return new NotificationSecurityErrorWriter(objectMapper);
    }

    @Bean
    NotificationAuthorityAttemptFilter notificationAuthorityAttemptFilter(
            NotificationSecurityErrorWriter errorWriter) {
        return new NotificationAuthorityAttemptFilter(errorWriter);
    }

    @Bean
    NotificationJwtAuthenticationConverter notificationJwtAuthenticationConverter() {
        return new NotificationJwtAuthenticationConverter();
    }

    @Bean
    SecurityFilterChain notificationSecurityFilterChain(HttpSecurity http,
            ObjectProvider<JwtDecoder> decoderProvider,
            NotificationAuthorityAttemptFilter authorityAttemptFilter,
            NotificationJwtAuthenticationConverter jwtAuthenticationConverter,
            NotificationSecurityErrorWriter errorWriter,
            @Value("${notification.security.resource-server-enabled:false}") boolean resourceServerEnabled)
            throws Exception {
        LOGGER.info("notification resource server enabled={}", resourceServerEnabled);
        AuthenticationEntryPoint entryPoint = (request, response, exception) ->
                errorWriter.write(response, 401, "UNAUTHENTICATED", "authentication required");
        AccessDeniedHandler deniedHandler = (request, response, exception) ->
                errorWriter.write(response, 403, "FORBIDDEN", "access denied");
        http.csrf(csrf -> csrf.disable())
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint(entryPoint)
                        .accessDeniedHandler(deniedHandler))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers("/internal/v1/**").authenticated()
                        .anyRequest().denyAll())
                .addFilterBefore(authorityAttemptFilter, AuthorizationFilter.class);
        if (resourceServerEnabled) {
            JwtDecoder decoder = decoderProvider.getIfAvailable(() -> {
                throw new IllegalStateException("notification resource server is enabled without a JwtDecoder");
            });
            http.oauth2ResourceServer(oauth -> oauth
                    .authenticationEntryPoint(entryPoint)
                    .accessDeniedHandler(deniedHandler)
                    .jwt(jwt -> jwt.decoder(decoder).jwtAuthenticationConverter(jwtAuthenticationConverter)));
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
}
