package com.englishflow.content.adapter.jdbc;

import com.englishflow.content.domain.ContentItem;
import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.ReviewTrail;
import com.englishflow.content.domain.ItemAvailability;
import com.englishflow.content.port.ContentItemRepository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;

import tools.jackson.databind.ObjectMapper;

/** Content-service-owned MySQL item store. It never reads or writes another service schema. */
public final class JdbcContentItemRepository implements ContentItemRepository {

    private static final String COLUMNS = """
            item_id, tenant_id, pack_code, kind, stem, availability, state_version,
            created_by, updated_by, first_reviewer, final_reviewer, publisher,
            source_code, license_code, fields_json, created_at, updated_at,
            submitted_by, last_review_decision, last_review_note, last_reviewer, last_reviewed_at,
            revision_of_live
            """;

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public JdbcContentItemRepository(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Override
    public Optional<ContentItem> findById(String itemId) {
        List<ContentItem> rows = jdbc.query(
                "SELECT " + COLUMNS + " FROM content_item WHERE item_id = ?",
                (resultSet, row) -> mapItem(resultSet), itemId);
        return rows.stream().findFirst();
    }

    @Override
    public List<ContentItem> search(String packCode, String kind, String query, ItemAvailability availability,
            int limit, String afterItemId) {
        StringBuilder sql = new StringBuilder("SELECT ").append(COLUMNS)
                .append(" FROM content_item WHERE tenant_id = 'platform' AND pack_code = ?");
        List<Object> args = new ArrayList<>();
        args.add(packCode);
        if (kind != null && !kind.isBlank()) {
            sql.append(" AND kind = ?");
            args.add(kind.trim().toUpperCase());
        }
        if (query != null && !query.isBlank()) {
            sql.append(" AND stem LIKE ? ESCAPE '\\\\'");
            args.add("%" + escapeLike(query.trim()) + "%");
        }
        if (availability != null) {
            sql.append(" AND availability = ?");
            args.add(availability.name());
        }
        if (afterItemId != null && !afterItemId.isBlank()) {
            sql.append(" AND item_id > ?");
            args.add(afterItemId);
        }
        sql.append(" ORDER BY item_id LIMIT ?");
        args.add(Math.max(1, Math.min(limit, 100)));
        return jdbc.query(sql.toString(), (resultSet, row) -> mapItem(resultSet), args.toArray());
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    @Override
    public void save(ContentItem item) {
        String fieldsJson = JdbcContentJson.write(mapper, item.fields(), "item fields cannot be serialized");
        jdbc.update("""
                INSERT INTO content_item
                    (item_id, tenant_id, pack_code, kind, stem, availability, state_version,
                     created_by, updated_by, first_reviewer, final_reviewer, publisher,
                     source_code, license_code, fields_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id), pack_code = VALUES(pack_code),
                    kind = VALUES(kind), stem = VALUES(stem), availability = VALUES(availability),
                    state_version = VALUES(state_version), created_by = VALUES(created_by),
                    updated_by = VALUES(updated_by), first_reviewer = VALUES(first_reviewer),
                    final_reviewer = VALUES(final_reviewer), publisher = VALUES(publisher),
                    source_code = VALUES(source_code), license_code = VALUES(license_code),
                    fields_json = VALUES(fields_json), created_at = VALUES(created_at),
                    updated_at = VALUES(updated_at)
                """,
                item.itemId(), item.tenantId(), item.packCode(), item.kind(), item.stem(),
                item.availability().name(), item.stateVersion(), item.createdBy(), item.updatedBy(),
                item.firstReviewer(), item.finalReviewer(), item.publisher(),
                item.sourceCode(), item.licenseCode(), fieldsJson,
                JdbcContentJson.timestamp(item.createdAt()), JdbcContentJson.timestamp(item.updatedAt()));
        saveTrail(item);
    }

    private void saveTrail(ContentItem item) {
        ReviewTrail trail = item.trail();
        jdbc.update("""
                UPDATE content_item SET submitted_by = ?, last_review_decision = ?, last_review_note = ?,
                    last_reviewer = ?, last_reviewed_at = ?, revision_of_live = ?
                WHERE item_id = ?
                """,
                trail.submittedBy(), trail.lastDecision(), trail.lastNote(), trail.lastReviewer(),
                JdbcContentJson.timestamp(trail.lastReviewedAt()), trail.revisionOfLive() ? 1 : 0,
                item.itemId());
    }

    static ReviewTrail readTrail(ResultSet resultSet) throws SQLException {
        return new ReviewTrail(
                resultSet.getString("submitted_by"), resultSet.getString("last_review_decision"),
                resultSet.getString("last_review_note"), resultSet.getString("last_reviewer"),
                JdbcContentJson.instant(resultSet, "last_reviewed_at"), resultSet.getInt("revision_of_live") == 1);
    }

    private ContentItem mapItem(ResultSet resultSet) throws SQLException {
        return new ContentItem(
                resultSet.getString("item_id"), resultSet.getString("tenant_id"),
                resultSet.getString("pack_code"), resultSet.getString("kind"),
                resultSet.getString("stem"), ItemAvailability.parse(resultSet.getString("availability")),
                resultSet.getLong("state_version"), resultSet.getString("created_by"),
                resultSet.getString("updated_by"), resultSet.getString("first_reviewer"),
                resultSet.getString("final_reviewer"), resultSet.getString("publisher"),
                resultSet.getString("source_code"), resultSet.getString("license_code"),
                readFields(resultSet.getString("fields_json")),
                JdbcContentJson.instant(resultSet, "created_at"), JdbcContentJson.instant(resultSet, "updated_at"))
                .restoreTrail(JdbcLexemeRepository.readTrail(resultSet));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> readFields(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            Object value = mapper.readValue(json, Map.class);
            if (value instanceof Map<?, ?> map) {
                Map<String, Object> result = new LinkedHashMap<>();
                for (Map.Entry<?, ?> entry : map.entrySet()) {
                    result.put(String.valueOf(entry.getKey()), entry.getValue());
                }
                return result;
            }
            throw new IllegalArgumentException("item fields JSON is not an object");
        } catch (Exception exception) {
            throw ContentOperationException.unavailable("ITEM_FACT_CORRUPT", "stored item fields cannot be read");
        }
    }
}
