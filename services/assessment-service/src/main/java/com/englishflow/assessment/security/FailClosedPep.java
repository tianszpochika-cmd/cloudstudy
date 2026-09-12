package com.englishflow.assessment.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Fail-closed dynamic-policy enforcement point. A cache miss or expired snapshot consults the
 * PDP; a PDP timeout, unavailable PDP, null decision, policy version mismatch or unknown
 * revocation state all deny. Only a fresh allowed decision with a matching policy version and a
 * confirmed non-revoked state may pass.
 */
public final class FailClosedPep {

    private static final Duration DEFAULT_PDP_TIMEOUT = Duration.ofMillis(250);
    private static final Duration DEFAULT_CACHE_TTL = Duration.ofSeconds(30);

    private final PdpPort pdp;
    private final Clock clock;
    private final Duration cacheTtl;
    private final Duration pdpTimeout;
    private final ConcurrentMap<String, CachedDecision> cache = new ConcurrentHashMap<>();

    public FailClosedPep(PdpPort pdp, Clock clock) {
        this(pdp, clock, DEFAULT_CACHE_TTL, DEFAULT_PDP_TIMEOUT);
    }

    public FailClosedPep(PdpPort pdp, Clock clock, Duration cacheTtl, Duration pdpTimeout) {
        this.pdp = Objects.requireNonNull(pdp, "pdp");
        this.clock = Objects.requireNonNull(clock, "clock");
        if (cacheTtl == null || cacheTtl.isZero() || cacheTtl.isNegative()) {
            throw new IllegalArgumentException("cache TTL must be positive");
        }
        if (pdpTimeout == null || pdpTimeout.isZero() || pdpTimeout.isNegative()) {
            throw new IllegalArgumentException("PDP timeout must be positive");
        }
        this.cacheTtl = cacheTtl;
        this.pdpTimeout = pdpTimeout;
    }

    public PdpDecision evaluate(String subject, String tenant, String action, String requiredPolicyVersion) {
        Objects.requireNonNull(subject, "subject");
        Objects.requireNonNull(tenant, "tenant");
        Objects.requireNonNull(action, "action");
        String key = subject + '|' + tenant + '|' + action;
        CachedDecision cached = cache.get(key);
        if (cached != null && !cached.expiredAt(clock, cacheTtl)) {
            return decide(cached.decision(), requiredPolicyVersion);
        }
        PdpDecision decision;
        try {
            decision = pdp.evaluate(new PdpRequest(subject, tenant, action), pdpTimeout);
        } catch (RuntimeException unavailable) {
            // Timeout, transport failure, missing implementation or policy version mismatch all
            // deny; the caller never receives an implicit allow.
            return PdpDecision.denied("pdp_unavailable");
        }
        if (decision == null) {
            return PdpDecision.denied("pdp_unavailable");
        }
        cache.put(key, new CachedDecision(decision, clock.instant()));
        return decide(decision, requiredPolicyVersion);
    }

    private static PdpDecision decide(PdpDecision decision, String requiredPolicyVersion) {
        if (decision.revocation() == PdpDecision.RevocationStatus.UNKNOWN) {
            return PdpDecision.denied("revocation_unknown");
        }
        if (decision.revocation() == PdpDecision.RevocationStatus.REVOKED) {
            return PdpDecision.denied("revoked");
        }
        if (requiredPolicyVersion != null && !requiredPolicyVersion.equals(decision.policyVersion())) {
            return PdpDecision.denied("policy_version_mismatch");
        }
        return decision.allowed() ? decision : PdpDecision.denied(decision.reason());
    }

    private record CachedDecision(PdpDecision decision, Instant fetchedAt) {

        boolean expiredAt(Clock clock, Duration cacheTtl) {
            return fetchedAt.plus(cacheTtl).isBefore(clock.instant());
        }
    }
}
