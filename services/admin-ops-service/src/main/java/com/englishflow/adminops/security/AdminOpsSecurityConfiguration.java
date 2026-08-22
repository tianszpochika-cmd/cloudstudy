package com.englishflow.adminops.security;

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

import tools.jackson.databind.ObjectMapper;

/** Resource-server boundary; a disabled IdP is fail-closed rather than a local bypass. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(AdminOpsResourceServerProperties.class)
public class AdminOpsSecurityConfiguration {

    @Bean
    AdminOpsSecurityErrorWriter adminOpsSecurityErrorWriter(ObjectMapper objectMapper) {
        return new AdminOpsSecurityErrorWriter(objectMapper);
    }

    @Bean
    ClientAuthorityHeaderFilter clientAuthorityHeaderFilter(AdminOpsSecurityErrorWriter writer) {
        return new ClientAuthorityHeaderFilter(writer);
    }

    @Bean
    AdminOpsJwtAuthenticationConverter adminOpsJwtAuthenticationConverter() {
        return new AdminOpsJwtAuthenticationConverter();
    }

    @Bean
    @ConditionalOnProperty(prefix = "security.resource-server", name = "enabled", havingValue = "true")
    JwtDecoder adminOpsJwtDecoder(AdminOpsResourceServerProperties properties) {
        if (properties.getIssuerUri() == null || properties.getIssuerUri().isBlank()
                || properties.getJwkSetUri() == null || properties.getJwkSetUri().isBlank()) {
            throw new IllegalStateException("admin-ops resource server requires issuer-uri and jwk-set-uri");
        }
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(properties.getJwkSetUri()).build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(properties.getIssuerUri()));
        return decoder;
    }

    @Bean
    SecurityFilterChain adminOpsSecurityFilterChain(
            HttpSecurity http,
            AdminOpsResourceServerProperties properties,
            ClientAuthorityHeaderFilter clientAuthorityHeaderFilter,
            AdminOpsSecurityErrorWriter errorWriter,
            AdminOpsJwtAuthenticationConverter jwtAuthenticationConverter) throws Exception {
        AuthenticationEntryPoint entryPoint = (request, response, exception) ->
                errorWriter.write(request, response, 401, "ADMIN_UNAUTHENTICATED", "authentication required");
        AccessDeniedHandler deniedHandler = (request, response, exception) ->
                errorWriter.write(request, response, 403, "ADMIN_FORBIDDEN", "access denied");

        http.csrf(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint(entryPoint)
                        .accessDeniedHandler(deniedHandler))
                .authorizeHttpRequests(auth -> {
                    auth.requestMatchers("/actuator/**", "/health").permitAll();
                    if (properties.isEnabled()) {
                        auth.anyRequest().authenticated();
                    } else {
                        auth.anyRequest().denyAll();
                    }
                })
                .addFilterBefore(clientAuthorityHeaderFilter, AuthorizationFilter.class);

        if (properties.isEnabled()) {
            http.oauth2ResourceServer(oauth2 -> oauth2
                    .authenticationEntryPoint(entryPoint)
                    .accessDeniedHandler(deniedHandler)
                    .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter)));
        }
        return http.build();
    }
}
