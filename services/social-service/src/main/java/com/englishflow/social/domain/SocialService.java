package com.englishflow.social.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.regex.Pattern;

import com.englishflow.social.security.SocialPep;
import com.englishflow.social.security.SocialPrincipal;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Social domain boundary for B12-SOC-002.
 *
 * <p>The current adapter is deliberately deterministic and in-memory so the state machines and
 * smoke tests can run without a shared database. The service-owned Flyway migration in this
 * module is the durable schema boundary. No method in this class writes a gamification ledger;
 * leaderboard values only move when a verified learning/growth event is consumed.</p>
 */
@Service
public final class SocialService {

    public static final ZoneId DISPLAY_ZONE = ZoneId.of("Asia/Shanghai");
    public static final int ROOM_CAPACITY = 25;
    public static final Duration LEASE_DURATION = Duration.ofSeconds(90);
    public static final Duration DISCONNECT_GRACE = Duration.ofSeconds(60);
    public static final Duration IDLE_RELEASE = Duration.ofMinutes(5);
    public static final Set<Integer> FOCUS_DURATIONS = Set.of(25, 45);
    public static final Set<String> FOCUS_TAGS = Set.of(
            "VOCABULARY", "LISTENING", "READING", "GRAMMAR", "SPEAKING", "WRITING");
    public static final Set<String> PRESET_CODES = Set.of(
            "CHEER_UP", "STUDY_TOGETHER", "CONGRATS", "TRY_AGAIN", "TONIGHT_20_MIN");
    public static final Set<String> REPORT_REASONS = Set.of(
            "SPAM", "HARASSMENT", "SENSITIVE_CONTENT", "IMPERSONATION", "OTHER");
    public static final Set<String> MODERATION_ACTIONS = Set.of(
            "TRIAGE", "START_REVIEW", "ACTION", "REJECT", "CLOSE");

    private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9._:-]{1,160}");
    private static final Set<String> FREE_TEXT_FIELDS = Set.of(
            "text", "message", "content", "html", "markdown", "url", "emoji", "extra",
            "note", "description", "comment", "body", "attachment");
    private static final Set<String> CLIENT_AUTHORITY_FIELDS = Set.of(
            "userid", "subjectid", "tenantid", "ownerid", "role", "permission", "score",
            "rank", "minutes", "qualifiedminutes", "newwords", "xp", "ledgerid");
    private static final Set<String> SERVICE_EVENT_TYPES = Set.of(
            "learning.activity.v1",
            "learning.focus.qualified.v1",
            "learning.focus_completed.v1",
            "learning.mastery.reached.v1",
            "learning.mastery_reached.v1",
            "gamification.xp.ledger_posted.v1",
            "leaderboard.refreshed.v1",
            "leaderboard.frozen.v1");
    private static final Set<String> LEARNING_SOURCES = Set.of("learning-service");
    private static final Set<String> GROWTH_SOURCES = Set.of("gamification-service");
    private static final Set<String> WORKFLOW_SOURCES = Set.of("workflow-service", "social-workflow");

    private final Clock clock;
    private final SocialPep pep = new SocialPep();
    private final Map<String, Room> rooms = new LinkedHashMap<>();
    private final Map<String, SeatRef> activeSeatBySubject = new LinkedHashMap<>();
    private final Map<String, FocusSession> focusSessions = new LinkedHashMap<>();
    private final Map<String, String> activeFocusBySubject = new LinkedHashMap<>();
    private final Map<String, Map<String, Object>> idempotencyResults = new LinkedHashMap<>();
    private final Map<String, String> idempotencyFingerprints = new LinkedHashMap<>();
    private final Map<String, Deque<Instant>> interactionWindows = new LinkedHashMap<>();
    private final Map<String, Deque<Instant>> interactionHourlyWindows = new LinkedHashMap<>();
    private final Map<String, Deque<Instant>> interactionTargetWindows = new LinkedHashMap<>();
    private final Map<String, Map<String, Object>> interactionByClientEvent = new LinkedHashMap<>();
    private final Map<String, Report> reports = new LinkedHashMap<>();
    private final Map<String, String> reportByFingerprint = new LinkedHashMap<>();
    private final Map<String, String> trustedEventFingerprints = new LinkedHashMap<>();
    private final Map<LeaderboardKey, Leaderboard> leaderboards = new LinkedHashMap<>();
    private final Map<String, Visibility> globalLeaderboardVisibility = new LinkedHashMap<>();
    private final List<Map<String, Object>> factJournal = new ArrayList<>();

    public SocialService(Clock clock) {
        this.clock = Objects.requireNonNull(clock, "clock is required");
        seedRooms();
    }

    public synchronized Map<String, Object> listRooms(SocialPrincipal principal, int limit) {
        pep.requirePermission(principal, SocialPep.ROOM_READ);
        int safeLimit = Math.max(1, Math.min(limit <= 0 ? 20 : limit, 50));
        List<Map<String, Object>> items = rooms.values().stream()
                .filter(room -> room.tenantId.equals(principal.tenantId()))
                .sorted(Comparator.comparing(room -> room.roomId))
                .limit(safeLimit)
                .map(room -> roomSummary(room))
                .toList();
        return map("items", items, "limit", safeLimit, "hasMore", rooms.size() > safeLimit,
                "nextCursor", rooms.size() > safeLimit ? "rooms:" + safeLimit : null,
                "serverTime", now().toString());
    }

    public synchronized Map<String, Object> getRoom(SocialPrincipal principal, String roomId) {
        Room room = requireRoom(principal, roomId);
        pep.requirePermission(principal, SocialPep.ROOM_MEMBER_READ);
        Member member = requireActiveMember(room, principal.subjectId());
        return roomView(room, member);
    }

    public synchronized Map<String, Object> join(
            SocialPrincipal principal, String roomId, Map<String, Object> rawBody, String idempotencyKey) {
        pep.requirePermission(principal, SocialPep.ROOM_JOIN);
        Room room = requireRoom(principal, roomId);
        Map<String, Object> body = body(rawBody);
        rejectFields(body, Set.of("preferredSeatIndex", "focusTagCode", "clientEventId"));
        int preferredSeatIndex = optionalInt(body.get("preferredSeatIndex"), 0, "preferredSeatIndex");
        if (preferredSeatIndex < 0 || preferredSeatIndex > room.capacity) {
            throw SocialException.invalid("SOC_SEAT_INDEX_INVALID", "preferredSeatIndex is outside the room");
        }
        String focusTag = optionalString(body.get("focusTagCode"));
        if (focusTag != null && !FOCUS_TAGS.contains(focusTag)) {
            throw SocialException.unprocessable("SOC_FOCUS_TAG_NOT_ALLOWED", "focusTagCode is not allowlisted");
        }
        String clientEventId = optionalSafeId(body.get("clientEventId"));
        return idempotent(principal, "join:" + room.roomId, idempotencyKey, body, () ->
                joinInternal(principal, room, preferredSeatIndex, focusTag, clientEventId));
    }

    public synchronized Map<String, Object> leave(
            SocialPrincipal principal, String roomId, Map<String, Object> rawBody, String idempotencyKey) {
        pep.requirePermission(principal, SocialPep.ROOM_WRITE);
        Room room = requireRoom(principal, roomId);
        Map<String, Object> body = body(rawBody);
        rejectFields(body, Set.of("reason", "clientEventId"));
        String reason = optionalString(body.getOrDefault("reason", "USER_LEAVE"));
        if (!Set.of("USER_LEAVE", "SWITCH_ROOM", "LOGOUT", "DEVICE_KICKED", "LEASE_TIMEOUT", "IDLE_TIMEOUT")
                .contains(reason)) {
            throw SocialException.invalid("SOC_LEAVE_REASON_INVALID", "reason is not allowlisted");
        }
        String clientEventId = optionalSafeId(body.get("clientEventId"));
        return idempotent(principal, "leave:" + room.roomId, idempotencyKey, body, () ->
                leaveInternal(principal, room, reason, clientEventId));
    }

    public synchronized Map<String, Object> disconnect(
            SocialPrincipal principal, String roomId, Map<String, Object> rawBody, String idempotencyKey) {
        pep.requirePermission(principal, SocialPep.ROOM_WRITE);
        Room room = requireRoom(principal, roomId);
        Map<String, Object> body = body(rawBody);
        rejectFields(body, Set.of("leaseId", "leaseVersion", "clientEventId"));
        return idempotent(principal, "disconnect:" + room.roomId, idempotencyKey, body, () -> {
            Member member = requireActiveMember(room, principal.subjectId());
            Seat seat = requireMemberSeat(room, member);
            if (seat.state == SeatState.DISCONNECTED) {
                return seatView(room, seat, principal.subjectId(), true);
            }
            ensureLeaseUsable(seat);
            seat.state = SeatState.DISCONNECTED;
            seat.disconnectedAt = now();
            seat.leaseExpiresAt = min(seat.leaseExpiresAt, now().plus(DISCONNECT_GRACE));
            member.presence = PresenceState.DISCONNECTED;
            room.version++;
            emitFact("study_room.disconnected.v1", principal.subjectId(), room,
                    map("seatIndex", seat.seatIndex, "leaseId", seat.leaseId));
            return map("roomId", room.roomId, "seatIndex", seat.seatIndex, "state", seat.state.name(),
                    "recoverUntil", seat.disconnectedAt.plus(DISCONNECT_GRACE).toString(),
                    "leaseId", seat.leaseId, "leaseVersion", seat.leaseVersion, "serverTime", now().toString());
        });
    }

    public synchronized Map<String, Object> recover(
            SocialPrincipal principal, String roomId, Map<String, Object> rawBody, String idempotencyKey) {
        pep.requirePermission(principal, SocialPep.ROOM_WRITE);
        Room room = requireRoom(principal, roomId);
        Map<String, Object> body = body(rawBody);
        rejectFields(body, Set.of("leaseId", "leaseVersion", "clientEventId"));
        String leaseId = optionalSafeId(body.get("leaseId"));
        Long leaseVersion = optionalLong(body.get("leaseVersion"), "leaseVersion");
        return idempotent(principal, "recover:" + room.roomId, idempotencyKey, body, () ->
                recoverInternal(principal, room, leaseId, leaseVersion));
    }

    public synchronized Map<String, Object> renewLease(
            SocialPrincipal principal, String roomId, Map<String, Object> rawBody, String idempotencyKey) {
        pep.requirePermission(principal, SocialPep.ROOM_WRITE);
        Room room = requireRoom(principal, roomId);
        Map<String, Object> body = body(rawBody);
        rejectFields(body, Set.of("leaseId", "leaseVersion", "clientEventId"));
        String leaseId = optionalSafeId(body.get("leaseId"));
        Long leaseVersion = optionalLong(body.get("leaseVersion"), "leaseVersion");
        return idempotent(principal, "renew:" + room.roomId, idempotencyKey, body, () -> {
            Member member = requireActiveMember(room, principal.subjectId());
            Seat seat = requireMemberSeat(room, member);
            checkLeaseToken(seat, leaseId, leaseVersion);
            ensureLeaseUsable(seat);
            seat.leaseExpiresAt = now().plus(LEASE_DURATION);
            // A transport heartbeat renews the lease only. It never becomes learning activity.
            return map("roomId", room.roomId, "seatIndex", seat.seatIndex, "leaseId", seat.leaseId,
                    "leaseVersion", seat.leaseVersion, "leaseExpiresAt", seat.leaseExpiresAt.toString(),
                    "activityUpdated", false, "serverTime", now().toString());
        });
    }

    public synchronized Map<String, Object> startFocus(
            SocialPrincipal principal, String roomId, Map<String, Object> rawBody, String idempotencyKey) {
        pep.requirePermission(principal, SocialPep.FOCUS_WRITE);
        Room room = requireRoom(principal, roomId);
        Map<String, Object> body = body(rawBody);
        rejectFields(body, Set.of("durationMinutes", "focusTagCode", "clientEventId"));
        int durationMinutes = requiredInt(body.get("durationMinutes"), "durationMinutes");
        if (!FOCUS_DURATIONS.contains(durationMinutes)) {
            throw SocialException.invalid("SOC_FOCUS_DURATION_INVALID", "durationMinutes must be 25 or 45");
        }
        String focusTag = optionalString(body.get("focusTagCode"));
        if (focusTag == null || !FOCUS_TAGS.contains(focusTag)) {
            throw SocialException.invalid("SOC_FOCUS_TAG_INVALID", "focusTagCode must be an allowlisted tag");
        }
        String clientEventId = requiredSafeId(body.get("clientEventId"), "clientEventId");
        return idempotent(principal, "focus-start:" + room.roomId, idempotencyKey, body, () -> {
            Member member = requireActiveMember(room, principal.subjectId());
            Seat seat = requireMemberSeat(room, member);
            ensureLeaseUsable(seat);
            FocusSession existing = activeFocus(principal.tenantId(), principal.subjectId());
            if (existing != null) {
                throw SocialException.conflict("SOC_FOCUS_ALREADY_RUNNING", "one active focus session is already owned by the subject", false);
            }
            String focusId = "FOCUS-" + UUID.randomUUID();
            FocusSession focus = new FocusSession(focusId, principal.tenantId(), principal.subjectId(), room.roomId,
                    seat.seatIndex, seat.leaseId, durationMinutes, focusTag, now());
            // A server-created focus session is an explicit lease holder. Keep the seat
            // alive through the selected focus window; ordinary seats still use the
            // short lease and must renew through the heartbeat boundary.
            Instant focusLeaseDeadline = now().plus(Duration.ofMinutes(durationMinutes));
            if (seat.leaseExpiresAt.isBefore(focusLeaseDeadline)) {
                seat.leaseExpiresAt = focusLeaseDeadline;
            }
            focusSessions.put(focusId, focus);
            activeFocusBySubject.put(subjectKey(principal.tenantId(), principal.subjectId()), focusId);
            seat.focusId = focusId;
            seat.focusTagCode = focusTag;
            member.presence = PresenceState.FOCUS;
            room.version++;
            emitFact("study_room.focus_started.v1", principal.subjectId(), room,
                    map("focusId", focusId, "durationMinutes", durationMinutes, "focusTagCode", focusTag));
            return focusView(focus, false);
        });
    }

    public synchronized Map<String, Object> updateFocus(
            SocialPrincipal principal, String focusId, Map<String, Object> rawBody, String idempotencyKey) {
        pep.requirePermission(principal, SocialPep.FOCUS_WRITE);
        Map<String, Object> body = body(rawBody);
        rejectFields(body, Set.of("action", "clientEventId"));
        String action = requiredString(body.get("action"), "action");
        if (!Set.of("PAUSE", "RESUME", "FINISH", "ABORT").contains(action)) {
            throw SocialException.invalid("SOC_FOCUS_ACTION_INVALID", "focus action is not allowlisted");
        }
        String clientEventId = optionalSafeId(body.get("clientEventId"));
        FocusSession focus = focusSessions.get(focusId);
        if (focus == null) {
            throw SocialException.notFound("SOC_FOCUS_NOT_FOUND", "focus session does not exist");
        }
        if (!focus.tenantId.equals(principal.tenantId())) {
            throw SocialException.forbidden("SOCIAL_TENANT_FORBIDDEN", "focus session is outside the tenant scope");
        }
        if (!focus.subjectId.equals(principal.subjectId())) {
            throw SocialException.forbidden("SOCIAL_OWNER_FORBIDDEN", "focus session belongs to another subject");
        }
        return idempotent(principal, "focus-update:" + focusId, idempotencyKey, body, () ->
                updateFocusInternal(principal, focus, action, clientEventId));
    }

    public synchronized Map<String, Object> interaction(
            SocialPrincipal principal, String roomId, Map<String, Object> rawBody, String idempotencyKey) {
        pep.requirePermission(principal, SocialPep.INTERACTION_SEND);
        Room room = requireRoom(principal, roomId);
        Map<String, Object> body = body(rawBody);
        rejectFields(body, Set.of("presetCode", "targetSeatIndex", "clientEventId"));
        String presetCode = requiredString(body.get("presetCode"), "presetCode");
        if (!PRESET_CODES.contains(presetCode)) {
            throw SocialException.unprocessable("SOC_PRESET_NOT_ALLOWED", "presetCode is not published");
        }
        int targetSeatIndex = optionalInt(body.get("targetSeatIndex"), 0, "targetSeatIndex");
        if (targetSeatIndex < 0 || targetSeatIndex > room.capacity) {
            throw SocialException.invalid("SOC_SEAT_INDEX_INVALID", "targetSeatIndex is outside the room");
        }
        String clientEventId = requiredSafeId(body.get("clientEventId"), "clientEventId");
        String eventKey = subjectKey(principal.tenantId(), principal.subjectId()) + ":" + clientEventId;
        Map<String, Object> priorClientEvent = interactionByClientEvent.get(eventKey);
        if (priorClientEvent != null) {
            return priorClientEvent;
        }
        return idempotent(principal, "interaction:" + room.roomId, idempotencyKey, body, () -> {
            Member sender = requireActiveMember(room, principal.subjectId());
            Seat senderSeat = requireMemberSeat(room, sender);
            ensureLeaseUsable(senderSeat);
            Member target = null;
            if (targetSeatIndex > 0) {
                Seat targetSeat = room.seats.get(targetSeatIndex);
                if (targetSeat == null || targetSeat.subjectId == null || targetSeat.state == SeatState.AVAILABLE) {
                    throw SocialException.forbidden("SOC_INTERACTION_TARGET_NOT_VISIBLE", "target is not an active room member");
                }
                target = room.members.get(targetSeat.subjectId);
                if (target == null || !target.active()) {
                    throw SocialException.forbidden("SOC_INTERACTION_TARGET_NOT_VISIBLE", "target is not an active room member");
                }
                if (target.subjectId.equals(principal.subjectId())) {
                    throw SocialException.invalid("SOC_INTERACTION_TARGET_INVALID", "target must be another room member");
                }
            }
            enforceInteractionLimits(principal, room, target);
            String eventId = "INTERACTION-" + UUID.randomUUID();
            Interaction interaction = new Interaction(eventId, principal.tenantId(), room.roomId,
                    principal.subjectId(), target == null ? null : target.subjectId, targetSeatIndex,
                    presetCode, clientEventId, now());
            interaction.state = InteractionState.DELIVERED;
            room.interactions.add(interaction);
            Map<String, Object> result = map("eventId", eventId, "roomId", room.roomId,
                    "presetCode", presetCode, "targetSeatIndex", targetSeatIndex == 0 ? null : targetSeatIndex,
                    "state", interaction.state.name(), "deliveredAt", interaction.deliveredAt.toString(),
                    "notificationCreated", false, "serverTime", now().toString());
            interactionByClientEvent.put(eventKey, result);
            emitFact("social.interaction.delivered.v1", principal.subjectId(), room,
                    map("eventId", eventId, "presetCode", presetCode, "targetSeatIndex", targetSeatIndex));
            return result;
        });
    }

    public synchronized Map<String, Object> leaderboard(
            SocialPrincipal principal, String kindValue, String periodValue, String roomId) {
        pep.requirePermission(principal, SocialPep.LEADERBOARD_READ);
        LeaderboardKind kind = parseEnum(kindValue, LeaderboardKind.class, "SOC_LEADERBOARD_KIND_INVALID");
        PeriodType period = parseEnum(periodValue, PeriodType.class, "SOC_LEADERBOARD_PERIOD_INVALID");
        Room scopedRoom = null;
        if (roomId != null && !roomId.isBlank()) {
            scopedRoom = requireRoom(principal, roomId);
            requireActiveMember(scopedRoom, principal.subjectId());
        }
        LocalDate periodStart = periodStart(now(), period);
        LeaderboardKey key = new LeaderboardKey(principal.tenantId(), kind, period, periodStart);
        Leaderboard board = leaderboards.get(key);
        if (board == null) {
            return delayedLeaderboard(principal, key, roomId);
        }
        List<ProjectionEntry> visible = board.entries.values().stream()
                .filter(entry -> !Visibility.OPT_OUT.equals(globalLeaderboardVisibility.getOrDefault(
                        subjectKey(principal.tenantId(), entry.subjectId), Visibility.NICKNAME)))
                .sorted(Comparator.comparingLong((ProjectionEntry entry) -> entry.score).reversed()
                        .thenComparing(entry -> entry.subjectId))
                .toList();
        List<Map<String, Object>> entries = new ArrayList<>();
        int rank = 0;
        long previousScore = Long.MIN_VALUE;
        int visibleRank = 0;
        for (ProjectionEntry entry : visible) {
            visibleRank++;
            if (entry.score != previousScore) {
                rank = visibleRank;
                previousScore = entry.score;
            }
            Map<String, Object> entryView = map("rank", rank,
                    "displayMode", displayMode(principal.tenantId(), entry.subjectId),
                    "displayName", displayName(principal.tenantId(), entry.subjectId), "score", entry.score,
                    "qualifiedUnits", entry.qualifiedUnits, "sourceWatermark", entry.sourceWatermark,
                    "isSelf", entry.subjectId.equals(principal.subjectId()));
            if (scopedRoom != null) {
                Seat scopedSeat = findSeat(scopedRoom, entry.subjectId);
                if (scopedSeat != null) {
                    // A room seat is an opaque, room-scoped reference. It lets the caller
                    // report a visible member without exposing subject IDs or accepting IDs
                    // from the client.
                    entryView.put("targetSeatIndex", scopedSeat.seatIndex);
                }
            }
            entries.add(entryView);
        }
        ProjectionEntry self = board.entries.get(principal.subjectId());
        boolean delayed = board.state == LeaderboardState.PROVISIONAL
                || board.lastProjectedAt == null
                || Duration.between(board.lastProjectedAt, now()).compareTo(Duration.ofSeconds(60)) > 0;
        return map("kind", kind.name(), "period", period.name(), "periodStart", periodStart.toString(),
                "periodEnd", periodEnd(period, periodStart).toString(), "timeZone", DISPLAY_ZONE.getId(),
                "projectionState", board.state.name(), "dataFreshness", delayed ? "DELAYED" : "CURRENT",
                "delayed", delayed, "asOf", board.lastProjectedAt == null ? null : board.lastProjectedAt.toString(),
                "snapshotVersion", board.snapshotVersion, "entries", entries,
                "me", self == null ? map("present", false, "visibility", visibility(principal.tenantId(), principal.subjectId()).name())
                        : map("present", true, "visibility", visibility(principal.tenantId(), principal.subjectId()).name(),
                                "score", self.score, "qualifiedUnits", self.qualifiedUnits),
                "sourceWatermark", board.sourceWatermark);
    }

    public synchronized Map<String, Object> setVisibility(
            SocialPrincipal principal, Map<String, Object> rawBody, String idempotencyKey) {
        pep.requirePermission(principal, SocialPep.VISIBILITY_WRITE);
        Map<String, Object> body = body(rawBody);
        rejectFields(body, Set.of("leaderboardVisibility", "roomVisibility"));
        Visibility leaderboard = optionalVisibility(body.get("leaderboardVisibility"), Visibility.NICKNAME);
        RoomVisibility roomVisibility = optionalRoomVisibility(body.get("roomVisibility"), RoomVisibility.PUBLIC);
        return idempotent(principal, "visibility", idempotencyKey, body, () -> {
            globalLeaderboardVisibility.put(subjectKey(principal.tenantId(), principal.subjectId()), leaderboard);
            for (Room room : rooms.values()) {
                Member member = room.members.get(principal.subjectId());
                if (member != null && member.tenantId.equals(principal.tenantId())) {
                    member.roomVisibility = roomVisibility;
                    member.privacyVersion++;
                }
            }
            return map("leaderboardVisibility", leaderboard.name(), "roomVisibility", roomVisibility.name(),
                    "updatedAt", now().toString());
        });
    }

    public synchronized Map<String, Object> report(
            SocialPrincipal principal, String roomId, Map<String, Object> rawBody, String idempotencyKey) {
        pep.requirePermission(principal, SocialPep.REPORT_CREATE);
        Room room = requireRoom(principal, roomId);
        Map<String, Object> body = body(rawBody);
        rejectFields(body, Set.of("targetSeatIndex", "reasonCode", "clientEventId"));
        int targetSeatIndex = requiredInt(body.get("targetSeatIndex"), "targetSeatIndex");
        String reasonCode = requiredString(body.get("reasonCode"), "reasonCode");
        if (!REPORT_REASONS.contains(reasonCode)) {
            throw SocialException.invalid("SOC_REPORT_REASON_INVALID", "reasonCode is not allowlisted");
        }
        String clientEventId = requiredSafeId(body.get("clientEventId"), "clientEventId");
        return idempotent(principal, "report:" + room.roomId, idempotencyKey, body, () -> {
            Member reporter = requireActiveMember(room, principal.subjectId());
            Seat targetSeat = room.seats.get(targetSeatIndex);
            if (targetSeat == null || targetSeat.subjectId == null || targetSeat.state == SeatState.AVAILABLE) {
                throw SocialException.forbidden("SOC_REPORT_TARGET_NOT_VISIBLE", "target is not an active room member");
            }
            if (targetSeat.subjectId.equals(principal.subjectId())) {
                throw SocialException.invalid("SOC_REPORT_TARGET_INVALID", "target must be another room member");
            }
            Member target = room.members.get(targetSeat.subjectId);
            if (target == null || !target.active()) {
                throw SocialException.forbidden("SOC_REPORT_TARGET_NOT_VISIBLE", "target is not an active room member");
            }
            String fingerprint = String.join("|", principal.tenantId(), room.roomId,
                    principal.subjectId(), target.subjectId, reasonCode);
            String previousId = reportByFingerprint.get(fingerprint);
            if (previousId != null) {
                Map<String, Object> replay = reports.get(previousId).view();
                replay.put("idempotentReplay", true);
                return replay;
            }
            Report report = new Report("REPORT-" + UUID.randomUUID(), principal.tenantId(), room.roomId,
                    principal.subjectId(), target.subjectId, targetSeatIndex, reasonCode, clientEventId, now());
            reports.put(report.reportId, report);
            reportByFingerprint.put(fingerprint, report.reportId);
            emitFact("social.report.received.v1", principal.subjectId(), room,
                    map("reportId", report.reportId, "reasonCode", reasonCode, "targetSeatIndex", targetSeatIndex));
            Map<String, Object> result = report.view();
            result.put("idempotentReplay", false);
            return result;
        });
    }

    public synchronized Map<String, Object> getReport(SocialPrincipal principal, String reportId) {
        pep.requirePermission(principal, SocialPep.REPORT_READ);
        Report report = reports.get(reportId);
        if (report == null) {
            throw SocialException.notFound("SOC_REPORT_NOT_FOUND", "report does not exist");
        }
        if (!report.tenantId.equals(principal.tenantId())) {
            throw SocialException.forbidden("SOCIAL_TENANT_FORBIDDEN", "report is outside the tenant scope");
        }
        if (!report.reporterSubjectId.equals(principal.subjectId())
                && !principal.hasPermission(SocialPep.MODERATION_REVIEW)) {
            throw SocialException.forbidden("SOC_REPORT_OWNER_FORBIDDEN", "report is visible only to its reporter or reviewer");
        }
        return report.view();
    }

    public synchronized Map<String, Object> moderate(
            SocialPrincipal principal, String reportId, Map<String, Object> rawBody, String idempotencyKey) {
        pep.requirePermission(principal, SocialPep.MODERATION_REVIEW);
        Map<String, Object> body = body(rawBody);
        rejectFields(body, Set.of("action"));
        String action = requiredString(body.get("action"), "action");
        if (!MODERATION_ACTIONS.contains(action)) {
            throw SocialException.invalid("SOC_MODERATION_ACTION_INVALID", "moderation action is not allowlisted");
        }
        Report report = reports.get(reportId);
        if (report == null) {
            throw SocialException.notFound("SOC_REPORT_NOT_FOUND", "report does not exist");
        }
        if (!report.tenantId.equals(principal.tenantId())) {
            throw SocialException.forbidden("SOCIAL_TENANT_FORBIDDEN", "report is outside the tenant scope");
        }
        return idempotent(principal, "moderation:" + reportId, idempotencyKey, body, () -> {
            ModerationState next = nextModerationState(report.state, action);
            report.state = next;
            report.updatedAt = now();
            emitFact("social.report.state_changed.v1", principal.subjectId(), null,
                    map("reportId", report.reportId, "action", action, "state", next.name()));
            return report.view();
        });
    }

    public synchronized Map<String, Object> transitionRoomState(
            SocialPrincipal principal, String roomId, Map<String, Object> rawBody, String idempotencyKey) {
        pep.requireIdentity(principal);
        Map<String, Object> body = body(rawBody);
        rejectFields(body, Set.of("action"));
        String action = requiredString(body.get("action"), "action");
        Room room = requireRoom(principal, roomId);
        pep.requireOwner(principal, room.tenantId, room.ownerSubject, "social.room.manage");
        if (!("CLOSE".equals(action) || "ARCHIVE".equals(action))) {
            throw SocialException.invalid("SOC_ROOM_ACTION_INVALID", "room action is not allowlisted");
        }
        return idempotent(principal, "room-state:" + room.roomId, idempotencyKey, body, () -> {
            RoomState next = "CLOSE".equals(action) ? RoomState.CLOSED : RoomState.ARCHIVED;
            if ((next == RoomState.CLOSED && room.state != RoomState.OPEN)
                    || (next == RoomState.ARCHIVED && room.state != RoomState.CLOSED)) {
                throw SocialException.conflict("SOC_ROOM_STATE_CONFLICT", "room state transition is not allowed", false);
            }
            room.state = next;
            room.version++;
            emitFact("study_room.state_changed.v1", principal.subjectId(), room,
                    map("action", action, "state", room.state.name()));
            return map("roomId", room.roomId, "state", room.state.name(), "version", room.version);
        });
    }

    /**
     * Consumes only authenticated, allowlisted learning/growth events. The payload is a projection
     * input; this service never creates, edits or settles a gamification ledger.
     */
    public synchronized Map<String, Object> consumeTrustedEvent(
            SocialPrincipal caller, TrustedSocialEvent event) {
        pep.requirePermission(caller, SocialPep.EVENTS_CONSUME);
        if (event == null || !SERVICE_EVENT_TYPES.contains(event.eventType())) {
            throw SocialException.unprocessable("SOC_TRUSTED_EVENT_SCHEMA_INVALID", "event type is not allowlisted");
        }
        pep.requireTenant(caller, event.tenantId());
        if (!sourceMatches(caller, event.sourceService(), event.eventType())) {
            throw SocialException.forbidden("SOC_TRUSTED_EVENT_SOURCE_FORBIDDEN", "event source is not trusted for this event type");
        }
        String eventFingerprint = fingerprint(event);
        String prior = trustedEventFingerprints.get(event.eventId());
        if (prior != null) {
            if (!prior.equals(eventFingerprint)) {
                throw SocialException.conflict("SOC_TRUSTED_EVENT_CONFLICT", "eventId was already used with another payload", false);
            }
            return map("status", "DUPLICATE", "eventId", event.eventId(), "projected", false,
                    "sourceWatermark", event.eventId());
        }
        Map<String, Object> payload = body(event.payload());
        Map<String, Object> result;
        switch (event.eventType()) {
            case "learning.activity.v1" -> result = consumeLearningActivity(event, payload);
            case "learning.focus.qualified.v1", "learning.focus_completed.v1" ->
                    result = consumeFocusProjection(event, payload);
            case "learning.mastery.reached.v1", "learning.mastery_reached.v1" ->
                    result = consumeMasteryProjection(event, payload);
            case "gamification.xp.ledger_posted.v1" -> result = consumeGrowthProjection(event, payload);
            case "leaderboard.refreshed.v1" -> result = refreshLeaderboard(event, payload, false);
            case "leaderboard.frozen.v1" -> result = refreshLeaderboard(event, payload, true);
            default -> throw SocialException.unprocessable("SOC_TRUSTED_EVENT_SCHEMA_INVALID", "event type is not handled");
        }
        trustedEventFingerprints.put(event.eventId(), eventFingerprint);
        result.put("eventId", event.eventId());
        result.put("traceId", event.traceId());
        return result;
    }

    public synchronized Map<String, Object> expireLeases() {
        Instant current = now();
        int released = 0;
        int emptyRooms = 0;
        for (Room room : rooms.values()) {
            boolean wasNonEmpty = room.activeMemberCount() > 0;
            for (Seat seat : new ArrayList<>(room.seats.values())) {
                if (seat.subjectId == null || seat.state == SeatState.AVAILABLE) {
                    continue;
                }
                boolean leaseExpired = seat.leaseExpiresAt != null && !seat.leaseExpiresAt.isAfter(current);
                boolean disconnectExpired = seat.state == SeatState.DISCONNECTED && seat.disconnectedAt != null
                        && !seat.disconnectedAt.plus(DISCONNECT_GRACE).isAfter(current);
                boolean idle = seat.lastActivityAt != null && !seat.lastActivityAt.plus(IDLE_RELEASE).isAfter(current);
                if (leaseExpired || disconnectExpired || idle) {
                    String reason = disconnectExpired ? "RECONNECT_GRACE_EXPIRED"
                            : idle ? "IDLE_TIMEOUT" : "LEASE_TIMEOUT";
                    releaseSeat(room, seat, reason);
                    released++;
                }
            }
            if (wasNonEmpty && room.activeMemberCount() == 0) {
                emptyRooms++;
                emitFact("study_room.empty.v1", "system:social-service", room,
                        map("reason", "NO_ACTIVE_MEMBERS"));
            }
        }
        return map("releasedSeats", released, "emptyRooms", emptyRooms, "serverTime", current.toString());
    }

    @Scheduled(fixedDelayString = "${social.lease-sweeper-ms:10000}")
    public void scheduledLeaseSweep() {
        expireLeases();
    }

    public synchronized List<Map<String, Object>> facts() {
        return factJournal.stream().map(SocialService::copyMap).toList();
    }

    private Map<String, Object> joinInternal(SocialPrincipal principal, Room room, int preferredSeatIndex,
                                               String focusTag, String clientEventId) {
        if (room.state != RoomState.OPEN) {
            throw SocialException.conflict("SOC_ROOM_UNAVAILABLE", "room is not open for joining", true);
        }
        Member existing = room.members.get(principal.subjectId());
        if (existing != null && existing.active()) {
            Seat current = requireMemberSeat(room, existing);
            if (current.state == SeatState.DISCONNECTED) {
                return recoverInternal(principal, room, current.leaseId, current.leaseVersion);
            }
            ensureLeaseUsable(current);
            return map("roomId", room.roomId, "membershipId", existing.membershipId,
                    "alreadyMember", true, "recovered", false,
                    "seat", seatView(room, current, principal.subjectId(), true), "serverTime", now().toString());
        }
        SeatRef priorSeat = activeSeatBySubject.get(subjectKey(principal.tenantId(), principal.subjectId()));
        if (priorSeat != null && !priorSeat.roomId.equals(room.roomId)) {
            throw SocialException.conflict("SOC_ONE_ACTIVE_SEAT", "a subject can own only one active seat", false);
        }
        Seat seat = findSeat(room, preferredSeatIndex);
        if (seat == null) {
            throw SocialException.conflict("SOC_ROOM_FULL", "room has no available seat", true);
        }
        Instant current = now();
        Member member = existing == null
                ? new Member("MEM-" + UUID.randomUUID(), principal.tenantId(), principal.subjectId(), current)
                : existing;
        member.state = MemberState.ACTIVE;
        member.presence = PresenceState.ONLINE;
        member.joinedAt = current;
        member.leftAt = null;
        member.lastActivityAt = current;
        member.roomVisibility = member.roomVisibility == null ? RoomVisibility.PUBLIC : member.roomVisibility;
        member.focusTagCode = focusTag;
        member.seatIndex = seat.seatIndex;
        room.members.put(principal.subjectId(), member);
        seat.state = SeatState.OCCUPIED;
        seat.subjectId = principal.subjectId();
        seat.leaseId = "LEASE-" + UUID.randomUUID();
        seat.leaseVersion = Math.max(1, seat.leaseVersion + 1);
        seat.leaseExpiresAt = current.plus(LEASE_DURATION);
        seat.disconnectedAt = null;
        seat.lastActivityAt = current;
        seat.focusTagCode = focusTag;
        activeSeatBySubject.put(subjectKey(principal.tenantId(), principal.subjectId()),
                new SeatRef(room.roomId, seat.seatIndex));
        room.version++;
        emitFact("study_room.joined.v1", principal.subjectId(), room,
                map("membershipId", member.membershipId, "seatIndex", seat.seatIndex,
                        "leaseId", seat.leaseId, "leaseVersion", seat.leaseVersion, "clientEventId", clientEventId));
        return map("roomId", room.roomId, "membershipId", member.membershipId, "alreadyMember", false,
                "recovered", false, "seat", seatView(room, seat, principal.subjectId(), true),
                "leaseId", seat.leaseId, "leaseVersion", seat.leaseVersion,
                "leaseExpiresAt", seat.leaseExpiresAt.toString(), "wsRequired", true,
                "serverTime", current.toString());
    }

    private Map<String, Object> leaveInternal(SocialPrincipal principal, Room room, String reason, String clientEventId) {
        Member member = requireActiveMember(room, principal.subjectId());
        Seat seat = requireMemberSeat(room, member);
        int seatIndex = seat.seatIndex;
        releaseFocusForSubject(principal.tenantId(), principal.subjectId(), room, "LEAVE");
        releaseSeat(room, seat, reason);
        member.state = MemberState.LEFT;
        member.presence = PresenceState.OFFLINE;
        member.leftAt = now();
        activeSeatBySubject.remove(subjectKey(principal.tenantId(), principal.subjectId()));
        room.version++;
        emitFact("study_room.left.v1", principal.subjectId(), room,
                map("seatIndex", seatIndex, "reason", reason, "clientEventId", clientEventId));
        if (room.activeMemberCount() == 0) {
            emitFact("study_room.empty.v1", "system:social-service", room,
                    map("reason", "NO_ACTIVE_MEMBERS"));
        }
        return map("roomId", room.roomId, "releasedAt", now().toString(), "seatIndex", seatIndex,
                "membershipStatus", member.state.name(), "emptyRoom", room.activeMemberCount() == 0,
                "serverTime", now().toString());
    }

    private Map<String, Object> recoverInternal(SocialPrincipal principal, Room room, String leaseId, Long leaseVersion) {
        Member member = room.members.get(principal.subjectId());
        if (member == null) {
            throw SocialException.forbidden("SOC_ROOM_MEMBER_REQUIRED", "active room membership is required");
        }
        if (!member.active()) {
            throw SocialException.conflict("SOC_SEAT_LEASE_EXPIRED", "seat lease has already been released", false);
        }
        Seat seat = requireMemberSeat(room, member);
        if (seat.state == SeatState.OCCUPIED) {
            return map("roomId", room.roomId, "recovered", false, "seat", seatView(room, seat, principal.subjectId(), true),
                    "leaseId", seat.leaseId, "leaseVersion", seat.leaseVersion, "serverTime", now().toString());
        }
        if (seat.state != SeatState.DISCONNECTED || seat.disconnectedAt == null
                || !seat.disconnectedAt.plus(DISCONNECT_GRACE).isAfter(now())) {
            throw SocialException.conflict("SOC_SEAT_LEASE_EXPIRED", "disconnect recovery window has expired", false);
        }
        checkLeaseToken(seat, leaseId, leaseVersion);
        seat.state = SeatState.OCCUPIED;
        seat.disconnectedAt = null;
        seat.leaseVersion++;
        seat.leaseExpiresAt = now().plus(LEASE_DURATION);
        member.presence = focusForSubject(principal.tenantId(), principal.subjectId()) == null
                ? PresenceState.ONLINE : PresenceState.FOCUS;
        room.version++;
        emitFact("study_room.recovered.v1", principal.subjectId(), room,
                map("seatIndex", seat.seatIndex, "leaseId", seat.leaseId, "leaseVersion", seat.leaseVersion));
        return map("roomId", room.roomId, "recovered", true, "seat", seatView(room, seat, principal.subjectId(), true),
                "leaseId", seat.leaseId, "leaseVersion", seat.leaseVersion,
                "leaseExpiresAt", seat.leaseExpiresAt.toString(), "serverTime", now().toString());
    }

    private Map<String, Object> updateFocusInternal(SocialPrincipal principal, FocusSession focus, String action,
                                                      String clientEventId) {
        Room room = requireRoom(principal, focus.roomId);
        if ("PAUSE".equals(action)) {
            if (focus.state != FocusState.RUNNING) {
                throw SocialException.conflict("SOC_FOCUS_STATE_CONFLICT", "only a running focus can be paused", false);
            }
            focus.pause(now());
            updatePresence(room, principal.subjectId(), PresenceState.ONLINE);
        } else if ("RESUME".equals(action)) {
            if (focus.state != FocusState.PAUSED) {
                throw SocialException.conflict("SOC_FOCUS_STATE_CONFLICT", "only a paused focus can be resumed", false);
            }
            Seat seat = requireMemberSeat(room, requireActiveMember(room, principal.subjectId()));
            ensureLeaseUsable(seat);
            focus.resume(now());
            updatePresence(room, principal.subjectId(), PresenceState.FOCUS);
        } else if ("FINISH".equals(action) || "ABORT".equals(action)) {
            if (!(focus.state == FocusState.RUNNING || focus.state == FocusState.PAUSED)) {
                throw SocialException.conflict("SOC_FOCUS_STATE_CONFLICT", "focus session is already terminal", false);
            }
            FocusState terminal = "FINISH".equals(action) ? FocusState.COMPLETED : FocusState.INVALID;
            focus.finish(terminal, now());
            activeFocusBySubject.remove(subjectKey(focus.tenantId, focus.subjectId));
            Seat seat = findSeat(room, focus.seatIndex);
            if (seat != null) {
                seat.focusId = null;
                seat.focusTagCode = null;
            }
            updatePresence(room, focus.subjectId, PresenceState.ONLINE);
        }
        emitFact("study_room.focus_state_changed.v1", principal.subjectId(), room,
                map("focusId", focus.focusId, "action", action, "state", focus.state.name(),
                        "clientEventId", clientEventId));
        return focusView(focus, true);
    }

    private Map<String, Object> consumeLearningActivity(TrustedSocialEvent event, Map<String, Object> payload) {
        rejectTrustedFields(payload, Set.of("roomId", "activityCode"));
        String roomId = optionalSafeId(payload.get("roomId"));
        String activityCode = payload.containsKey("activityCode")
                ? requiredSafeId(payload.get("activityCode"), "activityCode") : "TRUSTED_ACTIVITY";
        boolean updated = false;
        if (roomId != null) {
            Room room = rooms.get(roomKey(event.tenantId(), roomId));
            if (room != null) {
                Member member = room.members.get(event.subjectId());
                if (member != null && member.active()) {
                    Seat seat = findSeat(room, member.seatIndex);
                    if (seat != null && seat.subjectId.equals(event.subjectId())) {
                        Instant activityAt = event.occurredAt().isAfter(now()) ? now() : event.occurredAt();
                        member.lastActivityAt = activityAt;
                        seat.lastActivityAt = activityAt;
                        updated = true;
                    }
                }
            }
        }
        emitFact("social.presence.activity_projected.v1", event.subjectId(), null,
                map("eventId", event.eventId(), "roomId", roomId, "activityCode", activityCode, "updated", updated));
        return map("status", "ACCEPTED", "projected", updated, "projection", "PRESENCE", "activityCode", activityCode,
                "delayed", false);
    }

    private Map<String, Object> consumeFocusProjection(TrustedSocialEvent event, Map<String, Object> payload) {
        rejectTrustedFields(payload, Set.of("qualifiedMinutes", "roomId", "sourceSessionId"));
        long qualifiedMinutes = requiredLong(payload.get("qualifiedMinutes"), "qualifiedMinutes");
        if (qualifiedMinutes <= 0 || qualifiedMinutes > 480) {
            throw SocialException.unprocessable("SOC_TRUSTED_EVENT_VALUE_INVALID", "qualifiedMinutes is outside the event schema");
        }
        optionalSafeId(payload.get("roomId"));
        optionalSafeId(payload.get("sourceSessionId"));
        Leaderboard board = boardForEvent(event, LeaderboardKind.FOCUS_MINUTES, qualifiedMinutes);
        boolean late = board.state == LeaderboardState.FROZEN;
        if (!late) {
            project(board, event.subjectId(), qualifiedMinutes, qualifiedMinutes, event);
        }
        return projectionResult(board, event, late);
    }

    private Map<String, Object> consumeMasteryProjection(TrustedSocialEvent event, Map<String, Object> payload) {
        rejectTrustedFields(payload, Set.of("qualifiedUnits", "contentId", "masteryTransition", "roomId"));
        long qualifiedUnits = requiredLong(payload.get("qualifiedUnits"), "qualifiedUnits");
        if (qualifiedUnits <= 0 || qualifiedUnits > 1000) {
            throw SocialException.unprocessable("SOC_TRUSTED_EVENT_VALUE_INVALID", "qualifiedUnits is outside the event schema");
        }
        optionalSafeId(payload.get("contentId"));
        optionalSafeId(payload.get("roomId"));
        String masteryTransition = optionalSafeId(payload.get("masteryTransition"));
        if (masteryTransition != null && !"REACHED".equals(masteryTransition)) {
            throw SocialException.unprocessable("SOC_TRUSTED_EVENT_VALUE_INVALID", "masteryTransition must be REACHED");
        }
        Leaderboard board = boardForEvent(event, LeaderboardKind.MASTERED_WORDS, qualifiedUnits);
        boolean late = board.state == LeaderboardState.FROZEN;
        if (!late) {
            project(board, event.subjectId(), qualifiedUnits, qualifiedUnits, event);
        }
        return projectionResult(board, event, late);
    }

    private Map<String, Object> consumeGrowthProjection(TrustedSocialEvent event, Map<String, Object> payload) {
        rejectTrustedFields(payload, Set.of("qualifiedUnits", "sourceEntryId", "roomId"));
        long units = requiredLong(payload.get("qualifiedUnits"), "qualifiedUnits");
        if (units <= 0 || units > 1_000_000) {
            throw SocialException.unprocessable("SOC_TRUSTED_EVENT_VALUE_INVALID", "qualifiedUnits is outside the event schema");
        }
        optionalSafeId(payload.get("sourceEntryId"));
        optionalSafeId(payload.get("roomId"));
        Leaderboard board = boardForEvent(event, LeaderboardKind.XP, units);
        boolean late = board.state == LeaderboardState.FROZEN;
        if (!late) {
            project(board, event.subjectId(), units, units, event);
        }
        return projectionResult(board, event, late);
    }

    private Map<String, Object> refreshLeaderboard(TrustedSocialEvent event, Map<String, Object> payload, boolean freeze) {
        rejectTrustedFields(payload, Set.of("kind", "period", "snapshotVersion"));
        LeaderboardKind kind = parseEnum(requiredString(payload.get("kind"), "kind"), LeaderboardKind.class,
                "SOC_TRUSTED_EVENT_SCHEMA_INVALID");
        PeriodType period = parseEnum(requiredString(payload.get("period"), "period"), PeriodType.class,
                "SOC_TRUSTED_EVENT_SCHEMA_INVALID");
        long snapshotVersion = requiredLong(payload.get("snapshotVersion"), "snapshotVersion");
        if (snapshotVersion <= 0) {
            throw SocialException.unprocessable("SOC_TRUSTED_EVENT_VALUE_INVALID", "snapshotVersion must be positive");
        }
        LocalDate start = periodStart(event.occurredAt(), period);
        LeaderboardKey key = new LeaderboardKey(event.tenantId(), kind, period, start);
        Leaderboard board = leaderboards.computeIfAbsent(key, ignored -> new Leaderboard(key));
        board.snapshotVersion = snapshotVersion;
        board.state = freeze ? LeaderboardState.FROZEN : LeaderboardState.PUBLISHED;
        board.lastProjectedAt = now();
        board.sourceWatermark = event.eventId();
        return map("status", "ACCEPTED", "projected", true, "projection", "LEADERBOARD_STATE",
                "projectionState", board.state.name(), "snapshotVersion", board.snapshotVersion, "delayed", false);
    }

    private Leaderboard boardForEvent(TrustedSocialEvent event, LeaderboardKind kind, long units) {
        PeriodType period = kind == LeaderboardKind.XP ? PeriodType.WEEK : PeriodType.DAY;
        LocalDate start = periodStart(event.occurredAt(), period);
        return leaderboards.computeIfAbsent(new LeaderboardKey(event.tenantId(), kind, period, start),
                ignored -> new Leaderboard(new LeaderboardKey(event.tenantId(), kind, period, start)));
    }

    private Map<String, Object> projectionResult(Leaderboard board, TrustedSocialEvent event, boolean late) {
        return map("status", late ? "ACCEPTED_LATE_FOR_REVIEW" : "ACCEPTED", "projected", !late,
                "projection", board.key.kind.name(), "projectionState", board.state.name(),
                "delayed", true, "sourceWatermark", event.eventId(), "periodStart", board.key.periodStart.toString());
    }

    private void project(Leaderboard board, String subjectId, long score, long qualifiedUnits,
                         TrustedSocialEvent event) {
        ProjectionEntry entry = board.entries.computeIfAbsent(subjectId, ignored -> new ProjectionEntry(subjectId));
        entry.score += score;
        entry.qualifiedUnits += qualifiedUnits;
        entry.lastEventAt = event.occurredAt();
        entry.sourceWatermark = event.eventId();
        board.lastProjectedAt = now();
        board.sourceWatermark = event.eventId();
        if (board.state == LeaderboardState.DELAYED) {
            board.state = LeaderboardState.PROVISIONAL;
        }
    }

    private Map<String, Object> delayedLeaderboard(SocialPrincipal principal, LeaderboardKey key, String roomId) {
        return map("kind", key.kind.name(), "period", key.period.name(), "periodStart", key.periodStart.toString(),
                "periodEnd", periodEnd(key.period, key.periodStart).toString(), "timeZone", DISPLAY_ZONE.getId(),
                "projectionState", LeaderboardState.DELAYED.name(), "dataFreshness", "DELAYED", "delayed", true,
                "asOf", null, "snapshotVersion", 0, "entries", List.of(),
                "me", map("present", false, "visibility", visibility(principal.tenantId(), principal.subjectId()).name()),
                "sourceWatermark", null, "roomId", roomId);
    }

    private boolean sourceMatches(SocialPrincipal caller, String sourceService, String eventType) {
        Set<String> allowed = eventType.startsWith("learning.") ? LEARNING_SOURCES
                : eventType.startsWith("gamification.") ? GROWTH_SOURCES : WORKFLOW_SOURCES;
        if (!allowed.contains(sourceService)) {
            return false;
        }
        return caller.subjectId().equals(sourceService)
                || caller.subjectId().equals("service:" + sourceService)
                || caller.roles().contains("SERVICE_" + sourceService.toUpperCase(Locale.ROOT).replace('-', '_'));
    }

    private void enforceInteractionLimits(SocialPrincipal principal, Room room, Member target) {
        Instant current = now();
        String actorKey = subjectKey(principal.tenantId(), principal.subjectId()) + ":" + room.roomId;
        Deque<Instant> thirtySecond = interactionWindows.computeIfAbsent(actorKey, ignored -> new ArrayDeque<>());
        prune(thirtySecond, current.minusSeconds(30));
        if (thirtySecond.size() >= 3) {
            throw new SocialException("SOC_INTERACTION_RATE_LIMITED", "interaction rate limit reached", 429, true);
        }
        Deque<Instant> hourly = interactionHourlyWindows.computeIfAbsent(actorKey, ignored -> new ArrayDeque<>());
        prune(hourly, current.minusSeconds(3600));
        if (hourly.size() >= 60) {
            throw new SocialException("SOC_INTERACTION_RATE_LIMITED", "interaction rate limit reached", 429, true);
        }
        if (target != null) {
            String targetKey = subjectKey(principal.tenantId(), target.subjectId) + ":" + room.roomId;
            Deque<Instant> targetWindow = interactionTargetWindows.computeIfAbsent(targetKey, ignored -> new ArrayDeque<>());
            prune(targetWindow, current.minusSeconds(60));
            if (!targetWindow.isEmpty()) {
                throw new SocialException("SOC_INTERACTION_RATE_LIMITED", "target interaction rate limit reached", 429, true);
            }
            targetWindow.addLast(current);
        }
        thirtySecond.addLast(current);
        hourly.addLast(current);
    }

    private void releaseSeat(Room room, Seat seat, String reason) {
        String subjectId = seat.subjectId;
        if (subjectId == null) {
            return;
        }
        releaseFocusForSubject(room.tenantId, subjectId, room, reason);
        Member member = room.members.get(subjectId);
        if (member != null) {
            member.state = MemberState.EXPIRED;
            member.presence = PresenceState.OFFLINE;
            member.leftAt = now();
        }
        activeSeatBySubject.remove(subjectKey(room.tenantId, subjectId));
        seat.state = SeatState.AVAILABLE;
        seat.subjectId = null;
        seat.leaseId = null;
        seat.leaseExpiresAt = null;
        seat.disconnectedAt = null;
        seat.focusId = null;
        seat.focusTagCode = null;
        seat.lastReleasedAt = now();
        seat.releaseReason = reason;
        seat.leaseVersion++;
        room.version++;
        emitFact("study_room.seat_released.v1", subjectId, room,
                map("seatIndex", seat.seatIndex, "reason", reason));
    }

    private void releaseFocusForSubject(String tenantId, String subjectId, Room room, String reason) {
        FocusSession focus = focusForSubject(tenantId, subjectId);
        if (focus == null || !(focus.state == FocusState.RUNNING || focus.state == FocusState.PAUSED)) {
            return;
        }
        focus.finish(FocusState.AUTO_RELEASED, now());
        activeFocusBySubject.remove(subjectKey(tenantId, subjectId));
        emitFact("study_room.focus_auto_released.v1", subjectId, room,
                map("focusId", focus.focusId, "reason", reason, "serverElapsedSeconds", focus.serverElapsedSeconds));
    }

    private void ensureLeaseUsable(Seat seat) {
        if (seat.leaseId == null || seat.leaseExpiresAt == null || !seat.leaseExpiresAt.isAfter(now())
                || seat.state == SeatState.AVAILABLE || seat.state == SeatState.RELEASED) {
            throw SocialException.conflict("SOC_SEAT_LEASE_EXPIRED", "seat lease is stale or expired", false);
        }
        if (seat.state == SeatState.DISCONNECTED) {
            throw SocialException.conflict("SOC_SEAT_DISCONNECTED", "seat is disconnected and must be recovered", false);
        }
    }

    private void checkLeaseToken(Seat seat, String leaseId, Long leaseVersion) {
        if (leaseId != null && !leaseId.equals(seat.leaseId)) {
            throw SocialException.conflict("SOC_SEAT_LEASE_EXPIRED", "lease id is stale", false);
        }
        if (leaseVersion != null && leaseVersion.longValue() != seat.leaseVersion) {
            throw SocialException.conflict("SOC_SEAT_LEASE_EXPIRED", "lease version is stale", false);
        }
    }

    private Member requireActiveMember(Room room, String subjectId) {
        Member member = room.members.get(subjectId);
        if (member == null || !member.active()) {
            throw SocialException.forbidden("SOC_ROOM_MEMBER_REQUIRED", "active room membership is required");
        }
        return member;
    }

    private Seat requireMemberSeat(Room room, Member member) {
        if (member.seatIndex <= 0) {
            throw SocialException.conflict("SOC_SEAT_UNAVAILABLE", "an active seat is required", true);
        }
        Seat seat = room.seats.get(member.seatIndex);
        if (seat == null || seat.subjectId == null || !seat.subjectId.equals(member.subjectId)) {
            throw SocialException.conflict("SOC_SEAT_UNAVAILABLE", "seat projection is unavailable", true);
        }
        return seat;
    }

    private Room requireRoom(SocialPrincipal principal, String roomId) {
        pep.requireIdentity(principal);
        if (roomId == null || roomId.isBlank()) {
            throw SocialException.invalid("SOC_ROOM_ID_INVALID", "roomId is required");
        }
        Room room = rooms.get(roomKey(principal.tenantId(), roomId));
        if (room != null) {
            return room;
        }
        boolean existsInAnotherTenant = rooms.values().stream().anyMatch(candidate -> candidate.roomId.equals(roomId));
        if (existsInAnotherTenant) {
            throw SocialException.forbidden("SOCIAL_TENANT_FORBIDDEN", "room is outside the verified tenant scope");
        }
        throw SocialException.notFound("SOC_ROOM_NOT_FOUND", "study room does not exist");
    }

    private Seat findSeat(Room room, int preferredSeatIndex) {
        if (preferredSeatIndex > 0) {
            Seat preferred = room.seats.get(preferredSeatIndex);
            if (preferred != null && preferred.state == SeatState.AVAILABLE) {
                return preferred;
            }
        }
        return room.seats.values().stream().filter(seat -> seat.state == SeatState.AVAILABLE).findFirst().orElse(null);
    }

    private FocusSession activeFocus(String tenantId, String subjectId) {
        String focusId = activeFocusBySubject.get(subjectKey(tenantId, subjectId));
        if (focusId == null) {
            return null;
        }
        FocusSession focus = focusSessions.get(focusId);
        return focus != null && (focus.state == FocusState.RUNNING || focus.state == FocusState.PAUSED) ? focus : null;
    }

    private FocusSession focusForSubject(String tenantId, String subjectId) {
        return activeFocus(tenantId, subjectId);
    }

    private void updatePresence(Room room, String subjectId, PresenceState state) {
        Member member = room.members.get(subjectId);
        if (member != null && member.active()) {
            member.presence = state;
        }
    }

    private static ModerationState nextModerationState(ModerationState current, String action) {
        return switch (current) {
            case RECEIVED -> {
                if (!"TRIAGE".equals(action)) {
                    throw SocialException.conflict("SOC_MODERATION_STATE_CONFLICT", "report must be triaged first", false);
                }
                yield ModerationState.TRIAGED;
            }
            case TRIAGED -> {
                if (!"START_REVIEW".equals(action)) {
                    throw SocialException.conflict("SOC_MODERATION_STATE_CONFLICT", "report must enter review", false);
                }
                yield ModerationState.IN_REVIEW;
            }
            case IN_REVIEW -> {
                yield switch (action) {
                    case "ACTION" -> ModerationState.ACTIONED;
                    case "REJECT" -> ModerationState.REJECTED;
                    case "CLOSE" -> ModerationState.CLOSED;
                    default -> throw SocialException.conflict("SOC_MODERATION_STATE_CONFLICT", "review action is not allowed", false);
                };
            }
            case ACTIONED, REJECTED -> {
                if (!"CLOSE".equals(action)) {
                    throw SocialException.conflict("SOC_MODERATION_STATE_CONFLICT", "terminal moderation state must close", false);
                }
                yield ModerationState.CLOSED;
            }
            case CLOSED -> throw SocialException.conflict("SOC_MODERATION_STATE_CONFLICT", "closed report cannot change state", false);
        };
    }

    private Map<String, Object> roomSummary(Room room) {
        return map("roomId", room.roomId, "roomType", "PUBLIC", "themeCode", room.themeCode,
                "displayNameKey", room.displayNameKey, "capacity", room.capacity,
                "occupiedCount", room.activeMemberCount(), "status", room.state.name(),
                "empty", room.activeMemberCount() == 0, "roomVersion", room.version,
                "soundSet", List.of("RAIN", "FOREST", "CAFE", "FIREPLACE"));
    }

    private Map<String, Object> roomView(Room room, Member viewer) {
        List<Map<String, Object>> seatViews = room.seats.values().stream()
                .map(seat -> seatView(room, seat, viewer.subjectId, false)).toList();
        FocusSession focus = focusForSubject(viewer.tenantId, viewer.subjectId);
        return map("room", roomSummary(room), "roomVersion", room.version, "serverSequence", room.sequence,
                "empty", room.activeMemberCount() == 0, "seats", seatViews,
                "self", map("membershipId", viewer.membershipId, "status", viewer.state.name(),
                        "presence", viewer.presence.name(), "seatIndex", viewer.seatIndex,
                        "roomVisibility", viewer.roomVisibility.name(),
                        "leaderboardVisibility", visibility(viewer.tenantId, viewer.subjectId).name(),
                        "focus", focus == null ? null : focusView(focus, false)),
                "catalogVersions", map("preset", "social-preset-2026-08", "visibility", "social-visibility-1"),
                "serverTime", now().toString());
    }

    private Map<String, Object> seatView(Room room, Seat seat, String viewerSubjectId, boolean selfOnly) {
        boolean occupied = seat.subjectId != null && seat.state != SeatState.AVAILABLE && seat.state != SeatState.RELEASED;
        Map<String, Object> result = map("seatIndex", seat.seatIndex, "status", occupied ? seat.state.name() : "AVAILABLE",
                "presence", occupied ? presenceOf(room, seat.subjectId).name() : "OFFLINE",
                "focusTagCode", occupied ? seat.focusTagCode : null,
                "leaseExpiresAt", seat.subjectId != null && seat.subjectId.equals(viewerSubjectId) && seat.leaseExpiresAt != null
                        ? seat.leaseExpiresAt.toString() : null);
        if (!occupied) {
            return result;
        }
        Member member = room.members.get(seat.subjectId);
        if (member == null || !member.active()) {
            return result;
        }
        boolean self = seat.subjectId.equals(viewerSubjectId);
        if (self || member.roomVisibility == RoomVisibility.PUBLIC) {
            result.put("publicMember", map("displayMode", self ? "SELF" : "NICKNAME",
                    "displayName", self ? "本人" : displayName(member.tenantId, member.subjectId),
                    "privacyVersion", member.privacyVersion));
        } else if (member.roomVisibility == RoomVisibility.ANONYMOUS) {
            result.put("publicMember", map("displayMode", "ANONYMOUS", "displayName", "匿名学员"));
        } else {
            result.put("memberHidden", true);
        }
        if (selfOnly && !self) {
            result.remove("publicMember");
            result.put("memberHidden", true);
        }
        return result;
    }

    private PresenceState presenceOf(Room room, String subjectId) {
        Member member = room.members.get(subjectId);
        return member == null ? PresenceState.OFFLINE : member.presence;
    }

    private Map<String, Object> focusView(FocusSession focus, boolean includeServerElapsed) {
        Map<String, Object> result = map("focusId", focus.focusId, "roomId", focus.roomId,
                "seatIndex", focus.seatIndex, "state", focus.state.name(), "durationMinutes", focus.durationMinutes,
                "focusTagCode", focus.focusTagCode, "startedAt", focus.startedAt.toString(),
                "endedAt", focus.endedAt == null ? null : focus.endedAt.toString(),
                "qualifiedSeconds", focus.qualifiedSeconds, "serverTime", now().toString());
        if (includeServerElapsed || focus.state == FocusState.RUNNING || focus.state == FocusState.PAUSED) {
            result.put("serverElapsedSeconds", focus.activeSeconds(now()));
        }
        return result;
    }

    private String displayName(String tenantId, String subjectId) {
        return "学员-" + hash(subjectKey(tenantId, subjectId)).substring(0, 8).toUpperCase(Locale.ROOT);
    }

    private String displayMode(String tenantId, String subjectId) {
        return switch (visibility(tenantId, subjectId)) {
            case NICKNAME -> "NICKNAME";
            case ANONYMOUS -> "ANONYMOUS";
            case OPT_OUT -> "OPT_OUT";
        };
    }

    private String displayName(String tenantId, String subjectId, Visibility visibility) {
        return visibility == Visibility.ANONYMOUS ? "匿名学员" : displayName(tenantId, subjectId);
    }

    private Visibility visibility(String tenantId, String subjectId) {
        return globalLeaderboardVisibility.getOrDefault(subjectKey(tenantId, subjectId), Visibility.NICKNAME);
    }

    private static LocalDate periodStart(Instant instant, PeriodType period) {
        LocalDate date = instant.atZone(DISPLAY_ZONE).toLocalDate();
        return period == PeriodType.DAY ? date : date.minusDays(date.getDayOfWeek().getValue() - 1L);
    }

    private static LocalDate periodEnd(PeriodType period, LocalDate start) {
        return period == PeriodType.DAY ? start.plusDays(1) : start.plusDays(7);
    }

    private void seedRooms() {
        addSeedRoom("ROOM-001", "晨星自习室", "TEMPLATE_QUIET", SocialPrincipal.PLATFORM_TENANT, "room-owner-001");
        addSeedRoom("ROOM-002", "晚间专注舱", "TEMPLATE_FOCUS", SocialPrincipal.PLATFORM_TENANT, "room-owner-002");
    }

    private void addSeedRoom(String roomId, String displayNameKey, String themeCode, String tenantId, String ownerSubject) {
        Room room = new Room(roomId, displayNameKey, themeCode, tenantId, ownerSubject, ROOM_CAPACITY);
        rooms.put(roomKey(tenantId, roomId), room);
    }

    private static String roomKey(String tenantId, String roomId) {
        return tenantId + ":" + roomId;
    }

    private static String subjectKey(String tenantId, String subjectId) {
        return tenantId + ":" + subjectId;
    }

    private Instant now() {
        return clock.instant();
    }

    private static Instant min(Instant first, Instant second) {
        return first == null || second.isBefore(first) ? second : first;
    }

    private Map<String, Object> idempotent(SocialPrincipal principal, String scope, String key,
                                            Map<String, Object> request, Supplier<Map<String, Object>> operation) {
        requireIdempotencyKey(key);
        String composite = subjectKey(principal.tenantId(), principal.subjectId()) + ":" + scope + ":" + key;
        String requestFingerprint = fingerprint(request);
        String priorFingerprint = idempotencyFingerprints.get(composite);
        if (priorFingerprint != null) {
            if (!priorFingerprint.equals(requestFingerprint)) {
                throw SocialException.conflict("IDEMPOTENCY_KEY_REUSED", "idempotency key was reused with another request", false);
            }
            return idempotencyResults.get(composite);
        }
        Map<String, Object> result = operation.get();
        idempotencyFingerprints.put(composite, requestFingerprint);
        idempotencyResults.put(composite, result);
        return result;
    }

    private void rejectFields(Map<String, Object> fields, Set<String> allowed) {
        for (String key : fields.keySet()) {
            String normalized = key.toLowerCase(Locale.ROOT);
            if (FREE_TEXT_FIELDS.contains(normalized)) {
                throw SocialException.unprocessable("SOC_TEXT_NOT_ALLOWED", "free text and open payloads are not supported");
            }
        }
        for (String key : fields.keySet()) {
            String normalized = key.toLowerCase(Locale.ROOT);
            if (CLIENT_AUTHORITY_FIELDS.contains(normalized)) {
                throw SocialException.forbidden("UNTRUSTED_CLIENT_FACTS", "subject, tenant, owner, role and score facts are server-owned");
            }
            if (!allowed.contains(key)) {
                throw SocialException.invalid("REQUEST_INVALID", "request contains an unsupported field: " + key);
            }
        }
    }

    /** Trusted event payloads may carry a value produced by the owning domain, but remain schema-bound. */
    private void rejectTrustedFields(Map<String, Object> fields, Set<String> allowed) {
        for (String key : fields.keySet()) {
            String normalized = key.toLowerCase(Locale.ROOT);
            if (FREE_TEXT_FIELDS.contains(normalized)) {
                throw SocialException.unprocessable("SOC_TEXT_NOT_ALLOWED", "free text and open payloads are not supported");
            }
            if (Set.of("userid", "subjectid", "tenantid", "ownerid", "role", "permission").contains(normalized)) {
                throw SocialException.unprocessable("SOC_TRUSTED_EVENT_SCHEMA_INVALID", "identity facts must be in the trusted envelope");
            }
            if (!allowed.contains(key)) {
                throw SocialException.unprocessable("SOC_TRUSTED_EVENT_SCHEMA_INVALID", "event payload contains an unsupported field");
            }
        }
    }

    private static Map<String, Object> body(Map<String, Object> rawBody) {
        if (rawBody == null) {
            return new LinkedHashMap<>();
        }
        return new LinkedHashMap<>(rawBody);
    }

    private static String optionalString(Object value) {
        if (value == null) {
            return null;
        }
        if (!(value instanceof String string) || string.isBlank()) {
            throw SocialException.invalid("REQUEST_INVALID", "string field is invalid");
        }
        return string;
    }

    private static String requiredString(Object value, String field) {
        String result = optionalString(value);
        if (result == null) {
            throw SocialException.invalid("REQUEST_INVALID", field + " is required");
        }
        return result;
    }

    private static String optionalSafeId(Object value) {
        if (value == null) {
            return null;
        }
        String string = optionalString(value);
        if (string == null || !SAFE_ID.matcher(string).matches()) {
            throw SocialException.invalid("REQUEST_INVALID", "identifier is invalid");
        }
        return string;
    }

    private static String requiredSafeId(Object value, String field) {
        String result = optionalSafeId(value);
        if (result == null) {
            throw SocialException.invalid("REQUEST_INVALID", field + " is required");
        }
        return result;
    }

    private static int optionalInt(Object value, int fallback, String field) {
        if (value == null) {
            return fallback;
        }
        if (!(value instanceof Number number)) {
            throw SocialException.invalid("REQUEST_INVALID", field + " must be numeric");
        }
        return number.intValue();
    }

    private static int requiredInt(Object value, String field) {
        if (value == null) {
            throw SocialException.invalid("REQUEST_INVALID", field + " is required");
        }
        return optionalInt(value, 0, field);
    }

    private static long requiredLong(Object value, String field) {
        if (!(value instanceof Number number)) {
            throw SocialException.unprocessable("SOC_TRUSTED_EVENT_SCHEMA_INVALID", field + " must be numeric");
        }
        return number.longValue();
    }

    private static Long optionalLong(Object value, String field) {
        if (value == null) {
            return null;
        }
        if (!(value instanceof Number number)) {
            throw SocialException.invalid("REQUEST_INVALID", field + " must be numeric");
        }
        return number.longValue();
    }

    private static Visibility optionalVisibility(Object value, Visibility fallback) {
        if (value == null) {
            return fallback;
        }
        return parseEnum(requiredString(value, "leaderboardVisibility"), Visibility.class,
                "SOC_VISIBILITY_INVALID");
    }

    private static RoomVisibility optionalRoomVisibility(Object value, RoomVisibility fallback) {
        if (value == null) {
            return fallback;
        }
        return parseEnum(requiredString(value, "roomVisibility"), RoomVisibility.class,
                "SOC_VISIBILITY_INVALID");
    }

    private static <E extends Enum<E>> E parseEnum(String value, Class<E> type, String errorCode) {
        try {
            return Enum.valueOf(type, value);
        } catch (IllegalArgumentException exception) {
            throw SocialException.invalid(errorCode, "value is not allowlisted");
        }
    }

    private static void requireIdempotencyKey(String key) {
        if (key == null || !SAFE_ID.matcher(key).matches()) {
            throw SocialException.invalid("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required");
        }
    }

    private static void prune(Deque<Instant> values, Instant threshold) {
        while (!values.isEmpty() && !values.peekFirst().isAfter(threshold)) {
            values.removeFirst();
        }
    }

    private static String fingerprint(Object value) {
        return hash(canonical(value));
    }

    private static String canonical(Object value) {
        if (value == null) {
            return "null";
        }
        if (value instanceof Map<?, ?> mapValue) {
            TreeMap<String, Object> sorted = new TreeMap<>();
            mapValue.forEach((key, mapEntryValue) -> sorted.put(String.valueOf(key), mapEntryValue));
            StringBuilder builder = new StringBuilder("{");
            sorted.forEach((key, mapEntryValue) -> builder.append(key).append('=').append(canonical(mapEntryValue)).append(';'));
            return builder.append('}').toString();
        }
        if (value instanceof Collection<?> collection) {
            return collection.stream().map(SocialService::canonical).sorted().reduce("[", (left, right) -> left + right + ";") + "]";
        }
        return String.valueOf(value);
    }

    private static String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder();
            for (byte item : digest) {
                result.append(String.format(Locale.ROOT, "%02x", item));
            }
            return result.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required", exception);
        }
    }

    private void emitFact(String eventType, String subjectId, Room room, Map<String, Object> payload) {
        Map<String, Object> fact = map("eventId", "SOC-FACT-" + UUID.randomUUID(), "eventType", eventType,
                "schemaVersion", "social.fact.v1", "subjectId", subjectId,
                "roomId", room == null ? null : room.roomId, "occurredAt", now().toString(), "payload", payload);
        factJournal.add(fact);
        if (factJournal.size() > 1000) {
            factJournal.remove(0);
        }
        if (room != null) {
            room.sequence++;
        }
    }

    private static Map<String, Object> copyMap(Map<String, Object> source) {
        Map<String, Object> result = new LinkedHashMap<>();
        source.forEach((key, value) -> result.put(key, value instanceof Map<?, ?> nested ? copyMap(stringMap(nested)) : value));
        return result;
    }

    private static Map<String, Object> stringMap(Map<?, ?> source) {
        Map<String, Object> result = new LinkedHashMap<>();
        source.forEach((key, value) -> result.put(String.valueOf(key), value));
        return result;
    }

    private static Map<String, Object> map(Object... values) {
        if (values.length % 2 != 0) {
            throw new IllegalArgumentException("map values must be pairs");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        for (int index = 0; index < values.length; index += 2) {
            result.put(String.valueOf(values[index]), values[index + 1]);
        }
        return result;
    }

    private enum RoomState { OPEN, CLOSED, ARCHIVED }
    private enum MemberState { ACTIVE, LEFT, EXPIRED, REMOVED }
    private enum SeatState { AVAILABLE, HELD, OCCUPIED, DISCONNECTED, RELEASED }
    private enum PresenceState { OFFLINE, ONLINE, FOCUS, DISCONNECTED }
    private enum FocusState { RUNNING, PAUSED, COMPLETED, AUTO_RELEASED, INVALID }
    private enum InteractionState { CREATED, POLICY_CHECKED, DELIVERED, EXPIRED, REVOKED }
    private enum ModerationState { RECEIVED, TRIAGED, IN_REVIEW, ACTIONED, REJECTED, CLOSED }
    private enum LeaderboardKind { FOCUS_MINUTES, MASTERED_WORDS, XP }
    private enum PeriodType { DAY, WEEK }
    private enum LeaderboardState { DELAYED, PROVISIONAL, PUBLISHED, FROZEN }
    private enum Visibility { NICKNAME, ANONYMOUS, OPT_OUT }
    private enum RoomVisibility { PUBLIC, ANONYMOUS, HIDDEN }

    private static final class Room {
        private final String roomId;
        private final String displayNameKey;
        private final String themeCode;
        private final String tenantId;
        private final String ownerSubject;
        private final int capacity;
        private final Map<Integer, Seat> seats = new LinkedHashMap<>();
        private final Map<String, Member> members = new LinkedHashMap<>();
        private final List<Interaction> interactions = new ArrayList<>();
        private RoomState state = RoomState.OPEN;
        private long version = 1;
        private long sequence = 0;

        private Room(String roomId, String displayNameKey, String themeCode, String tenantId,
                     String ownerSubject, int capacity) {
            this.roomId = roomId;
            this.displayNameKey = displayNameKey;
            this.themeCode = themeCode;
            this.tenantId = tenantId;
            this.ownerSubject = ownerSubject;
            this.capacity = capacity;
            for (int index = 1; index <= capacity; index++) {
                seats.put(index, new Seat(index));
            }
        }

        private int activeMemberCount() {
            return (int) members.values().stream().filter(Member::active).count();
        }
    }

    private static final class Member {
        private final String membershipId;
        private final String tenantId;
        private final String subjectId;
        private final Instant createdAt;
        private MemberState state = MemberState.LEFT;
        private PresenceState presence = PresenceState.OFFLINE;
        private RoomVisibility roomVisibility = RoomVisibility.PUBLIC;
        private int seatIndex;
        private String focusTagCode;
        private Instant joinedAt;
        private Instant leftAt;
        private Instant lastActivityAt;
        private long privacyVersion;

        private Member(String membershipId, String tenantId, String subjectId, Instant createdAt) {
            this.membershipId = membershipId;
            this.tenantId = tenantId;
            this.subjectId = subjectId;
            this.createdAt = createdAt;
        }

        private boolean active() {
            return state == MemberState.ACTIVE;
        }
    }

    private static final class Seat {
        private final int seatIndex;
        private SeatState state = SeatState.AVAILABLE;
        private String subjectId;
        private String leaseId;
        private long leaseVersion;
        private Instant leaseExpiresAt;
        private Instant disconnectedAt;
        private Instant lastActivityAt;
        private Instant lastReleasedAt;
        private String releaseReason;
        private String focusId;
        private String focusTagCode;

        private Seat(int seatIndex) {
            this.seatIndex = seatIndex;
        }
    }

    private static final class FocusSession {
        private final String focusId;
        private final String tenantId;
        private final String subjectId;
        private final String roomId;
        private final int seatIndex;
        private final String leaseId;
        private final int durationMinutes;
        private final String focusTagCode;
        private final Instant startedAt;
        private FocusState state = FocusState.RUNNING;
        private Instant segmentStartedAt;
        private Instant endedAt;
        private long elapsedBeforeSegment;
        private long serverElapsedSeconds;
        private long qualifiedSeconds;

        private FocusSession(String focusId, String tenantId, String subjectId, String roomId, int seatIndex,
                             String leaseId, int durationMinutes, String focusTagCode, Instant startedAt) {
            this.focusId = focusId;
            this.tenantId = tenantId;
            this.subjectId = subjectId;
            this.roomId = roomId;
            this.seatIndex = seatIndex;
            this.leaseId = leaseId;
            this.durationMinutes = durationMinutes;
            this.focusTagCode = focusTagCode;
            this.startedAt = startedAt;
            this.segmentStartedAt = startedAt;
        }

        private long activeSeconds(Instant current) {
            long running = state == FocusState.RUNNING && segmentStartedAt != null
                    ? Math.max(0, Duration.between(segmentStartedAt, current).toSeconds()) : 0;
            return Math.max(0, elapsedBeforeSegment + running);
        }

        private void pause(Instant current) {
            elapsedBeforeSegment = activeSeconds(current);
            segmentStartedAt = null;
            state = FocusState.PAUSED;
        }

        private void resume(Instant current) {
            segmentStartedAt = current;
            state = FocusState.RUNNING;
        }

        private void finish(FocusState terminal, Instant current) {
            serverElapsedSeconds = activeSeconds(current);
            elapsedBeforeSegment = serverElapsedSeconds;
            segmentStartedAt = null;
            endedAt = current;
            state = terminal;
            qualifiedSeconds = terminal == FocusState.COMPLETED
                    ? Math.min(serverElapsedSeconds, durationMinutes * 60L) : 0;
        }
    }

    private static final class Interaction {
        private final String eventId;
        private final String tenantId;
        private final String roomId;
        private final String senderSubjectId;
        private final String targetSubjectId;
        private final int targetSeatIndex;
        private final String presetCode;
        private final String clientEventId;
        private final Instant createdAt;
        private final Instant deliveredAt;
        private InteractionState state = InteractionState.CREATED;

        private Interaction(String eventId, String tenantId, String roomId, String senderSubjectId,
                            String targetSubjectId, int targetSeatIndex, String presetCode,
                            String clientEventId, Instant createdAt) {
            this.eventId = eventId;
            this.tenantId = tenantId;
            this.roomId = roomId;
            this.senderSubjectId = senderSubjectId;
            this.targetSubjectId = targetSubjectId;
            this.targetSeatIndex = targetSeatIndex;
            this.presetCode = presetCode;
            this.clientEventId = clientEventId;
            this.createdAt = createdAt;
            this.deliveredAt = createdAt;
        }
    }

    private static final class Report {
        private final String reportId;
        private final String tenantId;
        private final String roomId;
        private final String reporterSubjectId;
        private final String targetSubjectId;
        private final int targetSeatIndex;
        private final String reasonCode;
        private final String clientEventId;
        private final Instant createdAt;
        private ModerationState state = ModerationState.RECEIVED;
        private Instant updatedAt;

        private Report(String reportId, String tenantId, String roomId, String reporterSubjectId,
                       String targetSubjectId, int targetSeatIndex, String reasonCode,
                       String clientEventId, Instant createdAt) {
            this.reportId = reportId;
            this.tenantId = tenantId;
            this.roomId = roomId;
            this.reporterSubjectId = reporterSubjectId;
            this.targetSubjectId = targetSubjectId;
            this.targetSeatIndex = targetSeatIndex;
            this.reasonCode = reasonCode;
            this.clientEventId = clientEventId;
            this.createdAt = createdAt;
            this.updatedAt = createdAt;
        }

        private Map<String, Object> view() {
            return map("reportId", reportId, "roomId", roomId, "targetSeatIndex", targetSeatIndex,
                    "reasonCode", reasonCode, "status", state.name(), "reviewMode", "MANUAL",
                    "createdAt", createdAt.toString(), "updatedAt", updatedAt.toString(),
                    "clientEventId", clientEventId);
        }
    }

    private static final class Leaderboard {
        private final LeaderboardKey key;
        private final Map<String, ProjectionEntry> entries = new LinkedHashMap<>();
        private LeaderboardState state = LeaderboardState.DELAYED;
        private long snapshotVersion;
        private Instant lastProjectedAt;
        private String sourceWatermark;

        private Leaderboard(LeaderboardKey key) {
            this.key = key;
        }
    }

    private static final class ProjectionEntry {
        private final String subjectId;
        private long score;
        private long qualifiedUnits;
        private Instant lastEventAt;
        private String sourceWatermark;

        private ProjectionEntry(String subjectId) {
            this.subjectId = subjectId;
        }
    }

    private record LeaderboardKey(String tenantId, LeaderboardKind kind, PeriodType period, LocalDate periodStart) {}
    private record SeatRef(String roomId, int seatIndex) {}
}
