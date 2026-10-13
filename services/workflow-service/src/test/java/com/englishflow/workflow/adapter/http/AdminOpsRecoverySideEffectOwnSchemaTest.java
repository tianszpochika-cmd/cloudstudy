package com.englishflow.workflow.adapter.http;

import com.englishflow.workflow.application.RecoverySideEffectPort;
import com.englishflow.workflow.domain.ManualRecoveryRequest;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * P1-2: workflow-service never writes another service's tables.
 *
 * <p>The TICKET/REOPEN effect is an HTTP call to admin-ops; the only SQL this
 * class may emit targets workflow's own {@code recovery_side_effect_log}.
 * These tests capture every statement and fail if any of them names a
 * ticket table or another service's schema.
 */
class AdminOpsRecoverySideEffectOwnSchemaTest {

    private record LoggedCall(JdbcTemplate jdbc, List<String> statements) {
    }

    private static LoggedCall loggingFixture() {
        List<String> statements = new ArrayList<>();
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), any(Object[].class))).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            statements.add(sql);
            return 1;
        });
        return new LoggedCall(jdbc, statements);
    }

    private static AdminOpsRecoverySideEffect effect(JdbcTemplate jdbc, int status, String body) {
        return new AdminOpsRecoverySideEffect(
                (uri, bearer, key) -> new AdminOpsRecoverySideEffect.Response(status, body),
                "http://admin-ops:18097", jdbc);
    }

    private static void assertOwnSchemaOnly(List<String> statements) {
        assertTrue(!statements.isEmpty(), "the effect must log its outcome to the local table");
        for (String sql : statements) {
            String lower = sql.toLowerCase(Locale.ROOT);
            assertTrue(lower.contains("recovery_side_effect_log"), "unexpected log target: " + sql);
            assertTrue(!lower.contains("support_ticket"), "cross-schema write: " + sql);
            assertTrue(!lower.contains("adminops") && !lower.contains("admin_ops")
                    && !lower.contains("admin-ops"), "cross-service write: " + sql);
        }
    }

    @Test
    void appliedEffectLogsOnlyToOwnTable() {
        LoggedCall logged = loggingFixture();
        effect(logged.jdbc(), 200, "{\"data\":{\"state\":\"IN_PROGRESS\"}}")
                .apply("rec-1", "TICKET", "t-1", "REOPEN", "ops-3", "jwt");
        assertOwnSchemaOnly(logged.statements());
        verify(logged.jdbc(), atLeastOnce()).update(anyString(), any(Object[].class));
    }

    @Test
    void uncertainAndRefusedEffectsLogOnlyToOwnTable() {
        LoggedCall logged = loggingFixture();
        AdminOpsRecoverySideEffect uncertain = effect(logged.jdbc(), 503, "");
        assertThrows(RecoverySideEffectPort.SideEffectUncertain.class,
                () -> uncertain.apply("rec-2", "TICKET", "t-2", "REOPEN", "ops-3", "jwt"));
        AdminOpsRecoverySideEffect refused = effect(logged.jdbc(), 409, "{\"code\":\"X\"}");
        assertThrows(ManualRecoveryRequest.RecoveryNotAllowed.class,
                () -> refused.apply("rec-3", "TICKET", "t-3", "REOPEN", "ops-3", "jwt"));
        assertOwnSchemaOnly(logged.statements());
    }
}
