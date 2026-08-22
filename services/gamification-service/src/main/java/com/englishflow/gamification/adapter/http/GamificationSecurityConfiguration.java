package com.englishflow.gamification.adapter.http;

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

/** Resource-server seam and default-deny service-side PEP. */
@Configuration
public class GamificationSecurityConfiguration {

    @Bean
    UntrustedSecurityFactsFilter untrustedSecurityFactsFilter() {
        return new UntrustedSecurityFactsFilter();
    }

    @Bean
    SecurityFilterChain gamificationSecurityFilterChain(HttpSecurity http,
            UntrustedSecurityFactsFilter untrustedHeaders,
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
            http.oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults())
                    .authenticationEntryPoint(authenticationEntryPoint)
                    .accessDeniedHandler(accessDeniedHandler));
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
