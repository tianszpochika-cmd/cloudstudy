package com.englishflow.platform.template.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Service-side policy enforcement point. Local policy is the hot path; cache miss/staleness and
 * explicitly dynamic requests use the PDP port, with every failure mapped to deny.
 */
public final class PepGuard {

    private final PolicyCache policyCache;
    private final LocalPolicyEvaluator localEvaluator;
    private final PdpPort pdpPort;
    private final Duration pdpTimeout;
    private final Clock clock;

    public PepGuard(
            PolicyCache policyCache,
            LocalPolicyEvaluator localEvaluator,
            PdpPort pdpPort,
            Duration pdpTimeout,
            Clock clock) {
        this.policyCache = Objects.requireNonNull(policyCache, "policyCache is required");
        this.localEvaluator = Objects.requireNonNull(localEvaluator, "localEvaluator is required");
        this.pdpPort = pdpPort;
        this.pdpTimeout = Objects.requireNonNull(pdpTimeout, "pdpTimeout is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
        if (pdpTimeout.isZero() || pdpTimeout.isNegative()) {
            throw new IllegalArgumentException("PDP timeout must be positive");
        }
    }

    public Decision authorize(AuthorizationContext context) {
        Decision facts = localEvaluator.validateFacts(context);
        if (!facts.allowed()) {
            return facts;
        }

        Optional<PolicySnapshot> fresh = policyCache.fresh();
        if (fresh.isPresent() && !context.pdpRequired()) {
            return localEvaluator.evaluate(context, fresh.get());
        }
        if (pdpPort == null) {
            return Decision.deny(
                    context,
                    policyCache.current().isPresent() ? DecisionReason.POLICY_STALE : DecisionReason.PDP_UNAVAILABLE,
                    policyCache.current().map(PolicySnapshot::version).orElse(null),
                    clock.instant());
        }
        return authorizeViaPdp(context);
    }

    private Decision authorizeViaPdp(AuthorizationContext context) {
        Instant now = clock.instant();
        CompletableFuture<PdpDecision> future = CompletableFuture.supplyAsync(
                () -> pdpPort.evaluate(context, pdpTimeout));
        try {
            PdpDecision pdpDecision = future.get(pdpTimeout.toMillis(), TimeUnit.MILLISECONDS);
            if (pdpDecision == null || !pdpDecision.completed()) {
                return Decision.deny(context, DecisionReason.PDP_INVALID, null, now);
            }
            if (pdpDecision.revocationStatus() != RevocationStatus.CONFIRMED_ACTIVE) {
                DecisionReason reason = pdpDecision.revocationStatus() == RevocationStatus.REVOKED
                        ? DecisionReason.REVOKED
                        : DecisionReason.REVOCATION_UNKNOWN;
                return Decision.deny(context, reason, pdpDecision.policyVersion(), now);
            }
            if (pdpDecision.policyVersion() == null || !pdpDecision.policyVersion().isFresh(now)) {
                return Decision.deny(context, DecisionReason.POLICY_STALE, pdpDecision.policyVersion(), now);
            }
            if (pdpDecision.effect() != DecisionEffect.ALLOW) {
                DecisionReason reason = pdpDecision.reason() == DecisionReason.ALLOWED
                        ? DecisionReason.PDP_DENIED : pdpDecision.reason();
                return Decision.deny(context, reason, pdpDecision.policyVersion(), now);
            }
            return Decision.allow(context, pdpDecision.policyVersion(), now);
        } catch (TimeoutException exception) {
            future.cancel(true);
            return Decision.deny(context, DecisionReason.PDP_TIMEOUT, null, now);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return Decision.deny(context, DecisionReason.PDP_TIMEOUT, null, now);
        } catch (ExecutionException | RuntimeException exception) {
            return Decision.deny(context, DecisionReason.PDP_UNAVAILABLE, null, now);
        }
    }
}
