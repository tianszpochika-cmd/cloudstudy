package com.englishflow.modules.social.b4;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/** The REST service owns the facts; this class defines the WebSocket boundary used by Web clients. */
public final class B4SocialProtocol {
    public static final String PATH = "/api/v1/social/ws";
    public static final String SUBPROTOCOL = "yuxuexing.social.v1.json";
    public static final int HEARTBEAT_SECONDS = 25;
    public static final int RESUME_WINDOW_SECONDS = 300;

    private B4SocialProtocol() {}

    public static Map<String, Object> envelope(String eventType, String eventId, String roomId, long seq, Map<String, Object> payload) {
        return new LinkedHashMap<>(Map.of("kind", "event", "eventType", eventType, "schema", "social.v1",
                "version", 1, "eventId", eventId, "requestId", "req_social", "occurredAt", Instant.now().toString(),
                "roomId", roomId, "seq", seq, "payload", payload));
    }

    public static void requireMonotonicSequence(long previous, long next) {
        if (next <= previous) throw new IllegalArgumentException("social event sequence must increase");
    }
}
