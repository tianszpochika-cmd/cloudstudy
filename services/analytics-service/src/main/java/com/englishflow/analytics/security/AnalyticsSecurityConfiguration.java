package com.englishflow.analytics.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
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

/** Resource-server seam with health-only anonymous access and default-deny business routes. */
@Configuration(proxyBeanMethods = false)
public class AnalyticsSecurityConfiguration {

    @Bean
    UntrustedSecurityFactsFilter untrustedSecurityFactsFilter() {
        return new UntrustedSecurityFactsFilter();
    }

    @Bean
    @ConditionalOnProperty(prefix = "analytics.security", name = "resource-server-enabled", havingValue = "true")
    JwtDecoder analyticsJwtDecoder(
            @Value("${analytics.security.issuer-uri:}") String issuerUri,
            @Value("${analytics.security.jwk-set-uri:}") String jwkSetUri) {
        if (issuerUri.isBlank() || jwkSetUri.isBlank()) {
            throw new IllegalStateException("analytics resource server requires issuer-uri and jwk-set-uri");
        }
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(issuerUri));
        return decoder;
    }

    @Bean
    SecurityFilterChain analyticsSecurityFilterChain(HttpSecurity http,
            UntrustedSecurityFactsFilter untrustedHeaders,
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
            http.oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults())
                    .authenticationEntryPoint(entryPoint).accessDeniedHandler(deniedHandler));
        }
        return http.build();
    }

    private static void write(jakarta.servlet.http.HttpServletResponse response, int status,
            String code, String message) throws IOException {
        response.setStatus(status);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json");
        response.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
    }
}
