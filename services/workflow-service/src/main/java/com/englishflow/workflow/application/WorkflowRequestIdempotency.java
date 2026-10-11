package com.englishflow.workflow.application;

import com.englishflow.workflow.adapter.jdbc.WorkflowTables;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Supplier;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/** Durable replay boundary for local manual recovery transitions. */
@Component
public class WorkflowRequestIdempotency {

    private static final Pattern SAFE_KEY = Pattern.compile("^[A-Za-z0-9._:-]{8,128}$");

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public WorkflowRequestIdempotency(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Transactional
    public Map<String, Object> execute(String tenantId, String actorSubject, String operation,
                                       String key, Object request, Supplier<Map<String, Object>> action) {
        return executeInternal(tenantId, actorSubject, operation, key, request, "recoveryId", action);
    }

    /** Serializes all compensation requests for one saga, including different keys. */
    @Transactional
    public Map<String, Object> executeSagaCompensation(String tenantId, String actorSubject,
                                                        String key, String sagaId, Map<String, Object> body,
                                                        Supplier<Map<String, Object>> action) {
        return executeInternal(tenantId, actorSubject, "SAGA_COMPENSATE", key,
                Map.of("sagaId", sagaId, "body", body), "sagaId", () -> {
                    List<Map<String, Object>> saga = jdbc.queryForList(WorkflowTables.sql("""
                            SELECT saga_id FROM workflow_service.saga_instance
                             WHERE saga_id = ? FOR UPDATE
                            """), sagaId);
                    if (saga.isEmpty()) {
                        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "saga was not found");
                    }
                    return action.get();
                });
    }

    private Map<String, Object> executeInternal(String tenantId, String actorSubject, String operation,
                                                String key, Object request, String replayIdentifier,
                                                Supplier<Map<String, Object>> action) {
        if (!"platform".equals(tenantId) || actorSubject == null || actorSubject.isBlank()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "recovery identity is not allowed");
        }
        if (key == null || !SAFE_KEY.matcher(key).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Idempotency-Key is required");
        }
        String digest = sha256(operation + "|" + json(canonical(request)));
        int inserted = jdbc.update("""
                INSERT IGNORE INTO workflow_request_idempotency
                    (tenant_id, actor_subject, operation, idempotency_key, request_digest, response_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(6))
                """, tenantId, actorSubject, operation, key, digest, json(Map.of("status", "IN_PROGRESS")));
        if (inserted == 0) {
            List<Map<String, Object>> rows = jdbc.queryForList("""
                    SELECT request_digest, response_json FROM workflow_request_idempotency
                     WHERE tenant_id = ? AND actor_subject = ? AND operation = ? AND idempotency_key = ?
                    """, tenantId, actorSubject, operation, key);
            if (rows.isEmpty() || !digest.equals(String.valueOf(rows.getFirst().get("request_digest")))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Idempotency-Key was reused with a different recovery request");
            }
            Object raw = rows.getFirst().get("response_json");
            Object saved = parse(raw instanceof byte[] bytes ? new String(bytes, StandardCharsets.UTF_8) : raw);
            if (!(saved instanceof Map<?, ?> response) || !response.containsKey(replayIdentifier)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "recovery request is still being processed");
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> replay = (Map<String, Object>) response;
            return replay;
        }
        Map<String, Object> response = action.get();
        int updated = jdbc.update("""
                UPDATE workflow_request_idempotency SET response_json = ?
                 WHERE tenant_id = ? AND actor_subject = ? AND operation = ? AND idempotency_key = ?
                """, json(response), tenantId, actorSubject, operation, key);
        if (updated != 1) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "recovery response snapshot was not saved");
        }
        return response;
    }

    private Object canonical(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> sorted = new TreeMap<>();
            map.forEach((key, child) -> sorted.put(String.valueOf(key), canonical(child)));
            return sorted;
        }
        if (value instanceof List<?> list) return list.stream().map(this::canonical).toList();
        return value;
    }

    private String json(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (JacksonException failure) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "recovery request cannot be serialized", failure);
        }
    }

    private Object parse(Object raw) {
        try {
            return mapper.readValue(String.valueOf(raw), Object.class);
        } catch (JacksonException failure) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "stored recovery response is invalid", failure);
        }
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException failure) {
            throw new IllegalStateException(failure);
        }
    }
}
