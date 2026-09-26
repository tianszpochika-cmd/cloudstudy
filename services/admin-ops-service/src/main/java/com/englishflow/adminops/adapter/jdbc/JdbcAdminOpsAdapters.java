package com.englishflow.adminops.adapter.jdbc;

import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import com.englishflow.adminops.domain.AdminOpsException;
import com.englishflow.adminops.domain.AdminPep;
import com.englishflow.adminops.domain.AdminPrincipal;
import com.englishflow.adminops.domain.AdminProjectionPort;
import com.englishflow.adminops.domain.AuditEvent;
import com.englishflow.adminops.domain.AuditPage;
import com.englishflow.adminops.domain.AuditRecord;
import com.englishflow.adminops.domain.AuditTrail;
import com.englishflow.adminops.domain.CommandForwardResult;
import com.englishflow.adminops.domain.CommandResult;
import com.englishflow.adminops.domain.DomainCommand;
import com.englishflow.adminops.domain.DomainCommandPort;
import com.englishflow.adminops.domain.IdempotencyLedger;
import com.englishflow.adminops.domain.ProjectionQuery;
import com.englishflow.adminops.domain.ProjectionRecord;
import com.englishflow.adminops.domain.ReferenceRedactor;
import com.englishflow.adminops.domain.ReviewStateRecord;
import com.englishflow.adminops.domain.ReviewStateStore;
import com.englishflow.adminops.support.MediaObjectAuthorizationPort;
import com.englishflow.adminops.support.MediaObjectRef;
import com.englishflow.adminops.support.SupportTicketRecord;
import com.englishflow.adminops.support.SupportTicketResult;
import com.englishflow.adminops.support.SupportTicketStore;
import com.englishflow.adminops.support.TicketCategory;
import com.englishflow.adminops.support.TicketPriority;
import com.englishflow.adminops.support.TicketState;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/** Local-real owner adapters for admin-ops. No adapter writes a foreign service table. */
public final class JdbcAdminOpsAdapters {

    private static final TypeReference<Map<String, Object>> OBJECT_MAP = new TypeReference<>() { };
    private static final TypeReference<List<Map<String, Object>>> MEDIA_LIST = new TypeReference<>() { };

    private JdbcAdminOpsAdapters() {
    }

    public static final class Projection implements AdminProjectionPort {
        private final JdbcTemplate jdbc;
        private final ObjectMapper mapper;
        private final AdminPep pep = new AdminPep();

        public Projection(JdbcTemplate jdbc, ObjectMapper mapper) {
            this.jdbc = jdbc;
            this.mapper = mapper;
        }

        @Override
        public List<ProjectionRecord> query(AdminPrincipal principal, ProjectionQuery query) {
            pep.requireAuthenticated(principal);
            String sql = "SELECT domain_name,resource_ref,projection_version,redacted_payload "
                    + "FROM admin_projection WHERE domain_name=? "
                    + "AND (? IS NULL OR resource_ref=?) "
                    + "AND JSON_UNQUOTE(JSON_EXTRACT(redacted_payload,'$.tenantId'))=? "
                    + "ORDER BY updated_at DESC LIMIT ?";
            return jdbc.query(sql, (rs, rowNum) -> mapProjection(rs, query), query.domain().name(),
                    query.resourceRef(), query.resourceRef(), principal.tenantId(), query.limit());
        }

        private ProjectionRecord mapProjection(ResultSet rs, ProjectionQuery query) throws SQLException {
            Map<String, Object> payload = readMap(rs.getString("redacted_payload"));
            String tenant = text(payload, "tenantId", "");
            String owner = text(payload, "ownerSubjectId", "local-fixture");
            String author = nullableText(payload, "authorSubjectId");
            String version = text(payload, "version", rs.getString("projection_version"));
            String status = text(payload, "status", "AVAILABLE");
            Map<String, String> fields = new LinkedHashMap<>();
            Object rawFields = payload.get("safeFields");
            if (rawFields instanceof Map<?, ?> map) {
                map.forEach((key, value) -> fields.put(String.valueOf(key), String.valueOf(value)));
            }
            return new ProjectionRecord(query.domain(), rs.getString("resource_ref"), tenant, owner, author,
                    version, status, fields);
        }

        private Map<String, Object> readMap(String value) {
            try {
                return mapper.readValue(value, OBJECT_MAP);
            } catch (JacksonException exception) {
                throw new IllegalStateException("admin projection payload is invalid", exception);
            }
        }
    }

    public static class CommandForwarder implements DomainCommandPort {
        private final JdbcTemplate jdbc;
        private final ObjectMapper mapper;

        public CommandForwarder(JdbcTemplate jdbc, ObjectMapper mapper) {
            this.jdbc = jdbc;
            this.mapper = mapper;
        }

        @Override
        @Transactional
        public CommandForwardResult forward(DomainCommand command) {
            Instant acceptedAt = Instant.now();
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("commandId", command.commandId());
            payload.put("domain", command.domain().name());
            payload.put("action", command.action().name());
            payload.put("resourceRef", command.resourceRef());
            payload.put("tenantId", command.tenantId());
            payload.put("actorSubjectId", ReferenceRedactor.subject(command.actorSubjectId()));
            payload.put("traceId", command.traceId());
            payload.put("expectedVersion", command.expectedVersion());
            payload.put("reasonCode", command.reasonCode());
            payload.put("attributes", command.attributes());
            // P1-LIVE-016: occurred_at is NOT NULL without default since the V3
            // standardize migration; the writer predates it (same drift species
            // as the learner/commerce outbox fixes).
            jdbc.update("INSERT INTO admin_ops_outbox_event "
                            + "(event_id,aggregate_id,event_name,schema_version,dedupe_key,payload_json,status,"
                            + "attempt_count,available_at,created_at,occurred_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    command.commandId(), command.resourceRef(), "admin.command." + command.action().name(),
                    "admin.command.v1", command.commandId(), json(payload), "ACCEPTED", 0,
                    Timestamp.from(acceptedAt), Timestamp.from(acceptedAt), Timestamp.from(acceptedAt));
            return new CommandForwardResult(command.commandId(), command.domain().targetService(), "ACCEPTED", acceptedAt);
        }

        private String json(Map<String, Object> payload) {
            try {
                return mapper.writeValueAsString(payload);
            } catch (JacksonException exception) {
                throw new IllegalStateException("admin command serialization failed", exception);
            }
        }
    }

    public static class Audit implements AuditTrail {
        private final JdbcTemplate jdbc;
        private final ObjectMapper mapper;

        public Audit(JdbcTemplate jdbc, ObjectMapper mapper) {
            this.jdbc = jdbc;
            this.mapper = mapper;
        }

        @Override
        @Transactional
        public synchronized AuditRecord append(AuditEvent event) {
            String previousHash = jdbc.query("SELECT record_hash FROM admin_audit_record "
                            + "ORDER BY sequence_id DESC LIMIT 1",
                    (rs, rowNum) -> rs.getString(1)).stream().findFirst().orElse(null);
            AuditRecord record = AuditRecord.create(event, previousHash, "audit_" + java.util.UUID.randomUUID());
            jdbc.update("INSERT INTO admin_audit_record "
                            + "(audit_id,tenant_ref,actor_ref,operation,resource_ref,command_id,trace_id,decision_id,"
                            + "safe_context,occurred_at,previous_hash,record_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                    record.auditId(), record.tenantRef(), record.actorRef(), record.operation(), record.resourceRef(),
                    record.commandId(), record.traceId(), record.decisionId(), json(record.safeContext()),
                    Timestamp.from(record.occurredAt()), record.previousHash(), record.recordHash());
            return record;
        }

        @Override
        public synchronized List<AuditRecord> snapshot() {
            return jdbc.query("SELECT audit_id,tenant_ref,actor_ref,operation,resource_ref,command_id,trace_id,"
                            + "decision_id,safe_context,occurred_at,previous_hash,record_hash "
                            + "FROM admin_audit_record ORDER BY sequence_id",
                    (rs, rowNum) -> new AuditRecord(rs.getString("audit_id"), rs.getString("tenant_ref"),
                            rs.getString("actor_ref"), rs.getString("operation"), rs.getString("resource_ref"),
                            rs.getString("command_id"), rs.getString("trace_id"), rs.getString("decision_id"),
                            stringMap(rs.getString("safe_context")), rs.getTimestamp("occurred_at").toInstant(),
                            rs.getString("previous_hash"), rs.getString("record_hash")));
        }

        @Override
        public AuditPage page(String tenantRef, Long beforeSequence, int pageSize) {
            String sql = "SELECT sequence_id,audit_id,tenant_ref,actor_ref,operation,resource_ref,command_id,trace_id,"
                    + "decision_id,safe_context,occurred_at,previous_hash,record_hash "
                    + "FROM admin_audit_record WHERE tenant_ref = ?"
                    + (beforeSequence == null ? "" : " AND sequence_id < ?")
                    + " ORDER BY sequence_id DESC LIMIT ?";
            Object[] arguments = beforeSequence == null
                    ? new Object[] {tenantRef, pageSize + 1}
                    : new Object[] {tenantRef, beforeSequence, pageSize + 1};
            List<AuditRow> rows = jdbc.query(sql, (rs, rowNum) -> new AuditRow(
                    rs.getLong("sequence_id"),
                    new AuditRecord(rs.getString("audit_id"), rs.getString("tenant_ref"),
                            rs.getString("actor_ref"), rs.getString("operation"), rs.getString("resource_ref"),
                            rs.getString("command_id"), rs.getString("trace_id"), rs.getString("decision_id"),
                            stringMap(rs.getString("safe_context")), rs.getTimestamp("occurred_at").toInstant(),
                            rs.getString("previous_hash"), rs.getString("record_hash"))), arguments);
            boolean hasMore = rows.size() > pageSize;
            List<AuditRow> visible = rows.subList(0, Math.min(pageSize, rows.size()));
            Long nextSequence = hasMore ? visible.getLast().sequence() : null;
            return new AuditPage(visible.stream().map(AuditRow::record).toList(), nextSequence);
        }

        private record AuditRow(long sequence, AuditRecord record) { }

        private String json(Map<String, String> values) {
            try {
                return mapper.writeValueAsString(values);
            } catch (JacksonException exception) {
                throw new IllegalStateException("admin audit serialization failed", exception);
            }
        }

        private Map<String, String> stringMap(String value) {
            Map<String, Object> raw;
            try {
                raw = mapper.readValue(value, OBJECT_MAP);
            } catch (JacksonException exception) {
                throw new IllegalStateException("admin audit payload is invalid", exception);
            }
            Map<String, String> result = new LinkedHashMap<>();
            raw.forEach((key, item) -> result.put(key, String.valueOf(item)));
            return result;
        }
    }

    public static class Idempotency implements IdempotencyLedger {
        private final JdbcTemplate jdbc;
        private final ObjectMapper mapper;

        public Idempotency(JdbcTemplate jdbc, ObjectMapper mapper) {
            this.jdbc = jdbc;
            this.mapper = mapper;
        }

        @Override
        public Optional<Entry> find(String scope, String key) {
            return jdbc.query("SELECT fingerprint,result_type,result_json FROM admin_idempotency "
                            + "WHERE scope_hash=? AND key_hash=?",
                    (rs, rowNum) -> new Stored(rs.getString("fingerprint"), rs.getString("result_type"),
                            rs.getString("result_json")), hash(scope), hash(key)).stream()
                    .findFirst().map(stored -> new Entry(stored.fingerprint(), readResult(stored)));
        }

        @Override
        @Transactional
        public void put(String scope, String key, String fingerprint, Object result) {
            Optional<Entry> prior = find(scope, key);
            if (prior.isPresent()) {
                if (!fingerprint.equals(prior.get().fingerprint())) {
                    throw AdminOpsException.conflict("ADMIN_IDEMPOTENCY_KEY_REUSED",
                            "Idempotency-Key was reused for another operation");
                }
                return;
            }
            String resultType = resultType(result);
            jdbc.update("INSERT INTO admin_idempotency "
                            + "(scope_hash,key_hash,fingerprint,result_type,result_json,created_at) VALUES (?,?,?,?,?,?)",
                    hash(scope), hash(key), fingerprint, resultType, json(result), Timestamp.from(Instant.now()));
        }

        private Object readResult(Stored stored) {
            try {
                return switch (stored.resultType()) {
                    case "COMMAND" -> mapper.readValue(stored.resultJson(), CommandResult.class);
                    case "SUPPORT_TICKET" -> mapper.readValue(stored.resultJson(), SupportTicketResult.class);
                    default -> throw new IllegalStateException("unknown admin idempotency result type");
                };
            } catch (JacksonException exception) {
                throw new IllegalStateException("admin idempotency result is invalid", exception);
            }
        }

        private String resultType(Object result) {
            if (result instanceof CommandResult) {
                return "COMMAND";
            }
            if (result instanceof SupportTicketResult) {
                return "SUPPORT_TICKET";
            }
            throw new IllegalArgumentException("unsupported admin idempotency result type");
        }

        private String json(Object value) {
            try {
                return mapper.writeValueAsString(value);
            } catch (JacksonException exception) {
                throw new IllegalStateException("admin idempotency serialization failed", exception);
            }
        }

        private static String hash(String value) {
            return ReferenceRedactor.sha256(value == null ? "<null>" : value);
        }

        private record Stored(String fingerprint, String resultType, String resultJson) { }
    }

    public static final class MediaAuthorization implements MediaObjectAuthorizationPort {
        private final JdbcTemplate jdbc;
        private final AdminPep pep = new AdminPep();

        public MediaAuthorization(JdbcTemplate jdbc) {
            this.jdbc = jdbc;
        }

        @Override
        public void requireReadable(AdminPrincipal principal, MediaObjectRef mediaObject) {
            pep.requireAuthenticated(principal);
            Integer count = mediaObject == null ? 0 : jdbc.queryForObject("SELECT COUNT(*) FROM admin_media_authorization "
                            + "WHERE tenant_id=? AND subject_id=? AND object_ref=? AND object_version=?",
                    Integer.class, principal.tenantId(), principal.subjectId(), mediaObject.objectRef(),
                    mediaObject.objectVersion());
            if (count == null || count < 1) {
                throw AdminOpsException.forbidden("SUPPORT_ATTACHMENT_FORBIDDEN",
                        "media reference is not readable in the current scope");
            }
        }
    }

    public static class ReviewState implements ReviewStateStore {
        private final JdbcTemplate jdbc;

        public ReviewState(JdbcTemplate jdbc) {
            this.jdbc = jdbc;
        }

        @Override
        public Optional<ReviewStateRecord> find(String tenantId, com.englishflow.adminops.domain.Domain domain,
                String resourceRef, String projectionVersion) {
            return jdbc.query("SELECT tenant_id,domain_name,resource_ref,projection_version,"
                            + "first_reviewer_subject,final_reviewer_subject,updated_at FROM admin_review_state "
                            + "WHERE tenant_id=? AND domain_name=? AND resource_ref=? AND projection_version=?",
                    (rs, rowNum) -> new ReviewStateRecord(rs.getString("tenant_id"),
                            com.englishflow.adminops.domain.Domain.valueOf(rs.getString("domain_name")),
                            rs.getString("resource_ref"), rs.getString("projection_version"),
                            rs.getString("first_reviewer_subject"), rs.getString("final_reviewer_subject"),
                            rs.getTimestamp("updated_at").toInstant()),
                    tenantId, domain.name(), resourceRef, projectionVersion).stream().findFirst();
        }

        @Override
        public void save(ReviewStateRecord state) {
            jdbc.update("INSERT INTO admin_review_state "
                            + "(tenant_id,domain_name,resource_ref,projection_version,first_reviewer_subject,"
                            + "final_reviewer_subject,updated_at) VALUES (?,?,?,?,?,?,?) "
                            + "ON DUPLICATE KEY UPDATE first_reviewer_subject=VALUES(first_reviewer_subject),"
                            + "final_reviewer_subject=VALUES(final_reviewer_subject),updated_at=VALUES(updated_at)",
                    state.tenantId(), state.domain().name(), state.resourceRef(), state.projectionVersion(),
                    state.firstReviewerSubjectId(), state.finalReviewerSubjectId(), Timestamp.from(state.updatedAt()));
        }
    }

    public static class SupportTickets implements SupportTicketStore {
        private final JdbcTemplate jdbc;
        private final ObjectMapper mapper;

        public SupportTickets(JdbcTemplate jdbc, ObjectMapper mapper) {
            this.jdbc = jdbc;
            this.mapper = mapper;
        }

        @Override
        @Transactional
        public void create(SupportTicketRecord ticket) {
            jdbc.update("INSERT INTO support_ticket "
                            + "(ticket_id,tenant_id,requester_subject,ticket_status,priority,redacted_summary,"
                            + "created_at,updated_at,category,resource_ref,description_fingerprint,sla_due_at,"
                            + "assignee_subject,last_audit_id,ticket_version,attachments_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    ticket.ticketId(), ticket.tenantId(), ticket.requesterSubjectId(), ticket.state().name(),
                    ticket.priority().name(), ticket.descriptionFingerprint(), Timestamp.from(ticket.createdAt()),
                    Timestamp.from(ticket.createdAt()), ticket.category().name(), ticket.resourceRef(),
                    ticket.descriptionFingerprint(), Timestamp.from(ticket.slaDueAt()), ticket.assigneeSubjectId(),
                    ticket.lastAuditId(), ticket.version(), json(ticket.attachments()));
        }

        @Override
        public List<SupportTicketRecord> list(String tenantId, boolean includeAll, String requesterSubjectId) {
            String sql = "SELECT ticket_id,tenant_id,requester_subject,ticket_status,priority,category,resource_ref,"
                    + "description_fingerprint,created_at,sla_due_at,assignee_subject,last_audit_id,ticket_version,"
                    + "attachments_json FROM support_ticket WHERE tenant_id=?"
                    + (includeAll ? "" : " AND requester_subject=?") + " ORDER BY created_at DESC";
            return includeAll
                    ? jdbc.query(sql, (rs, rowNum) -> map(rs), tenantId)
                    : jdbc.query(sql, (rs, rowNum) -> map(rs), tenantId, requesterSubjectId);
        }

        @Override
        public Optional<SupportTicketRecord> find(String tenantId, String ticketId) {
            return jdbc.query("SELECT ticket_id,tenant_id,requester_subject,ticket_status,priority,category,resource_ref,"
                            + "description_fingerprint,created_at,sla_due_at,assignee_subject,last_audit_id,ticket_version,"
                            + "attachments_json FROM support_ticket WHERE tenant_id=? AND ticket_id=?",
                    (rs, rowNum) -> map(rs), tenantId, ticketId).stream().findFirst();
        }

        @Override
        @Transactional
        public void update(SupportTicketRecord ticket, long expectedVersion) {
            int updated = jdbc.update("UPDATE support_ticket SET ticket_status=?,priority=?,updated_at=?,category=?,"
                            + "resource_ref=?,description_fingerprint=?,sla_due_at=?,assignee_subject=?,last_audit_id=?,"
                            + "ticket_version=?,attachments_json=? WHERE tenant_id=? AND ticket_id=? AND ticket_version=?",
                    ticket.state().name(), ticket.priority().name(), Timestamp.from(Instant.now()),
                    ticket.category().name(), ticket.resourceRef(), ticket.descriptionFingerprint(),
                    Timestamp.from(ticket.slaDueAt()), ticket.assigneeSubjectId(), ticket.lastAuditId(), ticket.version(),
                    json(ticket.attachments()), ticket.tenantId(), ticket.ticketId(), expectedVersion);
            if (updated != 1) {
                throw AdminOpsException.conflict("SUPPORT_VERSION_CONFLICT", "ticket changed; reload before retrying");
            }
        }

        private SupportTicketRecord map(ResultSet rs) throws SQLException {
            return new SupportTicketRecord(rs.getString("ticket_id"), rs.getString("tenant_id"),
                    rs.getString("requester_subject"), legacySafeCategory(rs.getString("category")),
                    rs.getString("resource_ref"), rs.getString("description_fingerprint"),
                    TicketPriority.valueOf(rs.getString("priority")), media(rs.getString("attachments_json")),
                    rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("sla_due_at").toInstant(),
                    TicketState.valueOf(rs.getString("ticket_status")), rs.getString("assignee_subject"),
                    rs.getString("last_audit_id"), rs.getLong("ticket_version"));
        }

        static TicketCategory legacySafeCategory(String value) {
            try {
                return TicketCategory.valueOf(value);
            } catch (IllegalArgumentException | NullPointerException invalidLegacyCategory) {
                return TicketCategory.LEGACY_UNMAPPED;
            }
        }

        private List<MediaObjectRef> media(String value) {
            try {
                List<Map<String, Object>> rows = mapper.readValue(value, MEDIA_LIST);
                return rows.stream().map(row -> new MediaObjectRef(
                        String.valueOf(row.get("objectRef")), String.valueOf(row.get("objectVersion")),
                        String.valueOf(row.get("purposeCode")), String.valueOf(row.get("contentType")),
                        ((Number) row.get("sizeBytes")).longValue())).toList();
            } catch (RuntimeException exception) {
                throw new IllegalStateException("support attachment metadata is invalid", exception);
            }
        }

        private String json(Object value) {
            try {
                return mapper.writeValueAsString(value);
            } catch (JacksonException exception) {
                throw new IllegalStateException("support ticket metadata serialization failed", exception);
            }
        }
    }

    private static String text(Map<String, Object> map, String key, String fallback) {
        Object value = map.get(key);
        return value == null || String.valueOf(value).isBlank() ? fallback : String.valueOf(value);
    }

    private static String nullableText(Map<String, Object> map, String key) {
        Object value = map.get(key);
        return value == null || String.valueOf(value).isBlank() ? null : String.valueOf(value);
    }
}
