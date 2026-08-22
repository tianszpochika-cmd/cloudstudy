package com.englishflow.social.security;

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

/** Resource-server boundary with no local authentication-success path. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(SocialResourceServerProperties.class)
public class SocialSecurityConfiguration {

    @Bean
    SocialSecurityErrorWriter socialSecurityErrorWriter(ObjectMapper objectMapper) {
        return new SocialSecurityErrorWriter(objectMapper);
    }

    @Bean
    SecurityErrorWriter securityErrorWriter(ObjectMapper objectMapper) {
        return new SecurityErrorWriter(objectMapper);
    }

    @Bean
    SocialAuthorityAttemptFilter socialAuthorityAttemptFilter(SocialSecurityErrorWriter writer) {
        return new SocialAuthorityAttemptFilter(writer);
    }

    @Bean
    ClientAuthorityHeaderFilter clientAuthorityHeaderFilter(SecurityErrorWriter writer) {
        return new ClientAuthorityHeaderFilter(writer);
    }

    @Bean
    SocialJwtAuthenticationConverter socialJwtAuthenticationConverter() {
        return new SocialJwtAuthenticationConverter();
    }

    @Bean
    @ConditionalOnProperty(prefix = "security.resource-server", name = "enabled", havingValue = "true")
    JwtDecoder socialJwtDecoder(SocialResourceServerProperties properties) {
        if (properties.getIssuerUri() == null || properties.getIssuerUri().isBlank()
                || properties.getJwkSetUri() == null || properties.getJwkSetUri().isBlank()) {
            throw new IllegalStateException("social resource server requires issuer-uri and jwk-set-uri");
        }
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(properties.getJwkSetUri()).build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(properties.getIssuerUri()));
        return decoder;
    }

    @Bean
    SecurityFilterChain socialSecurityFilterChain(
            HttpSecurity http,
            SocialResourceServerProperties properties,
            SocialAuthorityAttemptFilter authorityAttemptFilter,
            ClientAuthorityHeaderFilter clientAuthorityHeaderFilter,
            SecurityErrorWriter errorWriter,
            SocialJwtAuthenticationConverter jwtAuthenticationConverter) throws Exception {
        AuthenticationEntryPoint entryPoint = (request, response, exception) ->
                errorWriter.write(request, response, 401, "UNAUTHENTICATED", "authentication required");
        AccessDeniedHandler deniedHandler = (request, response, exception) ->
                errorWriter.write(request, response, 403, "FORBIDDEN", "access denied");

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
                .addFilterBefore(authorityAttemptFilter, AuthorizationFilter.class)
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
