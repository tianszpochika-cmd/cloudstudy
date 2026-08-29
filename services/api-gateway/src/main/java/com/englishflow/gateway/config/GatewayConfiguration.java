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
import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsConfigurationSource;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;
import com.englishflow.gateway.support.BoundedSecurityAuditSink;
import com.englishflow.gateway.support.CorrelationIds;
import com.englishflow.gateway.support.GatewayErrorMapper;
import com.englishflow.gateway.support.GatewayErrorResponseWriter;
import com.englishflow.gateway.support.SecurityAuditSink;
import org.springframework.web.server.ServerWebExchange;

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
                .cors(Customizer.withDefaults())
                .exceptionHandling(exceptionHandling -> exceptionHandling
                        .authenticationEntryPoint((exchange, failure) ->
                                GatewayErrorResponseWriter.write(exchange, GatewayErrorMapper.map(
                                        failure,
                                        requestId(exchange),
                                        traceId(exchange))))
                        .accessDeniedHandler((exchange, failure) -> accessDeniedResponse(exchange, failure)))
                .authorizeExchange(exchanges -> {
                    exchanges.pathMatchers("/actuator/health/**", "/actuator/info").permitAll();
                    exchanges.pathMatchers(HttpMethod.OPTIONS, "/api/**").permitAll();
                    exchanges.pathMatchers(HttpMethod.GET, "/api/v1/health").permitAll();
                    exchanges.pathMatchers(HttpMethod.HEAD, "/api/v1/health").permitAll();
                    exchanges.pathMatchers(HttpMethod.GET, "/api/v1/public/commerce/catalog").permitAll();
                    exchanges.pathMatchers(HttpMethod.HEAD, "/api/v1/public/commerce/catalog").permitAll();
                    exchanges.pathMatchers(HttpMethod.GET, "/api/v1/public/content/catalog").permitAll();
                    exchanges.pathMatchers(HttpMethod.HEAD, "/api/v1/public/content/catalog").permitAll();
                    exchanges.pathMatchers(HttpMethod.GET, "/api/v1/public/content/*").permitAll();
                    exchanges.pathMatchers(HttpMethod.HEAD, "/api/v1/public/content/*").permitAll();
                    exchanges.pathMatchers(HttpMethod.GET, "/api/v1/public/site/projection").permitAll();
                    exchanges.pathMatchers(HttpMethod.HEAD, "/api/v1/public/site/projection").permitAll();
                    exchanges.pathMatchers(HttpMethod.POST,
                            "/api/v1/auth/register",
                            "/api/v1/auth/login",
                            "/api/v1/auth/token/refresh",
                            "/api/v1/auth/password-reset/request",
                            "/api/v1/auth/password-reset/confirm").permitAll();
                    exchanges.pathMatchers(HttpMethod.GET, "/api/v1/auth/jwks").permitAll();
                    if (resourceServerEnabled) {
                        exchanges.anyExchange().authenticated();
                    } else {
                        if (localReadOnlyCompatibility && !resourceServerEnabled) {
                            exchanges.pathMatchers(HttpMethod.GET, "/api/v1/legacy/**").permitAll();
                            exchanges.pathMatchers(HttpMethod.HEAD, "/api/v1/legacy/**").permitAll();
                        }
                        // No token decoder means no protected request may pass. The custom
                        // access-denied handler below turns anonymous denyAll decisions into
                        // 401 rather than allowing a missing/invalid token to look authorized.
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
        if (properties.security().issuerUri() == null || properties.security().issuerUri().isBlank()
                || properties.security().jwkSetUri() == null || properties.security().jwkSetUri().isBlank()) {
            throw new IllegalStateException("Gateway JWT verifier requires issuer and explicit JWKS URI");
        }
        NimbusReactiveJwtDecoder nimbus = NimbusReactiveJwtDecoder.withJwkSetUri(properties.security().jwkSetUri()).build();
        nimbus.setJwtValidator(GatewayJwtValidators.forSecurity(properties.security()));
        return nimbus;
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(GatewayProperties properties) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(properties.cors().allowedOrigins());
        configuration.setAllowedMethods(csv(properties.cors().allowedMethods()));
        configuration.setAllowedHeaders(csv(properties.cors().allowedHeaders()));
        configuration.setExposedHeaders(csv(properties.cors().exposedHeaders()));
        configuration.setAllowCredentials(properties.cors().allowCredentials());
        configuration.setMaxAge(properties.cors().maxAge().toSeconds());

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    CorsWebFilter corsWebFilter(CorsConfigurationSource source) {
        return new CorsWebFilter(source);
    }

    @Bean
    RouteLocator gatewayRoutes(RouteLocatorBuilder routes, GatewayProperties properties) {
        var builder = routes.routes();
        if (Boolean.TRUE.equals(properties.identity().enabled())) {
            builder.route("iam-auth", route -> route
                        .path("/api/v1/auth/**", "/api/v1/iam/**")
                        .filters(filters -> identityFilters(filters, "iam-v1"))
                         .uri(properties.identity().iamUri().toString()));
        }
        if (Boolean.TRUE.equals(properties.b12().enabled())) {
            // Register the narrower B12 paths before B14's broad domain routes.
            // Otherwise /gamification/me/** would be rewritten as
            // /internal/v1/gamification/me/** instead of the canonical
            // /internal/v1/gamification/** owner path.
            registerB12Routes(builder, properties.b12());
        }
        if (Boolean.TRUE.equals(properties.b13().enabled())) {
            registerB13Routes(builder, properties.b13());
        }
        if (Boolean.TRUE.equals(properties.b14().enabled())) {
            registerB14Routes(builder, properties);
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
        GatewayProperties.B14Services.RouteMode learnerMode = services.mode("learner");
        if (isTargetMode(learnerMode)) {
            // B1 kept this route under /onboarding. B25 makes the owner explicit while keeping
            // the public contract stable for the existing Web/uni-app clients.
            builder.route("b25-learner-onboarding-target", route -> route
                    .path("/api/v1/onboarding/daily-tasks/**")
                    .filters(filters -> targetFilters(
                            filters.rewritePath("/api/v1/onboarding/daily-tasks/(?<segment>.*)",
                                    "/internal/v1/learner/onboarding/daily-tasks/${segment}"),
                            "b25-learner-onboarding-target", learnerMode))
                    .uri(services.serviceUri("learner").toString()));
            builder.route("b25-learner-onboarding-options-target", route -> route
                    .path("/api/v1/onboarding/options")
                    .and()
                    .method(HttpMethod.GET, HttpMethod.HEAD)
                    .filters(filters -> targetFilters(
                            filters.rewritePath("/api/v1/onboarding/options", "/internal/v1/learner/onboarding/options"),
                            "b25-learner-onboarding-options-target", learnerMode))
                    .uri(services.serviceUri("learner").toString()));
            // Privacy export is a learner-owned fact. Keep the stable public
            // B1 path while routing it to the current B25 owner instead of
            // the retired core-api /user/data-export compatibility path.
            builder.route("b25-learner-privacy-export", route -> route
                    .path("/api/v1/privacy/export")
                    .and()
                    .method(HttpMethod.POST)
                    .filters(filters -> targetFilters(
                            filters.rewritePath("/api/v1/privacy/export", "/internal/v1/learner/privacy/export"),
                            "b25-learner-privacy-export", learnerMode))
                    .uri(services.serviceUri("learner").toString()));
        }
        if (isTargetMode(services.mode("content"))) {
            // B9 public content projections are anonymous read contracts. Keep these
            // routes explicit so they cannot fall through to the authenticated
            // learner projection or the legacy compatibility boundary.
            builder.route("b9-public-content-catalog", route -> route
                    .path("/api/v1/public/content/catalog")
                    .and()
                    .method(HttpMethod.GET, HttpMethod.HEAD)
                    .filters(filters -> identityFilters(filters, "b9-public-content-catalog"))
                    .uri(services.serviceUri("content").toString()));
            builder.route("b9-public-content-item", route -> route
                    .path("/api/v1/public/content/*")
                    .and()
                    .method(HttpMethod.GET, HttpMethod.HEAD)
                    .filters(filters -> identityFilters(filters, "b9-public-content-item"))
                    .uri(services.serviceUri("content").toString()));
            builder.route("b33-public-site-projection", route -> route
                    .path("/api/v1/public/site/projection")
                    .and()
                    .method(HttpMethod.GET, HttpMethod.HEAD)
                    .filters(filters -> targetFilters(filters, "b33-public-site-projection"))
                    .uri(services.serviceUri("content").toString()));
            // B31 moves the admin content command contract to the content-service owner.
            // Keep the public B9 path stable while preventing the legacy core-api admin
            // controller from becoming an accidental write boundary.
            builder.route("b31-content-admin-commands", route -> route
                    .path("/api/v1/admin/content-commands", "/api/v1/admin/content-commands/**")
                    .filters(filters -> targetFilters(
                            filters.rewritePath(
                                    "/api/v1/admin/content-commands(?<segment>/.*)?",
                                    "/internal/v1/content/admin-commands${segment}"),
                            "b31-content-admin-commands", services.mode("content")))
                    .uri(services.serviceUri("content").toString()));
        }
        if (isTargetMode(commerceMode)) {
            builder.route("b14-commerce-payment-intent", route -> route
                    .path("/api/v1/commerce/orders/*/payment-intents")
                    .and()
                    .method(HttpMethod.POST)
                    .filters(filters -> targetFilters(
                            filters.rewritePath("/api/v1/commerce/orders/(?<orderId>[^/]+)/payment-intents",
                                    "/internal/v1/commerce/orders/${orderId}/payment-intents"),
                            "b14-commerce-payment-intent", commerceMode))
                    .uri(services.serviceUri("commerce").toString()));
        }
        // B4 avatar and game contracts are public semantic paths, but their owner is the
        // gamification service. Keep them explicit because these domains are not part of B14's
        // generic domain list and must not fall through to core-api.
        registerB4GamificationFeatureRoutes(builder, services);
        registerB2VocabularyRoutes(builder, services);
        // B3/B10 publish semantic learner paths. They are intentionally registered before the
        // generic B14 domain routes below so that a grammar/writing/reading request is routed to
        // its owning content or learning service instead of being interpreted as an unknown
        // domain. The public contract remains semantic; only the Gateway knows the internal
        // service paths.
        registerB3SemanticRoutes(builder, services);
        for (String domain : GatewayProperties.B14Services.DOMAINS) {
            GatewayProperties.B14Services.RouteMode mode = services.mode(domain);
            if (isTargetMode(mode)) {
                registerB14TargetRoutes(builder, services, domain, mode);
            } else if (Boolean.TRUE.equals(properties.compatibility().enabled())) {
                registerB14LegacyReadRoute(builder, properties, domain, mode);
            }
        }
    }

    private static void registerB4GamificationFeatureRoutes(
            RouteLocatorBuilder.Builder builder, GatewayProperties.B14Services services) {
        GatewayProperties.B14Services.RouteMode mode = services.mode("gamification");
        if (!isTargetMode(mode)) {
            return;
        }
        String gamificationUri = services.serviceUri("gamification").toString();
        builder.route("b4-avatar", route -> route
                .path("/api/v1/avatar/**")
                .and()
                .method(HttpMethod.GET, HttpMethod.HEAD, HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH)
                .filters(filters -> targetFilters(
                        filters.rewritePath("/api/v1/avatar/(?<segment>.*)",
                                "/internal/v1/gamification/avatar/${segment}"),
                        "b4-avatar", mode))
                .uri(gamificationUri));
        builder.route("b4-games", route -> route
                .path("/api/v1/games/**")
                .and()
                .method(HttpMethod.GET, HttpMethod.HEAD, HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH)
                .filters(filters -> targetFilters(
                        filters.rewritePath("/api/v1/games/(?<segment>.*)",
                                "/internal/v1/gamification/games/${segment}"),
                        "b4-games", mode))
                .uri(gamificationUri));
    }

    /**
     * B2 keeps its public vocabulary paths semantic.  Chunks are published
     * content, while mined expressions are learner-owned learning facts; the
     * browser must never fall through to the legacy core-api boundary.
     */
    private static void registerB2VocabularyRoutes(
            RouteLocatorBuilder.Builder builder, GatewayProperties.B14Services services) {
        GatewayProperties.B14Services.RouteMode contentMode = services.mode("content");
        if (isTargetMode(contentMode)) {
            registerB3Route(builder, "b2-vocabulary-chunk", "/api/v1/vocab/chunks/*",
                    "/api/v1/vocab/chunks/(?<chunkId>[^/]+)",
                    "/internal/v1/content/learner/vocab/chunks/${chunkId}",
                    services.serviceUri("content").toString(), contentMode, HttpMethod.GET, HttpMethod.HEAD);
        }
        GatewayProperties.B14Services.RouteMode learningMode = services.mode("learning");
        if (isTargetMode(learningMode)) {
            String learningUri = services.serviceUri("learning").toString();
            registerB3Route(builder, "b2-vocabulary-expressions", "/api/v1/vocab/expressions",
                    "/api/v1/vocab/expressions", "/internal/v1/learning/vocab/expressions",
                    learningUri, learningMode, HttpMethod.GET, HttpMethod.POST);
            registerB3Route(builder, "b2-vocabulary-expression", "/api/v1/vocab/expressions/*",
                    "/api/v1/vocab/expressions/(?<expressionId>[^/]+)",
                    "/internal/v1/learning/vocab/expressions/${expressionId}",
                    learningUri, learningMode, HttpMethod.GET, HttpMethod.PATCH, HttpMethod.DELETE);
            registerB3Route(builder, "b2-vocabulary-library", "/api/v1/vocab/library",
                    "/api/v1/vocab/library", "/internal/v1/learning/vocab/library",
                    learningUri, learningMode, HttpMethod.GET);
            registerB3Route(builder, "b2-vocabulary-library-entry-create", "/api/v1/vocab/library/entries",
                    "/api/v1/vocab/library/entries", "/internal/v1/learning/vocab/library/entries",
                    learningUri, learningMode, HttpMethod.POST);
            registerB3Route(builder, "b2-vocabulary-library-entry-delete", "/api/v1/vocab/library/entries/*",
                    "/api/v1/vocab/library/entries/(?<entryId>[^/]+)",
                    "/internal/v1/learning/vocab/library/entries/${entryId}",
                    learningUri, learningMode, HttpMethod.DELETE);
        }
    }

    private static void registerB3SemanticRoutes(
            RouteLocatorBuilder.Builder builder, GatewayProperties.B14Services services) {
        GatewayProperties.B14Services.RouteMode contentMode = services.mode("content");
        GatewayProperties.B14Services.RouteMode learningMode = services.mode("learning");
        GatewayProperties.B14Services.RouteMode assessmentMode = services.mode("assessment");

        if (isTargetMode(learningMode)) {
            String learningUri = services.serviceUri("learning").toString();
            // Mastery is learner-owned state derived from learning interactions.
            // Register it before the content read catch-all so content-service
            // cannot return the historical empty projection.
            registerB3Route(builder, "b10-learning-grammar-mastery", "/api/v1/grammar/mastery",
                    "/api/v1/grammar/mastery", "/internal/v1/learning/experiences/grammar/mastery",
                    learningUri, learningMode, HttpMethod.GET, HttpMethod.HEAD);
            registerB3Route(builder, "b3-grammar-attempt", "/api/v1/grammar/practice/attempts",
                    "/api/v1/grammar/practice/attempts", "/internal/v1/learning/experiences/grammar/attempts",
                    learningUri, learningMode, HttpMethod.POST);
            registerB3Route(builder, "b3-grammar-blocks", "/api/v1/grammar/sentences/*/blocks",
                    "/api/v1/grammar/sentences/(?<sentenceId>[^/]+)/blocks",
                    "/internal/v1/learning/experiences/grammar/sentences/${sentenceId}/blocks",
                    learningUri, learningMode, HttpMethod.POST);
            registerB3Route(builder, "b3-grammar-imitation", "/api/v1/grammar/sentences/*/imitation",
                    "/api/v1/grammar/sentences/(?<sentenceId>[^/]+)/imitation",
                    "/internal/v1/learning/experiences/grammar/sentences/${sentenceId}/imitation",
                    learningUri, learningMode, HttpMethod.POST);

            registerB3Route(builder, "b3-writing-submission", "/api/v1/writing/submissions",
                    "/api/v1/writing/submissions", "/internal/v1/learning/experiences/writing/submissions",
                    learningUri, learningMode, HttpMethod.POST);
            registerB3Route(builder, "b3-writing-correction", "/api/v1/writing/corrections",
                    "/api/v1/writing/corrections", "/internal/v1/learning/experiences/writing/corrections",
                    learningUri, learningMode, HttpMethod.POST);
            registerB3Route(builder, "b3-writing-history", "/api/v1/writing/history",
                    "/api/v1/writing/history", "/internal/v1/learning/experiences/writing/history",
                    learningUri, learningMode, HttpMethod.GET, HttpMethod.HEAD);

            registerB3Route(builder, "b3-listening-session", "/api/v1/listening/sessions",
                    "/api/v1/listening/sessions", "/internal/v1/learning/experiences/listening/sessions",
                    learningUri, learningMode, HttpMethod.POST);
            registerB3Route(builder, "b3-listening-dictation", "/api/v1/listening/sessions/*/dictation",
                    "/api/v1/listening/sessions/(?<sessionId>[^/]+)/dictation",
                    "/internal/v1/learning/experiences/listening/sessions/${sessionId}/dictation",
                    learningUri, learningMode, HttpMethod.POST);
            registerB3Route(builder, "b3-listening-progress", "/api/v1/listening/sessions/*/progress",
                    "/api/v1/listening/sessions/(?<sessionId>[^/]+)/progress",
                    "/internal/v1/learning/experiences/listening/sessions/${sessionId}/progress",
                    learningUri, learningMode, HttpMethod.PUT);
            registerB3Route(builder, "b11-learning-media-progress", "/api/v1/learning/media-progress",
                    "/api/v1/learning/media-progress", "/internal/v1/learning/experiences/media-progress",
                    learningUri, learningMode, HttpMethod.PUT);
            registerB3Route(builder, "b3-listening-offline-package", "/api/v1/listening/offline-packages",
                    "/api/v1/listening/offline-packages", "/internal/v1/learning/experiences/listening/offline-packages",
                    learningUri, learningMode, HttpMethod.POST);

            registerB3Route(builder, "b3-reading-attempt", "/api/v1/reading/attempts",
                    "/api/v1/reading/attempts", "/internal/v1/learning/experiences/reading/attempts",
                    learningUri, learningMode, HttpMethod.POST);
            registerB3Route(builder, "b3-reading-mining", "/api/v1/reading/mining",
                    "/api/v1/reading/mining", "/internal/v1/learning/experiences/reading/mining",
                    learningUri, learningMode, HttpMethod.POST);
            registerB3Route(builder, "b3-reading-progress", "/api/v1/reading/progress",
                    "/api/v1/reading/progress", "/internal/v1/learning/experiences/reading/progress",
                    learningUri, learningMode, HttpMethod.PUT);

            registerB3Route(builder, "b3-speaking-recording", "/api/v1/speaking/recordings",
                    "/api/v1/speaking/recordings", "/internal/v1/learning/experiences/speaking/recordings",
                    learningUri, learningMode, HttpMethod.POST);
            registerB3Route(builder, "b3-speaking-recording-delete", "/api/v1/speaking/recordings/*",
                    "/api/v1/speaking/recordings/(?<recordingId>[^/]+)",
                    "/internal/v1/learning/experiences/speaking/recordings/${recordingId}",
                    learningUri, learningMode, HttpMethod.DELETE);
            registerB3Route(builder, "b3-speaking-recording-rating", "/api/v1/speaking/recordings/*/self-rating",
                    "/api/v1/speaking/recordings/(?<recordingId>[^/]+)/self-rating",
                    "/internal/v1/learning/experiences/speaking/recordings/${recordingId}/self-rating",
                    learningUri, learningMode, HttpMethod.POST);
            registerB3Route(builder, "b3-speaking-shadowing", "/api/v1/speaking/shadowing/sessions",
                    "/api/v1/speaking/shadowing/sessions", "/internal/v1/learning/experiences/speaking/shadowing/sessions",
                    learningUri, learningMode, HttpMethod.POST);
            registerB3Route(builder, "b3-speaking-shadowing-progress", "/api/v1/speaking/shadowing/sessions/*/progress",
                    "/api/v1/speaking/shadowing/sessions/(?<sessionId>[^/]+)/progress",
                    "/internal/v1/learning/experiences/speaking/shadowing/sessions/${sessionId}/progress",
                    learningUri, learningMode, HttpMethod.POST);
            registerB3Route(builder, "b11-speaking-shadowing-completion", "/api/v1/speaking/shadowing/completions",
                    "/api/v1/speaking/shadowing/completions", "/internal/v1/learning/experiences/speaking/shadowing/completions",
                    learningUri, learningMode, HttpMethod.POST);
            registerB3Route(builder, "b10-mastery", "/api/v1/mastery/**",
                    "/api/v1/mastery/(?<segment>.*)", "/internal/v1/learning/experiences/mastery/${segment}",
                    learningUri, learningMode, HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT);
            registerB3Route(builder, "b3-speaking-roleplay", "/api/v1/speaking/roleplay/sessions",
                    "/api/v1/speaking/roleplay/sessions", "/internal/v1/learning/experiences/speaking/roleplay/sessions",
                    learningUri, learningMode, HttpMethod.POST);
            registerB3Route(builder, "b3-speaking-roleplay-turn", "/api/v1/speaking/roleplay/sessions/*/turns",
                    "/api/v1/speaking/roleplay/sessions/(?<sessionId>[^/]+)/turns",
                    "/internal/v1/learning/experiences/speaking/roleplay/sessions/${sessionId}/turns",
                    learningUri, learningMode, HttpMethod.POST);

            registerB3Route(builder, "b3-offline-sync-push", "/api/v1/offline/sync/push",
                    "/api/v1/offline/sync/push", "/internal/v1/learning/experiences/offline/sync/push",
                    learningUri, learningMode, HttpMethod.POST);
            registerB3Route(builder, "b3-offline-sync-pull", "/api/v1/offline/sync/pull",
                    "/api/v1/offline/sync/pull", "/internal/v1/learning/experiences/offline/sync/pull",
                    learningUri, learningMode, HttpMethod.GET, HttpMethod.HEAD);
        }

        if (isTargetMode(contentMode)) {
            // Keep the assessment-owned grammar practice session path ahead of the
            // broad read-only grammar projection.  Gateway route order is part of
            // the public contract: a GET/POST on /grammar/practice/sessions must
            // never be consumed by the content-service catch-all.
            if (isTargetMode(assessmentMode)) {
                String assessmentUri = services.serviceUri("assessment").toString();
                registerB3Route(builder, "b10-grammar-practice-session", "/api/v1/grammar/practice/sessions/**",
                        "/api/v1/grammar/practice/sessions(?<segment>/.*)?",
                        "/internal/v1/assessment/practice/sessions${segment}",
                        assessmentUri, assessmentMode, HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT);
            }
            String contentUri = services.serviceUri("content").toString();
            registerB3Route(builder, "b3-content-grammar", "/api/v1/grammar/**",
                    "/api/v1/grammar/(?<segment>.*)", "/internal/v1/content/learner/grammar/${segment}",
                    contentUri, contentMode, HttpMethod.GET, HttpMethod.HEAD);
            registerB3Route(builder, "b3-content-writing", "/api/v1/writing/**",
                    "/api/v1/writing/(?<segment>.*)", "/internal/v1/content/learner/writing/${segment}",
                    contentUri, contentMode, HttpMethod.GET, HttpMethod.HEAD);
            registerB3Route(builder, "b3-content-listening", "/api/v1/listening/**",
                    "/api/v1/listening/(?<segment>.*)", "/internal/v1/content/learner/listening/${segment}",
                    contentUri, contentMode, HttpMethod.GET, HttpMethod.HEAD);
            registerB3Route(builder, "b3-content-reading", "/api/v1/reading/**",
                    "/api/v1/reading/(?<segment>.*)", "/internal/v1/content/learner/reading/${segment}",
                    contentUri, contentMode, HttpMethod.GET, HttpMethod.HEAD);
            registerB3Route(builder, "b3-content-phonetics", "/api/v1/phonetics/**",
                    "/api/v1/phonetics/(?<segment>.*)", "/internal/v1/content/learner/phonetics/${segment}",
                    contentUri, contentMode, HttpMethod.GET, HttpMethod.HEAD);
        }

    }

    private static void registerB3Route(
            RouteLocatorBuilder.Builder builder,
            String routeName,
            String publicPath,
            String publicPattern,
            String internalPath,
            String serviceUri,
            GatewayProperties.B14Services.RouteMode mode,
            HttpMethod... methods) {
        builder.route(routeName, route -> route
                .path(publicPath)
                .and()
                .method(methods)
                .filters(filters -> targetFilters(
                        filters.rewritePath(publicPattern, internalPath), routeName, mode))
                .uri(serviceUri));
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

    private static GatewayFilterSpec identityFilters(GatewayFilterSpec filters, String routeName) {
        return filters
                .removeRequestHeader("X-B5-Role")
                .removeRequestHeader("X-Role")
                .removeRequestHeader("X-Tenant-Id")
                .removeRequestHeader("X-Owner-Id")
                .removeRequestHeader("X-Subject-Id")
                .removeRequestHeader("X-Permissions")
                .removeRequestHeader("X-Policy-Version")
                .addRequestHeader("X-Gateway-Route", routeName);
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
        // B12 governance is a public admin contract, but its facts remain owned by the
        // social/notification services.  These routes must be explicit; otherwise the
        // browser falls through to the legacy core-api compatibility boundary and returns
        // the misleading "network unavailable" snapshot state.
        builder.route("b12-admin-moderation-reports", route -> route
                .path("/api/v1/admin/moderation/reports")
                .and()
                .method(HttpMethod.GET)
                .filters(filters -> identityFilters(filters
                        .rewritePath("/api/v1/admin/moderation/reports", "/internal/v1/social/admin/moderation/reports"),
                        "b12-admin-moderation-reports"))
                .uri(services.socialUri().toString()));
        builder.route("b12-admin-moderation-command", route -> route
                .path("/api/v1/admin/moderation/reports/*/commands")
                .and()
                .method(HttpMethod.POST)
                .filters(filters -> identityFilters(filters
                        .rewritePath("/api/v1/admin/moderation/reports/(?<reportId>[^/]+)/commands",
                                "/internal/v1/social/admin/moderation/reports/${reportId}/commands"),
                        "b12-admin-moderation-command"))
                .uri(services.socialUri().toString()));
        builder.route("b12-admin-recovery-tasks", route -> route
                .path("/api/v1/admin/recovery/tasks")
                .and()
                .method(HttpMethod.GET)
                .filters(filters -> identityFilters(filters
                        .rewritePath("/api/v1/admin/recovery/tasks", "/internal/v1/notifications/admin/recovery/tasks"),
                        "b12-admin-recovery-tasks"))
                .uri(services.notificationUri().toString()));
        builder.route("b12-admin-recovery-command", route -> route
                .path("/api/v1/admin/recovery/tasks/*/commands")
                .and()
                .method(HttpMethod.POST)
                .filters(filters -> identityFilters(filters
                        .rewritePath("/api/v1/admin/recovery/tasks/(?<taskId>[^/]+)/commands",
                                "/internal/v1/notifications/admin/recovery/tasks/${taskId}/commands"),
                        "b12-admin-recovery-command"))
                .uri(services.notificationUri().toString()));
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
        // Offline change cursors are owned by notification/workflow in Phase 1.
        // Keep the public path stable while making the owner and rewrite explicit;
        // the learner client must not fall back to core-api for sync writes.
        builder.route("b12-sync-public", route -> route
                .path("/api/v1/sync/**")
                .filters(filters -> filters
                        .rewritePath("/api/v1/sync/(?<segment>.*)", "/internal/v1/sync/${segment}")
                        .removeRequestHeader("X-B5-Role")
                        .removeRequestHeader("X-Role")
                        .removeRequestHeader("X-Tenant-Id")
                        .removeRequestHeader("X-Owner-Id")
                        .addRequestHeader("X-Gateway-Route", "b12-sync-public"))
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
                                "/internal/v1/commerce/orders/${orderId}/payment-intents")
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

    private static reactor.core.publisher.Mono<Void> accessDeniedResponse(
            ServerWebExchange exchange,
            org.springframework.security.access.AccessDeniedException failure) {
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
                                traceId(exchange))));
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
