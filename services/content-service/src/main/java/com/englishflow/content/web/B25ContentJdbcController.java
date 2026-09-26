package com.englishflow.content.web;

import com.englishflow.content.application.ContentReadService;
import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentAudience;
import com.englishflow.content.domain.ContentChannel;
import com.englishflow.content.domain.ContentProjectionPolicy;
import com.englishflow.content.domain.PublicContentProjection;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.ObjectMapper;

/** B25 published content reader backed by content-service's own schema. */
@RestController
@RequestMapping("/internal/v1/content/learner")
@ConditionalOnProperty(prefix = "content.persistence", name = "mode", havingValue = "jdbc")
public final class B25ContentJdbcController {

    private static final String TENANT = "platform";
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final ContentReadService reads;
    private final VerifiedContentPrincipalFactory principals;

    public B25ContentJdbcController(
            JdbcTemplate jdbc,
            ObjectMapper objectMapper,
            ContentReadService reads,
            VerifiedContentPrincipalFactory principals) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.reads = reads;
        this.principals = principals;
    }

    @GetMapping("/catalog")
    public Map<String, Object> catalog(Authentication authentication,
            @RequestParam(required = false) String contentLocale,
            @RequestParam(required = false) String targetLevel) {
        principal(authentication);
        ContentActor actor = principals.from(authentication);
        String locale = blank(contentLocale) ? null : contentLocale;
        String level = blank(targetLevel) ? null : targetLevel;
        List<Map<String, Object>> items = jdbc.queryForList("""
                SELECT content_code, content_type, title, summary, content_locale, target_level,
                       content_version_id, published_at
                  FROM b25_content_course
                 WHERE tenant_id = ? AND availability = 'PUBLISHED' AND rights_status = 'VALID'
                   AND (? IS NULL OR content_locale = ?) AND (? IS NULL OR target_level = ?)
                 ORDER BY content_code
                """, TENANT, locale, locale, level, level);
        List<Map<String, Object>> published = reads.catalogEntries(
                        ContentAudience.LEARNER, ContentChannel.LEARNER, actor,
                        locale, level, null).stream()
                .map(B25ContentJdbcController::publishedCard)
                .toList();
        List<Map<String, Object>> merged = java.util.stream.Stream.concat(
                        published.stream(), items.stream())
                .collect(java.util.stream.Collectors.toMap(
                        item -> String.valueOf(item.get("contentCode")),
                        item -> item,
                        (left, right) -> left,
                        java.util.LinkedHashMap::new))
                .values().stream().toList();
        long epoch = published.stream()
                .mapToLong(item -> number(item.get("contentEpoch"), 1L)).max().orElse(1L);
        return envelope(Map.of("items", merged, "contentEpoch", epoch, "source", "mysql"));
    }

    @GetMapping("/{contentCode}")
    public Map<String, Object> content(@PathVariable String contentCode, Authentication authentication) {
        principal(authentication);
        try {
            ContentActor actor = principals.from(authentication);
            ContentReadService.ReadResult read = reads.readByCodeResult(
                    contentCode, ContentAudience.LEARNER, ContentChannel.LEARNER,
                    null, false, actor);
            return envelope(publishedContent(read));
        } catch (com.englishflow.content.domain.ContentOperationException exception) {
            if (exception.status() != HttpStatus.NOT_FOUND.value()) {
                throw exception;
            }
        }
        Map<String, Object> course = jdbc.queryForList("""
                SELECT content_code, content_type, title, summary, content_locale, target_level,
                       content_version_id, definition_json, published_at
                  FROM b25_content_course
                 WHERE content_code = ? AND tenant_id = ? AND availability = 'PUBLISHED' AND rights_status = 'VALID'
                """, contentCode, TENANT).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "published content not found"));
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT item_id, item_type, display_order, prompt, options_json, media_ref
                  FROM b25_content_item WHERE content_code = ? AND tenant_id = ? ORDER BY display_order, item_id
                """, contentCode, TENANT);
        Map<String, Object> data = new LinkedHashMap<>(course);
        data.remove("definition_json");
        data.put("items", rows.stream().map(this::publicItem).toList());
        data.put("learnerAccess", Map.of("available", true, "offlineAllowed", false, "reasonCode", "ALLOWED"));
        data.put("source", "mysql");
        return envelope(data);
    }

    @GetMapping("/vocabulary/{vocabularyId}")
    public Map<String, Object> vocabulary(@PathVariable String vocabularyId,
            @RequestParam(defaultValue = "full") String projection,
            Authentication authentication) {
        principal(authentication);
        Map<String, Object> row = jdbc.queryForList("""
                SELECT vocabulary_id, word_normalized, meaning_key, cefr_level, content_version,
                       availability, audio_ref, meaning_cn, definition_en, part_of_speech,
                       examples_json, collocations_json
                FROM b25_content_vocabulary
                WHERE vocabulary_id = ? AND availability = 'PUBLISHED'
                """, vocabularyId).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "published vocabulary not found"));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("vocabularyId", row.get("vocabulary_id"));
        data.put("itemId", row.get("vocabulary_id"));
        data.put("title", row.get("word_normalized"));
        data.put("word", row.get("word_normalized"));
        data.put("frontHint", row.get("cefr_level"));
        data.put("contentLocale", "en-US");
        data.put("contentVersionId", number(row.get("content_version"), 1L));
        data.put("availability", row.get("availability"));
        data.put("audioRef", row.get("audio_ref"));
        if (!"front".equalsIgnoreCase(projection)) {
            Map<String, Object> back = new LinkedHashMap<>();
            back.put("meaningCn", row.get("meaning_cn"));
            back.put("definitionEn", row.get("definition_en"));
            back.put("partOfSpeech", row.get("part_of_speech"));
            back.put("examples", parseJson(row.get("examples_json")));
            back.put("collocations", parseJson(row.get("collocations_json")));
            data.put("back", back);
            data.put("answerAvailable", true);
        } else {
            data.put("answerAvailable", false);
        }
        data.put("source", "mysql");
        return envelope(data);
    }

    /** B2 chunk detail is a published content projection owned by content-service. */
    @GetMapping("/vocab/chunks/{chunkId}")
    public Map<String, Object> chunk(@PathVariable long chunkId, Authentication authentication) {
        principal(authentication);
        if (chunkId < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "chunkId must be positive");
        }
        Map<String, Object> row = jdbc.queryForList("""
                SELECT chunk_id, canonical_text, chunk_type, meaning_cn, usage_note,
                       scenario_code, examples_json, content_version
                  FROM b2_content_chunk
                 WHERE chunk_id = ? AND tenant_id = ? AND availability = 'PUBLISHED'
                """, chunkId, TENANT).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "published chunk not found"));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("chunkId", row.get("chunk_id"));
        data.put("canonicalText", row.get("canonical_text"));
        data.put("chunkType", row.get("chunk_type"));
        data.put("meaningCn", row.get("meaning_cn"));
        data.put("usageNote", row.get("usage_note"));
        data.put("scenarioCode", row.get("scenario_code"));
        data.put("examples", parseJson(row.get("examples_json")));
        data.put("contentVersion", row.get("content_version"));
        data.put("answerAvailable", true);
        data.put("source", "mysql");
        return envelope(data);
    }

    private static Map<String, Object> publishedCard(ContentReadService.CatalogEntry entry) {
        PublicContentProjection projection = entry.projection();
        Map<String, Object> card = new LinkedHashMap<>();
        card.put("contentCode", entry.contentCode());
        card.put("contentType", projection.kind().name());
        card.put("title", projection.title());
        card.put("summary", text(projection.fields().get("summary")));
        card.put("contentLocale", projection.locale());
        card.put("targetLevel", projection.targetLevel());
        card.put("contentVersionId", projection.versionId().value());
        card.put("availability", "PUBLISHED");
        card.put("contentEpoch", entry.contentEpoch());
        card.put("projectionVersion", entry.projectionVersion());
        card.put("publishedAt", entry.publishedAt());
        return card;
    }

    private static Map<String, Object> publishedContent(ContentReadService.ReadResult read) {
        PublicContentProjection projection = read.projection();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("contentCode", read.contentCode());
        data.put("contentType", projection.kind().name());
        data.put("title", projection.title());
        data.put("summary", text(projection.fields().get("summary")));
        data.put("contentLocale", projection.locale());
        data.put("targetLevel", projection.targetLevel());
        data.put("contentVersionId", projection.versionId().value());
        data.put("versionNumber", read.versionNumber());
        data.put("projectionVersion", Math.max(1L, read.projectionVersion()));
        data.put("contentEpoch", Math.max(1L, read.contentEpoch()));
        data.put("availability", "PUBLISHED");
        data.put("items", publishedItems(projection));
        data.put("publishedAt", read.publishedAt());
        data.put("cacheTag", projection.contentHash());
        data.put("learnerAccess", Map.of("available", true, "offlineAllowed", false, "reasonCode", "ALLOWED"));
        data.put("source", "mysql");
        return data;
    }

    private static List<Map<String, Object>> publishedItems(PublicContentProjection projection) {
        Object raw = projection.fields().get("items");
        if (!(raw instanceof List<?> values)) {
            return List.of();
        }
        int[] index = {0};
        return values.stream().filter(Map.class::isInstance).map(value -> {
            @SuppressWarnings("unchecked") Map<Object, Object> source = (Map<Object, Object>) value;
            Map<String, Object> item = new LinkedHashMap<>();
            source.forEach((key, itemValue) -> {
                String name = String.valueOf(key);
                if (!ContentProjectionPolicy.isAnswerRuleKey(name)) {
                    item.put(name, itemValue);
                }
            });
            item.putIfAbsent("itemCode", projection.contentId().value() + "-item-" + index[0]);
            item.putIfAbsent("itemType", projection.kind().name());
            item.putIfAbsent("displayOrder", index[0]);
            item.putIfAbsent("stimulusRef", projection.contentId().value() + ":" + index[0]);
            index[0]++;
            return item;
        }).toList();
    }

    private Map<String, Object> publicItem(Map<String, Object> row) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("itemId", row.get("item_id")); item.put("itemType", row.get("item_type"));
        item.put("displayOrder", row.get("display_order")); item.put("prompt", row.get("prompt"));
        item.put("options", parseJson(row.get("options_json")));
        if (row.get("media_ref") != null) item.put("mediaRef", row.get("media_ref"));
        return item;
    }

    private Object parseJson(Object raw) {
        if (!(raw instanceof String json) || json.isBlank()) return List.of();
        try { return objectMapper.readValue(json, Object.class); }
        catch (Exception ignored) { return List.of(); }
    }

    private static Map<String, Object> envelope(Object data) { return Map.of("source", "mysql", "data", data); }

    private static long number(Object value, long fallback) {
        return value instanceof Number number ? number.longValue() : fallback;
    }

    private static String text(Object value) {
        return value instanceof String string ? string : "";
    }

    private static void principal(Authentication authentication) {
        ContentHttpPrincipals.requireLearnerRead(authentication);
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }
}
