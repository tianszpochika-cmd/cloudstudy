package com.englishflow.notification.security;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FailClosedPepTest {

    private static final Instant NOW = Instant.parse("2026-09-11T00:00:00Z");
    private static final PdpDecision ALLOWED = new PdpDecision(true, "policy-v1",
            PdpDecision.RevocationStatus.CONFIRMED_NOT_REVOKED, "allowed");

    @Test
    void freshAllowedDecisionWithMatchingVersionPasses() {
        FailClosedPep pep = new FailClosedPep((request, timeout) -> ALLOWED, Clock.fixed(NOW, ZoneOffset.UTC));
        PdpDecision decision = pep.evaluate("principal-1", "platform", "learning.plan.read", "policy-v1");
        assertTrue(decision.allowed());
    }

    @Test
    void pdpTimeoutUnavailableOrNullDecisionDenies() {
        FailClosedPep throwing = new FailClosedPep((request, timeout) -> {
            throw new IllegalStateException("timeout");
        }, Clock.fixed(NOW, ZoneOffset.UTC));
        assertFalse(throwing.evaluate("principal-1", "platform", "learning.plan.read", null).allowed());

        FailClosedPep nullDecision = new FailClosedPep((request, timeout) -> null, Clock.fixed(NOW, ZoneOffset.UTC));
        assertFalse(nullDecision.evaluate("principal-1", "platform", "learning.plan.read", null).allowed());

        FailClosedPep unprovisioned = new FailClosedPep(new UnavailablePdpPort(), Clock.fixed(NOW, ZoneOffset.UTC));
        assertEquals("pdp_unavailable",
                unprovisioned.evaluate("principal-1", "platform", "learning.plan.read", null).reason());
    }

    @Test
    void unknownOrRevokedStateDenies() {
        PdpDecision unknown = new PdpDecision(true, "policy-v1", PdpDecision.RevocationStatus.UNKNOWN, "unknown");
        FailClosedPep unknownPep = new FailClosedPep((request, timeout) -> unknown, Clock.fixed(NOW, ZoneOffset.UTC));
        assertEquals("revocation_unknown",
                unknownPep.evaluate("principal-1", "platform", "learning.plan.read", null).reason());

        PdpDecision revoked = new PdpDecision(true, "policy-v1", PdpDecision.RevocationStatus.REVOKED, "revoked");
        FailClosedPep revokedPep = new FailClosedPep((request, timeout) -> revoked, Clock.fixed(NOW, ZoneOffset.UTC));
        assertEquals("revoked", revokedPep.evaluate("principal-1", "platform", "learning.plan.read", null).reason());
    }

    @Test
    void policyVersionMismatchDenies() {
        FailClosedPep pep = new FailClosedPep((request, timeout) -> ALLOWED, Clock.fixed(NOW, ZoneOffset.UTC));
        assertEquals("policy_version_mismatch",
                pep.evaluate("principal-1", "platform", "learning.plan.read", "policy-v2").reason());
    }

    @Test
    void freshCacheAvoidsSecondPdpCallButExpiredSnapshotReconsults() {
        MutableClock clock = new MutableClock(NOW);
        AtomicInteger calls = new AtomicInteger();
        AtomicReference<PdpDecision> next = new AtomicReference<>(ALLOWED);
        FailClosedPep pep = new FailClosedPep((request, timeout) -> {
            calls.incrementAndGet();
            PdpDecision decision = next.get();
            if (decision == null) {
                throw new IllegalStateException("timeout");
            }
            return decision;
        }, clock);

        assertTrue(pep.evaluate("principal-1", "platform", "learning.plan.read", "policy-v1").allowed());
        assertTrue(pep.evaluate("principal-1", "platform", "learning.plan.read", "policy-v1").allowed());
        assertEquals(1, calls.get(), "a fresh cache snapshot must not be re-fetched inside the TTL");

        clock.advance(Duration.ofSeconds(31));
        next.set(null);
        assertFalse(pep.evaluate("principal-1", "platform", "learning.plan.read", "policy-v1").allowed(),
                "an expired snapshot must re-consult the PDP and deny when it is unavailable");
        assertEquals(2, calls.get());
    }

    private static final class MutableClock extends Clock {

        private Instant instant;

        private MutableClock(Instant instant) {
            this.instant = instant;
        }

        void advance(Duration duration) {
            instant = instant.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}
