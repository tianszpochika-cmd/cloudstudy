package com.englishflow.modules.social.b4;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Server-owned protocol primitives for the social WebSocket adapter.
 *
 * <p>The project does not yet depend on a WebSocket transport starter. This
 * class therefore keeps the transport-neutral state machine and envelope in
 * the domain layer so a later STOMP/native adapter cannot invent its own
 * sequencing, replay, or heartbeat rules.</p>
 */
public final class B4SocialProtocol {
    public static final String PATH = "/api/v1/social/ws";
    public static final String SUBPROTOCOL = "yuxuexing.social.v1.json";
    public static final int HEARTBEAT_SECONDS = 25;
    public static final int PONG_TIMEOUT_SECONDS = 10;
    public static final int LEASE_RENEW_SECONDS = 30;
    public static final int RESUME_WINDOW_SECONDS = 300;
    public static final int MAX_SUBSCRIPTIONS = 3;
    public static final int MAX_FRAME_BYTES = 64 * 1024;

    public static final int CLOSE_AUTH_EXPIRED = 4001;
    public static final int CLOSE_FORBIDDEN = 4003;
    public static final int CLOSE_RATE_LIMITED = 4008;
    public static final int CLOSE_SERVER_SHUTDOWN = 4010;
    public static final int CLOSE_RESUME_NOT_POSSIBLE = 4011;

    private B4SocialProtocol() {}

    /** Backwards-compatible event helper used by existing B4 code. */
    public static Map<String, Object> envelope(String eventType, String eventId, String roomId,
                                                long seq, Map<String, Object> payload) {
        return eventEnvelope(eventType, eventId, "req_social", roomId, seq, payload, Instant.now());
    }

    public static Map<String, Object> eventEnvelope(String eventType, String eventId, String requestId,
                                                     String roomId, long seq, Map<String, Object> payload,
                                                     Instant occurredAt) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("kind", "EVENT");
        result.put("eventType", eventType);
        result.put("schema", "social.event.v1");
        result.put("version", 1);
        result.put("eventId", eventId);
        result.put("requestId", requestId);
        result.put("occurredAt", occurredAt.toString());
        if (roomId != null) result.put("roomId", roomId);
        if (seq >= 0) result.put("seq", seq);
        result.put("payload", payload == null ? Map.of() : payload);
        return result;
    }

    public static Map<String, Object> commandAck(String eventType, String commandEventId,
                                                  String requestId, Map<String, Object> payload) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("kind", "ACK");
        result.put("eventType", eventType);
        result.put("schema", "social.ws.ack");
        result.put("version", 1);
        result.put("commandEventId", commandEventId);
        result.put("requestId", requestId);
        result.put("occurredAt", Instant.now().toString());
        result.put("payload", payload == null ? Map.of() : payload);
        return result;
    }

    public static void requireMonotonicSequence(long previous, long next) {
        if (next <= previous) throw new IllegalArgumentException("social event sequence must increase");
    }

    /** Mutable only inside the social service; transport adapters receive views. */
    public static final class ConnectionState {
        private final String connectionId;
        private final long userId;
        private final String deviceId;
        private final Instant acceptedAt;
        private final Map<String, Subscription> subscriptions = new LinkedHashMap<>();
        private Instant lastPongAt;
        private String pendingPingId;
        private Instant pendingPingDeadline;
        private int missedPongs;
        private boolean closed;

        public ConnectionState(long userId, String deviceId, Instant acceptedAt) {
            this.connectionId = "CONN-" + UUID.randomUUID();
            this.userId = userId;
            this.deviceId = deviceId == null || deviceId.isBlank() ? "device-unknown" : deviceId;
            this.acceptedAt = acceptedAt;
            this.lastPongAt = acceptedAt;
        }

        public String connectionId() { return connectionId; }
        public long userId() { return userId; }
        public String deviceId() { return deviceId; }
        public Instant acceptedAt() { return acceptedAt; }
        public Instant lastPongAt() { return lastPongAt; }
        public String pendingPingId() { return pendingPingId; }
        public Instant pendingPingDeadline() { return pendingPingDeadline; }
        public int missedPongs() { return missedPongs; }
        public boolean closed() { return closed; }
        public Set<String> subscribedRooms() { return Set.copyOf(new LinkedHashSet<>(subscriptions.keySet())); }

        public boolean subscribe(String roomId, long lastSeenSeq, long snapshotVersion) {
            if (subscriptions.containsKey(roomId)) {
                subscriptions.put(roomId, new Subscription(roomId, lastSeenSeq, snapshotVersion));
                return true;
            }
            if (subscriptions.size() >= MAX_SUBSCRIPTIONS) return false;
            subscriptions.put(roomId, new Subscription(roomId, lastSeenSeq, snapshotVersion));
            return true;
        }

        public void unsubscribe(String roomId) { subscriptions.remove(roomId); }
        public Subscription subscription(String roomId) { return subscriptions.get(roomId); }

        public Map<String, Object> issuePing(Instant now) {
            if (closed) return Map.of("closed", true);
            if (pendingPingDeadline != null && !pendingPingDeadline.isAfter(now)) missedPongs++;
            pendingPingId = "PING-" + UUID.randomUUID();
            pendingPingDeadline = now.plusSeconds(PONG_TIMEOUT_SECONDS);
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("pingId", pendingPingId);
            payload.put("deadlineAt", pendingPingDeadline.toString());
            return B4SocialProtocol.eventEnvelope("server.ping.v1", pendingPingId, "req_ws_heartbeat",
                    null, -1, payload, now);
        }

        public boolean acceptPong(String pingId, Instant now) {
            if (closed || pingId == null || !pingId.equals(pendingPingId)) return false;
            lastPongAt = now;
            pendingPingId = null;
            pendingPingDeadline = null;
            missedPongs = 0;
            return true;
        }

        public boolean shouldClose(Instant now) {
            return !closed && pendingPingDeadline != null
                    && !pendingPingDeadline.isAfter(now) && missedPongs >= 3;
        }

        public void close() {
            closed = true;
            subscriptions.clear();
        }

        public record Subscription(String roomId, long lastSeenSeq, long snapshotVersion) {}
    }
}
