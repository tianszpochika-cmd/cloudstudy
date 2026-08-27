package com.englishflow.content.web;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public B3ContentJdbcController(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/grammar/points")
    public Map<String, Object> grammarPoints(Authentication authentication,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) String cefrLevel) {
        principal(authentication);
        return list("GRAMMAR", "GRAMMAR_POINT", limit, cefrLevel, "cefrLevel");
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
        return envelope(Map.of("contentVersionId", 301, "nodes", items, "edges", List.of(), "ruleVersion", "b3-rule-v1"));
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
        return envelope(Map.of("items", items, "source", "mysql", "contentVersionId", 301));
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
                "blockOrder", data.getOrDefault("blockOrder", List.of()), "contentVersionId", 301));
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
        story.put("contentVersionId", article.getOrDefault("contentVersionId", 301));
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
            @RequestParam(required = false) String setCode) {
        principal(authentication);
        return list("PHONETICS", "PHONEME", 64, null, null);
    }

    @GetMapping("/phonetics/minimal-pairs")
    public Map<String, Object> minimalPairs(Authentication authentication,
            @RequestParam(defaultValue = "20") int limit) {
        principal(authentication);
        return list("PHONETICS", "MINIMAL_PAIR", limit, null, null);
    }

    private Map<String, Object> list(String domain, String resourceType, int limit, String filter, String filterKey) {
        List<Map<String, Object>> items = rows(domain, resourceType, limit, filter);
        if (filter != null && filterKey != null) {
            items = items.stream().filter(item -> filter.equals(String.valueOf(item.get(filterKey)))).toList();
        }
        return envelope(Map.of("items", items, "source", "mysql", "contentVersionId", 301));
    }

    private List<Map<String, Object>> rows(String domain, String resourceType, int limit, String ignored) {
        int bounded = Math.max(1, Math.min(limit <= 0 ? 20 : limit, 100));
        return jdbc.queryForList("""
                SELECT payload_json FROM b3_content_experience
                 WHERE tenant_id = ? AND domain_code = ? AND resource_type = ? AND availability = 'PUBLISHED'
                 ORDER BY resource_key LIMIT ?
                """, TENANT, domain, resourceType, bounded).stream().map(row -> parse(String.valueOf(row.get("payload_json")))).toList();
    }

    private Map<String, Object> one(String domain, String resourceType, String resourceKey, Authentication authentication) {
        return envelope(payload(domain, resourceType, resourceKey, authentication));
    }

    private Map<String, Object> payload(String domain, String resourceType, String resourceKey,
            Authentication authentication) {
        principal(authentication);
        return jdbc.queryForList("""
                SELECT payload_json FROM b3_content_experience
                 WHERE tenant_id = ? AND domain_code = ? AND resource_type = ? AND resource_key = ?
                   AND availability = 'PUBLISHED'
                """, TENANT, domain, resourceType, resourceKey).stream().findFirst()
                .map(row -> parse(String.valueOf(row.get("payload_json"))))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "published learner content not found"));
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
        if (!(authentication instanceof JwtAuthenticationToken jwt) || !jwt.isAuthenticated()
                || jwt.getToken().getSubject() == null || jwt.getToken().getSubject().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "verified JWT principal is required");
        }
        String tenant = jwt.getToken().getClaimAsString("tenant_id");
        if (tenant != null && !TENANT.equals(tenant)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "tenant is not allowed");
        }
    }
}
