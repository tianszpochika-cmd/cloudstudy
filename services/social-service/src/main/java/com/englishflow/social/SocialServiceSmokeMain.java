package com.englishflow.social;

import com.englishflow.social.domain.SocialException;
import com.englishflow.social.domain.SocialService;
import com.englishflow.social.domain.TrustedSocialEvent;
import com.englishflow.social.security.SocialPep;
import com.englishflow.social.security.SocialPrincipal;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Set;

/** Runnable B12-SOC-002 smoke for the service domain seam. */
public final class SocialServiceSmokeMain {

    private static final String ROOM_ID = "ROOM-001";
    private static final Instant START = Instant.parse("2026-08-22T00:00:00Z");

    private SocialServiceSmokeMain() {
    }

    public static void main(String[] args) {
        MutableClock clock = new MutableClock(START);
        SocialService service = new SocialService(clock);
        SocialPrincipal alice = SocialPrincipal.phaseOne("user-alice");
        SocialPrincipal bob = SocialPrincipal.phaseOne("user-bob");

        Map<String, Object> aliceJoin = service.join(alice, ROOM_ID,
                Map.of("preferredSeatIndex", 1), "smoke-join-alice");
        Map<String, Object> bobJoin = service.join(bob, ROOM_ID,
                Map.of("preferredSeatIndex", 2), "smoke-join-bob");
        check("OCCUPIED".equals(((Map<?, ?>) aliceJoin.get("seat")).get("status")), "alice join state");
        check("OCCUPIED".equals(((Map<?, ?>) bobJoin.get("seat")).get("status")), "bob join state");

        service.disconnect(alice, ROOM_ID, Map.of(), "smoke-disconnect");
        clock.advanceSeconds(30);
        Map<String, Object> recovered = service.recover(alice, ROOM_ID,
                Map.of("leaseId", aliceJoin.get("leaseId"), "leaseVersion", aliceJoin.get("leaseVersion")),
                "smoke-recover");
        check(Boolean.TRUE.equals(recovered.get("recovered")), "lease recovery");

        expect("SOC_TEXT_NOT_ALLOWED", () -> service.interaction(alice, ROOM_ID,
                Map.of("presetCode", "CHEER_UP", "targetSeatIndex", 2,
                        "clientEventId", "smoke-text", "message", "hello"), "smoke-text-key"));

        Map<String, Object> report = service.report(alice, ROOM_ID,
                Map.of("targetSeatIndex", 2, "reasonCode", "SPAM", "clientEventId", "smoke-report"),
                "smoke-report-key");
        Map<String, Object> replay = service.report(alice, ROOM_ID,
                Map.of("targetSeatIndex", 2, "reasonCode", "SPAM", "clientEventId", "smoke-report"),
                "smoke-report-key");
        check(String.valueOf(report.get("reportId")).equals(String.valueOf(replay.get("reportId"))),
                "report idempotency");

        SocialPrincipal workload = SocialPrincipal.servicePrincipal("learning-service", "platform",
                Set.of(SocialPep.EVENTS_CONSUME));
        TrustedSocialEvent event = new TrustedSocialEvent(
                "learning-event-smoke", "trace-smoke", "learning.events.v1",
                "learning.focus.qualified.v1", "learning-service", "user-alice", "platform", START,
                Map.of("qualifiedMinutes", 20, "sourceSessionId", "focus-smoke"));
        Map<String, Object> projected = service.consumeTrustedEvent(workload, event);
        Map<String, Object> duplicate = service.consumeTrustedEvent(workload, event);
        check("ACCEPTED".equals(projected.get("status")), "trusted event projection");
        check("DUPLICATE".equals(duplicate.get("status")), "trusted event dedupe");

        Map<String, Object> leaderboard = service.leaderboard(alice, "FOCUS_MINUTES", "DAY", null);
        check(Boolean.TRUE.equals(leaderboard.get("delayed")), "leaderboard delay is explicit");
        check(((java.util.List<?>) leaderboard.get("entries")).size() == 1, "leaderboard projection");

        System.out.println("social-service B12-SOC-002 smoke: PASS");
    }

    private static void expect(String expected, Runnable action) {
        try {
            action.run();
        } catch (SocialException exception) {
            check(expected.equals(exception.code()), "expected " + expected + ", got " + exception.code());
            return;
        }
        throw new AssertionError("expected " + expected);
    }

    private static void check(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    private static final class MutableClock extends Clock {
        private Instant current;

        private MutableClock(Instant current) {
            this.current = current;
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
            return current;
        }

        private void advanceSeconds(long seconds) {
            current = current.plusSeconds(seconds);
        }
    }
}
