package com.englishflow.workflow.adapter.http;

import com.englishflow.workflow.application.RecoverySideEffectPort;
import com.englishflow.workflow.domain.ManualRecoveryRequest;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdminOpsRecoverySideEffectTest {

    private final List<String> calls = new ArrayList<>();

    private AdminOpsRecoverySideEffect with(AdminOpsRecoverySideEffect.Transport transport) {
        return new AdminOpsRecoverySideEffect(transport, "http://admin-ops:18097/", null);
    }

    private AdminOpsRecoverySideEffect.Transport respond(int status, String body) {
        return (uri, bearer, key) -> {
            calls.add(uri + "|" + bearer + "|" + key);
            return new AdminOpsRecoverySideEffect.Response(status, body);
        };
    }

    @Test
    void callsOwnerApiWithRecoveryIdAsIdempotencyKeyAndExecutorToken() {
        String detail = with(respond(200, "{\"data\":{\"state\":\"IN_PROGRESS\",\"replayed\":false}}"))
                .apply("rec-1", "ticket", "tk 1", "reopen", "ops-3", "jwt-x");
        assertEquals(List.of("http://admin-ops:18097/internal/v1/admin-ops/tickets/tk%201/recovery-reopen|jwt-x|recovery-rec-1"), calls);
        assertTrue(detail.contains("IN_PROGRESS"));
    }

    @Test
    void replayedSuccessIsStillSuccess() {
        String detail = with(respond(200, "{\"data\":{\"replayed\":true}}"))
                .apply("rec-1", "TICKET", "t", "REOPEN", "ops-3", "jwt");
        assertTrue(detail.contains("replayed"));
    }

    @Test
    void ownerRefusalIsDefinitive() {
        ManualRecoveryRequest.RecoveryNotAllowed refusal = assertThrows(ManualRecoveryRequest.RecoveryNotAllowed.class,
                () -> with(respond(409, "{\"error\":{\"code\":\"SUPPORT_INVALID_TRANSITION\"}}"))
                        .apply("r", "TICKET", "t", "REOPEN", "e", "jwt"));
        assertTrue(refusal.getMessage().contains("SUPPORT_INVALID_TRANSITION"));
        assertThrows(ManualRecoveryRequest.RecoveryNotAllowed.class,
                () -> with(respond(403, "{\"code\":\"ADMIN_PERMISSION_DENIED\"}")).apply("r", "TICKET", "t", "REOPEN", "e", "jwt"));
    }

    @Test
    void serverErrorsAndTransportFailuresAreUncertain() {
        assertThrows(RecoverySideEffectPort.SideEffectUncertain.class,
                () -> with(respond(503, "")).apply("r", "TICKET", "t", "REOPEN", "e", "jwt"));
        assertThrows(RecoverySideEffectPort.SideEffectUncertain.class,
                () -> with(respond(429, "{\"code\":\"RATE_LIMITED\"}")).apply("r", "TICKET", "t", "REOPEN", "e", "jwt"));
        assertThrows(RecoverySideEffectPort.SideEffectUncertain.class,
                () -> with((uri, b, k) -> { throw new IOException("reset"); }).apply("r", "TICKET", "t", "REOPEN", "e", "jwt"));
        assertThrows(RecoverySideEffectPort.SideEffectUncertain.class,
                () -> with((uri, b, k) -> { throw new InterruptedException("cancelled"); })
                        .apply("r", "TICKET", "t", "REOPEN", "e", "jwt"));
        assertTrue(Thread.currentThread().isInterrupted(), "interruption must stay visible to the caller");
        Thread.interrupted();
        assertThrows(RecoverySideEffectPort.SideEffectUncertain.class,
                () -> with(respond(200, "")).apply("r", "TICKET", "t", "REOPEN", "e", null));
    }

    @Test
    void unknownActionsFailClosedWithoutCallingAnyone() {
        assertThrows(ManualRecoveryRequest.RecoveryNotAllowed.class,
                () -> with(respond(200, "")).apply("r", "SAGA", "s", "RETRY", "e", "jwt"));
        assertTrue(calls.isEmpty());
    }
}
