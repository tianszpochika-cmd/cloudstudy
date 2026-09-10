package com.englishflow.adminops.domain;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Single-use confirmation ledger: scope binding (tenant / actor / action / resource),
 * single-use semantics and expiry.
 *
 * Pure in-memory, no external dependencies.
 */
class ConfirmationServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-10T00:00:00Z");
    private static final Duration TTL = Duration.ofMinutes(5);
    private static final String ACTION = "order.refund";
    private static final String RESOURCE = "order-1";

    private static AdminPrincipal actor() {
        return new AdminPrincipal("admin-1", "tenant-1", Set.of(), Set.of(), null);
    }

    private static AdminPrincipal principal(String subjectId, String tenantId) {
        return new AdminPrincipal(subjectId, tenantId, Set.of(), Set.of(), null);
    }

    private static ConfirmationService service(Clock clock) {
        return new ConfirmationService(clock, TTL);
    }

    private static String codeOf(Throwable thrown) {
        assertThat(thrown).isInstanceOf(AdminOpsException.class);
        return ((AdminOpsException) thrown).code();
    }

    // --- prepare ---

    @Test
    void prepareRejectsNullPrincipal() {
        ConfirmationService service = service(Clock.fixed(NOW, ZoneOffset.UTC));
        assertThatThrownBy(() -> service.prepare(null, ACTION, RESOURCE))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("ADMIN_UNAUTHENTICATED"));
    }

    @Test
    void prepareIssuesChallengeBoundToPrincipalAndResource() {
        ConfirmationService service = service(Clock.fixed(NOW, ZoneOffset.UTC));
        ConfirmationChallenge challenge = service.prepare(actor(), ACTION, RESOURCE);

        assertThat(challenge.token()).startsWith("confirm_");
        assertThat(challenge.decisionId()).startsWith("decision_");
        assertThat(challenge.action()).isEqualTo(ACTION);
        assertThat(challenge.resourceRef()).isEqualTo(RESOURCE);
        assertThat(challenge.expiresAt()).isEqualTo(NOW.plus(TTL));
    }

    // --- consume: happy path ---

    @Test
    void consumeReturnsDecisionIdForMatchingRequest() {
        ConfirmationService service = service(Clock.fixed(NOW, ZoneOffset.UTC));
        ConfirmationChallenge challenge = service.prepare(actor(), ACTION, RESOURCE);

        String decisionId = service.consume(actor(), challenge.token(), ACTION, RESOURCE);

        assertThat(decisionId).isEqualTo(challenge.decisionId());
    }

    // --- consume: single use ---

    @Test
    void confirmationCannotBeConsumedTwice() {
        ConfirmationService service = service(Clock.fixed(NOW, ZoneOffset.UTC));
        ConfirmationChallenge challenge = service.prepare(actor(), ACTION, RESOURCE);
        service.consume(actor(), challenge.token(), ACTION, RESOURCE);

        assertThatThrownBy(() -> service.consume(actor(), challenge.token(), ACTION, RESOURCE))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("ADMIN_CONFIRMATION_INVALID"));
    }

    @Test
    void consumeRejectsNullToken() {
        ConfirmationService service = service(Clock.fixed(NOW, ZoneOffset.UTC));
        assertThatThrownBy(() -> service.consume(actor(), null, ACTION, RESOURCE))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("ADMIN_CONFIRMATION_INVALID"));
    }

    @Test
    void consumeRejectsUnknownToken() {
        ConfirmationService service = service(Clock.fixed(NOW, ZoneOffset.UTC));
        assertThatThrownBy(() -> service.consume(actor(), "confirm_does-not-exist", ACTION, RESOURCE))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("ADMIN_CONFIRMATION_INVALID"));
    }

    @Test
    void consumeRejectsNullPrincipal() {
        ConfirmationService service = service(Clock.fixed(NOW, ZoneOffset.UTC));
        ConfirmationChallenge challenge = service.prepare(actor(), ACTION, RESOURCE);
        assertThatThrownBy(() -> service.consume(null, challenge.token(), ACTION, RESOURCE))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("ADMIN_UNAUTHENTICATED"));
    }

    // --- consume: scope binding (security critical) ---

    @Test
    void consumeRejectsDifferentTenant() {
        ConfirmationService service = service(Clock.fixed(NOW, ZoneOffset.UTC));
        ConfirmationChallenge challenge = service.prepare(actor(), ACTION, RESOURCE);

        assertThatThrownBy(() -> service.consume(
                principal("admin-1", "tenant-OTHER"), challenge.token(), ACTION, RESOURCE))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("ADMIN_CONFIRMATION_SCOPE_MISMATCH"));
    }

    @Test
    void consumeRejectsDifferentActor() {
        ConfirmationService service = service(Clock.fixed(NOW, ZoneOffset.UTC));
        ConfirmationChallenge challenge = service.prepare(actor(), ACTION, RESOURCE);

        assertThatThrownBy(() -> service.consume(
                principal("admin-2", "tenant-1"), challenge.token(), ACTION, RESOURCE))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("ADMIN_CONFIRMATION_SCOPE_MISMATCH"));
    }

    @Test
    void consumeRejectsDifferentAction() {
        ConfirmationService service = service(Clock.fixed(NOW, ZoneOffset.UTC));
        ConfirmationChallenge challenge = service.prepare(actor(), ACTION, RESOURCE);

        assertThatThrownBy(() -> service.consume(actor(), challenge.token(), "order.cancel", RESOURCE))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("ADMIN_CONFIRMATION_SCOPE_MISMATCH"));
    }

    @Test
    void consumeRejectsDifferentResource() {
        ConfirmationService service = service(Clock.fixed(NOW, ZoneOffset.UTC));
        ConfirmationChallenge challenge = service.prepare(actor(), ACTION, RESOURCE);

        assertThatThrownBy(() -> service.consume(actor(), challenge.token(), ACTION, "order-2"))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("ADMIN_CONFIRMATION_SCOPE_MISMATCH"));
    }

    // --- consume: expiry boundary ---

    @Test
    void confirmationIsAcceptedJustBeforeExpiry() {
        MutableClock clock = new MutableClock(NOW);
        ConfirmationService service = service(clock);
        ConfirmationChallenge challenge = service.prepare(actor(), ACTION, RESOURCE);

        clock.advance(TTL.minusMillis(1));

        assertThat(service.consume(actor(), challenge.token(), ACTION, RESOURCE))
                .isEqualTo(challenge.decisionId());
    }

    @Test
    void confirmationIsRejectedAtExactExpiry() {
        MutableClock clock = new MutableClock(NOW);
        ConfirmationService service = service(clock);
        ConfirmationChallenge challenge = service.prepare(actor(), ACTION, RESOURCE);

        clock.advance(TTL); // clock.instant() == expiresAt -> isBefore() is false

        assertThatThrownBy(() -> service.consume(actor(), challenge.token(), ACTION, RESOURCE))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("ADMIN_CONFIRMATION_EXPIRED"));
    }

    @Test
    void expiredConfirmationIsPurgedSoItCannotBeReplayed() {
        MutableClock clock = new MutableClock(NOW);
        ConfirmationService service = service(clock);
        ConfirmationChallenge challenge = service.prepare(actor(), ACTION, RESOURCE);

        clock.advance(TTL.plusSeconds(1));
        assertThatThrownBy(() -> service.consume(actor(), challenge.token(), ACTION, RESOURCE))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("ADMIN_CONFIRMATION_EXPIRED"));

        // 时间回拨后仍不可用：过期条目已被移除，而不是"暂时不可用"
        clock.advance(TTL.negated());
        assertThatThrownBy(() -> service.consume(actor(), challenge.token(), ACTION, RESOURCE))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("ADMIN_CONFIRMATION_INVALID"));
    }

    @Test
    void challengesIssuedForDifferentResourcesAreIndependent() {
        ConfirmationService service = service(Clock.fixed(NOW, ZoneOffset.UTC));
        ConfirmationChallenge first = service.prepare(actor(), ACTION, "order-1");
        ConfirmationChallenge second = service.prepare(actor(), ACTION, "order-2");

        assertThat(first.token()).isNotEqualTo(second.token());
        assertThat(service.consume(actor(), first.token(), ACTION, "order-1"))
                .isEqualTo(first.decisionId());
        assertThat(service.consume(actor(), second.token(), ACTION, "order-2"))
                .isEqualTo(second.decisionId());
    }

    /** Minimal mutable clock so expiry boundaries can be exercised deterministically. */
    private static final class MutableClock extends Clock {
        private Instant current;

        MutableClock(Instant start) {
            this.current = start;
        }

        void advance(Duration amount) {
            current = current.plus(amount);
        }

        @Override
        public Instant instant() {
            return current;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }
    }
}
