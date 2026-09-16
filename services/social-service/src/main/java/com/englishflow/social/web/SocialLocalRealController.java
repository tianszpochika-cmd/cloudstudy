package com.englishflow.social.web;

import com.englishflow.social.domain.SocialException;
import com.englishflow.social.security.SocialAuthenticationToken;
import com.englishflow.social.security.SocialPep;
import com.englishflow.social.security.SocialPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Durable local-real social boundary. It implements the browser-facing room and focus slice
 * directly on the social owner schema while the richer in-memory state machine remains available
 * to the isolated domain smoke profile.
 */
@RestController
@Profile("local-real")
@RequestMapping({"/api/v1/social", "/internal/v1/social"})
public final class SocialLocalRealController {

    private static final Duration LEASE = Duration.ofSeconds(90);
    private final JdbcTemplate jdbc;
    private final SocialPep pep = new SocialPep();

    public SocialLocalRealController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/rooms")
    public Map<String, Object> rooms(@RequestParam(defaultValue = "20") int limit,
            HttpServletRequest request) {
        SocialPrincipal principal = require("social.room.read");
        int safeLimit = Math.max(1, Math.min(limit, 50));
        List<Map<String, Object>> items = jdbc.query(
                "SELECT room_id, theme_code, display_name_key, capacity, state, room_version "
                        + "FROM soc_study_room WHERE tenant_id = ? ORDER BY room_id LIMIT " + safeLimit,
                (rs, row) -> roomSummary(principal, rs.getString("room_id"), rs.getString("theme_code"),
                        rs.getString("display_name_key"), rs.getInt("capacity"), rs.getString("state"),
                        rs.getLong("room_version")), principal.tenantId());
        return envelope(map("items", items, "limit", safeLimit, "hasMore", false,
                "serverTime", Instant.now().toString()), request);
    }

    @GetMapping("/rooms/{roomId}")
    public Map<String, Object> room(@PathVariable String roomId, HttpServletRequest request) {
        SocialPrincipal principal = require("social.room.member.read");
        return envelope(map("room", roomSummary(principal, roomId), "member", member(principal, roomId)), request);
    }

    @PostMapping("/rooms/{roomId}/join")
    public Map<String, Object> join(@PathVariable String roomId,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            HttpServletRequest request) {
        SocialPrincipal principal = require("social.room.join");
        Map<String, Object> existing = member(principal, roomId);
        if ("ACTIVE".equals(existing.get("state"))) {
            return envelope(map("room", roomSummary(principal, roomId), "member", existing, "replayed", true), request);
        }
        Map<String, Object> room = roomRow(principal, roomId);
        Map<String, Object> seat = jdbc.query("SELECT seat_index, lease_id, lease_version FROM soc_seat_lease "
                        + "WHERE tenant_id = ? AND room_id = ? AND state = 'AVAILABLE' ORDER BY seat_index LIMIT 1",
                (rs, row) -> map("seatIndex", rs.getInt("seat_index"), "leaseId", rs.getString("lease_id"),
                        "leaseVersion", rs.getLong("lease_version")), principal.tenantId(), roomId)
                .stream().findFirst().orElseThrow(() -> SocialException.conflict("SOCIAL_ROOM_FULL",
                        "no available study-room seat", true));
        String membershipId = "membership-" + UUID.randomUUID();
        String leaseId = "lease-" + UUID.randomUUID();
        long leaseVersion = ((Number) seat.get("leaseVersion")).longValue() + 1;
        Instant expiresAt = Instant.now().plus(LEASE);
        jdbc.update("UPDATE soc_seat_lease SET subject_id = ?, state = 'OCCUPIED', lease_id = ?, lease_version = ?, "
                        + "lease_expires_at = ?, last_activity_at = ? WHERE tenant_id = ? AND room_id = ? AND seat_index = ? AND state = 'AVAILABLE'",
                principal.subjectId(), leaseId, leaseVersion, Timestamp.from(expiresAt), Timestamp.from(Instant.now()),
                principal.tenantId(), roomId, seat.get("seatIndex"));
        // P1-LIVE-015: a LEFT row already exists for a rejoining member (the
        // unique key is per subject, not per visit). Reactivate it instead of
        // inserting a second row, which raised a duplicate-key 500.
        int reactivated = jdbc.update("UPDATE soc_room_member SET state = 'ACTIVE', presence_state = 'ONLINE', "
                        + "left_at = NULL, last_activity_at = ? WHERE tenant_id = ? AND room_id = ? AND subject_id = ? AND state <> 'ACTIVE'",
                Timestamp.from(Instant.now()), principal.tenantId(), roomId, principal.subjectId());
        if (reactivated == 0) {
            jdbc.update("INSERT INTO soc_room_member(membership_id, room_id, tenant_id, subject_id, state, presence_state, "
                            + "room_visibility, privacy_version, joined_at, last_activity_at) VALUES (?, ?, ?, ?, 'ACTIVE', 'ONLINE', 'PUBLIC', 1, ?, ?)",
                    membershipId, roomId, principal.tenantId(), principal.subjectId(), Timestamp.from(Instant.now()), Timestamp.from(Instant.now()));
        }
        Map<String, Object> member = map("membershipId", membershipId, "roomId", roomId, "subjectId", principal.subjectId(),
                "state", "ACTIVE", "presence", "ONLINE", "seatIndex", seat.get("seatIndex"), "leaseId", leaseId,
                "leaseVersion", leaseVersion, "leaseExpiresAt", expiresAt.toString());
        return envelope(map("room", roomSummary(principal, roomId), "member", member, "replayed", false), request);
    }

    @PostMapping("/rooms/{roomId}/leave")
    public Map<String, Object> leave(@PathVariable String roomId,
            @RequestBody(required = false) Map<String, Object> body,
            HttpServletRequest request) {
        SocialPrincipal principal = require("social.room.write");
        jdbc.update("UPDATE soc_room_member SET state = 'LEFT', presence_state = 'OFFLINE', left_at = UTC_TIMESTAMP(3) "
                        + "WHERE tenant_id = ? AND room_id = ? AND subject_id = ? AND state = 'ACTIVE'",
                principal.tenantId(), roomId, principal.subjectId());
        jdbc.update("UPDATE soc_seat_lease SET subject_id = NULL, state = 'AVAILABLE', lease_id = NULL, "
                        + "lease_expires_at = NULL, released_at = UTC_TIMESTAMP(3), release_reason = 'USER_LEAVE' "
                        + "WHERE tenant_id = ? AND room_id = ? AND subject_id = ?",
                principal.tenantId(), roomId, principal.subjectId());
        return envelope(map("roomId", roomId, "state", "LEFT"), request);
    }

    @PostMapping("/rooms/{roomId}/focus")
    public Map<String, Object> startFocus(@PathVariable String roomId,
            @RequestBody Map<String, Object> body, HttpServletRequest request) {
        SocialPrincipal principal = require("social.focus.write");
        Map<String, Object> member = member(principal, roomId);
        if (!"ACTIVE".equals(member.get("state"))) {
            throw SocialException.conflict("SOCIAL_MEMBERSHIP_REQUIRED",
                    "join the room before starting focus", false);
        }
        int duration = ((Number) (body == null ? 25 : body.getOrDefault("durationMinutes", 25))).intValue();
        if (duration != 25 && duration != 45) throw new IllegalArgumentException("durationMinutes must be 25 or 45");
        String focusId = "focus-" + UUID.randomUUID();
        String tag = String.valueOf(body == null ? "VOCABULARY" : body.getOrDefault("focusTagCode", "VOCABULARY"));
        Instant now = Instant.now();
        jdbc.update("INSERT INTO soc_focus_state(focus_id, tenant_id, room_id, subject_id, seat_index, lease_id, "
                        + "duration_minutes, focus_tag_code, state, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'RUNNING', ?)",
                focusId, principal.tenantId(), roomId, principal.subjectId(), member.get("seatIndex"), member.get("leaseId"),
                duration, tag, Timestamp.from(now));
        Map<String, Object> session = focusView(focusId, roomId, duration, tag, "RUNNING", now, 0L);
        return envelope(map("session", session), request);
    }

    @PatchMapping("/rooms/{roomId}/focus")
    public Map<String, Object> updateFocus(@PathVariable String roomId, @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        SocialPrincipal principal = require("social.focus.write");
        String focusId = String.valueOf(body.get("focusId"));
        String action = String.valueOf(body.getOrDefault("action", "HEARTBEAT"));
        String next = switch (action) { case "PAUSE" -> "PAUSED"; case "RESUME", "HEARTBEAT" -> "RUNNING"; case "FINISH" -> "COMPLETED"; default -> "AUTO_RELEASED"; };
        jdbc.update("UPDATE soc_focus_state SET state = ?, ended_at = CASE WHEN ? IN ('COMPLETED','AUTO_RELEASED') THEN UTC_TIMESTAMP(3) ELSE ended_at END, "
                        + "server_elapsed_seconds = TIMESTAMPDIFF(SECOND, started_at, UTC_TIMESTAMP(3)), qualified_seconds = CASE WHEN ? = 'COMPLETED' THEN LEAST(TIMESTAMPDIFF(SECOND, started_at, UTC_TIMESTAMP(3)), duration_minutes * 60) ELSE qualified_seconds END "
                        + "WHERE focus_id = ? AND tenant_id = ? AND subject_id = ? AND room_id = ?",
                next, next, next, focusId, principal.tenantId(), principal.subjectId(), roomId);
        List<Map<String, Object>> sessions = jdbc.query(
                "SELECT focus_id, room_id, duration_minutes, focus_tag_code, state, started_at, server_elapsed_seconds "
                        + "FROM soc_focus_state WHERE focus_id = ? AND tenant_id = ? AND subject_id = ?",
                (rs, rowNum) -> {
                    Map<String, Object> session = new LinkedHashMap<>();
                    session.put("focusId", rs.getString("focus_id"));
                    session.put("roomId", rs.getString("room_id"));
                    session.put("durationMinutes", rs.getInt("duration_minutes"));
                    session.put("focusTagCode", rs.getString("focus_tag_code"));
                    session.put("state", rs.getString("state"));
                    session.put("startedAt", rs.getTimestamp("started_at"));
                    session.put("serverElapsedSeconds", rs.getLong("server_elapsed_seconds"));
                    return session;
                }, focusId, principal.tenantId(), principal.subjectId());
        if (sessions.isEmpty()) {
            throw SocialException.notFound("SOCIAL_FOCUS_NOT_FOUND",
                    "focus session is outside the verified tenant and owner scope");
        }
        return envelope(map("session", sessions.getFirst()), request);
    }

    @PostMapping("/rooms/{roomId}/interactions")
    public Map<String, Object> interaction(@PathVariable String roomId, @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        SocialPrincipal principal = require("social.interaction.send");
        String eventId = "interaction-" + UUID.randomUUID();
        String code = String.valueOf(body.getOrDefault("presetCode", "CHEER_UP"));
        jdbc.update("INSERT INTO soc_interaction(event_id, client_event_id, tenant_id, room_id, sender_subject_id, "
                        + "target_subject_id, target_seat_index, preset_code, state, created_at, delivered_at) "
                        + "VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 'DELIVERED', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))",
                eventId, String.valueOf(body.getOrDefault("clientEventId", eventId)), principal.tenantId(), roomId,
                principal.subjectId(), body.getOrDefault("targetSeatIndex", 0), code);
        return envelope(map("eventId", eventId, "roomId", roomId, "state", "DELIVERED", "presetCode", code), request);
    }

    @GetMapping("/leaderboards")
    public Map<String, Object> leaderboard(@RequestParam(defaultValue = "FOCUS_MINUTES") String kind,
            @RequestParam(defaultValue = "DAY") String period, @RequestParam(required = false) String roomId,
            HttpServletRequest request) {
        SocialPrincipal principal = require("social.leaderboard.read");
        List<Map<String, Object>> entries = jdbc.query("SELECT subject_id, score, qualified_units FROM soc_leaderboard_projection "
                        + "WHERE tenant_id = ? AND leaderboard_kind = ? AND period_type = ? AND period_start = CURRENT_DATE() "
                        + (roomId == null ? "" : " AND subject_id IN (SELECT subject_id FROM soc_room_member WHERE tenant_id = ? AND room_id = ?)")
                        + " ORDER BY score DESC LIMIT 50",
                (rs, row) -> map("rank", row + 1, "displayMode", "DEIDENTIFIED", "displayName", "学习者 " + (row + 1),
                        "score", rs.getLong("score"), "qualifiedUnits", rs.getLong("qualified_units"),
                        "isSelf", principal.subjectId().equals(rs.getString("subject_id"))),
                roomId == null ? new Object[]{principal.tenantId(), kind, period} : new Object[]{principal.tenantId(), kind, period, principal.tenantId(), roomId});
        return envelope(map("kind", kind, "period", period, "roomId", roomId, "entries", entries,
                "serverTime", Instant.now().toString()), request);
    }

    @PatchMapping("/me/visibility")
    public Map<String, Object> visibility(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        SocialPrincipal principal = require("social.visibility.write");
        String mode = String.valueOf(body.getOrDefault("leaderboardVisibility", "NICKNAME"));
        jdbc.update("INSERT INTO soc_room_member(membership_id, room_id, tenant_id, subject_id, state, presence_state, room_visibility, privacy_version) "
                        + "SELECT CONCAT('visibility-', ?), room_id, tenant_id, subject_id, 'LEFT', 'OFFLINE', ?, 1 FROM soc_study_room WHERE tenant_id = ? LIMIT 1 "
                        + "ON DUPLICATE KEY UPDATE room_visibility = VALUES(room_visibility), privacy_version = privacy_version + 1",
                principal.subjectId(), mode, principal.tenantId());
        return envelope(map("leaderboardVisibility", mode, "updated", true), request);
    }

    /**
     * B4's public moderation contract is not restricted to an already-open room. Keep the
     * moderation fact in this service's owner schema and accept an optional room context.
     */
    @PostMapping("/moderation/reports")
    public Map<String, Object> createModerationReport(@RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            HttpServletRequest request) {
        SocialPrincipal principal = require("social.report.create");
        String targetUserId = String.valueOf(body.getOrDefault("targetUserId", "")).trim();
        String reasonCode = String.valueOf(body.getOrDefault("reasonCode", "")).trim();
        if (targetUserId.isBlank() || targetUserId.equals(principal.subjectId())) {
            throw new IllegalArgumentException("targetUserId must identify another learner");
        }
        if (!List.of("SPAM", "HARASSMENT", "SENSITIVE_CONTENT", "IMPERSONATION", "OTHER")
                .contains(reasonCode)) {
            throw new IllegalArgumentException("unsupported moderation reasonCode");
        }
        String roomId = nullableText(body.get("roomId"));
        Integer targetSeatIndex = null;
        if (roomId != null) {
            List<Integer> seats = jdbc.query(
                    "SELECT seat_index FROM soc_seat_lease WHERE tenant_id = ? AND room_id = ? "
                            + "AND subject_id = ? AND state IN ('OCCUPIED','DISCONNECTED') LIMIT 1",
                    (rs, row) -> rs.getInt("seat_index"), principal.tenantId(), roomId, targetUserId);
            if (!seats.isEmpty()) {
                targetSeatIndex = seats.get(0);
            }
        }
        String clientEventId = key == null || key.isBlank() ? "moderation-" + UUID.randomUUID() : key;
        List<Map<String, Object>> replay = jdbc.query(
                "SELECT report_id, room_id, reporter_subject_id, target_subject_id, target_seat_index, "
                        + "reason_code, state, client_event_id, appeal_code, appeal_subject_id, appealed_at, created_at, updated_at "
                        + "FROM soc_report WHERE tenant_id = ? AND reporter_subject_id = ? AND client_event_id = ?",
                (rs, row) -> reportRow(rs), principal.tenantId(), principal.subjectId(), clientEventId);
        if (!replay.isEmpty()) {
            return envelope(map("report", replay.get(0), "replayed", true), request);
        }

        String reportId = "moderation-report-" + UUID.randomUUID();
        jdbc.update("INSERT INTO soc_report(report_id, tenant_id, room_id, reporter_subject_id, target_subject_id, "
                        + "target_seat_index, reason_code, state, client_event_id, created_at, updated_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))",
                reportId, principal.tenantId(), roomId, principal.subjectId(), targetUserId, targetSeatIndex,
                reasonCode, clientEventId);
        return envelope(map("report", jdbc.queryForObject(
                "SELECT report_id, room_id, reporter_subject_id, target_subject_id, target_seat_index, reason_code, "
                        + "state, client_event_id, appeal_code, appeal_subject_id, appealed_at, created_at, updated_at "
                        + "FROM soc_report WHERE tenant_id = ? AND report_id = ?",
                (rs, row) -> reportRow(rs), principal.tenantId(), reportId), "replayed", false), request);
    }

    @PostMapping("/moderation/reports/{reportId}/appeal")
    public Map<String, Object> appealModerationReport(@PathVariable String reportId,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            HttpServletRequest request) {
        SocialPrincipal principal = require("social.report.create");
        String appealCode = String.valueOf(body.getOrDefault("appealCode", "")).trim();
        if (!List.of("FALSE_POSITIVE", "CONTEXT", "OTHER").contains(appealCode)) {
            throw new IllegalArgumentException("unsupported appealCode");
        }
        int updated = jdbc.update("UPDATE soc_report SET appeal_code = ?, appeal_subject_id = ?, appealed_at = UTC_TIMESTAMP(3), "
                        + "state = CASE WHEN state = 'RECEIVED' THEN 'APPEALED' ELSE state END, updated_at = UTC_TIMESTAMP(3) "
                        + "WHERE tenant_id = ? AND report_id = ? AND (reporter_subject_id = ? OR target_subject_id = ?)",
                appealCode, principal.subjectId(), principal.tenantId(), reportId, principal.subjectId(), principal.subjectId());
        if (updated == 0) {
            throw new IllegalArgumentException("moderation report not found or not appealable by this learner");
        }
        Map<String, Object> report = jdbc.queryForObject(
                "SELECT report_id, room_id, reporter_subject_id, target_subject_id, target_seat_index, reason_code, "
                        + "state, client_event_id, appeal_code, appeal_subject_id, appealed_at, created_at, updated_at "
                        + "FROM soc_report WHERE tenant_id = ? AND report_id = ?",
                (rs, row) -> reportRow(rs), principal.tenantId(), reportId);
        return envelope(map("report", report, "appeal", map("appealCode", appealCode,
                "subjectId", principal.subjectId(), "idempotencyKey", key)), request);
    }

    @PostMapping("/rooms/{roomId}/reports")
    public Map<String, Object> report(@PathVariable String roomId, @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        SocialPrincipal principal = require("social.report.create");
        int seat = ((Number) body.getOrDefault("targetSeatIndex", 1)).intValue();
        String target = jdbc.queryForObject("SELECT subject_id FROM soc_seat_lease WHERE tenant_id = ? AND room_id = ? AND seat_index = ?",
                String.class, principal.tenantId(), roomId, seat);
        String reportId = "report-" + UUID.randomUUID();
        String reason = String.valueOf(body.getOrDefault("reasonCode", "OTHER"));
        jdbc.update("INSERT INTO soc_report(report_id, tenant_id, room_id, reporter_subject_id, target_subject_id, target_seat_index, reason_code, state, client_event_id, created_at, updated_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))",
                reportId, principal.tenantId(), roomId, principal.subjectId(), target, seat, reason,
                String.valueOf(body.getOrDefault("clientEventId", reportId)));
        return envelope(map("report", map("reportId", reportId, "roomId", roomId, "targetSeatIndex", seat,
                "reasonCode", reason, "status", "RECEIVED", "reviewMode", "MANUAL", "createdAt", Instant.now().toString())), request);
    }

    @GetMapping("/reports/{reportId}")
    public Map<String, Object> getReport(@PathVariable String reportId, HttpServletRequest request) {
        SocialPrincipal principal = require("social.report.read");
        return envelope(map("report", jdbc.queryForMap("SELECT report_id, room_id, target_seat_index, reason_code, state, created_at, updated_at FROM soc_report WHERE tenant_id = ? AND report_id = ?", principal.tenantId(), reportId)), request);
    }

    /** B12 admin queue.  Only safe opaque references leave the social owner schema. */
    @GetMapping("/admin/moderation/reports")
    public Map<String, Object> adminModerationReports(
            @RequestParam(defaultValue = "OPEN") String status,
            HttpServletRequest request) {
        SocialPrincipal principal = requireAdmin(Set.of("admin.moderation.read", "social.moderation.review"));
        String statePredicate = switch (status) {
            case "REVIEWING" -> "state = 'TRIAGED'";
            case "RESOLVED" -> "state IN ('ACTIONED', 'CLOSED')";
            case "DISMISSED" -> "state = 'REJECTED'";
            default -> "state IN ('RECEIVED', 'TRIAGED', 'APPEALED')";
        };
        List<Map<String, Object>> items = jdbc.query(
                "SELECT report_id, room_id, reporter_subject_id, target_subject_id, target_seat_index, "
                        + "reason_code, state, client_event_id, created_at, updated_at "
                        + "FROM soc_report WHERE tenant_id = ? AND " + statePredicate
                        + " ORDER BY created_at DESC LIMIT 100",
                (rs, row) -> adminReportRow(rs), principal.tenantId());
        return envelope(map("items", items, "status", status, "source", "mysql"), request);
    }

    @PostMapping("/admin/moderation/reports/{reportId}/commands")
    public Map<String, Object> adminModerationCommand(
            @PathVariable String reportId,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            HttpServletRequest request) {
        SocialPrincipal principal = requireAdmin(Set.of("admin.moderation.command", "social.moderation.review"));
        String commandCode = String.valueOf(body.getOrDefault("commandCode", "")).trim();
        String nextState = switch (commandCode) {
            case "START_REVIEW" -> "TRIAGED";
            case "RESOLVE" -> "ACTIONED";
            case "DISMISS" -> "REJECTED";
            case "ESCALATE" -> "APPEALED";
            default -> throw new IllegalArgumentException("unsupported moderation command");
        };
        String currentState;
        try {
            currentState = jdbc.queryForObject("SELECT state FROM soc_report WHERE tenant_id = ? AND report_id = ?",
                    String.class, principal.tenantId(), reportId);
        } catch (EmptyResultDataAccessException ignored) {
            throw new IllegalArgumentException("moderation report not found");
        }
        boolean replayed = nextState.equals(currentState);
        if (!replayed) {
            jdbc.update("UPDATE soc_report SET state = ?, updated_at = UTC_TIMESTAMP(3) "
                            + "WHERE tenant_id = ? AND report_id = ?",
                    nextState, principal.tenantId(), reportId);
        }
        Map<String, Object> report = jdbc.queryForObject(
                "SELECT report_id, room_id, reporter_subject_id, target_subject_id, target_seat_index, "
                        + "reason_code, state, client_event_id, created_at, updated_at "
                        + "FROM soc_report WHERE tenant_id = ? AND report_id = ?",
                (rs, row) -> adminReportRow(rs), principal.tenantId(), reportId);
        return envelope(map("report", report, "commandCode", commandCode, "replayed", replayed,
                "idempotencyKeyPresent", idempotencyKey != null && !idempotencyKey.isBlank(), "source", "mysql"), request);
    }

    @PostMapping("/ws-ticket")
    public Map<String, Object> wsTicket(HttpServletRequest request) {
        SocialPrincipal principal = require("social.room.read");
        return envelope(map("ticket", "local-real-ws-ticket-" + UUID.randomUUID(), "subjectId", principal.subjectId(), "expiresInSeconds", 60), request);
    }

    private SocialPrincipal require(String permission) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof SocialAuthenticationToken token) || !token.isAuthenticated()) {
            throw SocialException.unauthorized();
        }
        SocialPrincipal principal = token.socialPrincipal();
        // P1-LIVE-006: an unusable principal (wrong phase, inactive, revoked or
        // missing consent) is a 403, never a 500: raw IllegalStates here turned
        // every misconfigured caller into INTERNAL_ERROR and hid the real cause.
        if (!principal.isUsablePhaseOne()) {
            throw SocialException.forbidden("SOCIAL_PRINCIPAL_UNUSABLE",
                    "social principal is not usable in phase one");
        }
        pep.requirePermission(principal, permission);
        return principal;
    }

    private SocialPrincipal requireAdmin(Set<String> permissions) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof SocialAuthenticationToken token) || !token.isAuthenticated()) {
            throw SocialException.unauthorized();
        }
        SocialPrincipal principal = token.socialPrincipal();
        pep.requireAnyPermission(principal, permissions);
        return principal;
    }

    private Map<String, Object> roomSummary(SocialPrincipal principal, String roomId) {
        Map<String, Object> row = roomRow(principal, roomId);
        return roomSummary(principal, roomId, String.valueOf(row.get("themeCode")), String.valueOf(row.get("name")),
                ((Number) row.get("capacity")).intValue(), String.valueOf(row.get("state")), ((Number) row.get("version")).longValue());
    }

    private Map<String, Object> roomSummary(SocialPrincipal principal, String roomId, String theme, String name,
            int capacity, String state, long version) {
        int count = jdbc.queryForObject("SELECT COUNT(*) FROM soc_room_member WHERE tenant_id = ? AND room_id = ? AND state = 'ACTIVE'",
                Integer.class, principal.tenantId(), roomId);
        boolean joined = jdbc.queryForObject("SELECT COUNT(*) FROM soc_room_member WHERE tenant_id = ? AND room_id = ? AND subject_id = ? AND state = 'ACTIVE'",
                Integer.class, principal.tenantId(), roomId, principal.subjectId()) > 0;
        return map("roomId", roomId, "name", name, "templateCode", theme, "capacity", capacity,
                "memberCount", count, "joined", joined, "chatMode", "PRESET_ONLY", "state", state, "version", version);
    }

    private Map<String, Object> roomRow(SocialPrincipal principal, String roomId) {
        try {
            return jdbc.queryForMap("SELECT room_id AS roomId, theme_code AS themeCode, display_name_key AS name, capacity, state, room_version AS version FROM soc_study_room WHERE tenant_id = ? AND room_id = ?",
                    principal.tenantId(), roomId);
        } catch (EmptyResultDataAccessException ignored) {
            throw new IllegalArgumentException("study room not found");
        }
    }

    private Map<String, Object> member(SocialPrincipal principal, String roomId) {
        try {
            return jdbc.queryForMap("SELECT membership_id AS membershipId, room_id AS roomId, subject_id AS subjectId, state, presence_state AS presence, "
                            + "(SELECT seat_index FROM soc_seat_lease s WHERE s.tenant_id = m.tenant_id AND s.room_id = m.room_id AND s.subject_id = m.subject_id AND s.state IN ('OCCUPIED','DISCONNECTED') LIMIT 1) AS seatIndex, "
                            + "(SELECT lease_id FROM soc_seat_lease s WHERE s.tenant_id = m.tenant_id AND s.room_id = m.room_id AND s.subject_id = m.subject_id AND s.state IN ('OCCUPIED','DISCONNECTED') LIMIT 1) AS leaseId "
                            + "FROM soc_room_member m WHERE tenant_id = ? AND room_id = ? AND subject_id = ? ORDER BY id DESC LIMIT 1",
                    principal.tenantId(), roomId, principal.subjectId());
        } catch (EmptyResultDataAccessException ignored) {
            return map("roomId", roomId, "subjectId", principal.subjectId(), "state", "LEFT", "presence", "OFFLINE");
        }
    }

    private Map<String, Object> focusView(String focusId, String roomId, int duration, String tag, String state,
            Instant startedAt, long elapsed) {
        return map("sessionId", focusId, "focusId", focusId, "roomId", roomId, "durationMinutes", duration,
                "focusTagCode", tag, "status", state, "startedAt", startedAt.toString(),
                "serverDurationSeconds", elapsed, "serverElapsedSeconds", elapsed, "qualifiedSeconds", 0);
    }

    private static Map<String, Object> reportRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        Timestamp appealedAt = rs.getTimestamp("appealed_at");
        Timestamp createdAt = rs.getTimestamp("created_at");
        Timestamp updatedAt = rs.getTimestamp("updated_at");
        return map("reportId", rs.getString("report_id"), "roomId", rs.getString("room_id"),
                "reporterSubjectId", rs.getString("reporter_subject_id"),
                "targetUserId", rs.getString("target_subject_id"),
                "targetSeatIndex", rs.getObject("target_seat_index"),
                "reasonCode", rs.getString("reason_code"), "status", rs.getString("state"),
                "clientEventId", rs.getString("client_event_id"), "appealCode", rs.getString("appeal_code"),
                "appealSubjectId", rs.getString("appeal_subject_id"),
                "appealedAt", appealedAt == null ? null : appealedAt.toInstant().toString(),
                "createdAt", createdAt == null ? null : createdAt.toInstant().toString(),
                "updatedAt", updatedAt == null ? null : updatedAt.toInstant().toString());
    }

    private static Map<String, Object> adminReportRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        Timestamp createdAt = rs.getTimestamp("created_at");
        Timestamp updatedAt = rs.getTimestamp("updated_at");
        return map("reportId", rs.getString("report_id"), "roomRef",
                opaqueRef("room", rs.getString("room_id")), "targetRef",
                opaqueRef("subject", rs.getString("target_subject_id")), "targetSeatIndex",
                rs.getObject("target_seat_index") == null ? 1 : rs.getObject("target_seat_index"),
                "reasonCode", rs.getString("reason_code"), "status", rs.getString("state"),
                "reviewMode", "MANUAL", "clientEventId", rs.getString("client_event_id"),
                "createdAt", createdAt == null ? null : createdAt.toInstant().toString(),
                "updatedAt", updatedAt == null ? null : updatedAt.toInstant().toString());
    }

    private static String opaqueRef(String prefix, String value) {
        if (value == null || value.isBlank()) return null;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return prefix + "-" + java.util.HexFormat.of().formatHex(digest, 0, 8);
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
    }

    private static String nullableText(Object value) {
        if (value == null) return null;
        String text = String.valueOf(value).trim();
        return text.isBlank() ? null : text;
    }

    private static String normalize(String key) {
        StringBuilder result = new StringBuilder();
        boolean upper = false;
        for (char value : key.toCharArray()) {
            if (value == '_') { upper = true; continue; }
            result.append(upper ? Character.toUpperCase(value) : value);
            upper = false;
        }
        return result.toString();
    }

    private static Map<String, Object> envelope(Map<String, Object> data, HttpServletRequest request) {
        return map("requestId", request.getHeader("X-Request-Id") == null ? "req_social_local_real" : request.getHeader("X-Request-Id"),
                "data", data, "meta", map("service", "social-service", "schemaVersion", "social.api.v1"));
    }

    private static Map<String, Object> map(Object... pairs) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int index = 0; index < pairs.length; index += 2) result.put(String.valueOf(pairs[index]), pairs[index + 1]);
        return result;
    }
}
