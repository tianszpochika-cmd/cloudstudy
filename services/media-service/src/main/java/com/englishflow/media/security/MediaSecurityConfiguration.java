package com.englishflow.media.security;

import com.englishflow.media.config.MediaResourceServerProperties;

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

/** Default-deny boundary; local absence of an IdP is not a local authentication bypass. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(MediaResourceServerProperties.class)
public class MediaSecurityConfiguration {

    @Bean
    @ConditionalOnProperty(
            prefix = "security.resource-server",
            name = "enabled",
            havingValue = "true")
    JwtDecoder verifiedJwtDecoder(MediaResourceServerProperties properties) {
        if (properties.getIssuerUri() == null || properties.getIssuerUri().isBlank()
                || properties.getJwkSetUri() == null || properties.getJwkSetUri().isBlank()) {
            throw new IllegalStateException("media resource server requires issuer-uri and jwk-set-uri");
        }
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(properties.getJwkSetUri()).build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(properties.getIssuerUri()));
        return decoder;
    }

    @Bean
    MediaSecurityErrorWriter mediaSecurityErrorWriter() {
        return new MediaSecurityErrorWriter();
    }

    @Bean
    MediaAuthorityAttemptFilter mediaAuthorityAttemptFilter(MediaSecurityErrorWriter writer) {
        return new MediaAuthorityAttemptFilter(writer);
    }

    @Bean
    SecurityFilterChain mediaSecurityFilterChain(
            HttpSecurity http,
            MediaResourceServerProperties properties,
            ObjectProvider<JwtDecoder> decoderProvider,
            MediaAuthorityAttemptFilter authorityAttemptFilter,
            MediaSecurityErrorWriter errorWriter) throws Exception {
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
                .addFilterBefore(authorityAttemptFilter, AuthorizationFilter.class);

        if (properties.isEnabled()) {
            JwtDecoder decoder = decoderProvider.getIfAvailable(() ->
                    { throw new IllegalStateException("resource server is enabled without a JwtDecoder"); });
            http.oauth2ResourceServer(oauth2 -> oauth2
                    .authenticationEntryPoint(entryPoint)
                    .accessDeniedHandler(deniedHandler)
                    .jwt(jwt -> jwt.decoder(decoder)));
        }
        return http.build();
    }
}
