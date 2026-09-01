package com.englishflow.gateway.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.ConfigurationPropertySources;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.env.StandardEnvironment;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GatewayYamlLoadingTest {

    @Test
    void applicationConfigurationContainsTheSecurityBoundary() throws Exception {
        var source = new YamlPropertySourceLoader()
                .load("gateway", new ClassPathResource("application.yml"))
                .getFirst();

        assertEquals("${GATEWAY_JWT_PREVALIDATION_ENABLED:true}",
                source.getProperty("gateway.security.jwt-prevalidation-enabled"));
        assertEquals("${GATEWAY_RATE_LIMIT_BACKEND_TIMEOUT:750ms}",
                source.getProperty("gateway.rate-limit.backend-timeout"));
        StandardEnvironment environment = new StandardEnvironment();
        environment.getPropertySources().addFirst(source);
        ConfigurationPropertySources.attach(environment);
        assertEquals("true", environment.getProperty("gateway.security.jwt-prevalidation-enabled"));
        assertEquals("true", environment.getProperty("gateway.security.resource-server-enabled"));
        assertTrue(Binder.get(environment)
                .bind("gateway.security.jwt-prevalidation-enabled", Bindable.of(Boolean.class))
                .orElseThrow(() -> new IllegalStateException("Gateway security flag was not bound")));
        GatewayProperties.Security security = Binder.get(environment)
                .bind("gateway.security", Bindable.of(GatewayProperties.Security.class))
                .orElseThrow(() -> new IllegalStateException("Gateway security properties were not bound"));
        GatewayProperties properties = Binder.get(environment)
                .bind("gateway", Bindable.of(GatewayProperties.class))
                .orElseThrow(() -> new IllegalStateException("Gateway properties were not bound"));
        assertTrue(security.jwtPrevalidationEnabled());
        assertTrue(security.resourceServerEnabled());
        assertTrue(properties.security().jwtPrevalidationEnabled());
        assertEquals(Duration.ofMillis(750), properties.rateLimit().backendTimeout());
        assertTrue(properties.rateLimit().isBackendTimeoutStrictlyPositive());
    }
}
