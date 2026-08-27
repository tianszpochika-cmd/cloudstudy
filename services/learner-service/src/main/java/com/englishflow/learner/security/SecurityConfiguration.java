package com.englishflow.learner.security;

import tools.jackson.databind.ObjectMapper;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
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

import jakarta.servlet.http.HttpServletResponse;

/** Service-side Resource Server and default-deny PEP boundary for learner APIs. */
@Configuration(proxyBeanMethods = false)
@EnableMethodSecurity
@EnableConfigurationProperties(ResourceServerSecurityProperties.class)
public class SecurityConfiguration {

    @Bean
    ClientAuthorityHeaderFilter clientAuthorityHeaderFilter() {
        return new ClientAuthorityHeaderFilter();
    }

    @Bean
    @ConditionalOnProperty(
            prefix = "security.resource-server",
            name = "enabled",
            havingValue = "true")
    JwtDecoder verifiedJwtDecoder(ResourceServerSecurityProperties properties) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(properties.getJwkSetUri()).build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(properties.getIssuerUri()));
        return decoder;
    }

    @Bean
    SecurityFilterChain learnerSecurityFilterChain(
            HttpSecurity http,
            ResourceServerSecurityProperties properties,
            ObjectProvider<JwtDecoder> decoderProvider,
            ClientAuthorityHeaderFilter authorityHeaderFilter,
            ObjectMapper objectMapper) throws Exception {
        AuthenticationEntryPoint entryPoint = (request, response, exception) ->
                write(objectMapper, response, 401, "UNAUTHENTICATED", "authentication required");
        AccessDeniedHandler deniedHandler = (request, response, exception) ->
                write(objectMapper, response, 403, "FORBIDDEN", "access denied");

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
                throw new IllegalStateException("Resource Server is enabled without a JwtDecoder");
            });
            http.oauth2ResourceServer(oauth2 -> oauth2
                    .authenticationEntryPoint(entryPoint)
                    .accessDeniedHandler(deniedHandler)
                    .jwt(jwt -> jwt.decoder(decoder)));
        }
        return http.build();
    }

    private static void write(
            ObjectMapper objectMapper,
            HttpServletResponse response,
            int status,
            String code,
            String message) throws java.io.IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        objectMapper.writeValue(response.getWriter(), new ErrorEnvelope(code, message));
    }

    private record ErrorEnvelope(String code, String message) {
    }
}
