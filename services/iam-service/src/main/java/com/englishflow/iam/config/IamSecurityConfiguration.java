package com.englishflow.iam.config;

import com.englishflow.iam.auth.JwtPermissionAuthenticationConverter;
import com.englishflow.iam.auth.JwtSigningKeyProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
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
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.web.SecurityFilterChain;

import java.time.Duration;

/** IAM verifies its own access JWTs independently, including issuer, signature and audience. */
@Configuration(proxyBeanMethods = false)
public class IamSecurityConfiguration {

    @Bean
    SecurityFilterChain iamResourceServerChain(HttpSecurity http, JwtDecoder iamJwtDecoder,
                                               Converter<Jwt, ? extends AbstractAuthenticationToken> converter) throws Exception {
        return http.csrf(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/actuator/health/**", "/actuator/info").permitAll()
                        .requestMatchers("/api/v1/auth/register", "/api/v1/auth/login",
                                "/api/v1/auth/token/refresh", "/api/v1/auth/jwks",
                                "/api/v1/auth/password-reset/**").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.decoder(iamJwtDecoder)
                        .jwtAuthenticationConverter(converter)))
                .build();
    }

    @Bean
    JwtDecoder iamJwtDecoder(IamServiceProperties properties, JwtSigningKeyProvider keys) {
        if (!"RS256".equals(properties.getJwt().getAlgorithm())) {
            throw new IllegalStateException("IAM currently requires RS256 signing");
        }
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSource(keys.jwkSource()).build();
        OAuth2TokenValidator<Jwt> algorithm = jwt -> "RS256".equals(jwt.getHeaders().get("alg"))
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "JWT algorithm is not allowed", null));
        OAuth2TokenValidator<Jwt> tokenType = new JwtClaimValidator<String>("token_type", "access"::equals);
        OAuth2TokenValidator<Jwt> scope = new JwtClaimValidator<String>("scope", value -> value != null && !value.isBlank());
        OAuth2TokenValidator<Jwt> validator = new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(properties.getJwt().getIssuer()),
                new JwtAudienceValidator(properties.getJwt().getAudience()),
                new JwtTimestampValidator(positive(properties.getJwt().getClockSkew(), Duration.ofSeconds(60))),
                algorithm, tokenType, scope);
        decoder.setJwtValidator(validator);
        return decoder;
    }

    @Bean
    Converter<Jwt, ? extends AbstractAuthenticationToken> jwtAuthenticationConverter() {
        return new JwtPermissionAuthenticationConverter();
    }

    private static Duration positive(Duration value, Duration fallback) {
        return value == null || value.isNegative() ? fallback : value;
    }
}
