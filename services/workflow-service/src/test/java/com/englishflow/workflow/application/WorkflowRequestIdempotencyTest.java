package com.englishflow.workflow.application;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import com.englishflow.workflow.adapter.jdbc.WorkflowTables;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class WorkflowRequestIdempotencyTest {

    @Test
    void sameActorKeyAndCanonicalRequestReplayOriginalResponse() throws Exception {
        FakeJdbc jdbc = new FakeJdbc();
        WorkflowRequestIdempotency idempotency = new WorkflowRequestIdempotency(jdbc, new ObjectMapper());
        AtomicInteger actions = new AtomicInteger();
        Map<String, Object> firstBody = new LinkedHashMap<>();
        firstBody.put("recoveryId", "recovery-1");
        firstBody.put("reason", "reviewed");
        Map<String, Object> reversedBody = new LinkedHashMap<>();
        reversedBody.put("reason", "reviewed");
        reversedBody.put("recoveryId", "recovery-1");

        Map<String, Object> first = idempotency.execute("platform", "admin-a", "MANUAL_RECOVERY_REJECT",
                "recovery-key-1", firstBody, () -> {
                    actions.incrementAndGet();
                    return Map.of("recoveryId", "recovery-1", "status", "REJECTED");
                });
        Map<String, Object> replay = idempotency.execute("platform", "admin-a", "MANUAL_RECOVERY_REJECT",
                "recovery-key-1", reversedBody, () -> {
                    actions.incrementAndGet();
                    return Map.of("recoveryId", "different", "status", "REJECTED");
                });

        assertEquals(first, replay);
        assertEquals(1, actions.get());
        assertNotNull(WorkflowRequestIdempotency.class
                .getMethod("execute", String.class, String.class, String.class, String.class,
                        Object.class, java.util.function.Supplier.class)
                .getAnnotation(Transactional.class));
    }

    @Test
    void differentBodyWithSameKeyConflictsWithoutRunningAction() {
        FakeJdbc jdbc = new FakeJdbc();
        WorkflowRequestIdempotency idempotency = new WorkflowRequestIdempotency(jdbc, new ObjectMapper());
        AtomicInteger actions = new AtomicInteger();
        idempotency.execute("platform", "admin-a", "MANUAL_RECOVERY_APPROVE", "recovery-key-2",
                Map.of("recoveryId", "recovery-1"), () -> {
                    actions.incrementAndGet();
                    return Map.of("recoveryId", "recovery-1", "status", "APPROVED");
                });

        ResponseStatusException conflict = assertThrows(ResponseStatusException.class,
                () -> idempotency.execute("platform", "admin-a", "MANUAL_RECOVERY_APPROVE",
                        "recovery-key-2", Map.of("recoveryId", "recovery-2"), () -> {
                            actions.incrementAndGet();
                            return Map.of("recoveryId", "recovery-2", "status", "APPROVED");
                        }));
        assertEquals(HttpStatus.CONFLICT, conflict.getStatusCode());
        assertEquals(1, actions.get());
    }

    @Test
    void invalidKeyAndTenantAreRejectedBeforeAnyWrite() {
        FakeJdbc jdbc = new FakeJdbc();
        WorkflowRequestIdempotency idempotency = new WorkflowRequestIdempotency(jdbc, new ObjectMapper());
        ResponseStatusException keyFailure = assertThrows(ResponseStatusException.class,
                () -> idempotency.execute("platform", "admin-a", "MANUAL_RECOVERY_REQUEST", "short",
                        Map.of("subjectId", "s-1"), () -> Map.of("recoveryId", "x")));
        ResponseStatusException tenantFailure = assertThrows(ResponseStatusException.class,
                () -> idempotency.execute("foreign", "admin-a", "MANUAL_RECOVERY_REQUEST", "recovery-key-3",
                        Map.of("subjectId", "s-1"), () -> Map.of("recoveryId", "x")));
        assertEquals(HttpStatus.BAD_REQUEST, keyFailure.getStatusCode());
        assertEquals(HttpStatus.FORBIDDEN, tenantFailure.getStatusCode());
        assertEquals(0, jdbc.writes);
    }

    @Test
    void sagaCompensationReplaysStoredResultAndLocksOnlyForFirstExecution() throws Exception {
        FakeJdbc jdbc = new FakeJdbc();
        WorkflowRequestIdempotency idempotency = new WorkflowRequestIdempotency(jdbc, new ObjectMapper());
        AtomicInteger actions = new AtomicInteger();
        Map<String, Object> first = idempotency.executeSagaCompensation("platform", "admin-a",
                "saga-key-123", "saga-1", Map.of(), () -> {
                    actions.incrementAndGet();
                    return Map.of("sagaId", "saga-1", "status", "COMPENSATION_FAILED");
                });
        Map<String, Object> replay = idempotency.executeSagaCompensation("platform", "admin-a",
                "saga-key-123", "saga-1", Map.of(), () -> {
                    actions.incrementAndGet();
                    return Map.of("sagaId", "saga-1", "status", "COMPENSATED");
                });
        assertEquals(first, replay);
        assertEquals(1, actions.get());
        assertEquals(1, jdbc.sagaLocks);
        assertNotNull(WorkflowRequestIdempotency.class
                .getMethod("executeSagaCompensation", String.class, String.class, String.class,
                        String.class, Map.class, java.util.function.Supplier.class)
                .getAnnotation(Transactional.class));
    }

    @Test
    void sagaCompensationSameKeyDifferentSagaOrBodyConflicts() {
        FakeJdbc jdbc = new FakeJdbc();
        WorkflowRequestIdempotency idempotency = new WorkflowRequestIdempotency(jdbc, new ObjectMapper());
        idempotency.executeSagaCompensation("platform", "admin-a", "saga-key-124", "saga-1", Map.of(),
                () -> Map.of("sagaId", "saga-1", "status", "COMPENSATION_FAILED"));
        ResponseStatusException differentSaga = assertThrows(ResponseStatusException.class,
                () -> idempotency.executeSagaCompensation("platform", "admin-a", "saga-key-124", "saga-2",
                        Map.of(), () -> Map.of("sagaId", "saga-2")));
        ResponseStatusException differentBody = assertThrows(ResponseStatusException.class,
                () -> idempotency.executeSagaCompensation("platform", "admin-a", "saga-key-124", "saga-1",
                        Map.of("unexpected", true), () -> Map.of("sagaId", "saga-1")));
        assertEquals(HttpStatus.CONFLICT, differentSaga.getStatusCode());
        assertEquals(HttpStatus.CONFLICT, differentBody.getStatusCode());
        assertEquals(1, jdbc.sagaLocks);
    }

    private static final class FakeJdbc extends JdbcTemplate {
        private final Map<String, Map<String, Object>> records = new HashMap<>();
        private int writes;
        private int sagaLocks;

        @Override
        public int update(String sql, Object... args) {
            writes++;
            if (sql.contains("INSERT IGNORE INTO workflow_request_idempotency")) {
                String key = args[0] + "|" + args[1] + "|" + args[2] + "|" + args[3];
                if (records.containsKey(key)) return 0;
                records.put(key, Map.of("request_digest", args[4], "response_json", args[5]));
                return 1;
            }
            if (sql.contains("UPDATE workflow_request_idempotency SET response_json")) {
                String key = args[1] + "|" + args[2] + "|" + args[3] + "|" + args[4];
                Map<String, Object> record = records.get(key);
                if (record == null) return 0;
                records.put(key, Map.of("request_digest", record.get("request_digest"), "response_json", args[0]));
                return 1;
            }
            throw new AssertionError("unexpected update: " + sql);
        }

        @Override
        public List<Map<String, Object>> queryForList(String sql, Object... args) {
            if (sql.contains("FROM " + WorkflowTables.schema() + ".saga_instance") && sql.contains("FOR UPDATE")) {
                sagaLocks++;
                return List.of(Map.of("saga_id", args[0]));
            }
            if (!sql.contains("FROM workflow_request_idempotency")) throw new AssertionError(sql);
            Map<String, Object> record = records.get(args[0] + "|" + args[1] + "|" + args[2] + "|" + args[3]);
            return record == null ? List.of() : List.of(record);
        }
    }
}
