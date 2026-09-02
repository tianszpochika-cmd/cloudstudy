package com.englishflow.gateway.config;

import com.englishflow.gateway.filter.ClientAuthorizationContextHeaders;
import com.englishflow.gateway.policy.GatewayRouteExecutionPolicy;
import com.englishflow.gateway.policy.GatewayRoutePolicy;
import com.englishflow.gateway.support.BoundedSecurityAuditSink;
import com.englishflow.gateway.support.CorrelationIds;
import com.englishflow.gateway.support.GatewayAuthenticationFailureHandler;
import com.englishflow.gateway.support.GatewayErrorMapper;
import com.englishflow.gateway.support.GatewayErrorResponseWriter;
import com.englishflow.gateway.support.SecurityAuditRecorder;
import com.englishflow.gateway.support.SecurityAuditSink;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.GatewayFilterSpec;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.security.web.server.authentication.ServerAuthenticationEntryPointFailureHandler;
import org.springframework.security.web.server.util.matcher.ServerWebExchangeMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsConfigurationSource;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.Exceptions;
import reactor.core.publisher.Mono;

import java.util.Arrays;

@Configuration(proxyBeanMethods = false)
public class GatewayConfiguration {

    @Bean
    SecurityWebFilterChain platform0SecurityChain(
            ServerHttpSecurity http,
            GatewayProperties properties,
            GatewayRoutePolicy routePolicy,
            SecurityAuditRecorder auditRecorder,
            GatewayAuthenticationFailureHandler authenticationFailureHandler
    ) {
        boolean resourceServerEnabled = Boolean.TRUE.equals(properties.security().resourceServerEnabled());

        ServerHttpSecurity configured = http
                // Cookie-bearing unsafe requests are decided by the single
                // BrowserOriginCsrfGlobalFilter policy. Spring's synchronizer
                // token mechanism is deliberately not enabled because the
                // canonical Gateway contract freezes Origin-first / Referer-
                // fallback semantics instead.
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .httpBasic(ServerHttpSecurity.HttpBasicSpec::disable)
                .formLogin(ServerHttpSecurity.FormLoginSpec::disable)
                .cors(Customizer.withDefaults())
                .exceptionHandling(exceptionHandling -> exceptionHandling
                        .authenticationEntryPoint(authenticationFailureHandler)
                        .accessDeniedHandler((exchange, failure) -> accessDeniedResponse(exchange, failure, auditRecorder)))
                .authorizeExchange(exchanges -> {
                    exchanges.pathMatchers("/actuator/health/**", "/actuator/info").permitAll();
                    exchanges.matchers(exchange -> routePolicy.permitsAnonymous(exchange.getRequest())
                                    ? ServerWebExchangeMatcher.MatchResult.match()
                                    : ServerWebExchangeMatcher.MatchResult.notMatch())
                            .permitAll();
                    exchanges.matchers(exchange -> routePolicy.isKnownPreflight(exchange.getRequest())
                                    ? ServerWebExchangeMatcher.MatchResult.match()
                                    : ServerWebExchangeMatcher.MatchResult.notMatch())
                            .permitAll();
                    if (resourceServerEnabled) {
                        exchanges.anyExchange().authenticated();
                    } else {
                        // No token decoder means no protected request may pass. The custom
                        // access-denied handler below turns anonymous denyAll decisions into
                        // 401 rather than allowing a missing/invalid token to look authorized.
                        exchanges.anyExchange().denyAll();
                    }
                });

        if (resourceServerEnabled) {
            configured.oauth2ResourceServer(oauth2 -> oauth2
                    // Resource Server authentication happens before authorization
                    // exception handling. Wire the same redacted entry point here
                    // so malformed, signature, claim and JWKS failures cannot use
                    // Spring's verbose Bearer challenge response.
                    .authenticationEntryPoint(authenticationFailureHandler)
                    .authenticationFailureHandler(resourceServerFailureHandler(authenticationFailureHandler))
                    .jwt(Customizer.withDefaults()));
        }
        return configured.build();
    }

    private static ServerAuthenticationEntryPointFailureHandler resourceServerFailureHandler(
            GatewayAuthenticationFailureHandler authenticationFailureHandler
    ) {
        ServerAuthenticationEntryPointFailureHandler failureHandler =
                new ServerAuthenticationEntryPointFailureHandler(authenticationFailureHandler);
        // Spring Security otherwise rethrows AuthenticationServiceException.
        // Decoder/JWKS failures must use the same canonical, non-diagnostic 401
        // envelope as malformed, signature and claims failures.
        failureHandler.setRethrowAuthenticationServiceException(false);
        return failureHandler;
    }

    @Bean
    @ConditionalOnProperty(prefix = "gateway.security", name = "resource-server-enabled", havingValue = "true")
    ReactiveJwtDecoder gatewayJwtDecoder(GatewayProperties properties) {
        if (properties.security().issuerUri() == null || properties.security().issuerUri().isBlank()
                || properties.security().jwkSetUri() == null || properties.security().jwkSetUri().isBlank()) {
            throw new IllegalStateException("Gateway JWT verifier requires issuer and explicit JWKS URI");
        }
        NimbusReactiveJwtDecoder nimbus = NimbusReactiveJwtDecoder.withJwkSetUri(properties.security().jwkSetUri()).build();
        nimbus.setJwtValidator(GatewayJwtValidators.forSecurity(properties.security()));
        return token -> Mono.defer(() -> nimbus.decode(token))
                .onErrorMap(GatewayConfiguration::resourceServerJwtFailure);
    }

    private static Throwable resourceServerJwtFailure(Throwable failure) {
        // Do not hide JVM-fatal failures. Every other decoder/JWKS transport
        // failure must become a JwtException so AuthenticationWebFilter sends it
        // through the redacted Gateway authentication failure handler instead
        // of leaking a framework 500 response.
        Exceptions.throwIfFatal(failure);
        if (failure instanceof JwtException) {
            return failure;
        }
        return new BadJwtException("JWT decoding failed", failure);
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(
            GatewayProperties properties,
            GatewayRoutePolicy routePolicy,
            GatewayRouteExecutionPolicy routeExecutionPolicy
    ) {
        return exchange -> {
            String origin = exchange.getRequest().getHeaders().getOrigin();
            GatewayProperties.Cors.OriginProfile profile = properties.cors().profileFor(origin);
            GatewayRoutePolicy.Resolution resolution = HttpMethod.OPTIONS.equals(exchange.getRequest().getMethod())
                    ? routePolicy.resolvePreflight(exchange.getRequest())
                    : routePolicy.resolve(exchange.getRequest());
            HttpMethod admittedMethod = HttpMethod.OPTIONS.equals(exchange.getRequest().getMethod())
                    ? parseHttpMethod(exchange.getRequest().getHeaders()
                            .getFirst(org.springframework.http.HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD))
                    : exchange.getRequest().getMethod();
            if (profile == GatewayProperties.Cors.OriginProfile.UNKNOWN
                    || !resolution.matched()
                    || !routeExecutionPolicy.canExecute(
                            resolution.rule(), admittedMethod, exchange.getRequest().getPath().pathWithinApplication().value())) {
                return null;
            }
            if (profile == GatewayProperties.Cors.OriginProfile.OFFICIAL_SITE
                    && resolution.rule().authClass() != GatewayRoutePolicy.AuthClass.PUBLIC_READ) {
                return null;
            }

            CorsConfiguration configuration = new CorsConfiguration();
            configuration.setAllowedOrigins(java.util.List.of(origin));
            configuration.setAllowedMethods(profile == GatewayProperties.Cors.OriginProfile.OFFICIAL_SITE
                    ? java.util.List.of(HttpMethod.GET.name())
                    : csv(properties.cors().allowedMethods()));
            configuration.setAllowedHeaders(profile == GatewayProperties.Cors.OriginProfile.OFFICIAL_SITE
                    ? csv(properties.cors().publicAllowedHeaders())
                    : csv(properties.cors().credentialedAllowedHeaders()));
            configuration.setExposedHeaders(csv(properties.cors().exposedHeaders()));
            configuration.setAllowCredentials(properties.cors().isCredentialedProfile(profile));
            configuration.setMaxAge(properties.cors().maxAge().toSeconds());
            return configuration;
        };
    }

    @Bean
    RouteLocator gatewayRoutes(
            RouteLocatorBuilder routes,
            GatewayRouteExecutionPolicy routeExecutionPolicy
    ) {
        var builder = routes.routes();
        for (GatewayRouteExecutionPolicy.RouteBinding binding : routeExecutionPolicy.routeBindings()) {
            GatewayRoutePolicy.Rule rule = binding.rule();
            builder.route(binding.routeId(), route -> route
                    .path(binding.externalPathPatterns().toArray(String[]::new))
                    .and()
                    .method(routeMethods(binding.methods()))
                    .filters(filters -> executionFilters(identityFilters(filters, binding.routeId()), binding))
                    .metadata(binding.metadata())
                    .customize(routeBuilder -> routeBuilder.order(-rule.priority()))
                    .uri(binding.targetUri()));
        }
        // No B12/B13/B14/core-api catch-all is registered. Every Gateway route
        // above comes from GatewayRouteExecutionPolicy, which resolves the
        // canonical owner and its enabled target one rule at a time.
        return builder.build();
    }

    private static HttpMethod[] routeMethods(java.util.List<HttpMethod> allowedMethods) {
        return allowedMethods.toArray(HttpMethod[]::new);
    }

    private static GatewayFilterSpec executionFilters(
            GatewayFilterSpec filters,
            GatewayRouteExecutionPolicy.RouteBinding binding
    ) {
        GatewayRouteExecutionPolicy.PathProjection projection = binding.pathProjection();
        return projection.rewritesPath()
                ? filters.rewritePath(projection.admissionRegex(), projection.rewriteReplacement())
                : filters;
    }

    private static HttpMethod parseHttpMethod(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return HttpMethod.valueOf(value.trim());
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private static GatewayFilterSpec identityFilters(GatewayFilterSpec filters, String routeName) {
        return sanitizeClientAuthorityHeaders(filters)
                .addRequestHeader("X-Gateway-Route", routeName);
    }

    /**
     * Route filters repeat the global boundary sanitization so a future route
     * that changes filter ordering cannot forward a forged authority fact.
     */
    private static GatewayFilterSpec sanitizeClientAuthorityHeaders(GatewayFilterSpec filters) {
        GatewayFilterSpec configured = filters;
        for (String header : ClientAuthorizationContextHeaders.NAMES) {
            configured = configured.removeRequestHeader(header);
        }
        return configured;
    }

    @Bean
    SecurityAuditSink securityAuditSink() {
        return new BoundedSecurityAuditSink(512);
    }

    private static String requestId(ServerWebExchange exchange) {
        return CorrelationIds.requestId(
                exchange.getRequest().getHeaders().getFirst("X-Request-Id"),
                128
        );
    }

    private static String traceId(ServerWebExchange exchange) {
        return CorrelationIds.traceId(
                exchange.getRequest().getHeaders().getFirst("X-Trace-Id"),
                exchange.getRequest().getHeaders().getFirst("traceparent"),
                128
        );
    }

    private static Mono<Void> accessDeniedResponse(
            ServerWebExchange exchange,
            org.springframework.security.access.AccessDeniedException failure,
            SecurityAuditRecorder auditRecorder) {
        return exchange.getPrincipal()
                .filter(GatewayConfiguration::isAuthenticatedPrincipal)
                .flatMap(ignored -> GatewayErrorResponseWriter.write(
                        exchange,
                        GatewayErrorMapper.map(failure, requestId(exchange), traceId(exchange))))
                .switchIfEmpty(GatewayErrorResponseWriter.write(
                        exchange,
                        new com.englishflow.gateway.support.GatewayError(
                                401,
                                "unauthorized",
                                "Authentication is required.",
                                requestId(exchange),
                                traceId(exchange))))
                .then(auditRecorder.record(exchange, System.nanoTime()));
    }

    private static boolean isAuthenticatedPrincipal(java.security.Principal principal) {
        return principal instanceof Authentication authentication
                && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken);
    }

    private static java.util.List<String> csv(String value) {
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(item -> !item.isBlank())
                .toList();
    }
}
