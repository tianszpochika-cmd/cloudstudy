package com.englishflow.social.web;

import java.time.Instant;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Lightweight unauthenticated process health endpoint in addition to Actuator probes. */
@RestController
public final class HealthController {

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("status", "UP", "service", "social-service", "serverTime", Instant.now().toString());
    }
}
