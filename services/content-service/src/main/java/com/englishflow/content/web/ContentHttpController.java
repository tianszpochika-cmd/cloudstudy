package com.englishflow.content.web;

import com.englishflow.content.application.ContentReadService;
import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentAudience;
import com.englishflow.content.domain.ContentChannel;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.domain.PublicContentProjection;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.Authentication;

import tools.jackson.databind.ObjectMapper;

/** B9 public and authenticated learner content read seam. */
@RestController
public final class ContentHttpController {

    private final ContentReadService reads;
    private final VerifiedContentPrincipalFactory principals;
    private final ObjectProvider<JdbcTemplate> jdbcTemplates;
    private final ObjectMapper objectMapper;

    public ContentHttpController(
            ContentReadService reads,
            VerifiedContentPrincipalFactory principals,
            ObjectProvider<JdbcTemplate> jdbcTemplates,
            ObjectMapper objectMapper) {
        this.reads = reads;
        this.principals = principals;
        this.jdbcTemplates = jdbcTemplates;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/api/v1/public/content/catalog")
    public Envelope<Map<String, Object>> publicCatalog(
            @RequestParam(required = false) String contentType,
            @RequestParam(required = false) String targetLevel,
            @RequestParam(required = false) String contentLocale,
            @RequestHeader HttpHeaders headers) {
        List<ContentReadService.CatalogEntry> projections = reads.catalogEntries(
                ContentAudience.PUBLIC, ContentChannel.PUBLIC, null,
                contentLocale, targetLevel, contentType);
        return envelope(catalogData(projections), headers, false);
    }

    @GetMapping("/api/v1/public/content/{contentCode}")
    public Envelope<Map<String, Object>> publicContent(
            @PathVariable String contentCode,
            @RequestParam(required = false) Long versionPin,
            @RequestHeader HttpHeaders headers) {
        ContentReadService.ReadResult read = reads.readByCodeResult(
                contentCode, ContentAudience.PUBLIC, ContentChannel.PUBLIC,
                versionPin == null ? null : ContentVersionId.of(versionPin), false, null);
        return envelope(publicProjection(read), headers, false);
    }

    /**
     * Public website projection. Content courses come from the content owner;
     * the remaining public facets come from this service's published,
     * field-filtered projection read model. Commerce price facts are still
     * exposed by commerce-service and are not copied into this schema.
     */
    @GetMapping("/api/v1/public/site/projection")
    public SiteProjectionEnvelope publicSiteProjection(
            @RequestParam(required = false, defaultValue = "zh-CN") String uiLocale,
            @RequestHeader HttpHeaders headers) {
        List<ContentReadService.CatalogEntry> entries = reads.catalogEntries(
                ContentAudience.PUBLIC, ContentChannel.PUBLIC, null, null, null, null);
        long projectionVersion = entries.stream()
                .mapToLong(ContentReadService.CatalogEntry::projectionVersion)
                .max().orElse(1L);
        long contentEpoch = entries.stream()
                .mapToLong(ContentReadService.CatalogEntry::contentEpoch)
                .max().orElse(1L);
        Instant generatedAt = entries.stream()
                .map(ContentReadService.CatalogEntry::publishedAt)
                .max(Instant::compareTo)
                .orElseGet(Instant::now);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("generatedAt", generatedAt);
        data.put("projectionVersion", projectionVersion);
        data.put("contentEpoch", contentEpoch);
        data.put("courses", entries.stream().map(ContentHttpController::card).toList());
        // Pricing remains commerce-owned and is read from the canonical public
        // commerce endpoint by the official-site aggregation boundary. These
        // three platform facets are durable local read projections, never
        // client-supplied static cards.
        String locale = normalizeUiLocale(uiLocale);
        data.put("pricing", List.of());
        data.put("downloads", publicSiteFacets("DOWNLOAD", locale));
        data.put("announcements", publicSiteFacets("ANNOUNCEMENT", locale));
        data.put("compliance", publicSiteFacets("COMPLIANCE", locale));
        return new SiteProjectionEnvelope(
                data,
                new PublicSiteMeta(projectionVersion, contentEpoch, generatedAt,
                        "CONTENT_SERVICE", false, headers.getFirst("X-Trace-Id")));
    }

    @GetMapping("/api/v1/content/learner/catalog")
    public Envelope<Map<String, Object>> learnerCatalog(
            @RequestParam(required = false) String contentType,
            @RequestParam(required = false) String targetLevel,
            @RequestParam(required = false) String contentLocale,
            Authentication authentication,
            @RequestHeader HttpHeaders headers) {
        ContentActor actor = principals.from(authentication);
        List<ContentReadService.CatalogEntry> projections = reads.catalogEntries(
                ContentAudience.LEARNER, ContentChannel.LEARNER, actor,
                contentLocale, targetLevel, contentType);
        return envelope(catalogData(projections), headers, false);
    }

    @GetMapping("/api/v1/content/learner/{contentCode}")
    public Envelope<Map<String, Object>> learnerContent(
            @PathVariable String contentCode,
            @RequestParam(required = false) Long versionPin,
            Authentication authentication,
            @RequestHeader HttpHeaders headers) {
        ContentActor actor = principals.from(authentication);
        ContentReadService.ReadResult read = reads.readByCodeResult(
                contentCode, ContentAudience.LEARNER, ContentChannel.LEARNER,
                versionPin == null ? null : ContentVersionId.of(versionPin),
                versionPin != null, actor);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("content", publicProjection(read));
        data.put("learnerAccess", Map.of(
                "available", true,
                "offlineAllowed", false,
                "reasonCode", "ALLOWED"));
        data.put("contentEpoch", 1L);
        return envelope(data, headers, false);
    }

    private static Map<String, Object> catalogData(List<ContentReadService.CatalogEntry> projections) {
        long epoch = projections.stream().mapToLong(ContentReadService.CatalogEntry::contentEpoch).max().orElse(1L);
        long revision = projections.stream().mapToLong(ContentReadService.CatalogEntry::projectionVersion).max().orElse(1L);
        return Map.of(
                "items", projections.stream().map(ContentHttpController::card).toList(),
                "contentEpoch", Math.max(1L, epoch),
                "projectionVersion", Math.max(1L, revision));
    }

    private static Map<String, Object> card(ContentReadService.CatalogEntry entry) {
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
        return card;
    }

    private static String normalizeUiLocale(String value) {
        return "en-US".equalsIgnoreCase(value) ? "en-US" : "zh-CN";
    }

    private List<Map<String, Object>> publicSiteFacets(String facetType, String locale) {
        JdbcTemplate jdbc = jdbcTemplates.getIfAvailable();
        if (jdbc == null) {
            return List.of();
        }
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT payload_json
                  FROM content_public_site_facet
                 WHERE facet_type = ? AND status = 'PUBLISHED' AND ui_locale = ?
                   AND published_at <= CURRENT_TIMESTAMP(6)
                   AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP(6))
                 ORDER BY published_at DESC, facet_id
                """, facetType, locale);
        if (rows.isEmpty() && !"zh-CN".equals(locale)) {
            rows = jdbc.queryForList("""
                    SELECT payload_json
                      FROM content_public_site_facet
                     WHERE facet_type = ? AND status = 'PUBLISHED' AND ui_locale = 'zh-CN'
                       AND published_at <= CURRENT_TIMESTAMP(6)
                       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP(6))
                     ORDER BY published_at DESC, facet_id
                    """, facetType);
        }
        return rows.stream()
                .map(row -> publicFacet(facetType, decodeFacet(row.get("payload_json"))))
                .filter(facet -> !facet.isEmpty())
                .toList();
    }

    /** Convert the durable facet payload to the B9 public allow-list. */
    private static Map<String, Object> publicFacet(String facetType, Map<String, Object> payload) {
        if (payload.isEmpty()) {
            return Map.of();
        }
        Map<String, Object> facet = new LinkedHashMap<>();
        switch (facetType) {
            case "DOWNLOAD" -> {
                String platform = textOr(payload.get("platform"), "WEB").toUpperCase(Locale.ROOT);
                if (!List.of("WEB", "IOS", "ANDROID", "IPAD", "WECHAT_MINI_PROGRAM", "WINDOWS")
                        .contains(platform)) {
                    return Map.of();
                }
                facet.put("platform", platform);
                facet.put("channel", textOr(payload.get("channel"), textOr(payload.get("name"), platform)));
                facet.put("status", textOr(payload.get("status"), text(payload.get("availability")))
                        .toUpperCase(Locale.ROOT).replace('-', '_'));
                putIfText(facet, "downloadUrl", payload.get("downloadUrl"));
                putIfText(facet, "version", payload.get("version"));
            }
            case "ANNOUNCEMENT" -> {
                facet.put("announcementCode", textOr(payload.get("announcementCode"), text(payload.get("id"))));
                facet.put("title", text(payload.get("title")));
                facet.put("summary", text(payload.get("summary")));
                putIfText(facet, "publishedAt", payload.get("publishedAt"));
                putIfText(facet, "expiresAt", payload.get("expiresAt"));
            }
            case "COMPLIANCE" -> {
                facet.put("noticeCode", textOr(payload.get("noticeCode"), text(payload.get("id"))));
                facet.put("title", text(payload.get("title")));
                facet.put("body", textOr(payload.get("body"), text(payload.get("description"))));
                facet.put("version", textOr(payload.get("version"), text(payload.get("status"))));
                putIfText(facet, "effectiveAt", payload.get("effectiveAt"));
            }
            default -> {
                return Map.of();
            }
        }
        return facet.values().stream().anyMatch(value -> value instanceof String string && !string.isBlank())
                ? Collections.unmodifiableMap(facet)
                : Map.of();
    }

    private static void putIfText(Map<String, Object> target, String key, Object value) {
        String text = text(value);
        if (!text.isBlank()) {
            target.put(key, text);
        }
    }

    private Map<String, Object> decodeFacet(Object payload) {
        try {
            String json = payload instanceof String value ? value : String.valueOf(payload);
            @SuppressWarnings("unchecked")
            Map<String, Object> decoded = objectMapper.readValue(json, Map.class);
            return decoded == null ? Map.of() : Collections.unmodifiableMap(decoded);
        } catch (Exception ignored) {
            // A malformed published facet must not break the complete public
            // projection; it is excluded until the owner republishes it.
            return Map.of();
        }
    }

    private static Map<String, Object> publicProjection(ContentReadService.ReadResult read) {
        PublicContentProjection projection = read.projection();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("projectionKey", read.contentCode() + ":v" + projection.versionId().value());
        result.put("contentCode", read.contentCode());
        result.put("contentType", projection.kind().name());
        result.put("title", projection.title());
        result.put("summary", text(projection.fields().get("summary")));
        result.put("contentLocale", projection.locale());
        result.put("targetLevel", projection.targetLevel());
        result.put("contentVersionId", projection.versionId().value());
        result.put("versionNumber", read.versionNumber());
        result.put("projectionVersion", Math.max(1L, read.projectionVersion()));
        result.put("contentEpoch", Math.max(1L, read.contentEpoch()));
        result.put("availability", "PUBLISHED");
        result.put("items", items(projection));
        result.put("publishedAt", read.publishedAt());
        result.put("cacheTag", projection.contentHash());
        return result;
    }

    private static List<Map<String, Object>> items(PublicContentProjection projection) {
        Object raw = projection.fields().get("items");
        List<Map<String, Object>> result = new ArrayList<>();
        if (raw instanceof List<?> values) {
            int index = 0;
            for (Object value : values) {
                if (value instanceof Map<?, ?> item) {
                    result.add(itemView(projection, item, index++));
                }
            }
        }
        return List.copyOf(result);
    }

    private static Map<String, Object> itemView(
            PublicContentProjection projection,
            Map<?, ?> source,
            int index) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("itemCode", textOr(source.get("itemCode"),
                projection.contentId().value() + "-item-" + index));
        item.put("itemType", textOr(source.get("itemType"), projection.kind().name()));
        item.put("displayOrder", numberOr(source.get("displayOrder"), index));
        item.put("stimulusRef", textOr(source.get("stimulusRef"),
                projection.contentId().value() + ":" + index));
        String displayText = textOr(source.get("displayText"),
                textOr(source.get("prompt"), textOr(source.get("text"), "")));
        if (!displayText.isBlank()) {
            item.put("displayText", displayText);
        }
        return item;
    }

    private static String text(Object value) {
        return value instanceof String string ? string : "";
    }

    private static String textOr(Object value, String fallback) {
        String text = text(value);
        return text.isBlank() ? fallback : text;
    }

    private static int numberOr(Object value, int fallback) {
        return value instanceof Number number ? number.intValue() : fallback;
    }

    private static <T> Envelope<T> envelope(T data, HttpHeaders headers, boolean stale) {
        return new Envelope<>(data, new Meta(
                headers.getFirst("X-Trace-Id"),
                headers.getFirst("X-Request-Id"),
                "CONTENT_SERVICE", stale,
                Instant.now()));
    }

    public record Envelope<T>(T data, Meta meta) {
    }

    public record SiteProjectionEnvelope(Map<String, Object> data, PublicSiteMeta meta) {
    }

    public record PublicSiteMeta(
            long projectionVersion,
            long contentEpoch,
            Instant generatedAt,
            String source,
            boolean stale,
            String traceId) {
    }

    public record Meta(String traceId, String requestId, String source, boolean stale, Instant generatedAt) {
    }
}
