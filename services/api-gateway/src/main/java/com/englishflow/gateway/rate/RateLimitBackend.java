package com.englishflow.gateway.rate;

import com.englishflow.gateway.config.GatewayProperties;
import reactor.core.publisher.Mono;

/**
 * Platform seam for a fixed-window limiter. The Gateway owns admission only;
 * it does not write learner, IAM or domain facts.
 */
public interface RateLimitBackend {

    Mono<RateLimitDecision> consume(String key, GatewayProperties.RateLimit policy);
}
