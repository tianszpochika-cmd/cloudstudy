package com.englishflow.social;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.englishflow.social.domain.SocialException;
import com.englishflow.social.domain.SocialService;
import com.englishflow.social.domain.TrustedSocialEvent;
import com.englishflow.social.security.SocialPep;
import com.englishflow.social.security.SocialPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SocialServiceSmokeTest {

    private static final String ROOM_ID = "ROOM-001";
    private static final Instant START = Instant.parse("2026-08-22T00:00:00Z");

    private MutableClock clock;
    private SocialService service;
    private SocialPrincipal alice;
    private SocialPrincipal bob;

    @BeforeEach
    void setUp() {
        clock = new MutableClock(START);
        service = new SocialService(clock);
        alice = SocialPrincipal.phaseOne("user-alice");
        bob = SocialPrincipal.phaseOne("user-bob");
    }

    @Test
    void tenantAndOwnerFactsAreServerSideAndPermissionDenialIsNotAnEmptyList() {
        SocialPrincipal otherTenant = SocialPrincipal.phaseOne("user-alice", "tenant-other", alice.permissions());
        SocialException tenant = assertThrows(SocialException.class,
                () -> service.join(otherTenant, ROOM_ID, Map.of(), "tenant-join-001"));
        assertEquals("SOCIAL_TENANT_FORBIDDEN", tenant.code());
        assertEquals(403, tenant.status());

        SocialPrincipal readOnly = SocialPrincipal.phaseOne("user-read-only", "platform",
                Set.of(SocialPep.ROOM_READ));
        SocialException permission = assertThrows(SocialException.class,
                () -> service.join(readOnly, ROOM_ID, Map.of(), "permission-join-001"));
        assertEquals("SOCIAL_PERMISSION_DENIED", permission.code());
        assertEquals(403, permission.status());

        SocialPrincipal owner = new SocialPrincipal("room-owner-001", "platform", "phase-1", true, true, false,
                Set.of("social.room.manage"), Set.of());
        Map<String, Object> closed = service.transitionRoomState(owner, ROOM_ID,
                Map.of("action", "CLOSE"), "room-close-001");
        assertEquals("CLOSED", closed.get("state"));
        SocialException fullState = assertThrows(SocialException.class,
                () -> service.transitionRoomState(owner, ROOM_ID, Map.of("action", "CLOSE"), "room-close-002"));
        assertEquals("SOC_ROOM_STATE_CONFLICT", fullState.code());
    }

    @Test
    void disconnectRecoveryUsesOriginalLeaseAndExpiryReleasesSeat() {
        Map<String, Object> joined = service.join(alice, ROOM_ID, Map.of("preferredSeatIndex", 1), "join-lease-001");
        Map<String, Object> disconnected = service.disconnect(alice, ROOM_ID, Map.of(), "disconnect-001");
        assertEquals("DISCONNECTED", disconnected.get("state"));

        clock.advanceSeconds(30);
        Map<String, Object> recovered = service.recover(alice, ROOM_ID,
                Map.of("leaseId", joined.get("leaseId"), "leaseVersion", joined.get("leaseVersion")), "recover-001");
        assertEquals(Boolean.TRUE, recovered.get("recovered"));
        assertEquals("OCCUPIED", ((Map<?, ?>) recovered.get("seat")).get("status"));

        service.disconnect(alice, ROOM_ID, Map.of(), "disconnect-002");
        clock.advanceSeconds(61);
        Map<String, Object> sweep = service.expireLeases();
        assertEquals(1, sweep.get("releasedSeats"));
        SocialException expired = assertThrows(SocialException.class,
                () -> service.recover(alice, ROOM_ID, Map.of(), "recover-expired-001"));
        assertEquals("SOC_SEAT_LEASE_EXPIRED", expired.code());
        assertEquals(409, expired.status());
    }

    @Test
    void presetInteractionRejectsFreeTextAndAcceptsOnlyPublishedCode() {
        service.join(alice, ROOM_ID, Map.of(), "join-interaction-alice");
        service.join(bob, ROOM_ID, Map.of(), "join-interaction-bob");

        SocialException freeText = assertThrows(SocialException.class, () -> service.interaction(alice, ROOM_ID,
                Map.of("presetCode", "CHEER_UP", "targetSeatIndex", 2,
                        "clientEventId", "interaction-free-text", "text", "加油"),
                "interaction-free-text-key"));
        assertEquals("SOC_TEXT_NOT_ALLOWED", freeText.code());
        assertEquals(422, freeText.status());

        Map<String, Object> accepted = service.interaction(alice, ROOM_ID,
                Map.of("presetCode", "CHEER_UP", "targetSeatIndex", 2,
                        "clientEventId", "interaction-valid-001"), "interaction-valid-key");
        assertEquals("CHEER_UP", accepted.get("presetCode"));
        assertEquals("DELIVERED", accepted.get("state"));

        SocialException clientFact = assertThrows(SocialException.class, () -> service.interaction(alice, ROOM_ID,
                Map.of("presetCode", "CHEER_UP", "targetSeatIndex", 2,
                        "clientEventId", "interaction-user-id", "userId", "user-bob"),
                "interaction-user-id-key"));
        assertEquals("UNTRUSTED_CLIENT_FACTS", clientFact.code());
        assertEquals(403, clientFact.status());
    }

    @Test
    void reportIsIdempotentAndModerationFollowsStateMachine() {
        service.join(alice, ROOM_ID, Map.of(), "join-report-alice");
        service.join(bob, ROOM_ID, Map.of(), "join-report-bob");
        Map<String, Object> request = Map.of("targetSeatIndex", 2, "reasonCode", "SPAM",
                "clientEventId", "report-client-001");
        Map<String, Object> first = service.report(alice, ROOM_ID, request, "report-key-001");
        Map<String, Object> replay = service.report(alice, ROOM_ID, request, "report-key-001");
        assertEquals(first.get("reportId"), replay.get("reportId"));
        assertEquals("RECEIVED", first.get("status"));

        SocialException reused = assertThrows(SocialException.class, () -> service.report(alice, ROOM_ID,
                Map.of("targetSeatIndex", 2, "reasonCode", "HARASSMENT", "clientEventId", "report-client-002"),
                "report-key-001"));
        assertEquals("IDEMPOTENCY_KEY_REUSED", reused.code());

        SocialException targetCannotRead = assertThrows(SocialException.class,
                () -> service.getReport(bob, String.valueOf(first.get("reportId"))));
        assertEquals("SOC_REPORT_OWNER_FORBIDDEN", targetCannotRead.code());
        assertEquals(403, targetCannotRead.status());

        SocialPrincipal reviewer = new SocialPrincipal("moderator-1", "platform", "phase-1", true, true, false,
                Set.of(SocialPep.MODERATION_REVIEW, SocialPep.REPORT_READ), Set.of("MODERATOR"));
        String reportId = String.valueOf(first.get("reportId"));
        assertEquals("TRIAGED", service.moderate(reviewer, reportId, Map.of("action", "TRIAGE"), "mod-1").get("status"));
        assertEquals("IN_REVIEW", service.moderate(reviewer, reportId, Map.of("action", "START_REVIEW"), "mod-2").get("status"));
        assertEquals("ACTIONED", service.moderate(reviewer, reportId, Map.of("action", "ACTION"), "mod-3").get("status"));
        assertEquals("CLOSED", service.moderate(reviewer, reportId, Map.of("action", "CLOSE"), "mod-4").get("status"));

        SocialException invalidTransition = assertThrows(SocialException.class,
                () -> service.moderate(reviewer, reportId, Map.of("action", "ACTION"), "mod-5"));
        assertEquals("SOC_MODERATION_STATE_CONFLICT", invalidTransition.code());
    }

    @Test
    void focusPresenceAndEmptyRoomStateAreServerClocked() {
        service.join(alice, ROOM_ID, Map.of(), "join-focus-001");
        Map<String, Object> focus = service.startFocus(alice, ROOM_ID,
                Map.of("durationMinutes", 25, "focusTagCode", "VOCABULARY", "clientEventId", "focus-001"),
                "focus-start-001");
        String focusId = String.valueOf(focus.get("focusId"));
        clock.advanceSeconds(90);
        Map<String, Object> paused = service.updateFocus(alice, focusId,
                Map.of("action", "PAUSE"), "focus-pause-001");
        assertEquals("PAUSED", paused.get("state"));
        clock.advanceSeconds(90);
        Map<String, Object> resumed = service.updateFocus(alice, focusId,
                Map.of("action", "RESUME"), "focus-resume-001");
        assertEquals("RUNNING", resumed.get("state"));
        clock.advanceSeconds(30);
        Map<String, Object> completed = service.updateFocus(alice, focusId,
                Map.of("action", "FINISH"), "focus-finish-001");
        assertEquals("COMPLETED", completed.get("state"));
        assertEquals(120L, completed.get("qualifiedSeconds"));

        Map<String, Object> left = service.leave(alice, ROOM_ID, Map.of(), "leave-empty-001");
        assertEquals(Boolean.TRUE, left.get("emptyRoom"));
        Map<String, Object> roomList = service.listRooms(alice, 20);
        Map<?, ?> roomSummary = (Map<?, ?>) ((List<?>) roomList.get("items")).stream()
                .filter(item -> ROOM_ID.equals(((Map<?, ?>) item).get("roomId"))).findFirst().orElseThrow();
        assertEquals(Boolean.TRUE, roomSummary.get("empty"));
    }

    @Test
    void leaderboardConsumesTrustedLearningEventsOnceAndRedactsOptOut() {
        SocialPrincipal learningService = SocialPrincipal.servicePrincipal("learning-service", "platform",
                Set.of(SocialPep.EVENTS_CONSUME));
        TrustedSocialEvent event = new TrustedSocialEvent(
                "learning-event-001", "trace-001", "learning.events.v1", "learning.focus.qualified.v1",
                "learning-service", "user-alice", "platform", START,
                Map.of("qualifiedMinutes", 20, "sourceSessionId", "source-focus-001"));

        Map<String, Object> first = service.consumeTrustedEvent(learningService, event);
        Map<String, Object> duplicate = service.consumeTrustedEvent(learningService, event);
        assertEquals("ACCEPTED", first.get("status"));
        assertEquals("DUPLICATE", duplicate.get("status"));

        Map<String, Object> leaderboard = service.leaderboard(alice, "FOCUS_MINUTES", "DAY", null);
        assertEquals("PROVISIONAL", leaderboard.get("projectionState"));
        assertEquals(Boolean.TRUE, leaderboard.get("delayed"));
        List<?> entries = (List<?>) leaderboard.get("entries");
        assertEquals(1, entries.size());
        assertEquals(20L, ((Map<?, ?>) entries.get(0)).get("score"));

        Map<String, Object> hidden = service.setVisibility(alice,
                Map.of("leaderboardVisibility", "OPT_OUT"), "visibility-001");
        assertEquals("OPT_OUT", hidden.get("leaderboardVisibility"));
        Map<String, Object> redacted = service.leaderboard(alice, "FOCUS_MINUTES", "DAY", null);
        assertTrue(((List<?>) redacted.get("entries")).isEmpty());
        assertEquals(Boolean.TRUE, ((Map<?, ?>) redacted.get("me")).get("present"));
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
