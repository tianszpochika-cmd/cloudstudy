package com.englishflow.content.security;

import java.time.Duration;

import com.englishflow.content.config.ContentResourceServerProperties;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
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

/** Default-deny self-owned JWT boundary; Gateway validation never replaces service-side PEP. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(ContentResourceServerProperties.class)
public class ContentSecurityConfiguration {

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
    @ConditionalOnProperty(
            prefix = "security.resource-server",
            name = "enabled",
            havingValue = "true")
    JwtDecoder verifiedJwtDecoder(ContentResourceServerProperties properties) {
        NimbusJwtDecoder decoder = IamEnvelopedJwkSource.decoder(properties.getJwkSetUri(), java.time.Clock.systemUTC());
        OAuth2TokenValidator<Jwt> validator = jwtValidator(properties.getIssuerUri(), properties.getAudience());
        decoder.setJwtValidator(validator);
        return decoder;
    }

    @Bean
    ContentSecurityErrorWriter contentSecurityErrorWriter() {
        return new ContentSecurityErrorWriter();
    }

    @Bean
    ContentAuthorityAttemptFilter contentAuthorityAttemptFilter(ContentSecurityErrorWriter writer) {
        return new ContentAuthorityAttemptFilter(writer);
    }

    @Bean
    ContentJwtAuthenticationConverter contentJwtAuthenticationConverter() {
        return new ContentJwtAuthenticationConverter();
    }

    @Bean
    SecurityFilterChain contentSecurityFilterChain(
            HttpSecurity http,
            ContentResourceServerProperties properties,
            ObjectProvider<JwtDecoder> decoderProvider,
            ContentAuthorityAttemptFilter authorityAttemptFilter,
            ContentJwtAuthenticationConverter jwtAuthenticationConverter,
            ContentSecurityErrorWriter errorWriter) throws Exception {
        AuthenticationEntryPoint entryPoint = (request, response, exception) ->
                errorWriter.write(response, 401, "UNAUTHENTICATED", "authentication required");
        AccessDeniedHandler deniedHandler = (request, response, exception) ->
                errorWriter.write(response, 403, "FORBIDDEN", "access denied");

        http.csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint(entryPoint)
                        .accessDeniedHandler(deniedHandler))
                .authorizeHttpRequests(auth -> {
                    // Error forwards must render the honest framework error (400/404/405):
                    // denying them here masks every binding failure as opaque 403.
                    // Error bodies carry no secrets (domain messages exclude payloads;
                    // Boot sanitizes the rest), so permitting the forward is safe.
                    auth.dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ERROR).permitAll();
                    auth.requestMatchers("/actuator/**").permitAll();
                    auth.requestMatchers("/api/v1/public/content/**").permitAll();
                    auth.requestMatchers("/api/v1/public/site/projection").permitAll();
                    if (properties.isEnabled()) {
                        auth.anyRequest().authenticated();
                    } else {
                        auth.anyRequest().denyAll();
                    }
                })
                .addFilterBefore(authorityAttemptFilter, AuthorizationFilter.class);

        if (properties.isEnabled()) {
            JwtDecoder decoder = decoderProvider.getIfAvailable(() ->
                    { throw new IllegalStateException("resource server is enabled without a JwtDecoder"); });
            http.oauth2ResourceServer(oauth2 -> oauth2
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
