package com.englishflow.social.web;

import com.englishflow.social.domain.SocialException;
import com.englishflow.social.security.SocialAuthenticationToken;
import com.englishflow.social.security.SocialPrincipal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ModerationQueueReadBoundaryTest {
    private static final String KEY = "isolated-test-key-with-at-least-thirty-two-bytes";

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void deniesMissingPermissionAndMissingKeyBeforeDatabaseRead() {
        CountingJdbc jdbc = new CountingJdbc();
        SocialLocalRealController controller = new SocialLocalRealController(jdbc);
        MockHttpServletRequest request = request();

        authenticate(Set.of("social.room.read"));
        assertEquals("SOCIAL_PERMISSION_DENIED", assertThrows(SocialException.class,
                () -> controller.adminModerationReports("OPEN", 20, null, request)).code());
        assertEquals(0, jdbc.reads);

        authenticate(Set.of("admin.moderation.read"));
        assertEquals("MODERATION_CURSOR_UNAVAILABLE", assertThrows(SocialException.class,
                () -> controller.adminModerationReports("OPEN", 20, null, request)).code());
        assertEquals(0, jdbc.reads);
    }

    @Test
    void returnsCanonicalEmptyPageScopedToVerifiedTenant() {
        CountingJdbc jdbc = new CountingJdbc();
        SocialLocalRealController controller = new SocialLocalRealController(jdbc);
        ReflectionTestUtils.setField(controller, "moderationCursorKey", KEY);
        authenticate(Set.of("admin.moderation.read"));

        ResponseEntity<Map<String, Object>> response = controller.adminModerationReports("OPEN", 200, null, request());
        assertEquals(200, response.getStatusCode().value());
        assertEquals("v1", response.getHeaders().getFirst("X-API-Version"));
        assertEquals("req-test-1", response.getHeaders().getFirst("X-Request-Id"));
        assertEquals("0123456789abcdef0123456789abcdef", response.getHeaders().getFirst("X-Trace-Id"));
        assertEquals(1, jdbc.reads);
        assertTrue(jdbc.sql.contains("tenant_id = ?"));
        assertTrue(jdbc.sql.contains("ORDER BY id DESC LIMIT ?"));
        assertEquals("tenant-a", jdbc.arguments[0]);
        assertEquals(101, jdbc.arguments[1]);
        @SuppressWarnings("unchecked") Map<String, Object> data = (Map<String, Object>) response.getBody().get("data");
        @SuppressWarnings("unchecked") Map<String, Object> meta = (Map<String, Object>) response.getBody().get("meta");
        assertEquals(List.of(), data.get("items"));
        assertEquals(100, meta.get("pageSize"));
        assertFalse((Boolean) meta.get("hasMore"));
        assertNull(meta.get("nextCursor"));
        assertEquals("1.0.0", meta.get("schemaVersion"));
    }

    @Test
    void rejectsInvalidStatusAndCursorBeforeDatabaseRead() {
        CountingJdbc jdbc = new CountingJdbc();
        SocialLocalRealController controller = new SocialLocalRealController(jdbc);
        ReflectionTestUtils.setField(controller, "moderationCursorKey", KEY);
        authenticate(Set.of("admin.moderation.read"));

        assertEquals("MODERATION_STATUS_INVALID", assertThrows(SocialException.class,
                () -> controller.adminModerationReports("ALL", 20, null, request())).code());
        assertEquals("MODERATION_CURSOR_INVALID", assertThrows(SocialException.class,
                () -> controller.adminModerationReports("OPEN", 20, "made-up", request())).code());
        assertEquals(0, jdbc.reads);
    }

    @Test
    void pagesWithSignedCursorAndNeverReturnsRawSubjectOrClientEvent() {
        CountingJdbc jdbc = new CountingJdbc();
        jdbc.rows = List.of(3L, 2L, 1L);
        SocialLocalRealController controller = new SocialLocalRealController(jdbc);
        ReflectionTestUtils.setField(controller, "moderationCursorKey", KEY);
        authenticate(Set.of("admin.moderation.read"));

        ResponseEntity<Map<String, Object>> first = controller.adminModerationReports("OPEN", 1, null, request());
        @SuppressWarnings("unchecked") Map<String, Object> firstData = (Map<String, Object>) first.getBody().get("data");
        @SuppressWarnings("unchecked") List<Map<String, Object>> firstItems = (List<Map<String, Object>>) firstData.get("items");
        @SuppressWarnings("unchecked") Map<String, Object> firstMeta = (Map<String, Object>) first.getBody().get("meta");
        assertEquals(1, firstItems.size());
        assertEquals("report-3", firstItems.getFirst().get("reportId"));
        assertTrue(((String) firstItems.getFirst().get("targetRef")).startsWith("subject-"));
        assertFalse(firstItems.getFirst().containsKey("targetSubjectId"));
        assertFalse(firstItems.getFirst().containsKey("reporterSubjectId"));
        assertFalse(firstItems.getFirst().containsKey("clientEventId"));
        assertTrue((Boolean) firstMeta.get("hasMore"));
        String cursor = (String) firstMeta.get("nextCursor");
        assertTrue(cursor != null && !cursor.isBlank());

        ResponseEntity<Map<String, Object>> second = controller.adminModerationReports("OPEN", 1, cursor, request());
        @SuppressWarnings("unchecked") Map<String, Object> secondData = (Map<String, Object>) second.getBody().get("data");
        @SuppressWarnings("unchecked") List<Map<String, Object>> secondItems = (List<Map<String, Object>>) secondData.get("items");
        assertEquals("report-2", secondItems.getFirst().get("reportId"));
        assertTrue(jdbc.sql.contains("id < ?"));
        assertEquals("tenant-a", jdbc.arguments[0]);
        assertEquals(3L, jdbc.arguments[1]);
        assertEquals(2, jdbc.arguments[2]);
    }

    @Test
    void httpBoundaryReturnsCanonicalSuccessAndFailureEnvelopes() throws Exception {
        CountingJdbc jdbc = new CountingJdbc();
        SocialLocalRealController controller = new SocialLocalRealController(jdbc);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new ApiExceptionHandler()).build();
        authenticate(Set.of("admin.moderation.read"));
        mvc.perform(get("/internal/v1/social/admin/moderation/reports")
                        .header("X-Request-Id", "req-test-1")
                        .header("X-Trace-Id", "trace-test-1"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(header().string("X-API-Version", "v1"))
                .andExpect(jsonPath("$.error.errorCode").value("MODERATION_CURSOR_UNAVAILABLE"))
                .andExpect(jsonPath("$.meta.requestId").value("req-test-1"));
        assertEquals(0, jdbc.reads);

        ReflectionTestUtils.setField(controller, "moderationCursorKey", KEY);
        mvc.perform(get("/internal/v1/social/admin/moderation/reports")
                        .header("X-Request-Id", "req-test-2")
                        .param("status", "INVALID"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.errorCode").value("MODERATION_STATUS_INVALID"));
        mvc.perform(get("/internal/v1/social/admin/moderation/reports")
                        .header("X-Request-Id", "req-test-3"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Request-Id", "req-test-3"))
                .andExpect(jsonPath("$.data.items").isArray())
                .andExpect(jsonPath("$.meta.hasMore").value(false));

        jdbc.fail = true;
        mvc.perform(get("/internal/v1/social/admin/moderation/reports")
                        .header("X-Request-Id", "req-test-4"))
                .andExpect(status().isInternalServerError())
                .andExpect(header().string("X-API-Version", "v1"))
                .andExpect(jsonPath("$.error.errorCode").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.meta.requestId").value("req-test-4"));
    }

    private static void authenticate(Set<String> permissions) {
        SecurityContextHolder.getContext().setAuthentication(SocialAuthenticationToken.fromVerifiedPrincipal(
                SocialPrincipal.phaseOne("admin-a", "tenant-a", permissions)));
    }

    private static MockHttpServletRequest request() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/internal/v1/social/admin/moderation/reports");
        request.addHeader("X-Request-Id", "req-test-1");
        request.addHeader("X-Trace-Id", "0123456789abcdef0123456789abcdef");
        return request;
    }

    private static final class CountingJdbc extends JdbcTemplate {
        int reads;
        String sql;
        Object[] arguments;
        List<Long> rows = List.of();
        boolean fail;

        @Override
        public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
            reads++;
            this.sql = sql;
            this.arguments = args;
            if (fail) throw new IllegalStateException("synthetic database failure");
            long after = args.length == 3 ? (Long) args[1] : Long.MAX_VALUE;
            int limit = (Integer) args[args.length - 1];
            List<T> result = new ArrayList<>();
            try {
                for (long id : rows) {
                    if (id >= after || result.size() >= limit) continue;
                    ResultSet rs = mock(ResultSet.class);
                    when(rs.getLong("id")).thenReturn(id);
                    when(rs.getString("report_id")).thenReturn("report-" + id);
                    when(rs.getString("room_id")).thenReturn("room-raw-" + id);
                    when(rs.getString("target_subject_id")).thenReturn("subject-raw-" + id);
                    when(rs.getString("reason_code")).thenReturn("SPAM");
                    when(rs.getString("state")).thenReturn("RECEIVED");
                    when(rs.getString("client_event_id")).thenReturn("client-private-" + id);
                    when(rs.getObject("target_seat_index")).thenReturn(1);
                    Timestamp time = Timestamp.from(Instant.parse("2026-09-23T00:00:00Z"));
                    when(rs.getTimestamp("created_at")).thenReturn(time);
                    when(rs.getTimestamp("updated_at")).thenReturn(time);
                    result.add(rowMapper.mapRow(rs, result.size()));
                }
            } catch (SQLException exception) {
                throw new IllegalStateException(exception);
            }
            return result;
        }
    }
}
