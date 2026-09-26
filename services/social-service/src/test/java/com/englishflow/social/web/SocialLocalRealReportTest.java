package com.englishflow.social.web;

import com.englishflow.social.domain.SocialException;
import com.englishflow.social.security.SocialAuthenticationToken;
import com.englishflow.social.security.SocialPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import java.lang.reflect.Method;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SocialLocalRealReportTest {

    private static final String ROOM = "room-A";
    private static final String REPORTER = "subject-a";
    private static final String TENANT = "tenant-a";

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void writesCompleteReceiptAndMarksKeyAndFingerprintReplays() {
        ReportJdbc jdbc = readyJdbc();
        SocialLocalRealController controller = new SocialLocalRealController(jdbc);
        authenticate(reportPrincipal());

        Map<String, Object> first = report(controller, "report-key-0001", 2, "SPAM");
        Map<String, Object> firstReceipt = receipt(first);
        assertEquals("room-A", firstReceipt.get("roomId"));
        assertEquals(2, firstReceipt.get("targetSeatIndex"));
        assertEquals("SPAM", firstReceipt.get("reasonCode"));
        assertEquals("RECEIVED", firstReceipt.get("status"));
        assertEquals("MANUAL", firstReceipt.get("reviewMode"));
        assertEquals("report-key-0001", firstReceipt.get("clientEventId"));
        assertNotNull(firstReceipt.get("reportId"));
        assertNotNull(firstReceipt.get("createdAt"));
        assertNotNull(firstReceipt.get("updatedAt"));
        assertEquals(false, firstReceipt.get("idempotentReplay"));

        jdbc.updateReportState(String.valueOf(firstReceipt.get("reportId")), "TRIAGED");
        Map<String, Object> sameKeyReplay = report(controller, "report-key-0001", 2, "SPAM");
        Map<String, Object> sameKeyReceipt = receipt(sameKeyReplay);
        assertEquals(true, sameKeyReceipt.get("idempotentReplay"));
        assertEquals("RECEIVED", sameKeyReceipt.get("status"), "same-key replay returns its stored original receipt");
        assertEquals(firstReceipt.get("reportId"), sameKeyReceipt.get("reportId"));
        assertEquals(firstReceipt.get("clientEventId"), sameKeyReceipt.get("clientEventId"));

        Map<String, Object> fingerprintReplay = report(controller, "report-key-0002", 2, "SPAM");
        Map<String, Object> fingerprintReceipt = receipt(fingerprintReplay);
        assertEquals(true, fingerprintReceipt.get("idempotentReplay"));
        assertEquals("TRIAGED", fingerprintReceipt.get("status"),
                "a new key deduped by target/reason returns the current persisted report fact");
        assertEquals(firstReceipt.get("reportId"), fingerprintReceipt.get("reportId"));
        assertEquals("report-key-0001", fingerprintReceipt.get("clientEventId"),
                "a new key after token refresh must not replace the persisted original event id");
        assertEquals(1, jdbc.reports.size());
        assertEquals(2, jdbc.idempotency.size());
    }

    @Test
    void concurrentTargetReasonUniqueConflictReturnsTheCommittedReceipt() {
        ReportJdbc jdbc = readyJdbc();
        jdbc.raceNextReportInsertWith(new ReportRow("report-original", TENANT, ROOM, REPORTER,
                "subject-b", 2, "SPAM", "report-key-old-0003", "RECEIVED"));
        SocialLocalRealController controller = new SocialLocalRealController(jdbc);
        authenticate(reportPrincipal());

        Map<String, Object> response = report(controller, "report-key-0003", 2, "SPAM");
        Map<String, Object> receipt = receipt(response);
        assertEquals("report-original", receipt.get("reportId"));
        assertEquals("report-key-old-0003", receipt.get("clientEventId"));
        assertEquals(true, receipt.get("idempotentReplay"));
        assertEquals(1, jdbc.reports.size());
        assertTrue(jdbc.queries.stream().anyMatch(sql -> sql.contains("target_subject_id = ?")
                && sql.endsWith("FOR UPDATE")), "unique-key recovery must read the committed current row");
    }

    @Test
    void sameKeyWithDifferentBodyConflictsAndLegacyPermissionCannotCreateReports() {
        ReportJdbc jdbc = readyJdbc();
        SocialLocalRealController controller = new SocialLocalRealController(jdbc);
        authenticate(reportPrincipal());
        Map<String, Object> first = report(controller, "report-key-0004", 2, "SPAM");

        SocialException changedBody = assertThrows(SocialException.class,
                () -> report(controller, "report-key-0004", 2, "HARASSMENT"));
        assertEquals(409, changedBody.status());
        assertEquals("IDEMPOTENCY_KEY_REUSED", changedBody.code());
        assertEquals(1, jdbc.reports.size());

        authenticate(SocialPrincipal.phaseOne(REPORTER, TENANT, Set.of("social.report.create")));
        SocialException legacyDenied = assertThrows(SocialException.class,
                () -> report(controller, "report-key-0005", 2, "SPAM"));
        assertEquals(403, legacyDenied.status());
        assertEquals("SOCIAL_PERMISSION_DENIED", legacyDenied.code());
        assertEquals(1, jdbc.reports.size());
        assertEquals(firstReceiptReportId(first), jdbc.reports.getFirst().reportId());
    }

    @Test
    void requiresTheVerifiedConsentStateAndMatchingBodyEventKey() {
        ReportJdbc jdbc = readyJdbc();
        SocialLocalRealController controller = new SocialLocalRealController(jdbc);
        authenticate(new SocialPrincipal(REPORTER, TENANT, SocialPrincipal.PHASE_ONE, false,
                true, false, Set.of("social.report.create.self"), Set.of()));
        SocialException consentDenied = assertThrows(SocialException.class,
                () -> report(controller, "report-key-0006", 2, "SPAM"));
        assertEquals(403, consentDenied.status());
        assertEquals("SOCIAL_PRINCIPAL_UNUSABLE", consentDenied.code());
        assertTrue(jdbc.idempotency.isEmpty());

        authenticate(reportPrincipal());
        SocialException mismatch = assertThrows(SocialException.class,
                () -> controller.report(ROOM, Map.of("targetSeatIndex", 2, "reasonCode", "SPAM",
                        "clientEventId", "different-key-1"), "report-key-0006", new MockHttpServletRequest()));
        assertEquals(400, mismatch.status());
        assertEquals("IDEMPOTENCY_KEY_BODY_MISMATCH", mismatch.code());
        assertTrue(jdbc.idempotency.isEmpty());
    }

    @Test
    void rejectsMissingReporterHiddenOrSelfTargetsAndFailsClosedForMissingOwnerFact() {
        ReportJdbc noReporter = readyJdbc();
        noReporter.members.remove(new MemberKey(TENANT, ROOM, REPORTER));
        authenticate(reportPrincipal());
        SocialException memberDenied = assertThrows(SocialException.class,
                () -> report(new SocialLocalRealController(noReporter), "report-key-0007", 2, "SPAM"));
        assertEquals("SOC_ROOM_MEMBER_REQUIRED", memberDenied.code());

        ReportJdbc hidden = readyJdbc();
        hidden.members.put(new MemberKey(TENANT, ROOM, "subject-b"), new MemberRow("ACTIVE", "HIDDEN"));
        authenticate(reportPrincipal());
        SocialException hiddenDenied = assertThrows(SocialException.class,
                () -> report(new SocialLocalRealController(hidden), "report-key-0008", 2, "SPAM"));
        assertEquals("SOC_REPORT_TARGET_NOT_VISIBLE", hiddenDenied.code());

        ReportJdbc self = readyJdbc();
        self.seats.put(new SeatKey(TENANT, ROOM, 1), new SeatRow(REPORTER, "OCCUPIED"));
        authenticate(reportPrincipal());
        SocialException selfDenied = assertThrows(SocialException.class,
                () -> report(new SocialLocalRealController(self), "report-key-0009", 1, "SPAM"));
        assertEquals("SOC_REPORT_TARGET_INVALID", selfDenied.code());

        ReportJdbc missingFact = readyJdbc();
        SocialLocalRealController missingFactController = new SocialLocalRealController(missingFact);
        authenticate(reportPrincipal());
        Map<String, Object> first = report(missingFactController, "report-key-0010", 2, "SPAM");
        String reportId = String.valueOf(receipt(first).get("reportId"));
        missingFact.reports.clear();
        SocialException unavailable = assertThrows(SocialException.class,
                () -> report(missingFactController, "report-key-0010", 2, "SPAM"));
        assertEquals(503, unavailable.status());
        assertEquals("SOC_REPORT_RECEIPT_UNAVAILABLE", unavailable.code());
        assertFalse(reportId.isBlank());
    }

    @Test
    void reportWriteIsTransactionalAndClientEventUniqueConflictsAreNotInternalErrors() throws Exception {
        Method method = SocialLocalRealController.class.getMethod("report", String.class, Map.class,
                String.class, HttpServletRequest.class);
        assertNotNull(method.getAnnotation(Transactional.class),
                "the report fact and idempotency receipt must commit or roll back together");

        ReportJdbc jdbc = readyJdbc();
        jdbc.reports.add(new ReportRow("report-existing", TENANT, ROOM, REPORTER,
                "subject-c", 3, "HARASSMENT", "report-key-0011", "RECEIVED"));
        SocialLocalRealController controller = new SocialLocalRealController(jdbc);
        authenticate(reportPrincipal());
        SocialException reusedEvent = assertThrows(SocialException.class,
                () -> report(controller, "report-key-0011", 2, "SPAM"));
        assertEquals(409, reusedEvent.status());
        assertEquals("SOC_REPORT_CLIENT_EVENT_REUSED", reusedEvent.code());
    }

    @Test
    void idempotencyKeyIsRequiredAndCannotExceedThePersistedEventIdentityLimit() {
        ReportJdbc jdbc = readyJdbc();
        SocialLocalRealController controller = new SocialLocalRealController(jdbc);
        authenticate(reportPrincipal());
        Map<String, Object> body = Map.of("targetSeatIndex", 2, "reasonCode", "SPAM",
                "clientEventId", "report-key-0012");

        SocialException missing = assertThrows(SocialException.class,
                () -> controller.report(ROOM, body, null, new MockHttpServletRequest()));
        assertEquals("IDEMPOTENCY_KEY_REQUIRED", missing.code());

        String oversized = "r".repeat(161);
        SocialException tooLong = assertThrows(SocialException.class,
                () -> controller.report(ROOM, Map.of("targetSeatIndex", 2, "reasonCode", "SPAM",
                                "clientEventId", oversized), oversized, new MockHttpServletRequest()));
        assertEquals("REQUEST_INVALID", tooLong.code());
        assertTrue(jdbc.idempotency.isEmpty());
    }

    @Test
    void reportFactsAndIdempotencyRecordsRemainTenantScoped() {
        ReportJdbc jdbc = readyJdbc();
        jdbc.members.put(new MemberKey("tenant-b", ROOM, REPORTER), new MemberRow("ACTIVE", "PUBLIC"));
        jdbc.members.put(new MemberKey("tenant-b", ROOM, "subject-b"), new MemberRow("ACTIVE", "PUBLIC"));
        jdbc.seats.put(new SeatKey("tenant-b", ROOM, 2), new SeatRow("subject-b", "OCCUPIED"));
        jdbc.reports.add(new ReportRow("report-tenant-a", TENANT, ROOM, REPORTER,
                "subject-b", 2, "SPAM", "report-key-0013", "RECEIVED"));
        SocialLocalRealController controller = new SocialLocalRealController(jdbc);
        authenticate(SocialPrincipal.phaseOne(REPORTER, "tenant-b", Set.of("social.report.create.self")));

        Map<String, Object> response = report(controller, "report-key-0013", 2, "SPAM");
        Map<String, Object> receipt = receipt(response);
        assertEquals("report-key-0013", receipt.get("clientEventId"));
        assertTrue(Boolean.FALSE.equals(receipt.get("idempotentReplay")));
        assertEquals(2, jdbc.reports.size());
        assertTrue(jdbc.reports.stream().anyMatch(row -> "tenant-b".equals(row.tenant())
                && row.reportId().equals(receipt.get("reportId"))));
    }

    private static ReportJdbc readyJdbc() {
        ReportJdbc jdbc = new ReportJdbc();
        jdbc.members.put(new MemberKey(TENANT, ROOM, REPORTER), new MemberRow("ACTIVE", "PUBLIC"));
        jdbc.members.put(new MemberKey(TENANT, ROOM, "subject-b"), new MemberRow("ACTIVE", "PUBLIC"));
        jdbc.seats.put(new SeatKey(TENANT, ROOM, 2), new SeatRow("subject-b", "OCCUPIED"));
        return jdbc;
    }

    private static SocialPrincipal reportPrincipal() {
        // Production IAM only issues this learner scope after adult-gate and required-consent checks.
        return SocialPrincipal.phaseOne(REPORTER, TENANT, Set.of("social.report.create.self"));
    }

    private static void authenticate(SocialPrincipal principal) {
        SecurityContextHolder.getContext().setAuthentication(
                SocialAuthenticationToken.fromVerifiedPrincipal(principal));
    }

    private static Map<String, Object> report(SocialLocalRealController controller, String key,
            int targetSeat, String reason) {
        return controller.report(ROOM, Map.of("targetSeatIndex", targetSeat, "reasonCode", reason,
                "clientEventId", key), key, new MockHttpServletRequest());
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> receipt(Map<String, Object> envelope) {
        Map<String, Object> data = (Map<String, Object>) envelope.get("data");
        return (Map<String, Object>) data.get("report");
    }

    private static String firstReceiptReportId(Map<String, Object> envelope) {
        return String.valueOf(receipt(envelope).get("reportId"));
    }

    private record MemberKey(String tenant, String room, String subject) {}
    private record SeatKey(String tenant, String room, int seat) {}
    private record MemberRow(String state, String visibility) {}
    private record SeatRow(String subject, String state) {}
    private record IdempotencyKey(String tenant, String subject, String scope, String keyHash) {}
    private record IdempotencyRow(String fingerprint, String responseJson) {}
    private record ReportRow(String reportId, String tenant, String room, String reporter,
            String target, int seat,
            String reason, String eventId, String state) {}

    /** Stateful JDBC fake exercises the controller's owner queries and unique-key recovery paths. */
    private static final class ReportJdbc extends JdbcTemplate {
        private final Map<MemberKey, MemberRow> members = new HashMap<>();
        private final Map<SeatKey, SeatRow> seats = new HashMap<>();
        private final Map<IdempotencyKey, IdempotencyRow> idempotency = new HashMap<>();
        private final List<ReportRow> reports = new ArrayList<>();
        private final List<String> queries = new ArrayList<>();
        private ReportRow raceWinner;

        void raceNextReportInsertWith(ReportRow winner) {
            raceWinner = winner;
        }

        void updateReportState(String reportId, String state) {
            for (int index = 0; index < reports.size(); index++) {
                ReportRow row = reports.get(index);
                if (row.reportId().equals(reportId)) {
                    reports.set(index, new ReportRow(row.reportId(), row.tenant(), row.room(), row.reporter(),
                            row.target(), row.seat(), row.reason(), row.eventId(), state));
                    return;
                }
            }
        }

        @Override
        public <T> T queryForObject(String sql, Class<T> requiredType, Object... args) {
            queries.add(sql);
            if (sql.contains("FROM soc_room_member")) {
                MemberKey key = new MemberKey(String.valueOf(args[0]), String.valueOf(args[1]),
                        String.valueOf(args[2]));
                MemberRow member = members.get(key);
                if (member == null || !"ACTIVE".equals(member.state())) {
                    throw new EmptyResultDataAccessException("active room member not found", 1);
                }
                return requiredType.cast(1L);
            }
            throw new AssertionError("unexpected queryForObject: " + sql);
        }

        @Override
        public Map<String, Object> queryForMap(String sql, Object... args) {
            queries.add(sql);
            if (sql.contains("FROM soc_idempotency_record")) {
                IdempotencyKey key = new IdempotencyKey(String.valueOf(args[0]), String.valueOf(args[1]),
                        String.valueOf(args[2]), String.valueOf(args[3]));
                IdempotencyRow value = idempotency.get(key);
                if (value == null) throw new EmptyResultDataAccessException("idempotency not found", 1);
                return Map.of("requestFingerprint", value.fingerprint(), "responseJson", value.responseJson());
            }
            if (sql.contains("FROM soc_seat_lease")) {
                SeatKey key = new SeatKey(String.valueOf(args[0]), String.valueOf(args[1]),
                        ((Number) args[2]).intValue());
                SeatRow seat = seats.get(key);
                MemberRow member = seat == null ? null : members.get(new MemberKey(key.tenant(), key.room(), seat.subject()));
                if (seat == null || member == null || !"ACTIVE".equals(member.state())
                        || "HIDDEN".equals(member.visibility())
                        || !Set.of("OCCUPIED", "DISCONNECTED").contains(seat.state())) {
                    throw new EmptyResultDataAccessException("visible target not found", 1);
                }
                return Map.of("subjectId", seat.subject());
            }
            if (sql.contains("FROM soc_report") && sql.contains("target_subject_id = ?")) {
                ReportRow report = reports.stream().filter(row -> rowMatchesFingerprint(row, args)).findFirst()
                        .orElseThrow(() -> new EmptyResultDataAccessException("report fingerprint not found", 1));
                return Map.of("reportId", report.reportId());
            }
            if (sql.contains("FROM soc_report") && sql.contains("client_event_id = ?")) {
                ReportRow report = reports.stream().filter(row -> row.tenant().equals(args[0])
                                && row.reporter().equals(args[1]) && row.eventId().equals(args[2]))
                        .findFirst().orElseThrow(() -> new EmptyResultDataAccessException("event not found", 1));
                return Map.of("reportId", report.reportId(), "roomId", report.room(),
                        "targetSubjectId", report.target(), "targetSeatIndex", report.seat(),
                        "reasonCode", report.reason());
            }
            if (sql.contains("FROM soc_report") && sql.contains("report_id = ?")) {
                String tenant = String.valueOf(args[0]);
                String reportId = String.valueOf(args[1]);
                ReportRow row = reports.stream().filter(value -> tenant.equals(value.tenant())
                                && value.reportId().equals(reportId))
                        .findFirst().orElseThrow(() -> new EmptyResultDataAccessException("report not found", 1));
                return receiptRow(row);
            }
            throw new AssertionError("unexpected queryForMap: " + sql);
        }

        @Override
        public int update(String sql, Object... args) {
            if (sql.startsWith("INSERT INTO soc_idempotency_record")) {
                IdempotencyKey key = new IdempotencyKey(String.valueOf(args[0]), String.valueOf(args[1]),
                        String.valueOf(args[2]), String.valueOf(args[3]));
                if (idempotency.containsKey(key)) throw new DuplicateKeyException("idempotency key collision");
                idempotency.put(key, new IdempotencyRow(String.valueOf(args[4]), "{\"pending\":true}"));
                return 1;
            }
            if (sql.startsWith("UPDATE soc_idempotency_record")) {
                IdempotencyKey key = new IdempotencyKey(String.valueOf(args[1]), String.valueOf(args[2]),
                        String.valueOf(args[3]), String.valueOf(args[4]));
                IdempotencyRow prior = idempotency.get(key);
                if (prior == null) throw new AssertionError("idempotency reservation disappeared");
                idempotency.put(key, new IdempotencyRow(prior.fingerprint(), String.valueOf(args[0])));
                return 1;
            }
            if (sql.startsWith("INSERT INTO soc_report")) {
                ReportRow inserted = new ReportRow(String.valueOf(args[0]), String.valueOf(args[1]),
                        String.valueOf(args[2]), String.valueOf(args[3]), String.valueOf(args[4]),
                        ((Number) args[5]).intValue(), String.valueOf(args[6]),
                        String.valueOf(args[7]), "RECEIVED");
                if (raceWinner != null) {
                    reports.add(raceWinner);
                    raceWinner = null;
                    throw new DuplicateKeyException("concurrent target/reason unique-key winner");
                }
                if (reports.stream().anyMatch(row -> sameFingerprint(row, inserted))) {
                    throw new DuplicateKeyException("target/reason unique-key collision");
                }
                if (reports.stream().anyMatch(row -> row.tenant().equals(inserted.tenant())
                        && row.reporter().equals(inserted.reporter())
                        && row.eventId().equals(inserted.eventId()))) {
                    throw new DuplicateKeyException("client-event unique-key collision");
                }
                reports.add(inserted);
                return 1;
            }
            throw new AssertionError("unexpected update: " + sql);
        }

        private static boolean rowMatchesFingerprint(ReportRow row, Object[] args) {
            return row.tenant().equals(args[0]) && row.room().equals(args[1]) && row.reporter().equals(args[2])
                    && row.target().equals(args[3]) && row.reason().equals(args[4]);
        }

        private static boolean sameFingerprint(ReportRow first, ReportRow second) {
            return first.tenant().equals(second.tenant()) && first.room().equals(second.room())
                    && first.reporter().equals(second.reporter()) && first.target().equals(second.target())
                    && first.reason().equals(second.reason());
        }

        private static Map<String, Object> receiptRow(ReportRow row) {
            LinkedHashMap<String, Object> result = new LinkedHashMap<>();
            result.put("reportId", row.reportId());
            result.put("roomId", row.room());
            result.put("targetSeatIndex", row.seat());
            result.put("reasonCode", row.reason());
            result.put("status", row.state());
            result.put("clientEventId", row.eventId());
            result.put("createdAt", Instant.parse("2026-09-25T01:02:03Z").toString());
            result.put("updatedAt", Instant.parse("2026-09-25T01:02:03Z").toString());
            return result;
        }
    }
}
