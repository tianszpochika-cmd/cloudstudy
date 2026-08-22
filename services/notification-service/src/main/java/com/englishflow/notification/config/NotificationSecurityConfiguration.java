package com.englishflow.notification.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Gateway authentication is not enough: the service keeps a resource-server
 * seam and denies unauthenticated business requests by default.
 */
@Configuration
public class NotificationSecurityConfiguration {

    @Bean
    SecurityFilterChain notificationSecurityFilterChain(HttpSecurity http,
            @Value("${notification.security.resource-server-enabled:false}") boolean resourceServerEnabled)
            throws Exception {
        http.csrf(csrf -> csrf.disable())
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers("/internal/v1/**").authenticated()
                        .anyRequest().denyAll());
        if (resourceServerEnabled) {
            http.oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults()));
        }
        return http.build();
    }
}
