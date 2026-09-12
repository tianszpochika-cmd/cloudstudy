package com.englishflow.learner.security;

import java.time.Duration;

/** Fail-closed adapter used until a real PDP is provisioned. */
public final class UnavailablePdpPort implements PdpPort {

    @Override
    public PdpDecision evaluate(PdpRequest request, Duration timeout) {
        throw new IllegalStateException("dynamic policy PDP is not provisioned");
    }
}
