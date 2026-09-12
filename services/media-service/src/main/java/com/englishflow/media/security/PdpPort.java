package com.englishflow.media.security;

import java.time.Duration;

/** Replaceable port for dynamic/high-risk policy checks; implementations must honour the timeout. */
public interface PdpPort {

    PdpDecision evaluate(PdpRequest request, Duration timeout);
}
