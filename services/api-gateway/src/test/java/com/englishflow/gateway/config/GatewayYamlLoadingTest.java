package com.englishflow.gateway.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.ConfigurationPropertySources;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.env.StandardEnvironment;

import com.englishflow.gateway.policy.GatewayRoutePolicy;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
        assertTrue(properties.identity().enabled());
        assertFalse(properties.b12().enabled(), "unaccepted domain routes must be opt-in");
        assertFalse(properties.b13().enabled(), "unaccepted admin/analytics routes must be opt-in");
        assertFalse(properties.b14().enabled(), "unaccepted domain routes must be opt-in");
        assertFalse(properties.compatibility().enabled(), "core-api compatibility must be opt-in and no route is registered");
        assertFalse(properties.compatibility().anonymousReadEnabled(), "anonymous compatibility reads must stay disabled");
        assertEquals(Duration.ofMillis(750), properties.rateLimit().backendTimeout());
        assertTrue(properties.rateLimit().isBackendTimeoutStrictlyPositive());
    }

    @Test
    void productionHighRiskDefaultStaysThirtyAndEvidenceProfileIsIsolated() throws Exception {
        var loader = new YamlPropertySourceLoader();
        var production = loader.load("gateway", new ClassPathResource("application.yml")).getFirst();
        var evidence = loader.load("evidence", new ClassPathResource("application-evidence.yml")).getFirst();
        assertTrue(String.valueOf(production.getProperty(
                "gateway.rate-limit.policies.high-risk-admin.requests-per-window")).contains(":30}"));
        assertEquals("evidence", evidence.getProperty("spring.config.activate.on-profile"));
        assertEquals("2000", String.valueOf(evidence.getProperty(
                "gateway.rate-limit.policies.high-risk-admin.requests-per-window")));
        assertFalse(String.valueOf(evidence.getProperty(
                "gateway.rate-limit.policies.high-risk-admin.requests-per-window")).contains("${"));

        StandardEnvironment defaults = withoutSystemSources();
        defaults.getPropertySources().addFirst(production);
        ConfigurationPropertySources.attach(defaults);
        GatewayProperties productionProperties = Binder.get(defaults)
                .bind("gateway", Bindable.of(GatewayProperties.class))
                .orElseThrow(() -> new IllegalStateException("production gateway properties were not bound"));
        assertEquals(30, productionProperties.rateLimit().policyFor(GatewayRoutePolicy.AuthClass.HIGH_RISK_ADMIN).requestsPerWindow());
        assertEquals(240, productionProperties.rateLimit().policyFor(GatewayRoutePolicy.AuthClass.PUBLIC_READ).requestsPerWindow());

        StandardEnvironment overlay = withoutSystemSources();
        overlay.getPropertySources().addLast(production);
        overlay.getPropertySources().addFirst(evidence);
        ConfigurationPropertySources.attach(overlay);
        GatewayProperties evidenceProperties = Binder.get(overlay)
                .bind("gateway", Bindable.of(GatewayProperties.class))
                .orElseThrow(() -> new IllegalStateException("evidence gateway properties were not bound"));
        assertEquals(2000, evidenceProperties.rateLimit().policyFor(GatewayRoutePolicy.AuthClass.HIGH_RISK_ADMIN).requestsPerWindow());
        assertEquals(240, evidenceProperties.rateLimit().policyFor(GatewayRoutePolicy.AuthClass.PUBLIC_READ).requestsPerWindow());
        assertEquals(30, productionProperties.rateLimit().policyFor(GatewayRoutePolicy.AuthClass.HIGH_RISK_ADMIN).requestsPerWindow());
    }

    private static StandardEnvironment withoutSystemSources() {
        StandardEnvironment environment = new StandardEnvironment();
        environment.getPropertySources().remove("systemProperties");
        environment.getPropertySources().remove("systemEnvironment");
        return environment;
    }
}
