package com.englishflow.modules.social.b4;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import com.englishflow.modules.b4.B4Exception;
import com.englishflow.modules.b4.InMemoryB4DurableRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;

class B4SocialServiceTest {
    private static final long HOST_USER = 101L;
    private static final long MEMBER_USER = 102L;
    private static final String ROOM_ID = "ROOM-001";

    private MutableClock clock;
    private B4SocialService service;

    @BeforeEach
    void setUp() {
        clock = new MutableClock(Instant.parse("2026-08-22T00:00:00Z"));
        service = new B4SocialService(clock, new InMemoryB4DurableRepository());
    }

    @Test
    void joiningIsIdempotentAndRoomCapacityIsEnforced() {
        Map<String, Object> first = service.joinRoom(HOST_USER, ROOM_ID, Map.of("seatPreference", 1), "join-host-001");
        Map<String, Object> replay = service.joinRoom(HOST_USER, ROOM_ID, Map.of("seatPreference", 1), "join-host-001");

        assertSame(first, replay);
        assertEquals(Boolean.FALSE, data(first).get("alreadyMember"));
        assertEquals(1, ((Number) ((Map<?, ?>) data(first).get("seat")).get("seatIndex")).intValue());

        join(MEMBER_USER, "join-member-001");
        for (long userId = 103L; userId <= 125L; userId++) {
            join(userId, "join-user-" + userId);
        }

        Map<?, ?> room = (Map<?, ?>) data(service.room(HOST_USER, ROOM_ID)).get("room");
        assertEquals(25, room.get("memberCount"));
        assertEquals(25, room.get("occupiedCount"));

        B4Exception full = assertCode("SOC_ROOM_FULL",
                () -> service.joinRoom(126L, ROOM_ID, Map.of(), "join-user-126"));
        assertTrue(full.retryable());

        B4Exception reusedKey = assertCode("IDEMPOTENCY_KEY_REUSED",
                () -> service.joinRoom(HOST_USER, ROOM_ID, Map.of("seatPreference", 2), "join-host-001"));
        assertEquals(409, reusedKey.status());
    }

    @Test
    void focusPauseResumeCompleteUsesServerDurationAndIgnoresPausedTime() {
        join(HOST_USER, "focus-join-001");
        Map<String, Object> started = service.startFocus(HOST_USER, ROOM_ID,
                Map.of("durationMinutes", 25), "focus-start-001");
        String sessionId = String.valueOf(session(started).get("sessionId"));

        clock.advanceSeconds(90);
        Map<String, Object> heartbeat = service.updateFocus(HOST_USER, sessionId,
                Map.of("action", "HEARTBEAT"), "focus-heartbeat-001");
        assertEquals(90L, data(heartbeat).get("serverDurationSeconds"));

        Map<String, Object> paused = service.updateFocus(HOST_USER, sessionId,
                Map.of("action", "PAUSE"), "focus-pause-001");
        assertEquals("PAUSED", session(paused).get("state"));

        clock.advanceSeconds(60);
        Map<String, Object> resumed = service.updateFocus(HOST_USER, sessionId,
                Map.of("action", "RESUME"), "focus-resume-001");
        assertEquals("RUNNING", session(resumed).get("state"));

        clock.advanceSeconds(30);
        Map<String, Object> completed = service.updateFocus(HOST_USER, sessionId,
                Map.of("action", "COMPLETE"), "focus-complete-001");
        assertEquals("COMPLETED", session(completed).get("state"));
        assertEquals(120L, data(completed).get("serverDurationSeconds"));
        assertEquals(0L, data(completed).get("qualifiedSeconds"));
    }

    @Test
    void presetInteractionsRejectFreeTextAndAllowPublishedPreset() {
        join(HOST_USER, "interaction-host-001");
        join(MEMBER_USER, "interaction-member-001");

        B4Exception freeText = assertCode("SOC_TEXT_NOT_ALLOWED", () -> service.interactions(
                MEMBER_USER, ROOM_ID,
                Map.of("interactionCode", "CHEER_UP", "targetUserId", HOST_USER, "message", "加油"),
                "interaction-free-text-001"));
        assertEquals(422, freeText.status());

        Map<String, Object> accepted = service.interactions(HOST_USER, ROOM_ID,
                Map.of("interactionCode", "CHEER_UP", "targetUserId", MEMBER_USER,
                        "clientEventId", "preset-event-001"),
                "interaction-preset-001");
        assertEquals(Boolean.TRUE, data(accepted).get("accepted"));
        assertEquals("CHEER_UP", data(accepted).get("interactionCode"));
    }

    @Test
    void websocketHeartbeatAndRoomEventSequencesAreMonotonic() {
        join(HOST_USER, "ws-join-001");
        Map<String, Object> ticketResponse = service.issueWsTicket(HOST_USER,
                Map.of("roomId", ROOM_ID, "deviceId", "device-001"), "ws-ticket-001");
        String ticket = String.valueOf(data(ticketResponse).get("wsTicket"));
        Map<String, Object> connectionResponse = service.openWsConnection(ticket, HOST_USER, "device-001");
        String connectionId = String.valueOf(data(connectionResponse).get("connectionId"));

        Map<String, Object> subscription = service.subscribeWs(connectionId, ROOM_ID, 0, 0);
        List<Map<String, Object>> initialEvents = maps(data(subscription).get("events"));
        assertFalse(initialEvents.isEmpty());
        assertStrictlyIncreasing(initialEvents);
        long lastSeen = sequence(initialEvents.get(initialEvents.size() - 1));

        join(MEMBER_USER, "ws-join-member-001");
        Map<String, Object> resumed = service.subscribeWs(connectionId, ROOM_ID, lastSeen, 0);
        List<Map<String, Object>> resumedEvents = maps(data(resumed).get("events"));
        assertFalse(resumedEvents.isEmpty());
        assertStrictlyIncreasing(resumedEvents);
        assertTrue(resumedEvents.stream().allMatch(event -> sequence(event) > lastSeen));

        Map<String, Object> ping = service.serverPing(connectionId);
        String pingId = String.valueOf(((Map<?, ?>) ping.get("payload")).get("pingId"));
        Map<String, Object> pongAck = service.clientPong(connectionId, pingId);
        assertEquals("ACK", pongAck.get("kind"));
        assertEquals(Boolean.TRUE, ((Map<?, ?>) pongAck.get("payload")).get("accepted"));

        service.heartbeatSweep();
        Map<String, Object> lastSweep = Map.of();
        for (int missed = 0; missed < 3; missed++) {
            clock.advanceSeconds(B4SocialProtocol.PONG_TIMEOUT_SECONDS + 1L);
            lastSweep = service.heartbeatSweep();
        }
        assertTrue(((List<?>) data(lastSweep).get("closedConnectionIds")).contains(connectionId));
        assertCode("SOC_WS_CONNECTION_INVALID", () -> service.serverPing(connectionId));
    }

    @Test
    void reportAppealAndMuteEnforceActorPermissions() {
        join(HOST_USER, "moderation-host-001");
        join(MEMBER_USER, "moderation-member-001");

        Map<String, Object> report = service.report(MEMBER_USER,
                Map.of("reasonCode", "SPAM", "targetUserId", HOST_USER, "roomId", ROOM_ID),
                "moderation-report-001");
        Map<String, Object> reportData = data(report);
        assertEquals("RECEIVED", reportData.get("status"));
        String reportId = String.valueOf(reportData.get("reportId"));

        assertCode("SOC_MODERATION_FORBIDDEN", () -> service.appealModeration(999L, reportId,
                Map.of("appealCode", "CONTEXT"), "moderation-appeal-forbidden-001"));

        Map<String, Object> appeal = service.appealModeration(HOST_USER, reportId,
                Map.of("appealCode", "CONTEXT"), "moderation-appeal-host-001");
        assertEquals("APPEALED", data(appeal).get("status"));
        assertEquals(Boolean.TRUE, data(appeal).get("recorded"));

        Map<String, Object> mute = service.mute(HOST_USER, ROOM_ID,
                Map.of("targetUserId", MEMBER_USER, "durationSeconds", 60), "moderation-mute-host-001");
        assertEquals(Boolean.TRUE, data(mute).get("muted"));
        assertEquals(MEMBER_USER, data(mute).get("targetUserId"));

        assertCode("SOC_ROOM_HOST_REQUIRED", () -> service.mute(MEMBER_USER, ROOM_ID,
                Map.of("targetUserId", HOST_USER, "durationSeconds", 60), "moderation-mute-member-001"));
        assertCode("SOC_MEMBER_MUTED", () -> service.interactions(MEMBER_USER, ROOM_ID,
                Map.of("interactionCode", "CHEER_UP", "targetUserId", HOST_USER),
                "moderation-interaction-muted-001"));
    }

    private void join(long userId, String key) {
        service.joinRoom(userId, ROOM_ID, Map.of(), key);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(Map<String, Object> envelope) {
        return (Map<String, Object>) envelope.get("data");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> session(Map<String, Object> envelope) {
        return (Map<String, Object>) data(envelope).get("session");
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> maps(Object value) {
        return (List<Map<String, Object>>) value;
    }

    private static long sequence(Map<String, Object> event) {
        return ((Number) event.get("seq")).longValue();
    }

    private static void assertStrictlyIncreasing(List<Map<String, Object>> events) {
        long previous = 0;
        for (Map<String, Object> event : events) {
            long current = sequence(event);
            assertTrue(current > previous, "event sequence must increase");
            previous = current;
        }
    }

    private static B4Exception assertCode(String expectedCode, Executable executable) {
        B4Exception exception = assertThrows(B4Exception.class, executable);
        assertEquals(expectedCode, exception.code());
        assertNotNull(exception.getMessage());
        return exception;
    }

    private static final class MutableClock extends Clock {
        private Instant current;
        private final ZoneId zone;

        private MutableClock(Instant current) {
            this(current, ZoneOffset.UTC);
        }

        private MutableClock(Instant current, ZoneId zone) {
            this.current = current;
            this.zone = zone;
        }

        @Override
        public ZoneId getZone() {
            return zone;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return new MutableClock(current, zone);
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
