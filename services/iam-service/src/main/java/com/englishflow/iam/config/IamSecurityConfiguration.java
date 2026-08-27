package com.englishflow.iam.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtAudienceValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

/** IAM validates the same provider JWT boundary as the Gateway; Gateway validation is not enough. */
@Configuration(proxyBeanMethods = false)
public class IamSecurityConfiguration {

    @Bean
    @ConditionalOnProperty(prefix = "iam", name = "real-provider-enabled", havingValue = "true")
    SecurityFilterChain iamResourceServerChain(HttpSecurity http, JwtDecoder iamJwtDecoder) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/actuator/health/**", "/actuator/info").permitAll()
                        .requestMatchers("/api/v1/auth/oidc/**").permitAll()
                        .requestMatchers("/api/v1/iam/session/refresh").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.decoder(iamJwtDecoder)))
                .build();
    }

    @Bean
    @ConditionalOnProperty(prefix = "iam", name = "real-provider-enabled", havingValue = "true")
    JwtDecoder iamJwtDecoder(IamServiceProperties properties) {
        String issuer = properties.getOidc().getExpectedIssuer();
        if (issuer == null || issuer.isBlank()) {
            throw new IllegalStateException("IAM resource server requires OIDC_ISSUER_URI");
        }
        JwtDecoder decoder = JwtDecoders.fromIssuerLocation(issuer);
        if (!(decoder instanceof NimbusJwtDecoder nimbus)) {
            throw new IllegalStateException("IAM issuer must provide a Nimbus JWT decoder");
        }
        OAuth2TokenValidator<Jwt> validator = new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(issuer),
                new JwtAudienceValidator(properties.getOidc().getAudience()));
        nimbus.setJwtValidator(validator);
        return nimbus;
    }

    @Bean
    @ConditionalOnProperty(prefix = "iam", name = "real-provider-enabled", havingValue = "false", matchIfMissing = true)
    SecurityFilterChain iamFailClosedChain(HttpSecurity http) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/actuator/health/**", "/actuator/info").permitAll()
                        .requestMatchers("/api/v1/auth/oidc/**").permitAll()
                        .requestMatchers("/api/v1/iam/session/refresh").permitAll()
                        .anyRequest().denyAll())
                .build();
    }
}
