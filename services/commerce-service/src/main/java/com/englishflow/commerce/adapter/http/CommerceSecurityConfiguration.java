package com.englishflow.commerce.adapter.http;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.access.intercept.AuthorizationFilter;

@Configuration
public class CommerceSecurityConfiguration {
    @Bean UntrustedCommerceFactsFilter untrustedCommerceFactsFilter() { return new UntrustedCommerceFactsFilter(); }

    @Bean SecurityFilterChain commerceSecurityFilterChain(HttpSecurity http, UntrustedCommerceFactsFilter untrusted,
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
            http.oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults())
                    .authenticationEntryPoint(entryPoint).accessDeniedHandler(denied));
        }
        return http.build();
    }

    private static void write(jakarta.servlet.http.HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json");
        response.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
    }
}
