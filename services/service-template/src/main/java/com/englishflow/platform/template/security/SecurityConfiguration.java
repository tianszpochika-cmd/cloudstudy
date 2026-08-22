package com.englishflow.platform.template.security;

import java.time.Clock;

import com.englishflow.platform.template.config.ResourceServerProperties;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.access.intercept.AuthorizationFilter;

import com.fasterxml.jackson.databind.ObjectMapper;

/** Default-deny Resource Server boundary for a copied v2 service. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(ResourceServerProperties.class)
public class SecurityConfiguration {

    @Bean
    Clock securityClock() {
        return Clock.systemUTC();
    }

    @Bean
    SecurityErrorWriter securityErrorWriter(ObjectMapper objectMapper) {
        return new SecurityErrorWriter(objectMapper);
    }

    @Bean
    ClientAuthorityHeaderFilter clientAuthorityHeaderFilter(SecurityErrorWriter writer) {
        return new ClientAuthorityHeaderFilter(writer);
    }

    @Bean
    VerifiedJwtAuthenticationConverter verifiedJwtAuthenticationConverter() {
        return new VerifiedJwtAuthenticationConverter();
    }

    @Bean
    PolicyCache policyCache(ResourceServerProperties properties, Clock clock) {
        return new PolicyCache(clock, properties.getPolicyCacheTtl());
    }

    @Bean
    LocalPolicyEvaluator localPolicyEvaluator(Clock clock) {
        return new LocalPolicyEvaluator(clock);
    }

    @Bean
    PepGuard pepGuard(
            PolicyCache policyCache,
            LocalPolicyEvaluator localEvaluator,
            ObjectProvider<PdpPort> pdpProvider,
            ResourceServerProperties properties,
            Clock clock) {
        return new PepGuard(
                policyCache,
                localEvaluator,
                pdpProvider.getIfAvailable(),
                properties.getPdpTimeout(),
                clock);
    }

    @Bean
    @ConditionalOnProperty(
            prefix = "security.resource-server",
            name = "enabled",
            havingValue = "true")
    JwtDecoder verifiedJwtDecoder(ResourceServerProperties properties) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(properties.getJwkSetUri()).build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(properties.getIssuerUri()));
        return decoder;
    }

    @Bean
    SecurityFilterChain templateSecurityFilterChain(
            HttpSecurity http,
            ResourceServerProperties properties,
            ObjectProvider<JwtDecoder> decoderProvider,
            VerifiedJwtAuthenticationConverter converter,
            ClientAuthorityHeaderFilter authorityHeaderFilter,
            SecurityErrorWriter errorWriter) throws Exception {
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
                    auth.requestMatchers("/actuator/**").permitAll();
                    if (properties.isEnabled()) {
                        auth.anyRequest().authenticated();
                    } else {
                        auth.anyRequest().denyAll();
                    }
                })
                .addFilterBefore(authorityHeaderFilter, AuthorizationFilter.class);

        if (properties.isEnabled()) {
            JwtDecoder decoder = decoderProvider.getIfAvailable(() -> {
                throw new IllegalStateException("resource server is enabled without a JwtDecoder");
            });
            http.oauth2ResourceServer(oauth2 -> oauth2
                    .authenticationEntryPoint(entryPoint)
                    .accessDeniedHandler(deniedHandler)
                    .jwt(jwt -> jwt
                            .decoder(decoder)
                            .jwtAuthenticationConverter(converter)));
        }
        return http.build();
    }
}
