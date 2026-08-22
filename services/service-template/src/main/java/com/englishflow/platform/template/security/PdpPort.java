package com.englishflow.platform.template.security;

import java.time.Duration;

/** Replaceable port for dynamic/high-risk policy checks; implementations must honor the timeout. */
@FunctionalInterface
public interface PdpPort {

    PdpDecision evaluate(AuthorizationContext context, Duration timeout);
}
