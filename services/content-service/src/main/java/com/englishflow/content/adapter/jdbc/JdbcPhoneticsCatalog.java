package com.englishflow.content.adapter.jdbc;

import com.englishflow.content.domain.ContentItem;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Content-ops capability 6: admin read of the phonetics catalog
 * ({@code b3_content_experience}, every availability) and the learner projection
 * of reviewed PHONEME / MINIMAL_PAIR items.
 *
 * <p>A published item is projected only when the phonetics pack itself has a
 * canonical published content version: the learner read path
 * ({@code B3ContentJdbcController.ELIGIBLE_CONTENT}) joins on that version, so
 * projecting against a placeholder version would either be invisible or bypass
 * rights provenance. Without one the projection reports {@code PACK_NOT_PUBLISHED}.
 */
public class JdbcPhoneticsCatalog {

    private static final String TENANT = "platform";
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public JdbcPhoneticsCatalog(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public List<Map<String, Object>> catalog(String domain, String resourceType, int limit) {
        int bounded = Math.max(1, Math.min(limit, 200));
        return jdbc.queryForList("""
                SELECT b.experience_id, b.resource_type, b.resource_key, b.availability,
                       b.content_version_id, b.payload_json, b.updated_at,
                       CASE WHEN c.current_published_version_id = b.content_version_id
                            THEN 1 ELSE 0 END AS canonical_version
                  FROM b3_content_experience b
                  LEFT JOIN content_version v ON v.content_version_id = b.content_version_id
                  LEFT JOIN content_definition c ON c.content_id = v.content_id AND c.tenant_id = b.tenant_id
                 WHERE b.tenant_id = ? AND b.domain_code = ? AND b.resource_type = ?
                 ORDER BY b.resource_key
                 LIMIT ?
                """, TENANT, domain, resourceType, bounded).stream().map(this::row).toList();
    }

    /** @return PROJECTED, WITHDRAWN, PACK_NOT_PUBLISHED or NOT_PHONETIC */
    public String project(ContentItem item, boolean live) {
        if (!ContentItem.PHONETIC_KINDS.contains(item.kind()) || !ContentItem.isPhoneticsPack(item.packCode())) {
            return "NOT_PHONETIC";
        }
        String experienceId = experienceId(item);
        if (!live) {
            jdbc.update("UPDATE b3_content_experience SET availability = 'UNPUBLISHED' "
                    + "WHERE tenant_id = ? AND experience_id = ?", TENANT, experienceId);
            return "WITHDRAWN";
        }
        List<Long> version = jdbc.queryForList("SELECT current_published_version_id FROM content_definition "
                + "WHERE tenant_id = ? AND content_code = ? AND current_published_version_id IS NOT NULL",
                Long.class, TENANT, item.packCode());
        if (version.isEmpty()) {
            return "PACK_NOT_PUBLISHED";
        }
        Map<String, Object> payload = new LinkedHashMap<>(item.fields());
        payload.put("PHONEME".equals(item.kind()) ? "phonemeId" : "pairId", item.itemId());
        payload.put("itemId", item.itemId());
        payload.put("contentVersionId", version.getFirst());
        String json = mapper.writeValueAsString(payload);
        int updated = jdbc.update("UPDATE b3_content_experience SET availability = 'PUBLISHED', "
                + "content_version_id = ?, payload_json = ? WHERE tenant_id = ? AND experience_id = ?",
                version.getFirst(), json, TENANT, experienceId);
        if (updated == 0) {
            jdbc.update("INSERT INTO b3_content_experience (experience_id, tenant_id, domain_code, resource_type, "
                    + "resource_key, content_version_id, availability, payload_json) VALUES (?, ?, ?, ?, ?, ?, 'PUBLISHED', ?)",
                    experienceId, TENANT, item.packCode(), item.kind(), item.itemId(), version.getFirst(), json);
        }
        return "PROJECTED";
    }

    static String experienceId(ContentItem item) {
        String id = "b3-phonetics-item-" + item.itemId();
        return id.length() > 96 ? id.substring(0, 96) : id;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> row(Map<String, Object> raw) {
        Map<String, Object> out = new LinkedHashMap<>();
        Object json = raw.get("payload_json");
        try {
            out.putAll(mapper.readValue(String.valueOf(json), Map.class));
        } catch (RuntimeException error) {
            out.put("payloadError", "unreadable payload");
        }
        out.put("experienceId", raw.get("experience_id"));
        out.put("resourceType", raw.get("resource_type"));
        out.put("resourceKey", raw.get("resource_key"));
        out.put("availability", raw.get("availability"));
        out.put("contentVersionId", raw.get("content_version_id"));
        out.put("canonicalVersion", ((Number) raw.get("canonical_version")).intValue() == 1);
        out.put("learnerVisible", "PUBLISHED".equals(raw.get("availability"))
                && ((Number) raw.get("canonical_version")).intValue() == 1);
        out.put("maintainedItem", String.valueOf(raw.get("experience_id")).startsWith("b3-phonetics-item-"));
        out.put("updatedAt", raw.get("updated_at"));
        return out;
    }
}
