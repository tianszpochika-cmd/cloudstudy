package com.englishflow.modules.social.b4;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.BitSet;
import java.util.Collection;
import java.util.Comparator;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import java.util.stream.IntStream;

import com.englishflow.modules.b4.B4DurableRepository;
import com.englishflow.modules.b4.B4Exception;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * B4 social, study-room and offline-sync domain service.
 *
 * <p>All mutable facts are decided here.  The maps are projections used by
 * the current transport-neutral implementation; every state-changing path
 * also appends an immutable fact through {@link B4DurableRepository}.  No
 * client-provided duration, score, text, rank, completion flag or hash is
 * accepted as a server fact.</p>
 */
@Service
public final class B4SocialService {
    private static final int ROOM_CAPACITY = 25;
    private static final int LEASE_SECONDS = 90;
    private static final int DISCONNECT_GRACE_SECONDS = 60;
    private static final int IDLE_RELEASE_SECONDS = 5 * 60;
    private static final int MAX_EVENT_JOURNAL = 1000;
    private static final Set<Integer> FOCUS_DURATIONS = Set.of(25, 45);
    private static final Set<String> INTERACTION_CODES = Set.of(
            "CHEER_UP", "STUDY_TOGETHER", "CONGRATS", "TRY_AGAIN", "TONIGHT_20_MIN");
    private static final Set<String> MODERATION_REASONS = Set.of(
            "SPAM", "HARASSMENT", "SENSITIVE_CONTENT", "IMPERSONATION", "OTHER");
    private static final Set<String> APPEAL_CODES = Set.of("FALSE_POSITIVE", "CONTEXT", "OTHER");
    private static final Set<String> SOCIAL_TEXT_FIELDS = Set.of(
            "text", "message", "content", "html", "markdown", "url", "emoji", "extra");
    private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9._:-]{1,160}");
    private static final List<String> DURABLE_TYPES = List.of(
            "SOC_ROOM_MEMBER", "SOC_FOCUS", "SOC_INTERACTION", "SOC_BLOCK", "SOC_MUTE",
            "SOC_MODERATION_REPORT", "SOC_MODERATION_APPEAL", "INF_OFFLINE", "INF_SYNC_EVENT",
            "INF_SYNC_CONFLICT", "INF_SYNC_CHECKPOINT");

    private final Clock clock;
    private final B4DurableRepository durableRepository;
    private final Map<String, Room> rooms = new LinkedHashMap<>();
    private final Map<String, FocusSession> focusSessions = new LinkedHashMap<>();
    private final Map<Long, String> activeFocusByUser = new LinkedHashMap<>();
    private final Map<Long, SeatRef> activeSeatByUser = new LinkedHashMap<>();
    private final Map<String, B4WsTicket> wsTickets = new LinkedHashMap<>();
    private final Map<String, B4SocialProtocol.ConnectionState> wsConnections = new LinkedHashMap<>();
    private final Map<String, Map<String, Object>> idempotency = new LinkedHashMap<>();
    private final Map<String, String> idempotencyFingerprints = new LinkedHashMap<>();
    private final Map<String, Deque<Instant>> interactionThirtySecondWindows = new LinkedHashMap<>();
    private final Map<String, Deque<Instant>> interactionHourlyWindows = new LinkedHashMap<>();
    private final Map<String, Deque<Instant>> interactionTargetWindows = new LinkedHashMap<>();
    private final Map<String, Map<String, Object>> interactionByClientEvent = new LinkedHashMap<>();
    private final Map<Long, Set<Long>> blocksByUser = new LinkedHashMap<>();
    private final Map<String, Mute> mutes = new LinkedHashMap<>();
    private final Map<String, Report> reports = new LinkedHashMap<>();
    private final Map<String, String> reportDedupe = new LinkedHashMap<>();
    private final Map<Long, List<Map<String, Object>>> notifications = new LinkedHashMap<>();
    private final Map<Long, Map<String, Object>> notificationPreferences = new LinkedHashMap<>();
    private final Map<String, OfflinePackage> offlinePackages = new LinkedHashMap<>();
    private final Map<String, OfflineDownload> offlineDownloads = new LinkedHashMap<>();
    private final Map<String, SyncResult> syncResults = new LinkedHashMap<>();
    private final Map<String, String> syncFingerprints = new LinkedHashMap<>();
    private final Map<String, SyncEntity> syncEntities = new LinkedHashMap<>();
    private final Map<Long, List<SyncChange>> syncChanges = new LinkedHashMap<>();
    private final Map<Long, Long> syncSequences = new LinkedHashMap<>();
    private final Map<String, CursorState> cursors = new LinkedHashMap<>();
    private final Set<String> hydratedDurableTypes = new LinkedHashSet<>();

    public B4SocialService() {
        this(Clock.systemUTC(), new com.englishflow.modules.b4.InMemoryB4DurableRepository());
    }

    @Autowired
    public B4SocialService(B4DurableRepository durableRepository) {
        this(Clock.systemUTC(), durableRepository);
    }

    public B4SocialService(Clock clock, B4DurableRepository durableRepository) {
        this.clock = Objects.requireNonNull(clock, "clock");
        this.durableRepository = Objects.requireNonNull(durableRepository, "durableRepository");
        seedRooms();
    }

    public synchronized Map<String, Object> rooms(long userId, String cursor, int limit) {
        hydrateDurableFacts();
        int safeLimit = safeLimit(limit);
        List<Room> all = new ArrayList<>(rooms.values());
        int offset = roomOffset(cursor);
        List<Room> page = all.subList(Math.min(offset, all.size()), Math.min(offset + safeLimit, all.size()));
        boolean hasMore = offset + page.size() < all.size();
        return envelope(map("items", page.stream().map(room -> room.view(userId, false)).toList(),
                "nextCursor", hasMore ? "ROOM-CURSOR-" + (offset + page.size()) : null,
                "hasMore", hasMore, "serverTime", clock.instant().toString()));
    }

    public synchronized Map<String, Object> room(long userId, String roomId) {
        hydrateDurableFacts();
        Room room = ownedRoom(roomId);
        requireActiveMember(room, userId);
        return envelope(map("room", room.view(userId, true), "protocol", protocolView()));
    }

    public synchronized Map<String, Object> joinRoom(long userId, String roomId,
                                                       Map<String, Object> body, String key) {
        hydrateDurableFacts();
        requireKey(key);
        Map<String, Object> safeBody = body == null ? Map.of() : body;
        rejectUnknownFields(safeBody, Set.of("seatPreference"));
        return idempotent(userId, "room-join:" + roomId, key, safeBody, () -> {
            Room room = ownedRoom(roomId);
            Member existing = room.members.get(userId);
            if (existing != null && "ACTIVE".equals(existing.status)) {
                return envelope(map("joined", true, "alreadyMember", true, "room", room.view(userId, true),
                        "membershipId", existing.membershipId, "seat", existing.seatView()));
            }
            SeatRef otherSeat = activeSeatByUser.get(userId);
            if (otherSeat != null && !roomId.equals(otherSeat.roomId)) {
                throw error("SOC_SEAT_UNAVAILABLE", "user already occupies a seat in another room", 409, false);
            }
            int preferredSeat = preferredSeat(safeBody.get("seatPreference"));
            Seat seat = findAvailableSeat(room, preferredSeat);
            if (seat == null) throw error("SOC_ROOM_FULL", "study room is full", 409, true);
            if (room.ownerUserId == 0) room.ownerUserId = userId;
            Member member = new Member("MEM-" + UUID.randomUUID(), userId,
                    userId == room.ownerUserId ? "HOST" : "MEMBER", clock.instant());
            member.status = "ACTIVE";
            member.lastActivityAt = clock.instant();
            room.members.put(userId, member);
            occupySeat(room, seat, userId);
            activeSeatByUser.put(userId, new SeatRef(room.id, seat.seatIndex));
            appendFact("SOC_ROOM_MEMBER", room.id, userId, key, map(
                    "action", "JOIN", "membershipId", member.membershipId, "roleCode", member.roleCode,
                    "seatIndex", seat.seatIndex, "leaseId", seat.leaseId, "leaseVersion", seat.leaseVersion,
                    "leaseExpiresAt", seat.leaseExpiresAt.toString(), "occurredAt", clock.instant().toString()));
            emit(room, "room.member_joined.v1", userId, map(
                    "memberId", member.membershipId, "userId", userId, "roleCode", member.roleCode), key);
            emit(room, "seat.updated.v1", userId, seat.publicView());
            return envelope(map("joined", true, "alreadyMember", false, "membershipId", member.membershipId,
                    "room", room.view(userId, true), "seat", seat.view(), "wsRequired", true));
        });
    }

    public synchronized Map<String, Object> leaveRoom(long userId, String roomId, String key) {
        hydrateDurableFacts();
        requireKey(key);
        return idempotent(userId, "room-leave:" + roomId, key, map("roomId", roomId), () -> {
            Room room = ownedRoom(roomId);
            Member member = room.members.get(userId);
            if (member == null || !"ACTIVE".equals(member.status)) {
                return envelope(map("left", true, "alreadyLeft", true, "roomId", roomId));
            }
            releaseFocusForUser(userId, room, "LEAVE", key);
            Seat seat = memberSeat(room, userId);
            if (seat != null) releaseSeat(room, seat, "USER_LEAVE", key);
            member.status = "LEFT";
            member.leftAt = clock.instant();
            activeSeatByUser.remove(userId);
            appendFact("SOC_ROOM_MEMBER", room.id, userId, key, map(
                    "action", "LEAVE", "membershipId", member.membershipId, "reason", "USER_LEAVE",
                    "seatIndex", seat == null ? null : seat.seatIndex, "occurredAt", clock.instant().toString()));
            emit(room, "room.member_left.v1", userId, map(
                    "memberId", member.membershipId, "userId", userId, "reason", "USER_LEAVE"), key);
            return envelope(map("left", true, "alreadyLeft", false, "roomId", roomId,
                    "releasedAt", clock.instant().toString(), "seatIndex", seat == null ? null : seat.seatIndex,
                    "membershipStatus", member.status));
        });
    }

    public synchronized Map<String, Object> startFocus(long userId, String roomId,
                                                         Map<String, Object> body, String key) {
        hydrateDurableFacts();
        requireKey(key);
        Map<String, Object> safeBody = body == null ? Map.of() : body;
        rejectUnknownFields(safeBody, Set.of("action", "durationMinutes", "focusTagCode", "clientEventId"));
        rejectClientFields(safeBody, Set.of("minutes", "score", "rank", "newWords", "durationSeconds", "startedAt"));
        return idempotent(userId, "focus-start:" + roomId, key, safeBody, () -> {
            Room room = ownedRoom(roomId);
            Member member = requireActiveMember(room, userId);
            Seat seat = requireActiveSeat(room, userId);
            ensureSeatUsable(room, seat, userId);
            if (activeFocusByUser.containsKey(userId)) {
                throw error("SOC_FOCUS_ALREADY_RUNNING", "one focus session is already running", 409, false);
            }
            int duration = intValue(safeBody.getOrDefault("durationMinutes", 25), "durationMinutes");
            if (!FOCUS_DURATIONS.contains(duration)) {
                throw error("SOC_FOCUS_DURATION_INVALID", "durationMinutes must be 25 or 45", 400, false);
            }
            FocusSession session = new FocusSession("FOCUS-" + UUID.randomUUID(), userId, roomId,
                    seat.seatIndex, duration, clock.instant());
            session.focusTagCode = optionalSafeId(safeBody.get("focusTagCode"));
            focusSessions.put(session.id, session);
            activeFocusByUser.put(userId, session.id);
            appendFocusFact(session, "START", key);
            emit(room, "focus.started.v1", userId, map("sessionId", session.id, "userId", userId,
                    "seatIndex", seat.seatIndex, "state", session.state, "durationMinutes", duration), key);
            return envelope(map("session", session.view(clock.instant()), "serverDurationSeconds", 0,
                    "soundCatalog", soundCatalog(), "memberStatus", member.status));
        });
    }

    public synchronized Map<String, Object> updateFocus(long userId, String sessionId,
                                                          Map<String, Object> body, String key) {
        hydrateDurableFacts();
        requireKey(key);
        Map<String, Object> safeBody = body == null ? Map.of() : body;
        rejectUnknownFields(safeBody, Set.of("action", "clientEventId"));
        rejectClientFields(safeBody, Set.of("minutes", "score", "rank", "newWords", "durationSeconds",
                "startedAt", "finishedAt", "serverDurationSeconds", "qualifiedSeconds"));
        return idempotent(userId, "focus-update:" + sessionId, key, safeBody, () -> {
            FocusSession session = ownedFocus(userId, sessionId);
            Room room = ownedRoom(session.roomId);
            advanceFocusIfTargetReached(session, room, key);
            String action = text(safeBody.get("action"), "");
            Instant now = clock.instant();
            if ("HEARTBEAT".equals(action)) {
                return envelope(map("session", session.view(now), "serverDurationSeconds", session.activeSeconds(now),
                        "serverTime", now.toString(), "activityRecorded", false));
            }
            if ("AUTO_RELEASE".equals(action)) {
                throw error("SOC_CLIENT_FIELD_FORBIDDEN", "AUTO_RELEASE is server-owned", 400, false);
            }
            if ("PAUSE".equals(action) && "RUNNING".equals(session.state)) {
                session.pause(now);
                appendFocusFact(session, "PAUSE", key);
                emit(room, "focus.paused.v1", userId, map("sessionId", session.id, "state", session.state,
                        "serverElapsedSec", session.activeSeconds(now)), key);
            } else if ("RESUME".equals(action) && "PAUSED".equals(session.state)) {
                session.resume(now);
                appendFocusFact(session, "RESUME", key);
                emit(room, "focus.started.v1", userId, map("sessionId", session.id, "state", session.state,
                        "serverElapsedSec", session.activeSeconds(now)), key);
            } else if (("COMPLETE".equals(action) || "FINISH".equals(action))
                    && Set.of("RUNNING", "PAUSED").contains(session.state)) {
                finishFocus(session, "COMPLETED", "CLIENT_FINISH", key);
            } else {
                throw error("SOC_FOCUS_STATE_INVALID", "focus action is not valid for this state", 409, false);
            }
            return envelope(map("session", session.view(clock.instant()),
                    "serverDurationSeconds", session.serverDurationSeconds,
                    "qualifiedSeconds", session.qualifiedSeconds));
        });
    }

    /** Trusted learning-domain hook. It updates activity, unlike ping/pong. */
    public synchronized Map<String, Object> recordLearningActivity(long userId, String roomId,
                                                                     String sourceEventId) {
        hydrateDurableFacts();
        if (!SAFE_ID.matcher(text(sourceEventId, "")).matches()) {
            throw error("SOC_ACTIVITY_INVALID", "sourceEventId is invalid", 400, false);
        }
        Room room = ownedRoom(roomId);
        Member member = requireActiveMember(room, userId);
        Seat seat = requireActiveSeat(room, userId);
        ensureSeatUsable(room, seat, userId);
        member.lastActivityAt = clock.instant();
        seat.lastActivityAt = clock.instant();
        appendFact("SOC_ROOM_MEMBER", room.id, userId, "activity-" + sourceEventId, map(
                "action", "ACTIVITY", "sourceEventId", sourceEventId, "seatIndex", seat.seatIndex,
                "occurredAt", clock.instant().toString()));
        return envelope(map("recorded", true, "roomId", roomId, "lastActivityAt", member.lastActivityAt.toString()));
    }

    public synchronized Map<String, Object> interactions(long userId, String roomId,
                                                           Map<String, Object> body, String key) {
        hydrateDurableFacts();
        requireKey(key);
        Map<String, Object> safeBody = body == null ? Map.of() : body;
        rejectUnknownFields(safeBody, Set.of("interactionCode", "targetUserId", "clientEventId"));
        rejectClientFields(safeBody, SOCIAL_TEXT_FIELDS);
        return idempotent(userId, "interaction:" + roomId, key, safeBody, () -> {
            Room room = ownedRoom(roomId);
            requireActiveMember(room, userId);
            String clientEventId = optionalSafeId(safeBody.get("clientEventId"));
            if (clientEventId != null) {
                Map<String, Object> prior = interactionByClientEvent.get(userId + ":" + clientEventId);
                if (prior != null) return prior;
            }
            String code = text(safeBody.get("interactionCode"), "");
            if (!INTERACTION_CODES.contains(code)) {
                throw error("SOC_PRESET_NOT_ALLOWED", "only published preset interactions are supported", 422, false);
            }
            Long target = safeLong(safeBody.get("targetUserId"));
            if (target != null) {
                if (target == userId) throw error("SOC_PRESET_NOT_ALLOWED", "target cannot be sender", 422, false);
                requireActiveMember(room, target);
                requireNotBlocked(userId, target);
            }
            requireNotMuted(roomId, userId);
            Instant now = clock.instant();
            String actorWindow = userId + ":" + roomId;
            enforceInteractionLimit(interactionThirtySecondWindows, actorWindow, now, 30, 3,
                    "SOC_INTERACTION_RATE_LIMITED", "too many preset interactions in 30 seconds");
            enforceInteractionLimit(interactionHourlyWindows, actorWindow, now, 3600, 60,
                    "SOC_INTERACTION_RATE_LIMITED", "too many preset interactions in one hour");
            if (target != null) {
                enforceInteractionLimit(interactionTargetWindows, roomId + ":" + target, now, 60, 1,
                        "SOC_INTERACTION_RATE_LIMITED", "target received too many interactions");
            }
            String eventId = "INTERACTION-" + UUID.randomUUID();
            Map<String, Object> result = envelope(map("accepted", true, "eventId", eventId,
                    "interactionCode", code, "roomId", roomId, "targetUserId", target,
                    "visibleTo", "ROOM_MEMBERS", "deliveredAt", now.toString(), "notificationCreated", target != null));
            if (clientEventId != null) interactionByClientEvent.put(userId + ":" + clientEventId, result);
            appendFact("SOC_INTERACTION", eventId, userId, key, map(
                    "eventId", eventId, "clientEventId", clientEventId, "roomId", roomId,
                    "targetUserId", target, "interactionCode", code, "moderationState", "ALLOWLISTED",
                    "occurredAt", now.toString()));
            emit(room, "interaction.preset_received.v1", userId, map(
                    "eventId", eventId, "presetCode", code, "targetUserId", target,
                    "senderPublicId", userId), key);
            if (target != null && notificationEnabled(target, "roomInteractions")) {
                addNotification(target, "interaction.preset", map("presetCode", code, "senderPublicId", userId));
            }
            return result;
        });
    }

    public synchronized Map<String, Object> leaderboard(long userId, String roomId) {
        hydrateDurableFacts();
        Room room = ownedRoom(roomId);
        requireActiveMember(room, userId);
        List<Map<String, Object>> entries = room.activeMembers().stream()
                .filter(member -> !blocksByUser.getOrDefault(userId, Set.of()).contains(member.userId))
                .sorted(Comparator.comparingLong((Member member) -> focusSeconds(member.userId, roomId)).reversed()
                        .thenComparingLong(member -> member.userId))
                .map(member -> map("userId", member.userId, "completedFocusSeconds", focusSeconds(member.userId, roomId),
                        "status", "VALID", "displayMode", "PUBLIC_ID"))
                .toList();
        return envelope(map("roomId", roomId, "items", entries, "source", "MYSQL_SNAPSHOT",
                "serverTime", clock.instant().toString()));
    }

    public synchronized Map<String, Object> issueWsTicket(long userId, Map<String, Object> body, String key) {
        return issueWsTicket(userId, body, key, null);
    }

    public synchronized Map<String, Object> issueWsTicket(long userId, Map<String, Object> body,
                                                            String key, String origin) {
        hydrateDurableFacts();
        requireKey(key);
        Map<String, Object> safeBody = body == null ? Map.of() : body;
        rejectUnknownFields(safeBody, Set.of("roomId", "deviceId"));
        if (origin != null && (origin.contains("\r") || origin.contains("\n"))) {
            throw error("SOC_WS_ORIGIN_INVALID", "origin is invalid", 403, false);
        }
        return idempotent(userId, "ws-ticket", key, safeBody, () -> {
            String roomId = optionalSafeId(safeBody.get("roomId"));
            if (roomId != null) requireActiveMember(ownedRoom(roomId), userId);
            String deviceId = optionalSafeId(safeBody.get("deviceId"));
            if (deviceId == null) deviceId = "device-unknown";
            String ticket = "WST-" + UUID.randomUUID();
            Instant expiresAt = clock.instant().plusSeconds(60);
            wsTickets.put(ticket, new B4WsTicket(ticket, userId, deviceId, roomId, origin, expiresAt));
            return envelope(map("wsTicket", ticket, "expiresAt", expiresAt.toString(), "path", B4SocialProtocol.PATH,
                    "subprotocol", B4SocialProtocol.SUBPROTOCOL, "oneTime", true,
                    "deviceBound", !"device-unknown".equals(deviceId), "roomId", roomId));
        });
    }

    /** Legacy transport hook. Consuming a ticket is always one-time. */
    public synchronized boolean consumeWsTicket(String ticket) {
        B4WsTicket value = takeWsTicket(ticket);
        return value != null;
    }

    public synchronized Map<String, Object> openWsConnection(String ticket, long userId, String deviceId) {
        hydrateDurableFacts();
        B4WsTicket value = takeWsTicket(ticket);
        if (value == null) throw error("SOC_WS_TICKET_INVALID", "WebSocket ticket is expired or already used", 401, false);
        if (value.userId != userId || (!"device-unknown".equals(value.deviceId)
                && !Objects.equals(value.deviceId, deviceId))) {
            throw error("SOC_WS_TICKET_INVALID", "WebSocket ticket binding mismatch", 401, false);
        }
        B4SocialProtocol.ConnectionState connection = new B4SocialProtocol.ConnectionState(
                userId, value.deviceId, clock.instant());
        wsConnections.put(connection.connectionId(), connection);
        return envelope(map("connectionAccepted", true, "connectionId", connection.connectionId(),
                "serverTime", clock.instant().toString(), "heartbeatIntervalSec", B4SocialProtocol.HEARTBEAT_SECONDS,
                "pongTimeoutSec", B4SocialProtocol.PONG_TIMEOUT_SECONDS,
                "leaseRenewIntervalSec", B4SocialProtocol.LEASE_RENEW_SECONDS,
                "resumeWindowSec", B4SocialProtocol.RESUME_WINDOW_SECONDS,
                "maxSubscriptions", B4SocialProtocol.MAX_SUBSCRIPTIONS,
                "roomIdHint", value.roomId));
    }

    public synchronized Map<String, Object> subscribeWs(String connectionId, String roomId,
                                                          long lastSeenSeq, long snapshotVersion) {
        hydrateDurableFacts();
        B4SocialProtocol.ConnectionState connection = connection(connectionId);
        Room room = ownedRoom(roomId);
        if (connection.userId() <= 0) throw error("SOC_WS_AUTH_REQUIRED", "connection is not authenticated", 401, false);
        Member member = requireActiveMember(room, connection.userId());
        restoreDisconnectedSeat(room, member.userId, connection.deviceId());
        if (lastSeenSeq < 0) throw error("SOC_WS_SCHEMA_INVALID", "lastSeenSeq cannot be negative", 400, false);
        if (!connection.subscribe(roomId, lastSeenSeq, snapshotVersion)) {
            throw error("SOC_WS_SUBSCRIPTION_LIMIT", "connection has too many room subscriptions", 400, false);
        }
        long currentSeq = room.sequence;
        long firstSeq = room.events.isEmpty() ? currentSeq + 1 : eventSeq(room.events.peekFirst());
        boolean snapshotRequired = (lastSeenSeq + 1 < firstSeq) || (snapshotVersion > 0 && snapshotVersion != room.version);
        List<Map<String, Object>> replay = snapshotRequired ? List.of() : room.events.stream()
                .filter(event -> eventSeq(event) > lastSeenSeq).toList();
        Map<String, Object> ack = B4SocialProtocol.commandAck("room.subscribe.ack.v1",
                "subscribe-" + UUID.randomUUID(), requestId(), map("roomId", roomId, "seq", currentSeq,
                        "roomVersion", room.version, "resumed", !snapshotRequired,
                        "snapshotRequired", snapshotRequired));
        ack.put("roomId", roomId);
        Map<String, Object> data = map("ack", ack, "events", replay, "roomId", roomId,
                "serverTime", clock.instant().toString());
        if (snapshotRequired) {
            data.put("resyncRequired", B4SocialProtocol.eventEnvelope("room.resync_required.v1",
                    "RESYNC-" + UUID.randomUUID(), requestId(), roomId, currentSeq,
                    map("expectedSeq", currentSeq, "reason", "RESUME_WINDOW_OR_VERSION_MISMATCH"), clock.instant()));
            data.put("snapshot", B4SocialProtocol.eventEnvelope("room.snapshot.v1", "SNAPSHOT-" + UUID.randomUUID(),
                    requestId(), roomId, currentSeq, room.view(connection.userId(), true), clock.instant()));
        }
        return envelope(data);
    }

    public synchronized Map<String, Object> unsubscribeWs(String connectionId, String roomId) {
        B4SocialProtocol.ConnectionState connection = connection(connectionId);
        connection.unsubscribe(roomId);
        return envelope(map("unsubscribed", true, "roomId", roomId));
    }

    public synchronized Map<String, Object> serverPing(String connectionId) {
        B4SocialProtocol.ConnectionState connection = connection(connectionId);
        return connection.issuePing(clock.instant());
    }

    public synchronized Map<String, Object> clientPong(String connectionId, String pingId) {
        B4SocialProtocol.ConnectionState connection = connection(connectionId);
        if (!connection.acceptPong(pingId, clock.instant())) {
            throw error("SOC_WS_PONG_INVALID", "pong does not match the pending ping", 400, false);
        }
        return B4SocialProtocol.commandAck("client.pong.ack.v1", pingId, requestId(), map("accepted", true));
    }

    public synchronized Map<String, Object> disconnectWs(String connectionId) {
        B4SocialProtocol.ConnectionState connection = connection(connectionId);
        Instant now = clock.instant();
        for (String roomId : connection.subscribedRooms()) {
            Room room = rooms.get(roomId);
            if (room == null) continue;
            Seat seat = memberSeat(room, connection.userId());
            if (seat != null && "OCCUPIED".equals(seat.state)) {
                seat.state = "DISCONNECTED";
                seat.disconnectedAt = now;
                seat.version++;
                emit(room, "seat.updated.v1", connection.userId(), seat.publicView());
            }
        }
        connection.close();
        return envelope(map("disconnected", true, "connectionId", connectionId,
                "resumeWindowSeconds", B4SocialProtocol.RESUME_WINDOW_SECONDS));
    }

    public synchronized Map<String, Object> heartbeatSweep() {
        List<Map<String, Object>> pings = new ArrayList<>();
        List<String> closed = new ArrayList<>();
        for (B4SocialProtocol.ConnectionState connection : wsConnections.values()) {
            if (connection.closed()) continue;
            pings.add(connection.issuePing(clock.instant()));
            if (connection.missedPongs() >= 3) {
                connection.close();
                closed.add(connection.connectionId());
            }
        }
        return envelope(map("pings", pings, "closedConnectionIds", closed));
    }

    public synchronized Map<String, Object> renewSeat(String connectionId, String roomId,
                                                        String leaseId, long leaseVersion) {
        B4SocialProtocol.ConnectionState connection = connection(connectionId);
        if (!connection.subscribedRooms().contains(roomId)) {
            throw error("SOC_WS_ROOM_NOT_SUBSCRIBED", "room is not subscribed on this connection", 403, false);
        }
        Room room = ownedRoom(roomId);
        Seat seat = requireActiveSeat(room, connection.userId());
        if (!Objects.equals(seat.leaseId, leaseId) || seat.leaseVersion != leaseVersion
                || !"OCCUPIED".equals(seat.state) || !seat.leaseExpiresAt.isAfter(clock.instant())) {
            throw error("SOC_SEAT_LEASE_EXPIRED", "seat lease is stale or expired", 409, false);
        }
        seat.leaseVersion++;
        seat.leaseExpiresAt = clock.instant().plusSeconds(LEASE_SECONDS);
        seat.lastHeartbeatAt = clock.instant();
        return envelope(map("renewed", true, "roomId", roomId, "seat", seat.view(),
                "activityRecorded", false));
    }

    public synchronized Map<String, Object> notifications(long userId, int limit) {
        hydrateDurableFacts();
        List<Map<String, Object>> items = notifications.getOrDefault(userId, List.of()).stream()
                .limit(safeLimit(limit)).<Map<String, Object>>map(item -> new LinkedHashMap<>(item)).toList();
        return envelope(map("items", items, "nextCursor", null, "hasMore", false));
    }

    public synchronized Map<String, Object> readNotification(long userId, String messageId, String key) {
        hydrateDurableFacts();
        requireKey(key);
        return idempotent(userId, "notification-read:" + messageId, key, map("messageId", messageId), () -> {
            Map<String, Object> item = notifications.getOrDefault(userId, List.of()).stream()
                    .filter(value -> messageId.equals(value.get("messageId"))).findFirst().orElse(null);
            if (item == null) throw error("INF_NOTIFICATION_NOT_FOUND", "notification does not exist", 404, false);
            item.put("read", true);
            return envelope(map("messageId", messageId, "read", true));
        });
    }

    public synchronized Map<String, Object> readAllNotifications(long userId, String key) {
        hydrateDurableFacts();
        requireKey(key);
        return idempotent(userId, "notification-read-all", key, Map.of(), () -> {
            notifications.getOrDefault(userId, List.of()).forEach(item -> item.put("read", true));
            return envelope(map("readAll", true));
        });
    }

    public synchronized Map<String, Object> notificationPreferences(long userId) {
        hydrateDurableFacts();
        return envelope(map("preferences", new LinkedHashMap<>(notificationPreferences.computeIfAbsent(userId,
                ignored -> defaultNotificationPreferences()))));
    }

    public synchronized Map<String, Object> saveNotificationPreferences(long userId,
                                                                          Map<String, Object> body, String key) {
        hydrateDurableFacts();
        requireKey(key);
        Map<String, Object> safeBody = body == null ? Map.of() : body;
        rejectUnknownFields(safeBody, Set.of("roomInteractions", "focusReminders", "system", "doNotDisturb"));
        return idempotent(userId, "notification-preferences", key, safeBody, () -> {
            Map<String, Object> preferences = notificationPreferences.computeIfAbsent(userId,
                    ignored -> defaultNotificationPreferences());
            safeBody.forEach((field, value) -> {
                if (!(value instanceof Boolean)) throw error("INF_NOTIFICATION_PREFERENCE_INVALID",
                        field + " must be boolean", 422, false);
                preferences.put(field, value);
            });
            preferences.put("version", ((Number) preferences.getOrDefault("version", 0)).longValue() + 1);
            appendFact("INF_NOTIFICATION_PREFERENCE", String.valueOf(userId), userId, key, preferences);
            return notificationPreferences(userId);
        });
    }

    public synchronized Map<String, Object> offlinePackages(long userId, int limit) {
        hydrateDurableFacts();
        List<Map<String, Object>> items = offlinePackages.values().stream().limit(safeLimit(limit))
                .map(packageValue -> packageValue.view(userId, findDownload(userId, packageValue.packageId, null))).toList();
        return envelope(map("items", items, "manifestStateMachine",
                List.of("PUBLISHED", "AUTHORIZED", "DOWNLOADING", "PAUSED", "VERIFYING", "ACTIVE_LOCAL", "EXPIRED", "DELETED")));
    }

    public synchronized Map<String, Object> authorizeOfflinePackage(long userId, String packageId, String key) {
        return authorizeOfflinePackage(userId, packageId, "device-unknown", key);
    }

    public synchronized Map<String, Object> authorizeOfflinePackage(long userId, String packageId,
                                                                      String deviceId, String key) {
        hydrateDurableFacts();
        requireKey(key);
        String safeDeviceId = deviceId == null || deviceId.isBlank() ? "device-unknown" : deviceId;
        return idempotent(userId, "offline-authorize:" + packageId + ":" + safeDeviceId, key,
                map("packageId", packageId, "deviceId", safeDeviceId), () -> {
                    OfflinePackage packageValue = offlinePackages.get(packageId);
                    if (packageValue == null) throw error("INF_OFFLINE_PACKAGE_NOT_FOUND",
                            "offline package does not exist", 404, false);
                    if (packageValue.expiresAt != null && !packageValue.expiresAt.isAfter(clock.instant())) {
                        packageValue.state = "EXPIRED";
                        throw error("INF_OFFLINE_PACKAGE_EXPIRED", "offline package has expired", 410, false);
                    }
                    OfflineDownload existing = findDownload(userId, packageId, safeDeviceId);
                    if (existing != null && !"CLEANED".equals(existing.state)) {
                        return envelope(offlineAuthorizationView(packageValue, existing));
                    }
                    OfflineDownload download = new OfflineDownload("DOWNLOAD-" + UUID.randomUUID(),
                            packageValue, userId, safeDeviceId, clock.instant());
                    offlineDownloads.put(download.downloadId, download);
                    appendFact("INF_OFFLINE", download.downloadId, userId, key, map(
                            "action", "AUTHORIZED", "packageId", packageId, "deviceId", safeDeviceId,
                            "downloadId", download.downloadId, "state", download.state,
                            "occurredAt", clock.instant().toString()));
                    return envelope(offlineAuthorizationView(packageValue, download));
                });
    }

    /** Records storage progress only after the server-issued ETag is matched. */
    public synchronized Map<String, Object> updateOfflineDownload(long userId, String downloadId,
                                                                    Map<String, Object> body, String key) {
        hydrateDurableFacts();
        requireKey(key);
        Map<String, Object> safeBody = body == null ? Map.of() : body;
        rejectUnknownFields(safeBody, Set.of("action", "partIndex", "etag"));
        return idempotent(userId, "offline-download:" + downloadId, key, safeBody, () -> {
            OfflineDownload download = ownedDownload(userId, downloadId);
            String action = text(safeBody.get("action"), "");
            if ("PAUSE".equals(action)) {
                if (!Set.of("AUTHORIZED", "DOWNLOADING").contains(download.state)) {
                    throw error("INF_OFFLINE_STATE_INVALID", "download cannot be paused in its current state", 409, false);
                }
                download.state = "PAUSED";
            } else if ("RESUME".equals(action)) {
                if (!Set.of("AUTHORIZED", "PAUSED", "DOWNLOADING").contains(download.state)) {
                    throw error("INF_OFFLINE_STATE_INVALID", "download cannot be resumed in its current state", 409, false);
                }
                download.state = download.completed.cardinality() == 0 ? "AUTHORIZED" : "DOWNLOADING";
            } else if ("PART_RECEIVED".equals(action)) {
                if (!Set.of("AUTHORIZED", "PAUSED", "DOWNLOADING").contains(download.state)) {
                    throw error("INF_OFFLINE_STATE_INVALID", "download is not accepting parts", 409, false);
                }
                int partIndex = intValue(safeBody.get("partIndex"), "partIndex");
                if (partIndex < 0 || partIndex >= download.packageValue.partCount) {
                    throw error("INF_OFFLINE_PART_INVALID", "partIndex is outside the manifest", 422, false);
                }
                String expectedEtag = partEtag(download.packageValue, partIndex);
                if (!expectedEtag.equals(text(safeBody.get("etag"), ""))) {
                    throw error("INF_OFFLINE_PART_ETAG_MISMATCH", "part ETag does not match the signed manifest", 422, true);
                }
                download.completed.set(partIndex);
                download.partEtags.put(partIndex, expectedEtag);
                download.downloadedBytes = downloadedBytes(download.packageValue, download.completed);
                download.state = download.completed.cardinality() == download.packageValue.partCount
                        ? "VERIFYING" : "DOWNLOADING";
            } else {
                throw error("INF_OFFLINE_ACTION_INVALID", "action must be PAUSE, RESUME or PART_RECEIVED", 400, false);
            }
            appendFact("INF_OFFLINE", download.downloadId, userId, key, map(
                    "action", action, "packageId", download.packageValue.packageId, "deviceId", download.deviceId,
                    "state", download.state, "partBitmap", download.completed.toString(),
                    "downloadedBytes", download.downloadedBytes, "occurredAt", clock.instant().toString()));
            return envelope(map("download", download.view(), "serverVerificationRequired", "VERIFYING".equals(download.state)));
        });
    }

    /** Trusted object-storage callback; clients cannot set ACTIVE_LOCAL directly. */
    public synchronized Map<String, Object> verifyOfflineDownload(long userId, String downloadId,
                                                                    String computedSha256, boolean signatureValid) {
        hydrateDurableFacts();
        OfflineDownload download = ownedDownload(userId, downloadId);
        if (download.completed.cardinality() != download.packageValue.partCount) {
            throw error("INF_OFFLINE_NOT_COMPLETE", "all parts must be present before verification", 409, false);
        }
        if (!download.packageValue.sha256.equalsIgnoreCase(text(computedSha256, "")) || !signatureValid) {
            download.state = "VERIFYING";
            throw error("INF_OFFLINE_HASH_MISMATCH", "server-side package verification failed", 422, true);
        }
        download.state = "ACTIVE_LOCAL";
        appendFact("INF_OFFLINE", download.downloadId, userId, "verify-" + download.downloadId, map(
                "action", "VERIFIED", "packageId", download.packageValue.packageId, "state", download.state,
                "sha256", download.packageValue.sha256, "signatureVerified", true,
                "occurredAt", clock.instant().toString()));
        return envelope(map("download", download.view(), "verified", true));
    }

    public synchronized Map<String, Object> cleanupOfflineDownload(long userId, String downloadId, String key) {
        hydrateDurableFacts();
        requireKey(key);
        return idempotent(userId, "offline-cleanup:" + downloadId, key, map("downloadId", downloadId), () -> {
            OfflineDownload download = ownedDownload(userId, downloadId);
            download.completed.clear();
            download.partEtags.clear();
            download.downloadedBytes = 0;
            download.state = "CLEANED";
            appendFact("INF_OFFLINE", download.downloadId, userId, key, map(
                    "action", "CLEANED", "packageId", download.packageValue.packageId, "deviceId", download.deviceId,
                    "state", download.state, "occurredAt", clock.instant().toString()));
            return envelope(map("cleaned", true, "downloadId", downloadId, "state", download.state));
        });
    }

    public synchronized Map<String, Object> cleanupExpiredOfflineDownloads(long userId) {
        int cleaned = 0;
        for (OfflineDownload download : offlineDownloads.values()) {
            if (download.userId != userId) continue;
            if ((download.packageValue.expiresAt != null && !download.packageValue.expiresAt.isAfter(clock.instant()))
                    || "EXPIRED".equals(download.packageValue.state)) {
                download.completed.clear();
                download.partEtags.clear();
                download.downloadedBytes = 0;
                download.state = "CLEANED";
                cleaned++;
            }
        }
        return envelope(map("cleanedCount", cleaned));
    }

    public synchronized Map<String, Object> syncChanges(long userId, String cursor, int limit) {
        hydrateDurableFacts();
        int safeLimit = safeLimit(limit);
        long fromSequence = cursorSequence(userId, cursor);
        List<SyncChange> all = syncChanges.getOrDefault(userId, List.of()).stream()
                .filter(change -> change.sequence > fromSequence).toList();
        List<SyncChange> page = all.stream().limit(safeLimit).toList();
        long nextSequence = page.isEmpty() ? fromSequence : page.get(page.size() - 1).sequence;
        boolean hasMore = all.size() > page.size();
        String nextCursor = cursorFor(userId, nextSequence);
        List<Map<String, Object>> changes = page.stream().map(SyncChange::view).toList();
        return envelope(map("changes", changes, "items", changes, "cursor", nextCursor,
                "nextCursor", nextCursor, "hasMore", hasMore, "resetRequired", false,
                "serverTime", clock.instant().toString()));
    }

    public synchronized Map<String, Object> pushSync(long userId, Map<String, Object> body, String key) {
        return pushSync(userId, body, "device-unknown", key);
    }

    public synchronized Map<String, Object> pushSync(long userId, Map<String, Object> body,
                                                       String deviceId, String key) {
        hydrateDurableFacts();
        requireKey(key);
        Map<String, Object> safeBody = body == null ? Map.of() : body;
        rejectUnknownFields(safeBody, Set.of("clientBatchId", "events"));
        String safeDeviceId = deviceId == null || deviceId.isBlank() ? "device-unknown" : deviceId;
        return idempotent(userId, "sync-push:" + safeDeviceId, key, safeBody, () -> {
            String batchId = requiredSafeId(safeBody.get("clientBatchId"), "clientBatchId");
            Object rawEvents = safeBody.get("events");
            if (!(rawEvents instanceof List<?> events) || events.size() > 100) {
                throw error("SYNC_PAYLOAD_INVALID", "events must contain 0-100 items", 422, false);
            }
            List<Map<String, Object>> results = new ArrayList<>();
            int applied = 0;
            int conflicts = 0;
            for (Object rawEvent : events) {
                if (!(rawEvent instanceof Map<?, ?> rawMap)) {
                    results.add(map("status", "REJECTED", "resultCode", "SYNC_PAYLOAD_INVALID"));
                    continue;
                }
                Map<String, Object> event = stringMap(rawMap);
                try {
                    SyncProcessing processing = processSyncEvent(userId, safeDeviceId, batchId, event, key);
                    results.add(processing.result);
                    if ("ACCEPTED".equals(processing.result.get("status"))) applied++;
                    if ("CONFLICT".equals(processing.result.get("status"))) conflicts++;
                } catch (B4Exception exception) {
                    results.add(map("clientEventId", optionalSafeId(event.get("clientEventId")),
                            "status", "REJECTED", "resultCode", exception.code(), "retryable", exception.retryable()));
                }
            }
            long current = syncSequences.getOrDefault(userId, 0L);
            return envelope(map("clientBatchId", batchId, "results", results, "accepted", applied,
                    "applied", applied, "conflicts", conflicts, "nextCursor", cursorFor(userId, current)));
        });
    }

    public synchronized Map<String, Object> checkpoint(long userId, String entityId,
                                                         Map<String, Object> body, String key) {
        hydrateDurableFacts();
        requireKey(key);
        Map<String, Object> safeBody = body == null ? Map.of() : body;
        rejectUnknownFields(safeBody, Set.of("entityVersion", "deviceId"));
        return idempotent(userId, "checkpoint:" + entityId, key, safeBody, () -> {
            long incoming = longValue(safeBody.get("entityVersion"), "entityVersion");
            if (incoming < 0) throw error("SYNC_PAYLOAD_INVALID", "entityVersion cannot be negative", 422, false);
            String entityKey = userId + ":" + entityId;
            SyncEntity current = syncEntities.get(entityKey);
            if (current != null && incoming < current.version) {
                appendFact("INF_SYNC_CONFLICT", entityId, userId, key, map(
                        "entityId", entityId, "localVersion", incoming, "serverVersion", current.version,
                        "resolutionCode", "SERVER_WINS", "occurredAt", clock.instant().toString()));
                throw error("SYNC_CONFLICT", "checkpoint is older than the server version", 409, false);
            }
            boolean advanced = current == null || incoming > current.version;
            if (advanced) {
                syncEntities.put(entityKey, new SyncEntity(incoming, "CHECKPOINT"));
                appendSyncChange(userId, "checkpoint.updated.v1", entityId, incoming, key);
                appendFact("INF_SYNC_CHECKPOINT", entityId, userId, key, map(
                        "entityId", entityId, "entityVersion", incoming, "occurredAt", clock.instant().toString()));
            }
            return envelope(map("entityId", entityId, "checkpointVersion", currentVersion(syncEntities.get(entityKey)),
                    "serverVersion", currentVersion(syncEntities.get(entityKey)),
                    "serverUpdatedAt", clock.instant().toString(), "accepted", true, "conflict", false));
        });
    }

    public synchronized Map<String, Object> report(long userId, Map<String, Object> body, String key) {
        hydrateDurableFacts();
        requireKey(key);
        Map<String, Object> safeBody = body == null ? Map.of() : body;
        rejectUnknownFields(safeBody, Set.of("reasonCode", "targetUserId", "roomId"));
        rejectClientFields(safeBody, SOCIAL_TEXT_FIELDS);
        return idempotent(userId, "moderation-report", key, safeBody, () -> {
            String reason = text(safeBody.get("reasonCode"), "");
            if (!MODERATION_REASONS.contains(reason)) {
                throw error("SOC_MODERATION_REASON_INVALID", "moderation reason is invalid", 400, false);
            }
            long target = longValue(safeBody.get("targetUserId"), "targetUserId");
            if (target <= 0 || target == userId) throw error("SOC_MODERATION_TARGET_INVALID",
                    "targetUserId must identify another user", 400, false);
            String roomId = optionalSafeId(safeBody.get("roomId"));
            if (roomId != null) {
                Room room = ownedRoom(roomId);
                requireActiveMember(room, userId);
                requireActiveMember(room, target);
            }
            String dedupe = userId + ":" + target + ":" + text(roomId, "-") + ":" + reason;
            String priorReportId = reportDedupe.get(dedupe);
            if (priorReportId != null) return envelope(reports.get(priorReportId).view());
            Report report = new Report("REPORT-" + UUID.randomUUID(), userId, target, roomId, reason, clock.instant());
            reports.put(report.reportId, report);
            reportDedupe.put(dedupe, report.reportId);
            appendFact("SOC_MODERATION_REPORT", report.reportId, userId, key, map(
                    "reportId", report.reportId, "targetUserId", target, "roomId", roomId,
                    "reasonCode", reason, "status", report.status, "reviewMode", "MANUAL",
                    "occurredAt", report.createdAt.toString()));
            return envelope(report.view());
        });
    }

    public synchronized Map<String, Object> appealModeration(long userId, String reportId,
                                                               Map<String, Object> body, String key) {
        hydrateDurableFacts();
        requireKey(key);
        Map<String, Object> safeBody = body == null ? Map.of() : body;
        rejectUnknownFields(safeBody, Set.of("appealCode"));
        rejectClientFields(safeBody, SOCIAL_TEXT_FIELDS);
        return idempotent(userId, "moderation-appeal:" + reportId, key, safeBody, () -> {
            Report report = reports.get(reportId);
            if (report == null) throw error("SOC_REPORT_NOT_FOUND", "report does not exist", 404, false);
            if (report.reporterUserId != userId && report.targetUserId != userId) {
                throw error("SOC_MODERATION_FORBIDDEN", "user cannot appeal this report", 403, false);
            }
            String appealCode = text(safeBody.get("appealCode"), "OTHER");
            if (!APPEAL_CODES.contains(appealCode)) throw error("SOC_APPEAL_CODE_INVALID",
                    "appealCode is invalid", 400, false);
            if (report.appealed) return envelope(map("appealId", report.appealId, "status", report.status,
                    "alreadyAppealed", true));
            report.appealed = true;
            report.appealId = "APPEAL-" + UUID.randomUUID();
            report.status = "APPEALED";
            appendFact("SOC_MODERATION_APPEAL", report.reportId, userId, key, map(
                    "appealId", report.appealId, "reportId", report.reportId, "appealCode", appealCode,
                    "status", report.status, "occurredAt", clock.instant().toString()));
            return envelope(map("appealId", report.appealId, "reportId", report.reportId,
                    "status", report.status, "recorded", true));
        });
    }

    public synchronized Map<String, Object> block(long userId, long targetUserId, String key) {
        hydrateDurableFacts();
        requireKey(key);
        if (userId <= 0 || targetUserId <= 0 || userId == targetUserId) {
            throw error("SOC_BLOCK_TARGET_INVALID", "targetUserId must identify another user", 400, false);
        }
        return idempotent(userId, "block:" + targetUserId, key, map("targetUserId", targetUserId), () -> {
            Set<Long> blocked = blocksByUser.computeIfAbsent(userId, ignored -> new LinkedHashSet<>());
            boolean added = blocked.add(targetUserId);
            if (added) appendFact("SOC_BLOCK", userId + ":" + targetUserId, userId, key,
                    map("action", "BLOCK", "targetUserId", targetUserId, "occurredAt", clock.instant().toString()));
            return envelope(map("blocked", true, "alreadyBlocked", !added, "targetUserId", targetUserId));
        });
    }

    public synchronized Map<String, Object> mute(long userId, String roomId, long targetUserId, String key) {
        return mute(userId, roomId, map("targetUserId", targetUserId, "durationSeconds", 3600), key);
    }

    public synchronized Map<String, Object> mute(long userId, String roomId, Map<String, Object> body, String key) {
        hydrateDurableFacts();
        requireKey(key);
        Map<String, Object> safeBody = body == null ? Map.of() : body;
        rejectUnknownFields(safeBody, Set.of("targetUserId", "durationSeconds"));
        return idempotent(userId, "mute:" + roomId + ":" + text(safeBody.get("targetUserId"), ""), key, safeBody, () -> {
            Room room = ownedRoom(roomId);
            Member actor = requireActiveMember(room, userId);
            if (!"HOST".equals(actor.roleCode)) throw error("SOC_ROOM_HOST_REQUIRED",
                    "only the room host can mute a member", 403, false);
            long target = longValue(safeBody.get("targetUserId"), "targetUserId");
            if (target <= 0 || target == userId) throw error("SOC_MUTE_TARGET_INVALID",
                    "targetUserId must identify another member", 400, false);
            requireActiveMember(room, target);
            int duration = intValue(safeBody.getOrDefault("durationSeconds", 3600), "durationSeconds");
            if (duration < 60 || duration > 86400) throw error("SOC_MUTE_DURATION_INVALID",
                    "durationSeconds must be between 60 and 86400", 400, false);
            String muteKey = roomId + ":" + target;
            Mute existing = mutes.get(muteKey);
            Instant expiresAt = clock.instant().plusSeconds(duration);
            if (existing != null && existing.expiresAt.isAfter(clock.instant())) {
                return envelope(existing.view(true));
            }
            Mute mute = new Mute(roomId, userId, target, expiresAt);
            mutes.put(muteKey, mute);
            appendFact("SOC_MUTE", muteKey, userId, key, map(
                    "roomId", roomId, "targetUserId", target, "expiresAt", expiresAt.toString(),
                    "status", "ACTIVE", "occurredAt", clock.instant().toString()));
            emit(room, "room.member_muted.v1", userId, map("targetUserId", target,
                    "expiresAt", expiresAt.toString()), key);
            return envelope(mute.view(false));
        });
    }

    public synchronized Map<String, Object> sweepExpiredState() {
        hydrateDurableFacts();
        int released = 0;
        Instant now = clock.instant();
        for (Room room : rooms.values()) {
            for (Seat seat : new ArrayList<>(room.seats.values())) {
                Member member = room.members.get(seat.userId);
                if (member == null || !"ACTIVE".equals(member.status)) continue;
                boolean disconnectExpired = "DISCONNECTED".equals(seat.state) && seat.disconnectedAt != null
                        && !seat.disconnectedAt.plusSeconds(DISCONNECT_GRACE_SECONDS).isAfter(now);
                boolean leaseExpired = seat.leaseExpiresAt != null && !seat.leaseExpiresAt.isAfter(now);
                boolean idle = seat.lastActivityAt != null && !seat.lastActivityAt.plusSeconds(IDLE_RELEASE_SECONDS).isAfter(now);
                if (disconnectExpired || leaseExpired || idle) {
                    String reason = disconnectExpired ? "RECONNECT_GRACE_EXPIRED" : idle ? "IDLE_TIMEOUT" : "LEASE_TIMEOUT";
                    releaseFocusForUser(member.userId, room, "AUTO_RELEASE", "sweep-" + reason);
                    releaseSeat(room, seat, reason, "sweep-" + reason);
                    member.status = "EXPIRED";
                    member.leftAt = now;
                    activeSeatByUser.remove(member.userId);
                    appendFact("SOC_ROOM_MEMBER", room.id, member.userId, "sweep-" + seat.seatIndex, map(
                            "action", "EXPIRE", "reason", reason, "seatIndex", seat.seatIndex,
                            "occurredAt", now.toString()));
                    released++;
                }
            }
        }
        return envelope(map("releasedSeats", released, "serverTime", now.toString()));
    }

    private void seedRooms() {
        rooms.putIfAbsent("ROOM-001", new Room("ROOM-001", "晨星自习室", "TEMPLATE_QUIET", ROOM_CAPACITY));
        rooms.putIfAbsent("ROOM-002", new Room("ROOM-002", "晚间专注舱", "TEMPLATE_FOCUS", ROOM_CAPACITY));
        offlinePackages.putIfAbsent("OFFLINE-B4-FOUNDATION", new OfflinePackage(
                "OFFLINE-B4-FOUNDATION", "FOUNDATION", "1.0.0", 4096, 4,
                "b4-offline-foundation-sha256", "b4-offline-signature-v1", "0.1.0",
                clock.instant().plus(Duration.ofDays(30))));
    }

    private Map<String, Object> protocolView() {
        return map("path", B4SocialProtocol.PATH, "subprotocol", B4SocialProtocol.SUBPROTOCOL,
                "heartbeatSeconds", B4SocialProtocol.HEARTBEAT_SECONDS,
                "pongTimeoutSeconds", B4SocialProtocol.PONG_TIMEOUT_SECONDS,
                "leaseRenewIntervalSeconds", B4SocialProtocol.LEASE_RENEW_SECONDS,
                "resumeWindowSeconds", B4SocialProtocol.RESUME_WINDOW_SECONDS,
                "maxSubscriptions", B4SocialProtocol.MAX_SUBSCRIPTIONS);
    }

    private Map<String, Object> soundCatalog() {
        return map("version", "SOUND-2026-08", "items", List.of(
                map("soundCode", "RAIN", "titleKey", "sound.rain", "allowed", true),
                map("soundCode", "FOREST", "titleKey", "sound.forest", "allowed", true),
                map("soundCode", "CAFE", "titleKey", "sound.cafe", "allowed", true),
                map("soundCode", "FIREPLACE", "titleKey", "sound.fireplace", "allowed", true)));
    }

    private Room ownedRoom(String roomId) {
        Room room = rooms.get(roomId);
        if (room == null) throw error("SOC_ROOM_NOT_FOUND", "study room does not exist", 404, false);
        return room;
    }

    private Member requireActiveMember(Room room, long userId) {
        Member member = room.members.get(userId);
        if (member == null || !"ACTIVE".equals(member.status)) {
            throw error("SOC_ROOM_MEMBER_REQUIRED", "join the room before using this resource", 403, false);
        }
        return member;
    }

    private Seat requireActiveSeat(Room room, long userId) {
        Member member = requireActiveMember(room, userId);
        Seat seat = memberSeat(room, userId);
        if (seat == null || !Set.of("OCCUPIED", "DISCONNECTED").contains(seat.state)) {
            throw error("SOC_SEAT_UNAVAILABLE", "an occupied seat is required", 409, false);
        }
        return seat;
    }

    private void ensureSeatUsable(Room room, Seat seat, long userId) {
        Instant now = clock.instant();
        if (seat.leaseExpiresAt == null || !seat.leaseExpiresAt.isAfter(now)) {
            throw error("SOC_SEAT_LEASE_EXPIRED", "seat lease has expired", 409, false);
        }
        if ("DISCONNECTED".equals(seat.state)) restoreDisconnectedSeat(room, userId, "device-unknown");
        if (!"OCCUPIED".equals(seat.state)) throw error("SOC_SEAT_UNAVAILABLE", "seat is not occupied", 409, false);
    }

    private void restoreDisconnectedSeat(Room room, long userId, String deviceId) {
        Seat seat = memberSeat(room, userId);
        if (seat == null || !"DISCONNECTED".equals(seat.state)) return;
        if (seat.disconnectedAt == null || !seat.disconnectedAt.plusSeconds(DISCONNECT_GRACE_SECONDS).isAfter(clock.instant())) {
            throw error("SOC_SEAT_LEASE_EXPIRED", "reconnect grace period has expired", 409, false);
        }
        seat.state = "OCCUPIED";
        seat.disconnectedAt = null;
        seat.leaseExpiresAt = clock.instant().plusSeconds(LEASE_SECONDS);
        seat.version++;
    }

    private Seat findAvailableSeat(Room room, int preferredSeat) {
        if (preferredSeat > 0) {
            Seat preferred = room.seats.get(preferredSeat);
            if (preferred != null && "AVAILABLE".equals(preferred.state)) return preferred;
        }
        return room.seats.values().stream().filter(seat -> "AVAILABLE".equals(seat.state)).findFirst().orElse(null);
    }

    private void occupySeat(Room room, Seat seat, long userId) {
        seat.userId = userId;
        seat.state = "OCCUPIED";
        seat.leaseId = "LEASE-" + UUID.randomUUID();
        seat.leaseVersion = 1;
        seat.leaseExpiresAt = clock.instant().plusSeconds(LEASE_SECONDS);
        seat.lastHeartbeatAt = clock.instant();
        seat.lastActivityAt = clock.instant();
        seat.version++;
    }

    private void releaseSeat(Room room, Seat seat, String reason, String key) {
        long userId = seat.userId;
        seat.state = "AVAILABLE";
        seat.userId = 0;
        seat.leaseId = null;
        seat.leaseExpiresAt = null;
        seat.disconnectedAt = null;
        seat.releasedAt = clock.instant();
        seat.releaseReason = reason;
        seat.version++;
        emit(room, "seat.released.v1", userId, map("seatIndex", seat.seatIndex, "reason", reason,
                "releasedAt", seat.releasedAt.toString()), key);
    }

    private Seat memberSeat(Room room, long userId) {
        return room.seats.values().stream().filter(seat -> seat.userId == userId
                && !"AVAILABLE".equals(seat.state)).findFirst().orElse(null);
    }

    private FocusSession ownedFocus(long userId, String sessionId) {
        FocusSession session = focusSessions.get(sessionId);
        if (session == null || session.userId != userId) {
            throw error("SOC_FOCUS_NOT_FOUND", "focus session does not exist", 404, false);
        }
        return session;
    }

    private void releaseFocusForUser(long userId, Room room, String reason, String key) {
        String focusId = activeFocusByUser.get(userId);
        if (focusId == null) return;
        FocusSession session = focusSessions.get(focusId);
        if (session != null && Set.of("RUNNING", "PAUSED").contains(session.state)) {
            finishFocus(session, "AUTO_RELEASED", reason, key);
            emit(room, "focus.completed.v1", userId, map("sessionId", session.id,
                    "state", session.state, "reason", reason, "serverElapsedSec", session.serverDurationSeconds), key);
        }
    }

    private void advanceFocusIfTargetReached(FocusSession session, Room room, String key) {
        if ("RUNNING".equals(session.state) && session.activeSeconds(clock.instant()) >= session.durationMinutes * 60L) {
            finishFocus(session, "COMPLETED", "TARGET_REACHED", key);
            emit(room, "focus.completed.v1", session.userId, map("sessionId", session.id,
                    "state", session.state, "reason", "TARGET_REACHED", "serverElapsedSec", session.serverDurationSeconds), key);
        }
    }

    private void finishFocus(FocusSession session, String state, String reason, String key) {
        Instant now = clock.instant();
        session.finish(state, now);
        activeFocusByUser.remove(session.userId, session.id);
        appendFocusFact(session, state, key);
    }

    private long focusSeconds(long userId, String roomId) {
        return focusSessions.values().stream()
                .filter(session -> session.userId == userId && roomId.equals(session.roomId)
                        && Set.of("COMPLETED", "AUTO_RELEASED").contains(session.state))
                .mapToLong(session -> session.qualifiedSeconds).sum();
    }

    private void appendFocusFact(FocusSession session, String action, String key) {
        appendFact("SOC_FOCUS", session.id, session.userId, key, map(
                "action", action, "sessionId", session.id, "roomId", session.roomId,
                "seatIndex", session.seatIndex, "durationMinutes", session.durationMinutes,
                "state", session.state, "startedAt", session.startedAt.toString(),
                "serverDurationSeconds", session.serverDurationSeconds, "qualifiedSeconds", session.qualifiedSeconds,
                "endedAt", session.endedAt == null ? null : session.endedAt.toString(),
                "occurredAt", clock.instant().toString()));
    }

    private Map<String, Object> emit(Room room, String eventType, long actorUserId, Map<String, Object> payload) {
        return emit(room, eventType, actorUserId, payload, null);
    }

    private Map<String, Object> emit(Room room, String eventType, long actorUserId,
                                     Map<String, Object> payload, String requestId) {
        room.sequence++;
        room.version++;
        Map<String, Object> event = B4SocialProtocol.eventEnvelope(eventType, "SOC-EVT-" + UUID.randomUUID(),
                requestId == null ? requestId() : requestId, room.id, room.sequence, payload, clock.instant());
        room.events.addLast(event);
        while (room.events.size() > MAX_EVENT_JOURNAL) room.events.removeFirst();
        return event;
    }

    private B4WsTicket takeWsTicket(String ticket) {
        B4WsTicket value = wsTickets.remove(ticket);
        if (value == null || !value.expiresAt.isAfter(clock.instant())) return null;
        return value;
    }

    private B4SocialProtocol.ConnectionState connection(String connectionId) {
        B4SocialProtocol.ConnectionState connection = wsConnections.get(connectionId);
        if (connection == null || connection.closed()) throw error("SOC_WS_CONNECTION_INVALID",
                "WebSocket connection is closed or unknown", 401, false);
        return connection;
    }

    private int eventSeq(Map<String, Object> event) {
        return ((Number) event.getOrDefault("seq", 0)).intValue();
    }

    private void requireNotBlocked(long actor, long target) {
        if (blocksByUser.getOrDefault(actor, Set.of()).contains(target)
                || blocksByUser.getOrDefault(target, Set.of()).contains(actor)) {
            throw error("SOC_MEMBER_BLOCKED", "interaction is unavailable for this relationship", 403, false);
        }
    }

    private void requireNotMuted(String roomId, long userId) {
        Mute mute = mutes.get(roomId + ":" + userId);
        if (mute != null && mute.expiresAt.isAfter(clock.instant())) {
            throw error("SOC_MEMBER_MUTED", "member is temporarily muted", 403, false);
        }
        if (mute != null) mutes.remove(roomId + ":" + userId);
    }

    private void enforceInteractionLimit(Map<String, Deque<Instant>> windows, String key, Instant now,
                                         int seconds, int max, String code, String message) {
        Deque<Instant> window = windows.computeIfAbsent(key, ignored -> new ArrayDeque<>());
        while (!window.isEmpty() && !window.peekFirst().plusSeconds(seconds).isAfter(now)) window.removeFirst();
        if (window.size() >= max) throw error(code, message, 429, true);
        window.addLast(now);
    }

    private boolean notificationEnabled(long userId, String field) {
        Map<String, Object> preferences = notificationPreferences.computeIfAbsent(userId,
                ignored -> defaultNotificationPreferences());
        return Boolean.TRUE.equals(preferences.get(field)) && !Boolean.TRUE.equals(preferences.get("doNotDisturb"));
    }

    private void addNotification(long userId, String eventType, Map<String, Object> safePayload) {
        String dedupeKey = eventType + ":" + userId + ":" + fingerprint(safePayload);
        List<Map<String, Object>> list = notifications.computeIfAbsent(userId, ignored -> new ArrayList<>());
        if (list.stream().anyMatch(item -> dedupeKey.equals(item.get("dedupeKey")))) return;
        list.add(map("messageId", "NOTIFY-" + UUID.randomUUID(), "eventType", eventType,
                "safePayload", safePayload, "dedupeKey", dedupeKey, "read", false,
                "createdAt", clock.instant().toString()));
    }

    private OfflineDownload ownedDownload(long userId, String downloadId) {
        OfflineDownload download = offlineDownloads.get(downloadId);
        if (download == null || download.userId != userId) {
            throw error("INF_OFFLINE_DOWNLOAD_NOT_FOUND", "offline download does not exist", 404, false);
        }
        return download;
    }

    private OfflineDownload findDownload(long userId, String packageId, String deviceId) {
        return offlineDownloads.values().stream().filter(download -> download.userId == userId
                && download.packageValue.packageId.equals(packageId)
                && (deviceId == null || deviceId.equals(download.deviceId))
                && !"CLEANED".equals(download.state)).findFirst().orElse(null);
    }

    private Map<String, Object> offlineAuthorizationView(OfflinePackage packageValue, OfflineDownload download) {
        List<String> urls = IntStream.range(0, packageValue.partCount)
                .mapToObj(index -> "signed-part-token:" + download.downloadId + ":" + index + ":"
                        + packageValue.expiresAt.toEpochMilli()).toList();
        return map("downloadId", download.downloadId, "deviceId", download.deviceId,
                "manifest", packageValue.view(download.userId, download), "signedPartUrls", urls,
                "expiresAt", packageValue.expiresAt.toString());
    }

    private String partEtag(OfflinePackage packageValue, int partIndex) {
        return "ETAG-" + packageValue.packageId + "-" + packageValue.versionCode + "-" + partIndex;
    }

    private long downloadedBytes(OfflinePackage packageValue, BitSet completed) {
        long base = packageValue.sizeBytes / packageValue.partCount;
        long remainder = packageValue.sizeBytes % packageValue.partCount;
        long total = 0;
        for (int index = completed.nextSetBit(0); index >= 0; index = completed.nextSetBit(index + 1)) {
            total += base + (index < remainder ? 1 : 0);
        }
        return total;
    }

    private SyncProcessing processSyncEvent(long userId, String deviceId, String batchId,
                                            Map<String, Object> event, String key) {
        Set<String> allowed = Set.of("clientEventId", "eventType", "occurredAt", "entityId", "entityVersion");
        rejectUnknownFields(event, allowed);
        String clientEventId = requiredSafeId(event.get("clientEventId"), "clientEventId");
        String eventType = requiredSafeId(event.get("eventType"), "eventType");
        String occurredAtText = requiredText(event, "occurredAt");
        try {
            Instant.parse(occurredAtText);
        } catch (DateTimeParseException exception) {
            throw error("SYNC_PAYLOAD_INVALID", "occurredAt must be an ISO instant", 422, false);
        }
        String entityId = optionalSafeId(event.get("entityId"));
        Long version = event.containsKey("entityVersion")
                ? longValue(event.get("entityVersion"), "entityVersion") : null;
        if (version != null && version < 0) throw error("SYNC_PAYLOAD_INVALID",
                "entityVersion cannot be negative", 422, false);
        String identity = userId + ":" + deviceId + ":" + clientEventId;
        String fingerprint = fingerprint(event);
        SyncResult prior = syncResults.get(identity);
        if (prior != null) {
            if (!fingerprint.equals(syncFingerprints.get(identity))) {
                throw error("SYNC_CONFLICT", "clientEventId was reused with a different event", 409, false);
            }
            return new SyncProcessing(prior.duplicateView(), prior);
        }
        if (entityId != null && version != null) {
            String entityKey = userId + ":" + entityId;
            SyncEntity current = syncEntities.get(entityKey);
            if (current != null && version < current.version) {
                SyncResult rejected = new SyncResult(clientEventId, "CONFLICT", "SYNC_CONFLICT", null, 0);
                syncResults.put(identity, rejected);
                syncFingerprints.put(identity, fingerprint);
                appendFact("INF_SYNC_CONFLICT", entityId, userId, key, map(
                        "clientEventId", clientEventId, "entityId", entityId, "localVersion", version,
                        "serverVersion", current.version, "resolutionCode", "SERVER_WINS",
                        "occurredAt", clock.instant().toString()));
                return new SyncProcessing(rejected.view(), rejected);
            }
            if (current != null && version.equals(current.version) && !fingerprint.equals(current.fingerprint)) {
                SyncResult rejected = new SyncResult(clientEventId, "CONFLICT", "SYNC_CONFLICT", null, 0);
                syncResults.put(identity, rejected);
                syncFingerprints.put(identity, fingerprint);
                appendFact("INF_SYNC_CONFLICT", entityId, userId, key, map(
                        "clientEventId", clientEventId, "entityId", entityId, "localVersion", version,
                        "serverVersion", current.version, "resolutionCode", "CONCURRENT_VERSION",
                        "occurredAt", clock.instant().toString()));
                return new SyncProcessing(rejected.view(), rejected);
            }
            syncEntities.put(entityKey, new SyncEntity(version, fingerprint));
        }
        long sequence = appendSyncChange(userId, eventType, entityId, version == null ? 0 : version, key);
        String serverEventId = "SYNC-EVT-" + UUID.randomUUID();
        SyncResult accepted = new SyncResult(clientEventId, "ACCEPTED", "APPLIED", serverEventId, sequence);
        syncResults.put(identity, accepted);
        syncFingerprints.put(identity, fingerprint);
        appendFact("INF_SYNC_EVENT", clientEventId, userId, key, map(
                "clientBatchId", batchId, "clientEventId", clientEventId, "eventType", eventType,
                "entityId", entityId, "entityVersion", version, "serverEventId", serverEventId,
                "serverSequence", sequence, "occurredAt", occurredAtText));
        return new SyncProcessing(accepted.view(), accepted);
    }

    private long appendSyncChange(long userId, String eventType, String entityId, long entityVersion, String key) {
        long sequence = syncSequences.getOrDefault(userId, 0L) + 1;
        syncSequences.put(userId, sequence);
        SyncChange change = new SyncChange(sequence, eventType, entityId,
                entityVersion, clock.instant());
        syncChanges.computeIfAbsent(userId, ignored -> new ArrayList<>()).add(change);
        return sequence;
    }

    private long cursorSequence(long userId, String cursor) {
        if (cursor == null || cursor.isBlank() || "0".equals(cursor)) return 0;
        CursorState state = cursors.get(cursor);
        if (state == null || state.userId != userId) throw error("SYNC_CURSOR_INVALID",
                "cursor is invalid for this user", 400, false);
        return state.sequence;
    }

    private String cursorFor(long userId, long sequence) {
        String existing = cursors.entrySet().stream()
                .filter(entry -> entry.getValue().userId == userId && entry.getValue().sequence == sequence)
                .map(Map.Entry::getKey).findFirst().orElse(null);
        if (existing != null) return existing;
        String cursor = "CUR-" + userId + "-" + sequence + "-" + UUID.randomUUID();
        cursors.put(cursor, new CursorState(userId, sequence));
        return cursor;
    }

    private int roomOffset(String cursor) {
        if (cursor == null || cursor.isBlank()) return 0;
        if (!cursor.startsWith("ROOM-CURSOR-")) throw error("SOC_CURSOR_INVALID", "room cursor is invalid", 400, false);
        try { return Math.max(0, Integer.parseInt(cursor.substring("ROOM-CURSOR-".length()))); }
        catch (NumberFormatException exception) { throw error("SOC_CURSOR_INVALID", "room cursor is invalid", 400, false); }
    }

    private Map<String, Object> envelope(Map<String, Object> data) {
        return map("requestId", requestId(), "serverTime", clock.instant().toString(), "data", data);
    }

    private <T> Map<String, Object> idempotent(long userId, String scope, String key,
                                                Map<String, Object> body, Supplier<Map<String, Object>> action) {
        String identity = userId + ":" + scope + ":" + key;
        String fingerprint = fingerprint(body == null ? Map.of() : body);
        if (idempotency.containsKey(identity)) {
            if (!fingerprint.equals(idempotencyFingerprints.get(identity))) {
                throw error("IDEMPOTENCY_KEY_REUSED", "Idempotency-Key was reused with a different request", 409, false);
            }
            return idempotency.get(identity);
        }
        Map<String, Object> result = action.get();
        idempotency.put(identity, result);
        idempotencyFingerprints.put(identity, fingerprint);
        return result;
    }

    private void appendFact(String aggregateType, String aggregateId, long userId,
                            String idempotencyKey, Map<String, Object> payload) {
        durableRepository.append(new B4DurableRepository.Fact(aggregateType, aggregateId, userId,
                requestId(), idempotencyKey, clock.instant(), payload));
    }

    private void hydrateDurableFacts() {
        for (String type : DURABLE_TYPES) {
            if (hydratedDurableTypes.contains(type)) continue;
            List<B4DurableRepository.Fact> facts = durableRepository.listAll(type);
            for (B4DurableRepository.Fact fact : facts) replayFact(fact);
            hydratedDurableTypes.add(type);
        }
    }

    /** Rebuilds the lightweight projections from the append-only B4 fact table. */
    private void replayFact(B4DurableRepository.Fact fact) {
        Map<String, Object> payload = fact.payload();
        switch (fact.aggregateType()) {
            case "SOC_BLOCK" -> {
                Long target = safeLong(payload.get("targetUserId"));
                if (target != null) blocksByUser.computeIfAbsent(fact.userId(), ignored -> new LinkedHashSet<>()).add(target);
            }
            case "SOC_MUTE" -> {
                String roomId = text(payload.get("roomId"), "");
                Long target = safeLong(payload.get("targetUserId"));
                Instant expires = instant(payload.get("expiresAt"));
                if (!roomId.isBlank() && target != null && expires != null) mutes.put(roomId + ":" + target,
                        new Mute(roomId, fact.userId(), target, expires));
            }
            case "SOC_MODERATION_REPORT" -> replayReport(payload, fact.userId());
            case "SOC_MODERATION_APPEAL" -> {
                String reportId = text(payload.get("reportId"), "");
                Report report = reports.get(reportId);
                if (report != null) { report.appealed = true; report.appealId = text(payload.get("appealId"), null); report.status = "APPEALED"; }
            }
            case "INF_SYNC_EVENT" -> replaySyncEvent(payload, fact.userId());
            case "INF_SYNC_CHECKPOINT" -> {
                String entityId = text(payload.get("entityId"), "");
                Long version = safeLong(payload.get("entityVersion"));
                if (!entityId.isBlank() && version != null) syncEntities.put(fact.userId() + ":" + entityId,
                        new SyncEntity(version, "CHECKPOINT"));
            }
            default -> { /* Room/focus/offline replay is intentionally handled by live facts below. */ }
        }
    }

    private void replayReport(Map<String, Object> payload, long reporterId) {
        String reportId = text(payload.get("reportId"), "");
        Long target = safeLong(payload.get("targetUserId"));
        if (reportId.isBlank() || target == null) return;
        Report report = new Report(reportId, reporterId, target, optionalSafeId(payload.get("roomId")),
                text(payload.get("reasonCode"), "OTHER"), instant(payload.get("occurredAt")) == null
                        ? clock.instant() : instant(payload.get("occurredAt")));
        report.status = text(payload.get("status"), "RECEIVED");
        reports.putIfAbsent(reportId, report);
    }

    private void replaySyncEvent(Map<String, Object> payload, long userId) {
        String clientEventId = optionalSafeId(payload.get("clientEventId"));
        Long sequence = safeLong(payload.get("serverSequence"));
        if (clientEventId == null || sequence == null) return;
        String device = "device-unknown";
        String identity = userId + ":" + device + ":" + clientEventId;
        syncResults.putIfAbsent(identity, new SyncResult(clientEventId, "ACCEPTED", "APPLIED",
                optionalSafeId(payload.get("serverEventId")), sequence));
        syncSequences.put(userId, Math.max(syncSequences.getOrDefault(userId, 0L), sequence));
        syncChanges.computeIfAbsent(userId, ignored -> new ArrayList<>()).add(new SyncChange(sequence,
                text(payload.get("eventType"), "SYNC_EVENT"), optionalSafeId(payload.get("entityId")),
                safeLong(payload.get("entityVersion")) == null ? 0 : safeLong(payload.get("entityVersion")),
                instant(payload.get("occurredAt")) == null ? clock.instant() : instant(payload.get("occurredAt"))));
    }

    private static Map<String, Object> stringMap(Map<?, ?> source) {
        Map<String, Object> result = new LinkedHashMap<>();
        source.forEach((key, value) -> result.put(String.valueOf(key), value));
        return result;
    }

    private void rejectUnknownFields(Map<String, Object> body, Set<String> allowed) {
        for (String field : body.keySet()) {
            if (!allowed.contains(field)) {
                if (SOCIAL_TEXT_FIELDS.contains(field)) {
                    throw error("SOC_TEXT_NOT_ALLOWED", "free text and extension fields are not supported", 422, false);
                }
                throw error("SOC_SCHEMA_INVALID", "unsupported field: " + field, 400, false);
            }
        }
    }

    private void rejectClientFields(Map<String, Object> body, Set<String> fields) {
        for (String field : fields) if (body.containsKey(field)) {
            throw error(SOCIAL_TEXT_FIELDS.contains(field) ? "SOC_TEXT_NOT_ALLOWED" : "SOC_CLIENT_FIELD_FORBIDDEN",
                    field + " is not accepted from the client", SOCIAL_TEXT_FIELDS.contains(field) ? 422 : 400, false);
        }
    }

    private static void requireKey(String key) {
        if (key == null || key.isBlank() || key.length() < 8 || key.length() > 96
                || key.contains("\r") || key.contains("\n")) {
            throw error("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key must contain 8-96 safe characters", 400, false);
        }
    }

    private static String requiredSafeId(Object value, String field) {
        String result = text(value, "");
        if (!SAFE_ID.matcher(result).matches()) throw error("SYNC_PAYLOAD_INVALID", field + " is invalid", 422, false);
        return result;
    }

    private static String optionalSafeId(Object value) {
        if (value == null) return null;
        String result = String.valueOf(value);
        if (result.isBlank()) return null;
        if (!SAFE_ID.matcher(result).matches()) throw error("SOC_SCHEMA_INVALID", "identifier is invalid", 400, false);
        return result;
    }

    private static String requiredText(Map<String, Object> body, String field) {
        String result = text(body.get(field), "");
        if (result.isBlank()) throw error("SYNC_PAYLOAD_INVALID", field + " is required", 422, false);
        return result;
    }

    private static int preferredSeat(Object value) {
        if (value == null) return 0;
        String text = String.valueOf(value).replace("SEAT-", "");
        try { return Integer.parseInt(text); }
        catch (NumberFormatException exception) { throw error("SOC_SEAT_PREFERENCE_INVALID", "seatPreference is invalid", 400, false); }
    }

    private static int intValue(Object value, String field) {
        if (value instanceof Number number) return number.intValue();
        try { return Integer.parseInt(String.valueOf(value)); }
        catch (Exception exception) { throw error("SOC_SCHEMA_INVALID", field + " must be an integer", 400, false); }
    }

    private static long longValue(Object value, String field) {
        if (value instanceof Number number) return number.longValue();
        try { return Long.parseLong(String.valueOf(value)); }
        catch (Exception exception) { throw error("SOC_SCHEMA_INVALID", field + " must be an integer", 400, false); }
    }

    private static Long safeLong(Object value) {
        if (value == null) return null;
        try { return value instanceof Number number ? number.longValue() : Long.parseLong(String.valueOf(value)); }
        catch (Exception exception) { throw error("SOC_SCHEMA_INVALID", "numeric identifier is invalid", 400, false); }
    }

    private static Instant instant(Object value) {
        if (value == null) return null;
        try { return Instant.parse(String.valueOf(value)); }
        catch (DateTimeParseException exception) { return null; }
    }

    private static String text(Object value, String fallback) {
        return value == null ? fallback : String.valueOf(value);
    }

    private static int safeLimit(int value) { return Math.max(1, Math.min(value <= 0 ? 20 : value, 100)); }

    private static String requestId() { return "req_social_" + UUID.randomUUID(); }

    private static long currentVersion(SyncEntity entity) { return entity == null ? 0 : entity.version; }

    private static B4Exception error(String code, String message, int status, boolean retryable) {
        return new B4Exception(code, message, status, retryable);
    }

    private static Map<String, Object> map(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int index = 0; index + 1 < values.length; index += 2) {
            if (values[index + 1] != null) result.put(String.valueOf(values[index]), values[index + 1]);
        }
        return result;
    }

    private static String fingerprint(Object value) {
        String canonical = canonical(value);
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(64);
            for (byte item : digest) result.append(String.format("%02x", item));
            return result.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required", exception);
        }
    }

    private static String canonical(Object value) {
        if (value == null) return "null";
        if (value instanceof Map<?, ?> source) {
            StringBuilder result = new StringBuilder("{");
            new TreeMap<>(stringMap(source)).forEach((key, item) -> result.append(key).append(':').append(canonical(item)).append(';'));
            return result.append('}').toString();
        }
        if (value instanceof Collection<?> collection) {
            return collection.stream().map(B4SocialService::canonical).reduce("[", (left, right) -> left + right + ";") + "]";
        }
        return String.valueOf(value);
    }

    private static Map<String, Object> defaultNotificationPreferences() {
        return new LinkedHashMap<>(map("roomInteractions", true, "focusReminders", true,
                "system", true, "doNotDisturb", false, "version", 1L));
    }

    private static final class Room {
        final String id;
        final String name;
        final String templateCode;
        final int capacity;
        final Map<Long, Member> members = new LinkedHashMap<>();
        final Map<Integer, Seat> seats = new LinkedHashMap<>();
        final Deque<Map<String, Object>> events = new ArrayDeque<>();
        long sequence;
        long version = 1;
        long ownerUserId;

        Room(String id, String name, String templateCode, int capacity) {
            this.id = id; this.name = name; this.templateCode = templateCode; this.capacity = capacity;
            for (int index = 1; index <= capacity; index++) seats.put(index, new Seat(index));
        }

        List<Member> activeMembers() {
            return members.values().stream().filter(member -> "ACTIVE".equals(member.status)).toList();
        }

        Map<String, Object> view(long userId, boolean snapshot) {
            Member self = members.get(userId);
            Map<String, Object> result = map("roomId", id, "roomCode", id, "name", name,
                    "displayName", name, "templateCode", templateCode, "themeCode", templateCode,
                    "capacity", capacity, "memberCount", activeMembers().size(),
                    "occupiedCount", (int) seats.values().stream().filter(seat -> !"AVAILABLE".equals(seat.state)).count(),
                    "joined", self != null && "ACTIVE".equals(self.status), "roomVersion", version,
                    "chatMode", "PRESET_ONLY", "wsRequired", true, "soundCatalogVersion", "SOUND-2026-08",
                    "presetCatalogVersion", "SOCIAL_PRESET-2026-08");
            if (snapshot) {
                result.put("seats", seats.values().stream().map(Seat::publicView).toList());
                result.put("members", activeMembers().stream().map(Member::publicView).toList());
                result.put("self", self == null ? null : self.publicSelfView());
            }
            return result;
        }
    }

    private static final class Member {
        final String membershipId;
        final long userId;
        final String roleCode;
        final Instant joinedAt;
        String status = "ACTIVE";
        Instant leftAt;
        Instant lastActivityAt;

        Member(String membershipId, long userId, String roleCode, Instant joinedAt) {
            this.membershipId = membershipId; this.userId = userId; this.roleCode = roleCode; this.joinedAt = joinedAt;
        }

        Map<String, Object> publicView() { return map("membershipId", membershipId, "userId", userId,
                "roleCode", roleCode, "status", status); }

        Map<String, Object> publicSelfView() { return map("membershipId", membershipId, "userId", userId,
                "roleCode", roleCode, "status", status, "lastActivityAt", lastActivityAt == null ? null : lastActivityAt.toString()); }

        Map<String, Object> seatView() { return map("membershipId", membershipId, "status", status); }
    }

    private static final class Seat {
        final int seatIndex;
        long userId;
        String state = "AVAILABLE";
        String leaseId;
        long leaseVersion;
        Instant leaseExpiresAt;
        Instant lastHeartbeatAt;
        Instant lastActivityAt;
        Instant disconnectedAt;
        Instant releasedAt;
        String releaseReason;
        long version;

        Seat(int seatIndex) { this.seatIndex = seatIndex; }

        Map<String, Object> publicView() { return map("seatIndex", seatIndex, "status", state,
                "publicMember", userId == 0 ? null : map("userId", userId), "leaseVersion", leaseVersion,
                "leaseExpiresAt", leaseExpiresAt == null ? null : leaseExpiresAt.toString()); }

        Map<String, Object> view() { return map("seatIndex", seatIndex, "status", state, "leaseId", leaseId,
                "leaseVersion", leaseVersion, "leaseExpiresAt", leaseExpiresAt == null ? null : leaseExpiresAt.toString(),
                "serverVersion", version); }
    }

    private static final class SeatRef {
        final String roomId; final int seatIndex;
        SeatRef(String roomId, int seatIndex) { this.roomId = roomId; this.seatIndex = seatIndex; }
    }

    private static final class FocusSession {
        final String id; final long userId; final String roomId; final int seatIndex; final int durationMinutes; final Instant startedAt;
        String state = "RUNNING"; String focusTagCode; Instant segmentStartedAt; Instant pausedAt; Instant endedAt;
        long elapsedBeforeSegment; long serverDurationSeconds; long qualifiedSeconds;

        FocusSession(String id, long userId, String roomId, int seatIndex, int durationMinutes, Instant startedAt) {
            this.id = id; this.userId = userId; this.roomId = roomId; this.seatIndex = seatIndex;
            this.durationMinutes = durationMinutes; this.startedAt = startedAt; this.segmentStartedAt = startedAt;
        }

        void pause(Instant now) { elapsedBeforeSegment = activeSeconds(now); segmentStartedAt = null; pausedAt = now; state = "PAUSED"; }
        void resume(Instant now) { segmentStartedAt = now; pausedAt = null; state = "RUNNING"; }
        void finish(String finalState, Instant now) { serverDurationSeconds = activeSeconds(now); elapsedBeforeSegment = serverDurationSeconds;
            segmentStartedAt = null; endedAt = now; state = finalState; qualifiedSeconds = serverDurationSeconds >= durationMinutes * 60L
                    ? Math.min(serverDurationSeconds, durationMinutes * 60L) : 0; }
        long activeSeconds(Instant now) { return Math.max(0, elapsedBeforeSegment + ("RUNNING".equals(state) && segmentStartedAt != null
                ? Duration.between(segmentStartedAt, now).toSeconds() : 0)); }
        Map<String, Object> view(Instant now) { long live = "RUNNING".equals(state) ? activeSeconds(now) : serverDurationSeconds;
            return map("sessionId", id, "roomId", roomId, "seatIndex", seatIndex, "state", state,
                    "status", state, "durationMinutes", durationMinutes, "focusTagCode", focusTagCode,
                    "startedAt", startedAt.toString(), "endedAt", endedAt == null ? null : endedAt.toString(),
                    "serverDurationSeconds", live, "qualifiedSeconds", qualifiedSeconds); }
    }

    private static final class B4WsTicket {
        final String ticket; final long userId; final String deviceId; final String roomId; final String origin; final Instant expiresAt;
        B4WsTicket(String ticket, long userId, String deviceId, String roomId, String origin, Instant expiresAt) {
            this.ticket = ticket; this.userId = userId; this.deviceId = deviceId; this.roomId = roomId; this.origin = origin; this.expiresAt = expiresAt;
        }
    }

    private static final class Mute {
        final String roomId; final long actorUserId; final long targetUserId; final Instant expiresAt;
        Mute(String roomId, long actorUserId, long targetUserId, Instant expiresAt) {
            this.roomId = roomId; this.actorUserId = actorUserId; this.targetUserId = targetUserId; this.expiresAt = expiresAt;
        }
        Map<String, Object> view(boolean already) { return map("muted", true, "alreadyMuted", already, "roomId", roomId,
                "targetUserId", targetUserId, "expiresAt", expiresAt.toString(), "expiresInSeconds",
                Math.max(0, Duration.between(Instant.now(), expiresAt).toSeconds())); }
    }

    private static final class Report {
        final String reportId; final long reporterUserId; final long targetUserId; final String roomId; final String reasonCode; final Instant createdAt;
        String status = "RECEIVED"; boolean appealed; String appealId;
        Report(String reportId, long reporterUserId, long targetUserId, String roomId, String reasonCode, Instant createdAt) {
            this.reportId = reportId; this.reporterUserId = reporterUserId; this.targetUserId = targetUserId;
            this.roomId = roomId; this.reasonCode = reasonCode; this.createdAt = createdAt;
        }
        Map<String, Object> view() { return map("reportId", reportId, "status", status, "reviewMode", "MANUAL",
                "targetUserId", targetUserId, "roomId", roomId, "reasonCode", reasonCode, "createdAt", createdAt.toString(),
                "appealed", appealed, "appealId", appealId); }
    }

    private static final class OfflinePackage {
        final String packageId; final String packageCode; final String versionCode; final long sizeBytes; final int partCount;
        final String sha256; final String signature; final String minClientVersion; final Instant expiresAt; String state = "PUBLISHED";
        OfflinePackage(String packageId, String packageCode, String versionCode, long sizeBytes, int partCount, String sha256,
                       String signature, String minClientVersion, Instant expiresAt) { this.packageId = packageId; this.packageCode = packageCode;
            this.versionCode = versionCode; this.sizeBytes = sizeBytes; this.partCount = partCount; this.sha256 = sha256; this.signature = signature;
            this.minClientVersion = minClientVersion; this.expiresAt = expiresAt; }
        Map<String, Object> view(long userId, OfflineDownload download) { return map("packageId", packageId, "packageCode", packageCode,
                "version", versionCode, "versionCode", versionCode, "state", state, "sizeBytes", sizeBytes, "partCount", partCount,
                "sha256", sha256, "signature", signature, "minClientVersion", minClientVersion, "expiresAt", expiresAt.toString(),
                "downloadId", download == null ? null : download.downloadId, "downloadState", download == null ? null : download.state,
                "completedPartCount", download == null ? 0 : download.completed.cardinality(),
                "downloadedBytes", download == null ? 0 : download.downloadedBytes); }
    }

    private static final class OfflineDownload {
        final String downloadId; final OfflinePackage packageValue; final long userId; final String deviceId; final Instant createdAt;
        final BitSet completed = new BitSet(); final Map<Integer, String> partEtags = new LinkedHashMap<>();
        String state = "AUTHORIZED"; long downloadedBytes;
        OfflineDownload(String downloadId, OfflinePackage packageValue, long userId, String deviceId, Instant createdAt) {
            this.downloadId = downloadId; this.packageValue = packageValue; this.userId = userId; this.deviceId = deviceId; this.createdAt = createdAt; }
        Map<String, Object> view() { return map("downloadId", downloadId, "packageId", packageValue.packageId, "deviceId", deviceId,
                "state", state, "partCount", packageValue.partCount, "completedPartCount", completed.cardinality(),
                "downloadedBytes", downloadedBytes, "sizeBytes", packageValue.sizeBytes, "version", packageValue.versionCode); }
    }

    private static final class SyncEntity {
        final long version; final String fingerprint;
        SyncEntity(long version, String fingerprint) { this.version = version; this.fingerprint = fingerprint; }
    }

    private static final class SyncResult {
        final String clientEventId; final String status; final String resultCode; final String serverEventId; final long serverSequence;
        SyncResult(String clientEventId, String status, String resultCode, String serverEventId, long serverSequence) {
            this.clientEventId = clientEventId; this.status = status; this.resultCode = resultCode; this.serverEventId = serverEventId; this.serverSequence = serverSequence; }
        Map<String, Object> view() { return map("clientEventId", clientEventId, "status", status, "resultCode", resultCode,
                "serverEventId", serverEventId, "serverCursor", serverSequence == 0 ? null : "SEQ-" + serverSequence); }
        Map<String, Object> duplicateView() { Map<String, Object> result = new LinkedHashMap<>(view()); result.put("status", "DUPLICATE"); return result; }
    }

    private record SyncProcessing(Map<String, Object> result, SyncResult state) {}

    private static final class SyncChange {
        final long sequence; final String eventType; final String entityId; final long entityVersion; final Instant occurredAt;
        SyncChange(long sequence, String eventType, String entityId, long entityVersion, Instant occurredAt) {
            this.sequence = sequence; this.eventType = eventType; this.entityId = entityId; this.entityVersion = entityVersion; this.occurredAt = occurredAt; }
        Map<String, Object> view() { return map("streamSeq", sequence, "changeType", eventType, "entityType", eventType,
                "entityId", entityId, "entityVersion", entityVersion, "payload", map("serverOwned", true),
                "tombstone", false, "occurredAt", occurredAt.toString()); }
    }

    private record CursorState(long userId, long sequence) {}
}
