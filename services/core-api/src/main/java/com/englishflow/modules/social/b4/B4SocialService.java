package com.englishflow.modules.social.b4;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

import com.englishflow.modules.b4.B4DurableRepository;
import com.englishflow.modules.b4.B4Exception;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public final class B4SocialService {
    private static final int ROOM_CAPACITY = 25;
    private static final Set<String> INTERACTION_CODES = Set.of("CHEER_UP", "STUDY_TOGETHER", "CONGRATS", "TRY_AGAIN", "TONIGHT_20_MIN");
    private static final Set<String> MODERATION_REASONS = Set.of("SPAM", "HARASSMENT", "SENSITIVE_CONTENT", "IMPERSONATION", "OTHER");

    private final Clock clock;
    private final B4DurableRepository durableRepository;
    private final Map<String, Room> rooms = new ConcurrentHashMap<>();
    private final Map<String, FocusSession> focusSessions = new ConcurrentHashMap<>();
    private final Map<Long, String> activeFocusByUser = new ConcurrentHashMap<>();
    private final Map<String, Instant> interactionWindow = new ConcurrentHashMap<>();
    private final Map<String, Integer> interactionCounts = new ConcurrentHashMap<>();
    private final Map<String, Instant> wsTickets = new ConcurrentHashMap<>();
    private final Map<Long, List<Map<String, Object>>> notifications = new ConcurrentHashMap<>();
    private final Map<Long, Map<String, Object>> notificationPreferences = new ConcurrentHashMap<>();
    private final Map<String, OfflinePackage> offlinePackages = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> idempotency = new ConcurrentHashMap<>();
    private final Map<String, String> idempotencyFingerprints = new ConcurrentHashMap<>();

    public B4SocialService() {
        this(Clock.systemUTC(), new com.englishflow.modules.b4.InMemoryB4DurableRepository());
    }

    @Autowired
    public B4SocialService(B4DurableRepository durableRepository) { this(Clock.systemUTC(), durableRepository); }

    public B4SocialService(Clock clock, B4DurableRepository durableRepository) {
        this.clock = clock;
        this.durableRepository = durableRepository;
        seedRooms();
    }

    public synchronized Map<String, Object> rooms(long userId, String cursor, int limit) {
        return envelope(map("items", this.rooms.values().stream().limit(safeLimit(limit)).map(room -> room.view(userId)).toList(),
                "nextCursor", null, "hasMore", false, "serverTime", clock.instant().toString()));
    }

    public synchronized Map<String, Object> room(long userId, String roomId) {
        return envelope(map("room", ownedRoom(roomId).view(userId), "protocol", map("path", B4SocialProtocol.PATH, "subprotocol", B4SocialProtocol.SUBPROTOCOL,
                "heartbeatSeconds", B4SocialProtocol.HEARTBEAT_SECONDS, "resumeWindowSeconds", B4SocialProtocol.RESUME_WINDOW_SECONDS)));
    }

    public synchronized Map<String, Object> joinRoom(long userId, String roomId, Map<String, Object> body, String key) {
        requireKey(key);
        return idempotent(userId, "room-join:" + roomId, key, body, () -> {
            Room room = ownedRoom(roomId);
            if (room.members.contains(userId)) return envelope(map("joined", true, "room", room.view(userId), "alreadyMember", true));
            if (room.members.size() >= room.capacity) throw error("SOC_ROOM_FULL", "study room is full", 409, false);
            room.members.add(userId);
            durableRepository.append(new B4DurableRepository.Fact("SOC_ROOM_MEMBER", roomId, userId, requestId(), key, clock.instant(), map("action", "JOIN", "roomId", roomId)));
            return envelope(map("joined", true, "room", room.view(userId), "seatState", "AVAILABLE"));
        });
    }

    public synchronized Map<String, Object> leaveRoom(long userId, String roomId, String key) {
        requireKey(key);
        return idempotent(userId, "room-leave:" + roomId, key, map("roomId", roomId), () -> {
            Room room = ownedRoom(roomId);
            room.members.remove(userId);
            String focusId = activeFocusByUser.remove(userId);
            if (focusId != null) focusSessions.get(focusId).status = "AUTO_RELEASED";
            return envelope(map("left", true, "roomId", roomId));
        });
    }

    public synchronized Map<String, Object> startFocus(long userId, String roomId, Map<String, Object> body, String key) {
        requireKey(key);
        rejectClientFields(body, Set.of("minutes", "score", "rank", "newWords", "durationSeconds", "startedAt"));
        return idempotent(userId, "focus-start:" + roomId, key, body, () -> {
            Room room = ownedRoom(roomId);
            if (!room.members.contains(userId)) throw error("SOC_ROOM_MEMBER_REQUIRED", "join the room before focusing", 403, false);
            if (activeFocusByUser.containsKey(userId)) throw error("SOC_FOCUS_ALREADY_RUNNING", "one focus session is already running", 409, false);
            FocusSession session = new FocusSession("FOCUS-" + UUID.randomUUID(), userId, roomId, clock.instant());
            focusSessions.put(session.id, session); activeFocusByUser.put(userId, session.id);
            return envelope(map("session", session.view(clock.instant())));
        });
    }

    public synchronized Map<String, Object> updateFocus(long userId, String sessionId, Map<String, Object> body, String key) {
        requireKey(key);
        rejectClientFields(body, Set.of("minutes", "score", "rank", "newWords", "durationSeconds", "startedAt", "finishedAt"));
        return idempotent(userId, "focus-update:" + sessionId, key, body, () -> {
            FocusSession session = ownedFocus(userId, sessionId);
            String action = text(body.get("action"), "");
            if ("PAUSE".equals(action) && "RUNNING".equals(session.status)) session.status = "PAUSED";
            else if ("RESUME".equals(action) && "PAUSED".equals(session.status)) session.status = "RUNNING";
            else if (("COMPLETE".equals(action) || "AUTO_RELEASE".equals(action)) && Set.of("RUNNING", "PAUSED").contains(session.status)) {
                session.status = "COMPLETE".equals(action) ? "COMPLETED" : "AUTO_RELEASED";
                activeFocusByUser.remove(userId);
                long seconds = Duration.between(session.startedAt, clock.instant()).toSeconds();
                session.serverDurationSeconds = Math.min(Math.max(seconds, 0), 480 * 60L);
            } else if (!"HEARTBEAT".equals(action)) throw error("SOC_FOCUS_STATE_INVALID", "focus action is not valid for this state", 409, false);
            return envelope(map("session", session.view(clock.instant()), "serverDurationSeconds", session.serverDurationSeconds));
        });
    }

    public synchronized Map<String, Object> interactions(long userId, String roomId, Map<String, Object> body, String key) {
        requireKey(key);
        rejectClientFields(body, Set.of("text", "message", "content", "html", "url", "emoji", "extra"));
        return idempotent(userId, "interaction:" + roomId, key, body, () -> {
            ownedRoom(roomId);
            String code = text(body.get("interactionCode"), "");
            if (!INTERACTION_CODES.contains(code)) throw error("SOC_INTERACTION_NOT_ALLOWED", "only preset interactions are supported", 400, false);
            String windowKey = userId + ":" + roomId;
            Instant now = clock.instant();
            Instant started = interactionWindow.get(windowKey);
            if (started == null || Duration.between(started, now).toSeconds() >= 30) { interactionWindow.put(windowKey, now); interactionCounts.put(windowKey, 0); }
            int count = interactionCounts.getOrDefault(windowKey, 0);
            if (count >= 3) throw error("SOC_INTERACTION_RATE_LIMIT", "too many preset interactions", 429, true);
            interactionCounts.put(windowKey, count + 1);
            return envelope(map("accepted", true, "interactionCode", code, "roomId", roomId, "targetUserId", body.get("targetUserId"), "visibleTo", "ROOM_MEMBERS"));
        });
    }

    public synchronized Map<String, Object> leaderboard(long userId, String roomId) {
        Room room = ownedRoom(roomId);
        List<Map<String, Object>> entries = room.members.stream().sorted().map(member -> map("userId", member, "completedFocusSeconds", focusSeconds(member, roomId), "status", "VALID")).toList();
        return envelope(map("roomId", roomId, "items", entries, "source", "MYSQL_SNAPSHOT", "serverTime", clock.instant().toString()));
    }

    public synchronized Map<String, Object> issueWsTicket(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        return idempotent(userId, "ws-ticket", key, body, () -> {
            String ticket = "WST-" + UUID.randomUUID();
            Instant expiresAt = clock.instant().plusSeconds(60);
            wsTickets.put(ticket, expiresAt);
            return envelope(map("wsTicket", ticket, "expiresAt", expiresAt.toString(), "path", B4SocialProtocol.PATH,
                    "subprotocol", B4SocialProtocol.SUBPROTOCOL, "oneTime", true));
        });
    }

    public synchronized boolean consumeWsTicket(String ticket) {
        Instant expiresAt = wsTickets.remove(ticket);
        return expiresAt != null && expiresAt.isAfter(clock.instant());
    }

    public synchronized Map<String, Object> notifications(long userId, int limit) {
        List<Map<String, Object>> items = notifications.getOrDefault(userId, List.of()).stream().limit(safeLimit(limit)).toList();
        return envelope(map("items", items, "nextCursor", null, "hasMore", false));
    }

    public synchronized Map<String, Object> readNotification(long userId, String messageId, String key) {
        requireKey(key);
        return idempotent(userId, "notification-read:" + messageId, key, map("messageId", messageId), () -> {
            notifications.computeIfAbsent(userId, ignored -> new ArrayList<>()).stream().filter(item -> messageId.equals(item.get("messageId"))).forEach(item -> item.put("read", true));
            return envelope(map("messageId", messageId, "read", true));
        });
    }

    public synchronized Map<String, Object> readAllNotifications(long userId, String key) {
        requireKey(key);
        return idempotent(userId, "notification-read-all", key, map(), () -> {
            notifications.computeIfAbsent(userId, ignored -> new ArrayList<>()).forEach(item -> item.put("read", true));
            return envelope(map("readAll", true));
        });
    }

    public synchronized Map<String, Object> notificationPreferences(long userId) {
        return envelope(map("preferences", notificationPreferences.computeIfAbsent(userId, ignored -> map("roomInteractions", true, "focusReminders", true, "system", true, "doNotDisturb", false, "version", 1))));
    }

    public synchronized Map<String, Object> saveNotificationPreferences(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        return idempotent(userId, "notification-preferences", key, body, () -> {
            Map<String, Object> preferences = notificationPreferences.computeIfAbsent(userId, ignored -> new LinkedHashMap<>());
            for (String field : List.of("roomInteractions", "focusReminders", "system", "doNotDisturb")) if (body.containsKey(field)) preferences.put(field, Boolean.TRUE.equals(body.get(field)));
            preferences.put("version", ((Number) preferences.getOrDefault("version", 0)).intValue() + 1);
            return notificationPreferences(userId);
        });
    }

    public synchronized Map<String, Object> offlinePackages(long userId, int limit) {
        return envelope(map("items", offlinePackages.values().stream().limit(safeLimit(limit)).map(OfflinePackage::view).toList(), "manifestStateMachine", List.of("PUBLISHED", "AUTHORIZED", "DOWNLOADING", "VERIFYING", "ACTIVE_LOCAL", "EXPIRED", "DELETED")));
    }

    public synchronized Map<String, Object> authorizeOfflinePackage(long userId, String packageId, String key) {
        requireKey(key);
        return idempotent(userId, "offline-authorize:" + packageId, key, map("packageId", packageId), () -> {
            OfflinePackage item = offlinePackages.get(packageId);
            if (item == null) throw error("INF_OFFLINE_PACKAGE_NOT_FOUND", "offline package does not exist", 404, false);
            item.state = "AUTHORIZED";
            return envelope(map("package", item.view()));
        });
    }

    public synchronized Map<String, Object> syncChanges(long userId, String cursor, int limit) {
        return envelope(map("items", List.of(), "cursor", cursor == null ? "0" : cursor, "hasMore", false, "serverTime", clock.instant().toString()));
    }

    public synchronized Map<String, Object> pushSync(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        rejectClientFields(body, Set.of("deltaXp", "deltaCoins", "score", "rank", "serverDurationSeconds"));
        return idempotent(userId, "sync-push", key, body, () -> envelope(map("accepted", true, "applied", 1, "conflicts", List.of(), "nextCursor", "1")));
    }

    public synchronized Map<String, Object> checkpoint(long userId, String entityId, Map<String, Object> body, String key) {
        requireKey(key);
        return idempotent(userId, "checkpoint:" + entityId, key, body, () -> envelope(map("entityId", entityId, "serverVersion", 1, "accepted", true)));
    }

    public synchronized Map<String, Object> report(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        rejectClientFields(body, Set.of("text", "message", "content", "html", "url", "emoji"));
        return idempotent(userId, "moderation-report", key, body, () -> {
            if (!MODERATION_REASONS.contains(text(body.get("reasonCode"), ""))) throw error("SOC_MODERATION_REASON_INVALID", "moderation reason is invalid", 400, false);
            return envelope(map("reportId", "REPORT-" + UUID.randomUUID(), "status", "RECEIVED", "reviewMode", "MANUAL"));
        });
    }

    public synchronized Map<String, Object> block(long userId, long targetUserId, String key) {
        requireKey(key);
        return idempotent(userId, "block:" + targetUserId, key, map("targetUserId", targetUserId), () -> envelope(map("blocked", true, "targetUserId", targetUserId)));
    }

    public synchronized Map<String, Object> mute(long userId, String roomId, long targetUserId, String key) {
        requireKey(key);
        ownedRoom(roomId);
        return idempotent(userId, "mute:" + roomId + ":" + targetUserId, key, map("roomId", roomId, "targetUserId", targetUserId), () -> envelope(map("muted", true, "roomId", roomId, "targetUserId", targetUserId, "expiresInSeconds", 3600)));
    }

    private void seedRooms() {
        rooms.putIfAbsent("ROOM-001", new Room("ROOM-001", "晨星自习室", "TEMPLATE_QUIET", ROOM_CAPACITY));
        rooms.putIfAbsent("ROOM-002", new Room("ROOM-002", "晚间专注舱", "TEMPLATE_FOCUS", ROOM_CAPACITY));
        offlinePackages.putIfAbsent("OFFLINE-B4-FOUNDATION", new OfflinePackage("OFFLINE-B4-FOUNDATION"));
    }

    private Room ownedRoom(String roomId) { Room room = rooms.get(roomId); if (room == null) throw error("SOC_ROOM_NOT_FOUND", "study room does not exist", 404, false); return room; }
    private FocusSession ownedFocus(long userId, String id) { FocusSession session = focusSessions.get(id); if (session == null || session.userId != userId) throw error("SOC_FOCUS_NOT_FOUND", "focus session does not exist", 404, false); return session; }
    private long focusSeconds(long userId, String roomId) { return focusSessions.values().stream().filter(session -> session.userId == userId && roomId.equals(session.roomId) && Set.of("COMPLETED", "AUTO_RELEASED").contains(session.status)).mapToLong(session -> session.serverDurationSeconds).sum(); }
    private <T> Map<String, Object> idempotent(long userId, String scope, String key, Map<String, Object> body, Supplier<Map<String, Object>> action) {
        String identity = userId + ":" + scope + ":" + key; String fingerprint = body == null ? "0" : body.toString();
        if (idempotency.containsKey(identity)) { if (!fingerprint.equals(idempotencyFingerprints.get(identity))) throw error("SOC_IDEMPOTENCY_CONFLICT", "Idempotency-Key was reused with a different request", 409, false); return idempotency.get(identity); }
        Map<String, Object> result = action.get(); idempotency.put(identity, result); idempotencyFingerprints.put(identity, fingerprint); return result;
    }
    private void rejectClientFields(Map<String, Object> body, Set<String> fields) { for (String field : fields) if (body.containsKey(field)) throw error("SOC_CLIENT_FIELD_FORBIDDEN", field + " is server-owned", 400, false); }
    private static void requireKey(String key) { if (key == null || key.isBlank() || key.length() < 8 || key.length() > 96) throw error("SOC_IDEMPOTENCY_REQUIRED", "Idempotency-Key must contain 8-96 characters", 400, false); }
    private String requestId() { return "req_social_" + UUID.randomUUID(); }
    private static int safeLimit(int value) { return Math.max(1, Math.min(value <= 0 ? 20 : value, 100)); }
    private static String text(Object value, String fallback) { return value == null ? fallback : String.valueOf(value); }
    private Map<String, Object> envelope(Map<String, Object> data) { return map("requestId", requestId(), "serverTime", clock.instant().toString(), "data", data); }
    private static B4Exception error(String code, String message, int status, boolean retryable) { return new B4Exception(code, message, status, retryable); }
    private static Map<String, Object> map(Object... values) { Map<String, Object> result = new LinkedHashMap<>(); for (int i = 0; i + 1 < values.length; i += 2) if (values[i + 1] != null) result.put(String.valueOf(values[i]), values[i + 1]); return result; }

    private static final class Room {
        final String id; final String name; final String templateCode; final int capacity; final Set<Long> members = new LinkedHashSet<>();
        Room(String id, String name, String templateCode, int capacity) { this.id = id; this.name = name; this.templateCode = templateCode; this.capacity = capacity; }
        Map<String, Object> view(long userId) { return map("roomId", id, "name", name, "templateCode", templateCode, "capacity", capacity, "memberCount", members.size(), "joined", members.contains(userId), "chatMode", "PRESET_ONLY"); }
    }
    private static final class FocusSession {
        final String id; final long userId; final String roomId; final Instant startedAt; String status = "RUNNING"; long serverDurationSeconds;
        FocusSession(String id, long userId, String roomId, Instant startedAt) { this.id = id; this.userId = userId; this.roomId = roomId; this.startedAt = startedAt; }
        Map<String, Object> view(Instant now) { long live = serverDurationSeconds > 0 ? serverDurationSeconds : Duration.between(startedAt, now).toSeconds(); return map("sessionId", id, "roomId", roomId, "status", status, "startedAt", startedAt.toString(), "serverDurationSeconds", Math.min(Math.max(live, 0), 480 * 60L)); }
    }
    private static final class OfflinePackage {
        final String id; String state = "PUBLISHED";
        OfflinePackage(String id) { this.id = id; }
        Map<String, Object> view() { return map("packageId", id, "packageCode", id, "version", "1.0.0", "state", state, "sizeBytes", 1024, "partCount", 1, "sha256", "sha256:b4-offline", "signature", "sig:b4-offline", "minClientVersion", "0.1.0"); }
    }
}
