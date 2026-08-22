package com.englishflow.gateway.config;

import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.GatewayFilterSpec;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoders;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;
import com.englishflow.gateway.support.BoundedSecurityAuditSink;
import com.englishflow.gateway.support.SecurityAuditSink;

import java.util.Arrays;

@Configuration(proxyBeanMethods = false)
public class GatewayConfiguration {

    @Bean
    SecurityWebFilterChain platform0SecurityChain(
            ServerHttpSecurity http,
            GatewayProperties properties,
            Environment environment
    ) {
        boolean localReadOnlyCompatibility = properties.compatibility().anonymousReadEnabled()
                && environment.acceptsProfiles(Profiles.of("local"));
        boolean resourceServerEnabled = Boolean.TRUE.equals(properties.security().resourceServerEnabled());

        ServerHttpSecurity configured = http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .httpBasic(ServerHttpSecurity.HttpBasicSpec::disable)
                .formLogin(ServerHttpSecurity.FormLoginSpec::disable)
                .authorizeExchange(exchanges -> {
                    exchanges.pathMatchers("/actuator/health/**", "/actuator/info").permitAll();
                    exchanges.pathMatchers(HttpMethod.OPTIONS, "/api/**").permitAll();
                    exchanges.pathMatchers(HttpMethod.GET, "/api/v1/health").permitAll();
                    exchanges.pathMatchers(HttpMethod.HEAD, "/api/v1/health").permitAll();
                    exchanges.pathMatchers(HttpMethod.GET, "/api/v1/public/commerce/catalog").permitAll();
                    exchanges.pathMatchers(HttpMethod.HEAD, "/api/v1/public/commerce/catalog").permitAll();
                    exchanges.pathMatchers("/api/v1/auth/oidc/**").permitAll();
                    exchanges.pathMatchers(HttpMethod.POST,
                            "/api/v1/iam/session/refresh",
                            "/api/v1/auth/refresh").permitAll();
                    if (resourceServerEnabled) {
                        exchanges.anyExchange().authenticated();
                    } else {
                        if (localReadOnlyCompatibility) {
                            exchanges.pathMatchers(HttpMethod.GET, "/api/v1/legacy/**").permitAll();
                            exchanges.pathMatchers(HttpMethod.HEAD, "/api/v1/legacy/**").permitAll();
                        }
                        // B8 replaces the explicit local read-only exception with verified
                        // Resource Server/JWKS authentication and service-side PEP checks.
                        exchanges.anyExchange().denyAll();
                    }
                });

        if (resourceServerEnabled) {
            configured.oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()));
        }
        return configured.build();
    }

    @Bean
    @ConditionalOnProperty(prefix = "gateway.security", name = "resource-server-enabled", havingValue = "true")
    ReactiveJwtDecoder gatewayJwtDecoder(GatewayProperties properties) {
        return ReactiveJwtDecoders.fromIssuerLocation(properties.security().issuerUri());
    }

    @Bean
    CorsWebFilter corsWebFilter(GatewayProperties properties) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(properties.cors().allowedOrigins());
        configuration.setAllowedMethods(csv(properties.cors().allowedMethods()));
        configuration.setAllowedHeaders(csv(properties.cors().allowedHeaders()));
        configuration.setExposedHeaders(csv(properties.cors().exposedHeaders()));
        configuration.setAllowCredentials(properties.cors().allowCredentials());
        configuration.setMaxAge(properties.cors().maxAge().toSeconds());

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return new CorsWebFilter(source);
    }

    @Bean
    RouteLocator gatewayRoutes(RouteLocatorBuilder routes, GatewayProperties properties) {
        var builder = routes.routes();
        if (Boolean.TRUE.equals(properties.identity().enabled())) {
            builder.route("iam-legacy-refresh", route -> route
                        .path("/api/v1/auth/refresh")
                        .and()
                        .method(HttpMethod.POST)
                        .filters(filters -> filters
                                .rewritePath("/api/v1/auth/refresh", "/api/v1/iam/session/refresh")
                                .removeRequestHeader("X-B5-Role")
                                .removeRequestHeader("X-Role")
                                .removeRequestHeader("X-Tenant-Id")
                                .removeRequestHeader("X-Owner-Id")
                                .addRequestHeader("X-Gateway-Route", "iam-v1-legacy-refresh"))
                        .uri(properties.identity().iamUri().toString()));
            builder.route("iam-legacy-logout", route -> route
                        .path("/api/v1/auth/logout")
                        .and()
                        .method(HttpMethod.POST)
                        .filters(filters -> filters
                                .rewritePath("/api/v1/auth/logout", "/api/v1/iam/session/logout")
                                .removeRequestHeader("X-B5-Role")
                                .removeRequestHeader("X-Role")
                                .removeRequestHeader("X-Tenant-Id")
                                .removeRequestHeader("X-Owner-Id")
                                .addRequestHeader("X-Gateway-Route", "iam-v1-legacy-logout"))
                        .uri(properties.identity().iamUri().toString()));
            builder.route("iam-legacy-session-revoke", route -> route
                        .path("/api/v1/auth/sessions/{sessionId}/revoke")
                        .and()
                        .method(HttpMethod.POST)
                        .filters(filters -> filters
                                .rewritePath("/api/v1/auth/sessions/(?<sessionId>[^/]+)/revoke", "/api/v1/iam/sessions/${sessionId}/revoke")
                                .removeRequestHeader("X-B5-Role")
                                .removeRequestHeader("X-Role")
                                .removeRequestHeader("X-Tenant-Id")
                                .removeRequestHeader("X-Owner-Id")
                                .addRequestHeader("X-Gateway-Route", "iam-v1-legacy-session-revoke"))
                        .uri(properties.identity().iamUri().toString()));
            builder.route("iam-auth", route -> route
                        .path("/api/v1/auth/**", "/api/v1/iam/**")
                        .filters(filters -> filters
                                .removeRequestHeader("X-B5-Role")
                                .removeRequestHeader("X-Role")
                                .removeRequestHeader("X-Tenant-Id")
                                .removeRequestHeader("X-Owner-Id")
                                .addRequestHeader("X-Gateway-Route", "iam-v1"))
                         .uri(properties.identity().iamUri().toString()));
        }
        if (Boolean.TRUE.equals(properties.b14().enabled())) {
            registerB14Routes(builder, properties);
        }
        if (Boolean.TRUE.equals(properties.b12().enabled())) {
            registerB12Routes(builder, properties.b12());
        }
        if (Boolean.TRUE.equals(properties.b13().enabled())) {
            registerB13Routes(builder, properties.b13());
        }
        if (!Boolean.TRUE.equals(properties.compatibility().enabled())) {
            return builder.build();
        }

        String coreApiUri = properties.compatibility().coreApiUri().toString();
        builder.route("core-api-health-compat", route -> route
                        .path("/api/v1/health")
                        .and()
                         .method(HttpMethod.GET, HttpMethod.HEAD)
                         .filters(filters -> compatibilityFilters(filters, properties))
                        .uri(coreApiUri));
        builder.route("core-api-legacy-compat", route -> route
                        .path("/api/v1/legacy/**")
                        .and()
                         .method(HttpMethod.GET, HttpMethod.HEAD)
                         .filters(filters -> compatibilityFilters(
                                 filters.rewritePath("/api/v1/legacy/(?<segment>.*)", "/api/v1/${segment}"), properties))
                        .uri(coreApiUri));
        return builder.build();
    }

    /**
     * Registers the target side of the Phase 1 strangler. Legacy compatibility
     * routes remain explicit and read-only; the target route never forwards
     * client authority or tenant headers to a domain service.
     */
    private static void registerB14Routes(
            RouteLocatorBuilder.Builder builder, GatewayProperties properties) {
        GatewayProperties.B14Services services = properties.b14();
        GatewayProperties.B14Services.RouteMode commerceMode = services.mode("commerce");
        if (isTargetMode(commerceMode)) {
            builder.route("b14-commerce-payment-intent", route -> route
                    .path("/api/v1/commerce/orders/*/payment-intents")
                    .and()
                    .method(HttpMethod.POST)
                    .filters(filters -> targetFilters(
                            filters.rewritePath("/api/v1/commerce/orders/(?<orderId>[^/]+)/payment-intents",
                                    "/internal/v1/commerce/orders/${orderId}/payments"),
                            "b14-commerce-payment-intent", commerceMode))
                    .uri(services.serviceUri("commerce").toString()));
        }
        for (String domain : GatewayProperties.B14Services.DOMAINS) {
            GatewayProperties.B14Services.RouteMode mode = services.mode(domain);
            if (isTargetMode(mode)) {
                registerB14TargetRoutes(builder, services, domain, mode);
            } else if (Boolean.TRUE.equals(properties.compatibility().enabled())) {
                registerB14LegacyReadRoute(builder, properties, domain, mode);
            }
        }
    }

    private static boolean isTargetMode(GatewayProperties.B14Services.RouteMode mode) {
        return mode == GatewayProperties.B14Services.RouteMode.TARGET
                || mode == GatewayProperties.B14Services.RouteMode.SHADOW;
    }

    private static void registerB14TargetRoutes(
            RouteLocatorBuilder.Builder builder,
            GatewayProperties.B14Services services,
            String domain,
            GatewayProperties.B14Services.RouteMode mode) {
        String modeName = mode.name().toLowerCase(java.util.Locale.ROOT);
        String publicPath = "/api/v1/" + domain + "/**";
        String publicPattern = "/api/v1/" + domain + "/(?<segment>.*)";
        String internalPath = "/internal/v1/" + domain + "/**";
        builder.route("b14-" + domain + "-" + modeName, route -> route
                .path(publicPath)
                .filters(filters -> targetFilters(
                        filters.rewritePath(publicPattern, "/internal/v1/" + domain + "/${segment}"),
                        "b14-" + domain + "-" + modeName, mode))
                .uri(services.serviceUri(domain).toString()));
        builder.route("b14-" + domain + "-internal-" + modeName, route -> route
                .path(internalPath)
                .filters(filters -> targetFilters(filters, "b14-" + domain + "-internal-" + modeName, mode))
                .uri(services.serviceUri(domain).toString()));
    }

    /**
     * LEGACY and FALLBACK are read-only compatibility modes. Writes are denied
     * by B14RouteModeGuardGlobalFilter; they are never sent to core-api.
     */
    private static void registerB14LegacyReadRoute(
            RouteLocatorBuilder.Builder builder,
            GatewayProperties properties,
            String domain,
            GatewayProperties.B14Services.RouteMode mode) {
        String modeName = mode.name().toLowerCase(java.util.Locale.ROOT);
        String publicPath = "/api/v1/" + domain + "/**";
        String publicPattern = "/api/v1/" + domain + "/(?<segment>.*)";
        builder.route("b14-" + domain + "-" + modeName + "-read", route -> route
                .path(publicPath)
                .and()
                .method(HttpMethod.GET, HttpMethod.HEAD)
                .filters(filters -> compatibilityFilters(
                        filters.rewritePath(publicPattern, "/api/v1/" + domain + "/${segment}")
                                .addRequestHeader("X-B14-Route-Mode", mode.name()),
                        properties))
                .uri(properties.compatibility().coreApiUri().toString()));
    }

    private static GatewayFilterSpec targetFilters(GatewayFilterSpec filters, String routeName) {
        return targetFilters(filters, routeName, null);
    }

    private static GatewayFilterSpec targetFilters(
            GatewayFilterSpec filters,
            String routeName,
            GatewayProperties.B14Services.RouteMode mode) {
        GatewayFilterSpec configured = filters
                .removeRequestHeader("X-B5-Role")
                .removeRequestHeader("X-Role")
                .removeRequestHeader("X-Tenant-Id")
                .removeRequestHeader("X-Owner-Id")
                .addRequestHeader("X-Gateway-Route", routeName);
        if (mode != null) {
            configured = configured.addRequestHeader("X-B14-Route-Mode", mode.name());
        }
        return configured;
    }

    private static GatewayFilterSpec compatibilityFilters(
            GatewayFilterSpec filters, GatewayProperties properties) {
        GatewayFilterSpec configured = filters
                .removeRequestHeader("X-Compatibility-Route")
                .addRequestHeader("X-Compatibility-Route", "core-api-v1")
                .addResponseHeader("X-EnglishFlow-Compatibility", "core-api-v1");
        if (Boolean.TRUE.equals(properties.b14().deprecationHeadersEnabled())) {
            configured = configured
                    .addResponseHeader("Deprecation", "true")
                    .addResponseHeader("Sunset", properties.b14().deprecationSunsetAt());
        }
        return configured;
    }

    private static void registerB12Routes(
            RouteLocatorBuilder.Builder builder, GatewayProperties.B12Services services) {
        builder.route("b12-gamification-public", route -> route
                .path("/api/v1/gamification/me/**")
                .filters(filters -> filters
                        .rewritePath("/api/v1/gamification/me/(?<segment>.*)", "/internal/v1/gamification/${segment}")
                        .removeRequestHeader("X-B5-Role")
                        .removeRequestHeader("X-Role")
                        .removeRequestHeader("X-Tenant-Id")
                        .removeRequestHeader("X-Owner-Id")
                        .addRequestHeader("X-Gateway-Route", "b12-gamification-public"))
                .uri(services.gamificationUri().toString()));
        builder.route("b12-gamification-trusted-events", route -> route
                .path("/internal/v1/gamification/**")
                .filters(filters -> filters
                        .removeRequestHeader("X-B5-Role")
                        .removeRequestHeader("X-Role")
                        .removeRequestHeader("X-Tenant-Id")
                        .removeRequestHeader("X-Owner-Id")
                        .addRequestHeader("X-Gateway-Route", "b12-gamification-internal"))
                .uri(services.gamificationUri().toString()));
        builder.route("b12-social-public", route -> route
                .path("/api/v1/social/**")
                .filters(filters -> filters
                        .removeRequestHeader("X-B5-Role")
                        .removeRequestHeader("X-Role")
                        .removeRequestHeader("X-Tenant-Id")
                        .removeRequestHeader("X-Owner-Id")
                        .addRequestHeader("X-Gateway-Route", "b12-social-public"))
                .uri(services.socialUri().toString()));
        builder.route("b12-social-internal", route -> route
                .path("/internal/v1/social/**")
                .filters(filters -> filters
                        .removeRequestHeader("X-B5-Role")
                        .removeRequestHeader("X-Role")
                        .removeRequestHeader("X-Tenant-Id")
                        .removeRequestHeader("X-Owner-Id")
                        .addRequestHeader("X-Gateway-Route", "b12-social-internal"))
                .uri(services.socialUri().toString()));
        builder.route("b12-notification-public", route -> route
                .path("/api/v1/notifications/**")
                .filters(filters -> filters
                        .rewritePath("/api/v1/notifications/(?<segment>.*)", "/internal/v1/notifications/${segment}")
                        .removeRequestHeader("X-B5-Role")
                        .removeRequestHeader("X-Role")
                        .removeRequestHeader("X-Tenant-Id")
                        .removeRequestHeader("X-Owner-Id")
                        .addRequestHeader("X-Gateway-Route", "b12-notification-public"))
                .uri(services.notificationUri().toString()));
        builder.route("b12-notification-internal", route -> route
                .path("/internal/v1/notifications/**")
                .filters(filters -> filters
                        .removeRequestHeader("X-B5-Role")
                        .removeRequestHeader("X-Role")
                        .removeRequestHeader("X-Tenant-Id")
                        .removeRequestHeader("X-Owner-Id")
                        .addRequestHeader("X-Gateway-Route", "b12-notification-internal"))
                .uri(services.notificationUri().toString()));
    }

    private static void registerB13Routes(
            RouteLocatorBuilder.Builder builder, GatewayProperties.B13Services services) {
        builder.route("b13-public-commerce-catalog", route -> route
                .path("/api/v1/public/commerce/catalog")
                .and()
                .method(HttpMethod.GET, HttpMethod.HEAD)
                .filters(filters -> filters
                        .rewritePath("/api/v1/public/commerce/catalog", "/internal/v1/commerce/public/catalog")
                        .removeRequestHeader("X-B5-Role")
                        .removeRequestHeader("X-Role")
                        .removeRequestHeader("X-Tenant-Id")
                        .removeRequestHeader("X-Owner-Id")
                        .addRequestHeader("X-Gateway-Route", "b13-commerce-public-catalog"))
                .uri(services.commerceUri().toString()));
        builder.route("b13-commerce-payment-intent", route -> route
                .path("/api/v1/commerce/orders/*/payment-intents")
                .and()
                .method(HttpMethod.POST)
                .filters(filters -> filters
                        .rewritePath("/api/v1/commerce/orders/(?<orderId>[^/]+)/payment-intents",
                                "/internal/v1/commerce/orders/${orderId}/payments")
                        .removeRequestHeader("X-B5-Role")
                        .removeRequestHeader("X-Role")
                        .removeRequestHeader("X-Tenant-Id")
                        .removeRequestHeader("X-Owner-Id")
                        .addRequestHeader("X-Gateway-Route", "b13-commerce-payment-intent"))
                .uri(services.commerceUri().toString()));
        builder.route("b13-commerce-public", route -> route
                .path("/api/v1/commerce/**")
                .filters(filters -> filters
                        .rewritePath("/api/v1/commerce/(?<segment>.*)", "/internal/v1/commerce/${segment}")
                        .removeRequestHeader("X-B5-Role")
                        .removeRequestHeader("X-Role")
                        .removeRequestHeader("X-Tenant-Id")
                        .removeRequestHeader("X-Owner-Id")
                        .addRequestHeader("X-Gateway-Route", "b13-commerce"))
                .uri(services.commerceUri().toString()));
        builder.route("b13-commerce-internal", route -> route
                .path("/internal/v1/commerce/**")
                .filters(filters -> filters
                        .removeRequestHeader("X-B5-Role")
                        .removeRequestHeader("X-Role")
                        .removeRequestHeader("X-Tenant-Id")
                        .removeRequestHeader("X-Owner-Id")
                        .addRequestHeader("X-Gateway-Route", "b13-commerce-internal"))
                .uri(services.commerceUri().toString()));
        builder.route("b13-admin-metrics", route -> route
                .path("/api/v1/admin/ops/metrics")
                .and()
                .method(HttpMethod.GET)
                .filters(filters -> filters
                        .rewritePath("/api/v1/admin/ops/metrics", "/internal/v1/analytics/metrics")
                        .removeRequestHeader("X-B5-Role")
                        .removeRequestHeader("X-Role")
                        .removeRequestHeader("X-Tenant-Id")
                        .removeRequestHeader("X-Owner-Id")
                        .addRequestHeader("X-Gateway-Route", "b13-analytics-admin-metrics"))
                .uri(services.analyticsUri().toString()));
        builder.route("b13-admin-ops", route -> route
                .path("/api/v1/admin/ops/**")
                .filters(filters -> filters
                        .rewritePath("/api/v1/admin/ops/(?<segment>.*)", "/internal/v1/admin-ops/${segment}")
                        .removeRequestHeader("X-B5-Role")
                        .removeRequestHeader("X-Role")
                        .removeRequestHeader("X-Tenant-Id")
                        .removeRequestHeader("X-Owner-Id")
                        .addRequestHeader("X-Gateway-Route", "b13-admin-ops"))
                .uri(services.adminOpsUri().toString()));
        builder.route("b13-admin-ops-internal", route -> route
                .path("/internal/v1/admin-ops/**")
                .filters(filters -> filters
                        .removeRequestHeader("X-B5-Role")
                        .removeRequestHeader("X-Role")
                        .removeRequestHeader("X-Tenant-Id")
                        .removeRequestHeader("X-Owner-Id")
                        .addRequestHeader("X-Gateway-Route", "b13-admin-ops-internal"))
                .uri(services.adminOpsUri().toString()));
        builder.route("b13-analytics-internal", route -> route
                .path("/internal/v1/analytics/**")
                .filters(filters -> filters
                        .removeRequestHeader("X-B5-Role")
                        .removeRequestHeader("X-Role")
                        .removeRequestHeader("X-Tenant-Id")
                        .removeRequestHeader("X-Owner-Id")
                        .addRequestHeader("X-Gateway-Route", "b13-analytics-internal"))
                .uri(services.analyticsUri().toString()));
    }

    @Bean
    SecurityAuditSink securityAuditSink() {
        return new BoundedSecurityAuditSink(512);
    }

    private static java.util.List<String> csv(String value) {
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(item -> !item.isBlank())
                .toList();
    }
}
