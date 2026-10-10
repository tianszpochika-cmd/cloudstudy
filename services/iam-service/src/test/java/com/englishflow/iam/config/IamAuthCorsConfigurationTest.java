package com.englishflow.iam.config;

import com.englishflow.iam.auth.JwtSigningKeyProvider;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.filter.CorsFilter;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class IamAuthCorsConfigurationTest {

    @Test
    void learnerOriginsReceiveCredentialedAuthCors() throws Exception {
        Filter cors = new CorsFilter(new IamAuthCorsConfiguration().iamAuthCorsConfigurationSource());
        for (String origin : List.of(
                "http://127.0.0.1:18180",
                "http://127.0.0.1:18183",
                "http://localhost:18180",
                "http://localhost:18183",
                "http://LOCALHOST:18180")) {
            MockHttpServletResponse response = preflight(cors, origin, "/api/v1/auth/register", "POST",
                    "content-type, idempotency-key, accept, authorization");
            assertEquals(origin, response.getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN), origin);
            assertEquals("true", response.getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS), origin);
            String methods = response.getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS);
            assertNotNull(methods, origin);
            assertTrue(methods.contains("POST") && methods.contains("OPTIONS"), methods);
            assertFalse(methods.contains("*"), methods);
            assertFalse(methods.contains("GET"), methods);
        }
    }

    @Test
    void unknownOriginsAndNonAuthPathsStayClosed() throws Exception {
        Filter cors = new CorsFilter(new IamAuthCorsConfiguration().iamAuthCorsConfigurationSource());
        for (String origin : List.of(
                "http://127.0.0.1:18181",
                "http://127.0.0.1:18182",
                "https://127.0.0.1:18180",
                "http://evil.example",
                "http://127.0.0.1:18180.evil.test",
                "http://127.0.0.1:181800",
                "null")) {
            assertClosed(preflight(cors, origin, "/api/v1/auth/login", "POST", "content-type"));
        }
        assertClosed(preflight(cors, "http://127.0.0.1:18180", "/api/v1/iam/principal/me", "POST", "content-type"));
        assertClosed(preflight(cors, "http://127.0.0.1:18180", "/internal/v1/iam/service-token", "POST", "content-type"));
        assertClosed(preflight(cors, "http://127.0.0.1:18180", "/api/v1/authentication", "POST", "content-type"));
        assertClosed(preflight(cors, "http://127.0.0.1:18180", "/api/v1/auth/../iam/principal/me", "POST", "content-type"));
        assertClosed(preflight(cors, "http://user@127.0.0.1:18180", "/api/v1/auth/register", "POST", "content-type"));
    }

    @Test
    void disallowedMethodAndHeaderDoNotEchoTheOrigin() throws Exception {
        Filter cors = new CorsFilter(new IamAuthCorsConfiguration().iamAuthCorsConfigurationSource());
        assertClosed(preflight(cors, "http://127.0.0.1:18180", "/api/v1/auth/register", "PUT", "content-type"));
        assertClosed(preflight(cors, "http://127.0.0.1:18183", "/api/v1/auth/register", "DELETE", "content-type"));
        assertClosed(preflight(cors, "http://127.0.0.1:18180", "/api/v1/auth/login", "POST", "content-type, x-role"));
    }

    @Test
    void actualPasswordPostKeepsTheCredentialedOrigin() throws Exception {
        Filter cors = new CorsFilter(new IamAuthCorsConfiguration().iamAuthCorsConfigurationSource());
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/password-reset/request");
        request.addHeader(HttpHeaders.ORIGIN, "http://127.0.0.1:18183");
        MockHttpServletResponse response = new MockHttpServletResponse();
        cors.doFilter(request, response, (servletRequest, servletResponse) ->
                ((MockHttpServletResponse) servletResponse).setStatus(202));
        assertEquals(202, response.getStatus());
        assertEquals("http://127.0.0.1:18183", response.getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
        assertEquals("true", response.getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS));
    }

    @Test
    void securityChainInstallsTheSameAuthCorsFilter() throws Exception {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext(SecuritySlice.class)) {
            SecurityFilterChain chain = context.getBean(SecurityFilterChain.class);
            Filter cors = chain.getFilters().stream().filter(CorsFilter.class::isInstance).findFirst().orElseThrow();
            MockHttpServletResponse allowed = preflight(cors, "http://127.0.0.1:18180", "/api/v1/auth/register",
                    "POST", "content-type, idempotency-key");
            assertEquals("http://127.0.0.1:18180", allowed.getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
            assertEquals("true", allowed.getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS));
            assertClosed(preflight(cors, "http://127.0.0.1:18180", "/api/v1/iam/adult-gate", "POST", "content-type"));
            assertClosed(preflight(cors, "https://attacker.example", "/api/v1/auth/register", "POST", "content-type"));
        }
    }

    private static void assertClosed(MockHttpServletResponse response) {
        assertNull(response.getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
        assertNull(response.getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS));
        assertNull(response.getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS));
    }

    private static MockHttpServletResponse preflight(Filter cors, String origin, String path, String method,
                                                     String headers) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("OPTIONS", path);
        request.addHeader(HttpHeaders.ORIGIN, origin);
        request.addHeader(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, method);
        request.addHeader(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, headers);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = (servletRequest, servletResponse) -> { };
        cors.doFilter(request, response, chain);
        return response;
    }

    @Configuration
    @EnableWebSecurity
    static class SecuritySlice {
        @Bean
        SecurityFilterChain iamChain(HttpSecurity http) throws Exception {
            IamServiceProperties properties = new IamServiceProperties();
            properties.getJwt().setEphemeralKeysAllowed(true);
            JwtSigningKeyProvider keys = new JwtSigningKeyProvider(properties);
            IamSecurityConfiguration security = new IamSecurityConfiguration();
            return security.iamResourceServerChain(
                    http,
                    security.iamJwtDecoder(properties, keys),
                    security.jwtAuthenticationConverter(),
                    new IamAuthCorsConfiguration().iamAuthCorsConfigurationSource());
        }
    }
}
