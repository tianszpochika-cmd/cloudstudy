package com.englishflow.content.web;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.ObjectMapper;

/**
 * B3 learner content projection. The projection is deliberately read-only: content-service owns
 * the published learning material, while attempts and progress are written by learning-service.
 */
@RestController
@RequestMapping("/internal/v1/content/learner")
@ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "jdbc")
public final class B3ContentJdbcController {

    private static final String TENANT = "platform";
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_CURSOR_LENGTH = 512;
    private static final Base64.Encoder CURSOR_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder CURSOR_DECODER = Base64.getUrlDecoder();
    private static final List<String> CEFR_LEVELS = List.of("A1", "A2", "B1", "B2", "C1", "C2");
    /**
     * The legacy B3 table has no content_id or payload digest tying a row to the canonical
     * content_version payload. Its PUBLISHED flag and numeric version_id, including the seeded 301,
     * cannot establish that provenance. Keep every legacy row unavailable until an owner-owned,
     * versioned binding is designed, migrated, populated and verified at read time. The remaining
     * predicates describe necessary publication and rights facts; they are not sufficient alone.
     */
    private static final String ELIGIBLE_CONTENT = """
            FROM b3_content_experience b
            JOIN content_version v ON v.content_version_id = b.content_version_id
            JOIN content_definition c ON c.content_id = v.content_id
             AND c.tenant_id = b.tenant_id
             AND c.current_published_version_id = v.content_version_id
            WHERE b.tenant_id = ? AND b.availability = 'PUBLISHED'
              AND 1 = 0
              AND v.status = 'PUBLISHED' AND v.published_at IS NOT NULL
              AND v.copyright_status = 'ACTIVE' AND v.rights_allows_learning = TRUE
              AND NULLIF(TRIM(v.rights_source_code), '') IS NOT NULL
              AND NULLIF(TRIM(v.rights_license_code), '') IS NOT NULL
              AND NULLIF(TRIM(v.authorization_evidence_ref), '') IS NOT NULL
              AND NULLIF(TRIM(v.editor), '') IS NOT NULL
              AND NULLIF(TRIM(v.first_reviewer), '') IS NOT NULL
              AND NULLIF(TRIM(v.final_reviewer), '') IS NOT NULL
              AND NULLIF(TRIM(v.publisher), '') IS NOT NULL
              AND v.editor <> v.first_reviewer AND v.editor <> v.final_reviewer
              AND v.editor <> v.publisher AND v.first_reviewer <> v.final_reviewer
              AND v.first_reviewer <> v.publisher AND v.final_reviewer <> v.publisher
              AND (v.rights_starts_at IS NULL OR v.rights_starts_at <= CURRENT_TIMESTAMP(6))
              AND (v.rights_expires_at IS NULL OR v.rights_expires_at > CURRENT_TIMESTAMP(6))
              AND v.rights_permitted_channels IS NOT NULL
              AND (JSON_CONTAINS(v.rights_permitted_channels, '"LEARNER"')
                   OR JSON_CONTAINS(v.rights_permitted_channels, '"*"'))
            """;

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public B3ContentJdbcController(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/grammar/points")
    public Map<String, Object> grammarPoints(Authentication authentication,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String cefrLevel,
            @RequestHeader HttpHeaders headers) {
        principal(authentication);
        int size = pageSize == null ? DEFAULT_PAGE_SIZE : pageSize;
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "pageSize must be between 1 and 100");
        }
        CursorPosition after = decodeCursor(cursor);
        if (cefrLevel != null && !CEFR_LEVELS.contains(cefrLevel)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "cefrLevel is not supported");
        }

        StringBuilder sql = new StringBuilder("SELECT b.experience_id, b.resource_key, b.payload_json, b.content_version_id ")
                .append(ELIGIBLE_CONTENT)
                .append(" AND b.domain_code = ? AND b.resource_type = ?");
        List<Object> parameters = new ArrayList<>(List.of(TENANT, "GRAMMAR", "GRAMMAR_POINT"));
        if (after != null) {
            sql.append(" AND (b.resource_key > ? OR (b.resource_key = ? AND b.experience_id > ?))");
            parameters.add(after.resourceKey());
            parameters.add(after.resourceKey());
            parameters.add(after.experienceId());
        }
        if (cefrLevel != null) {
            sql.append(" AND JSON_UNQUOTE(JSON_EXTRACT(b.payload_json, '$.cefrLevel')) = ?");
            parameters.add(cefrLevel);
        }
        sql.append(" ORDER BY b.resource_key, b.experience_id LIMIT ?");
        parameters.add(size + 1);

        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), parameters.toArray());
        boolean hasMore = rows.size() > size;
        List<Map<String, Object>> items = rows.stream().limit(size).map(this::publishedRow).toList();
        Map<String, Object> last = hasMore ? rows.get(size - 1) : Map.of();
        String nextCursor = hasMore
                ? encodeCursor(String.valueOf(last.get("resource_key")), String.valueOf(last.get("experience_id")))
                : null;
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", items);
        data.put("source", "mysql");
        return cursorPage(data, hasMore, nextCursor, size, requestContext(headers));
    }

    static String encodeCursor(String resourceKey, String experienceId) {
        String position = resourceKey + "\u0000" + experienceId;
        return CURSOR_ENCODER.encodeToString(position.getBytes(StandardCharsets.UTF_8));
    }

    private static CursorPosition decodeCursor(String cursor) {
        if (cursor == null) return null;
        if (cursor.isBlank() || cursor.length() > MAX_CURSOR_LENGTH
                || !cursor.matches("[A-Za-z0-9_-]+")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "cursor is invalid");
        }
        try {
            byte[] bytes = CURSOR_DECODER.decode(cursor);
            String position = new String(bytes, StandardCharsets.UTF_8);
            int separator = position.indexOf('\u0000');
            if (bytes.length == 0 || bytes.length > 193 || separator <= 0
                    || separator != position.lastIndexOf('\u0000')
                    || !CURSOR_ENCODER.encodeToString(position.getBytes(StandardCharsets.UTF_8)).equals(cursor)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "cursor is invalid");
            }
            String resourceKey = position.substring(0, separator);
            String experienceId = position.substring(separator + 1);
            if (resourceKey.length() > 96 || experienceId.isBlank() || experienceId.length() > 96
                    || resourceKey.codePoints().anyMatch(Character::isISOControl)
                    || experienceId.codePoints().anyMatch(Character::isISOControl)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "cursor is invalid");
            }
            return new CursorPosition(resourceKey, experienceId);
        } catch (IllegalArgumentException invalid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "cursor is invalid");
        }
    }

    private static Map<String, Object> cursorPage(
            Map<String, Object> data,
            boolean hasMore,
            String nextCursor,
            int size,
            B3RequestContext context) {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("requestId", context.requestId());
        meta.put("traceId", context.traceId());
        meta.put("apiVersion", "v1");
        meta.put("schemaVersion", "1.0.0");
        meta.put("serverTime", Instant.now().toString());
        meta.put("hasMore", hasMore);
        meta.put("pageSize", size);
        meta.put("nextCursor", nextCursor);
        return Map.of("data", data, "meta", meta);
    }

    private static B3RequestContext requestContext(HttpHeaders headers) {
        String requestId = headers.getFirst("X-Request-Id");
        String traceId = headers.getFirst("X-Trace-Id");
        if (requestId == null || !requestId.matches("[A-Za-z][A-Za-z0-9._-]{7,127}")) {
            requestId = "local-" + UUID.randomUUID();
        }
        if (traceId == null || !traceId.matches("[a-f0-9]{32}")) {
            traceId = UUID.randomUUID().toString().replace("-", "");
        }
        return new B3RequestContext(requestId, traceId);
    }

    private record B3RequestContext(String requestId, String traceId) {
    }

    private record CursorPosition(String resourceKey, String experienceId) {
    }

    @GetMapping("/grammar/points/{grammarPointId}")
    public Map<String, Object> grammarPoint(@PathVariable String grammarPointId, Authentication authentication) {
        return one("GRAMMAR", "GRAMMAR_POINT", grammarPointId, authentication);
    }

    @GetMapping("/grammar/tree")
    public Map<String, Object> grammarTree(Authentication authentication) {
        principal(authentication);
        List<Map<String, Object>> items = rows("GRAMMAR", "GRAMMAR_POINT", 50, null).stream()
                .map(item -> {
                    Map<String, Object> node = new LinkedHashMap<>();
                    copy(item, node, "grammarPointId", "code", "title", "cefrLevel", "contentVersionId");
                    node.put("prerequisites", List.of());
                    return node;
                }).toList();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("nodes", items);
        data.put("edges", List.of());
        data.put("ruleVersion", "b3-rule-v1");
        versionIfPresent(items, data);
        return envelope(data);
    }

    @GetMapping("/grammar/exercises")
    public Map<String, Object> grammarExercises(Authentication authentication,
            @RequestParam(required = false) String grammarPointId,
            @RequestParam(defaultValue = "20") int limit) {
        principal(authentication);
        List<Map<String, Object>> items = rows("GRAMMAR", "GRAMMAR_EXERCISE", limit, null).stream()
                .filter(item -> grammarPointId == null || grammarPointId.isBlank()
                        || String.valueOf(item.get("grammarPointId")).equals(grammarPointId))
                .toList();
        return itemEnvelope(items);
    }

    @GetMapping("/grammar/sentences/{sentenceId}")
    public Map<String, Object> sentence(@PathVariable String sentenceId, Authentication authentication) {
        return one("GRAMMAR", "SENTENCE", sentenceId, authentication);
    }

    @GetMapping("/grammar/sentences/{sentenceId}/xray")
    public Map<String, Object> sentenceXray(@PathVariable String sentenceId, Authentication authentication) {
        Map<String, Object> data = payload("GRAMMAR", "SENTENCE", sentenceId, authentication);
        Map<String, Object> xray = new LinkedHashMap<>();
        copy(data, xray, "sentenceId", "tokens", "slices", "nodes", "edges", "audioTracks", "contentVersionId");
        xray.put("ruleVersion", "b3-rule-v1");
        return envelope(xray);
    }

    @GetMapping("/grammar/sentences/{sentenceId}/blocks")
    public Map<String, Object> sentenceBlocks(@PathVariable String sentenceId, Authentication authentication) {
        Map<String, Object> data = payload("GRAMMAR", "SENTENCE", sentenceId, authentication);
        return envelope(Map.of("sentenceId", sentenceId, "blocks", data.getOrDefault("slices", List.of()),
                "blockOrder", data.getOrDefault("blockOrder", List.of()),
                "contentVersionId", data.get("contentVersionId")));
    }

    @GetMapping("/grammar/mastery")
    public Map<String, Object> grammarMastery(Authentication authentication) {
        principal(authentication);
        return envelope(Map.of("items", List.of(), "dimensions", List.of("FORM", "MEANING", "USAGE", "ORDER"),
                "ruleVersion", "b3-rule-v1", "source", "mysql"));
    }

    @GetMapping("/writing/prompts")
    public Map<String, Object> writingPrompts(Authentication authentication,
            @RequestParam(defaultValue = "20") int limit) {
        principal(authentication);
        return list("WRITING", "WRITING_PROMPT", limit, null, null);
    }

    @GetMapping("/writing/templates")
    public Map<String, Object> writingTemplates(Authentication authentication,
            @RequestParam(defaultValue = "20") int limit) {
        principal(authentication);
        return list("WRITING", "WRITING_TEMPLATE", limit, null, null);
    }

    @GetMapping("/writing/materials")
    public Map<String, Object> writingMaterials(Authentication authentication,
            @RequestParam(defaultValue = "20") int limit) {
        principal(authentication);
        return list("WRITING", "WRITING_MATERIAL", limit, null, null);
    }

    @GetMapping("/writing/proofreading/exercises")
    public Map<String, Object> proofreading(Authentication authentication,
            @RequestParam(defaultValue = "20") int limit) {
        principal(authentication);
        return list("WRITING", "PROOFREADING", limit, null, null);
    }

    @GetMapping("/listening/materials")
    public Map<String, Object> listeningMaterials(Authentication authentication,
            @RequestParam(defaultValue = "20") int limit) {
        principal(authentication);
        return list("LISTENING", "LISTENING_MATERIAL", limit, null, null);
    }

    @GetMapping("/listening/materials/{materialId}")
    public Map<String, Object> listeningMaterial(@PathVariable String materialId, Authentication authentication) {
        return one("LISTENING", "LISTENING_MATERIAL", materialId, authentication);
    }

    @GetMapping("/listening/clips")
    public Map<String, Object> listeningClips(Authentication authentication,
            @RequestParam(defaultValue = "20") int limit) {
        principal(authentication);
        return list("LISTENING", "LISTENING_CLIP", limit, null, null);
    }

    @GetMapping("/listening/offline-packages")
    public Map<String, Object> listeningOfflinePackages(Authentication authentication) {
        principal(authentication);
        return envelope(Map.of("items", List.of(), "source", "mysql", "availability", "NOT_READY"));
    }

    @GetMapping("/reading/articles")
    public Map<String, Object> readingArticles(Authentication authentication,
            @RequestParam(defaultValue = "20") int limit) {
        principal(authentication);
        return list("READING", "READING_ARTICLE", limit, null, null);
    }

    @GetMapping("/reading/articles/{articleId}")
    public Map<String, Object> readingArticle(@PathVariable String articleId, Authentication authentication) {
        return one("READING", "READING_ARTICLE", articleId, authentication);
    }

    /** Reading story projection derived from the published article payload. */
    @GetMapping("/reading/articles/{articleId}/story")
    public Map<String, Object> readingStory(@PathVariable String articleId, Authentication authentication) {
        Map<String, Object> article = payload("READING", "READING_ARTICLE", articleId, authentication);
        List<Map<String, Object>> nodes = new java.util.ArrayList<>();
        Object rawBlocks = article.get("blocks");
        if (rawBlocks instanceof List<?> blocks) {
            for (int index = 0; index < blocks.size(); index++) {
                Object rawBlock = blocks.get(index);
                if (!(rawBlock instanceof Map<?, ?> source)) continue;
                Map<String, Object> node = new LinkedHashMap<>();
                Object blockId = source.get("blockId");
                String id = blockId == null ? "block-" + (index + 1) : String.valueOf(blockId);
                node.put("nodeId", id);
                node.put("blockId", id);
                node.put("blockIndex", index);
                node.put("text", source.get("text"));
                node.put("translation", source.get("translation"));
                if (index + 1 < blocks.size()) {
                    Object nextRaw = blocks.get(index + 1);
                    String nextId = nextRaw instanceof Map<?, ?> next && next.get("blockId") != null
                            ? String.valueOf(next.get("blockId")) : "block-" + (index + 2);
                    node.put("choices", List.of(Map.of("choiceCode", "NEXT", "label", "继续阅读", "nextBlockId", nextId)));
                } else {
                    node.put("choices", List.of());
                }
                nodes.add(node);
            }
        }
        Map<String, Object> story = new LinkedHashMap<>();
        story.put("articleId", article.getOrDefault("articleId", articleId));
        story.put("branching", !nodes.isEmpty());
        story.put("nodes", nodes);
        story.put("startNodeId", nodes.isEmpty() ? null : nodes.getFirst().get("nodeId"));
        story.put("contentVersionId", article.get("contentVersionId"));
        story.put("source", "mysql");
        return envelope(story);
    }

    @GetMapping("/reading/articles/{articleId}/dictionary")
    public Map<String, Object> dictionary(@PathVariable String articleId,
            @RequestParam String tokenId, Authentication authentication) {
        return one("READING", "DICTIONARY_ENTRY", articleId + ":" + tokenId, authentication);
    }

    @GetMapping("/reading/questions")
    public Map<String, Object> readingQuestions(Authentication authentication,
            @RequestParam(defaultValue = "20") int limit) {
        principal(authentication);
        return list("READING", "READING_QUESTION", limit, null, null);
    }

    @GetMapping("/phonetics/catalog")
    public Map<String, Object> phonetics(Authentication authentication,
            @RequestParam(required = false) String setCode,
            @RequestParam(required = false) String language) {
        principal(authentication);
        return list(phoneticsDomain(language), "PHONEME", 64, null, null);
    }

    @GetMapping("/phonetics/minimal-pairs")
    public Map<String, Object> minimalPairs(Authentication authentication,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) String language) {
        principal(authentication);
        return list(phoneticsDomain(language), "MINIMAL_PAIR", limit, null, null);
    }

    /**
     * B4 language ribbon for the phonetics catalog. Blank or English input keeps
     * reading the legacy {@code PHONETICS} domain (48 English rows); any other
     * BCP-47 language reads its own {@code PHONETICS-{PRIMARY}} domain so French
     * rows never leak into the English learner page.
     */
    static String phoneticsDomain(String language) {
        if (language == null || language.isBlank()) {
            return "PHONETICS";
        }
        String tag = language.trim();
        String primary = tag.contains("-") ? tag.substring(0, tag.indexOf('-')) : tag;
        if (!primary.matches("[A-Za-z]{2,3}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "language must be a BCP-47 tag");
        }
        if (primary.equalsIgnoreCase("en")) {
            return "PHONETICS";
        }
        return "PHONETICS-" + primary.toUpperCase(java.util.Locale.ROOT);
    }

    private Map<String, Object> list(String domain, String resourceType, int limit, String filter, String filterKey) {
        List<Map<String, Object>> items = rows(domain, resourceType, limit, filter);
        if (filter != null && filterKey != null) {
            items = items.stream().filter(item -> filter.equals(String.valueOf(item.get(filterKey)))).toList();
        }
        return itemEnvelope(items);
    }

    private List<Map<String, Object>> rows(String domain, String resourceType, int limit, String ignored) {
        int bounded = Math.max(1, Math.min(limit <= 0 ? 20 : limit, 100));
        return jdbc.queryForList("SELECT b.payload_json, b.content_version_id " + ELIGIBLE_CONTENT
                + " AND b.domain_code = ? AND b.resource_type = ? ORDER BY b.resource_key LIMIT ?",
                TENANT, domain, resourceType, bounded).stream().map(this::publishedRow).toList();
    }

    private Map<String, Object> one(String domain, String resourceType, String resourceKey, Authentication authentication) {
        return envelope(payload(domain, resourceType, resourceKey, authentication));
    }

    private Map<String, Object> payload(String domain, String resourceType, String resourceKey,
            Authentication authentication) {
        principal(authentication);
        return jdbc.queryForList("SELECT b.payload_json, b.content_version_id " + ELIGIBLE_CONTENT
                + " AND b.domain_code = ? AND b.resource_type = ? AND b.resource_key = ?",
                TENANT, domain, resourceType, resourceKey).stream().findFirst()
                .map(this::publishedRow)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "published learner content not found"));
    }

    private Map<String, Object> publishedRow(Map<String, Object> row) {
        long version = ((Number) row.get("content_version_id")).longValue();
        Map<String, Object> payload = new LinkedHashMap<>(parse(String.valueOf(row.get("payload_json"))));
        Object declared = payload.get("contentVersionId");
        if (declared != null && !String.valueOf(version).equals(String.valueOf(declared))) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "published content version does not match its projection");
        }
        payload.put("contentVersionId", version);
        return payload;
    }

    private Map<String, Object> itemEnvelope(List<Map<String, Object>> items) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", items);
        data.put("source", "mysql");
        versionIfPresent(items, data);
        return envelope(data);
    }

    private static void versionIfPresent(List<Map<String, Object>> items, Map<String, Object> data) {
        if (!items.isEmpty()) {
            data.put("contentVersionId", items.getFirst().get("contentVersionId"));
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parse(String json) {
        try {
            Object value = objectMapper.readValue(json, Object.class);
            return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "published content projection is invalid", exception);
        }
    }

    private static void copy(Map<String, Object> source, Map<String, Object> target, String... keys) {
        for (String key : keys) if (source.containsKey(key)) target.put(key, source.get(key));
    }

    private static Map<String, Object> envelope(Object data) {
        return Map.of("source", "mysql", "data", data);
    }

    private static void principal(Authentication authentication) {
        ContentHttpPrincipals.requireLearnerRead(authentication);
    }
}
