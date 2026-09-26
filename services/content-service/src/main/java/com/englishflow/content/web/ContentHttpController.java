package com.englishflow.content.web;

import com.englishflow.content.application.ContentReadService;
import com.englishflow.content.domain.ContentActor;
import com.englishflow.content.domain.ContentAudience;
import com.englishflow.content.domain.ContentChannel;
import com.englishflow.content.domain.ContentVersionId;
import com.englishflow.content.domain.PublicContentProjection;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
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
        ContentHttpPrincipals.requireLearnerRead(authentication);
        ContentActor actor = principals.from(authentication);
        List<ContentReadService.CatalogEntry> projections = reads.catalogEntries(
                ContentAudience.LEARNER, ContentChannel.LEARNER, actor,
                contentLocale, targetLevel, contentType);
        return envelope(catalogData(projections), headers, false);
    }

    /**
     * P1R decision 7B: session-pin resolution for assessment. When a pinned content
     * code is unavailable, assessment asks here for the deterministic substitute
     * instead of inventing content; empty resolves to catalog/support actions.
     */
    @GetMapping("/api/v1/content/learner/substitute")
    public Envelope<Map<String, Object>> learnerSubstitute(
            @RequestParam String code,
            @RequestParam(required = false) String reason,
            Authentication authentication,
            @RequestHeader HttpHeaders headers) {
        ContentHttpPrincipals.requireLearnerRead(authentication);
        ContentActor actor = principals.from(authentication);
        String reasonCode = reason == null || reason.isBlank() ? "PIN_UNAVAILABLE" : reason.trim();
        Map<String, Object> data = reads.resolveSubstitute(
                        code.trim(), reasonCode, ContentAudience.LEARNER, ContentChannel.LEARNER, actor)
                .map(resolution -> {
                    Map<String, Object> substitute = new LinkedHashMap<>();
                    substitute.put("contentCode", resolution.substitute().contentCode());
                    substitute.put("contentVersionId", resolution.substitute().versionId().value());
                    substitute.put("kind", resolution.substitute().kind().name());
                    substitute.put("targetLevel", resolution.substitute().targetLevel());
                    substitute.put("title", resolution.substitute().title());
                    Map<String, Object> result = new LinkedHashMap<>();
                    result.put("unavailableCode", code.trim());
                    result.put("reasonCode", resolution.reasonCode());
                    result.put("alternativeAction", resolution.alternativeAction());
                    result.put("substitute", substitute);
                    return result;
                })
                .orElseThrow(() -> com.englishflow.content.domain.ContentOperationException.notFound("CONTENT_SUBSTITUTE_UNAVAILABLE", "no substitute available"));
        return envelope(data, headers, false);
    }

    @GetMapping("/api/v1/content/learner/{contentCode}")
    public Envelope<Map<String, Object>> learnerContent(
            @PathVariable String contentCode,
            @RequestParam(required = false) Long versionPin,
            Authentication authentication,
            @RequestHeader HttpHeaders headers) {
        ContentHttpPrincipals.requireLearnerRead(authentication);
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
    static Map<String, Object> publicFacet(String facetType, Map<String, Object> payload) {
        if (payload.isEmpty()) {
            return Map.of();
        }
        Map<String, Object> facet = new LinkedHashMap<>();
        switch (facetType) {
            case "DOWNLOAD" -> {
                String platform = text(payload.get("platform")).toUpperCase(Locale.ROOT);
                if (!List.of("WEB", "IOS", "ANDROID", "IPAD", "WECHAT_MINI_PROGRAM", "WINDOWS")
                        .contains(platform)) {
                    return Map.of();
                }
                String channel = text(payload.get("channel"));
                String status = text(payload.get("status")).toUpperCase(Locale.ROOT).replace('-', '_');
                if (channel.isBlank() || !List.of("AVAILABLE", "UNAVAILABLE", "COMING_SOON").contains(status)) {
                    return Map.of();
                }
                String downloadUrl = text(payload.get("downloadUrl"));
                boolean usableDownloadUrl = publicHttpsUrl(downloadUrl);
                if ("AVAILABLE".equals(status) && !usableDownloadUrl) {
                    return Map.of();
                }
                facet.put("platform", platform);
                facet.put("channel", channel);
                facet.put("status", status);
                if (usableDownloadUrl) {
                    facet.put("downloadUrl", downloadUrl);
                }
                putIfText(facet, "version", payload.get("version"));
            }
            case "ANNOUNCEMENT" -> {
                String code = text(payload.get("announcementCode"));
                String title = text(payload.get("title"));
                String summary = text(payload.get("summary"));
                String publishedAt = text(payload.get("publishedAt"));
                if (code.isBlank() || title.isBlank() || summary.isBlank() || !validInstant(publishedAt)) {
                    return Map.of();
                }
                facet.put("announcementCode", code);
                facet.put("title", title);
                facet.put("summary", summary);
                facet.put("publishedAt", publishedAt);
                putIfText(facet, "expiresAt", payload.get("expiresAt"));
            }
            case "COMPLIANCE" -> {
                String code = text(payload.get("noticeCode"));
                String title = text(payload.get("title"));
                String body = text(payload.get("body"));
                String version = text(payload.get("version"));
                String effectiveAt = text(payload.get("effectiveAt"));
                if (code.isBlank() || title.isBlank() || body.isBlank() || version.isBlank()
                        || !validInstant(effectiveAt)) {
                    return Map.of();
                }
                facet.put("noticeCode", code);
                facet.put("title", title);
                facet.put("body", body);
                facet.put("version", version);
                facet.put("effectiveAt", effectiveAt);
            }
            default -> {
                return Map.of();
            }
        }
        return Collections.unmodifiableMap(facet);
    }

    private static boolean validInstant(String value) {
        if (value.isBlank()) {
            return false;
        }
        try {
            Instant.parse(value);
            return true;
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    /**
     * Validate download links without making a network request from a public
     * read. DNS names still require publisher-side verification to resolve to
     * public addresses; literal local/private targets and local-only names are
     * rejected here before they can be exposed to browsers.
     */
    private static boolean publicHttpsUrl(String value) {
        if (value.isBlank()) {
            return false;
        }
        try {
            URI uri = URI.create(value);
            if (!uri.isAbsolute() || !"https".equals(uri.getScheme())
                    || uri.getRawAuthority() == null || uri.getRawUserInfo() != null
                    || uri.getHost() == null || uri.getPort() == 0 || uri.getPort() > 65535) {
                return false;
            }

            String host = uri.getHost().toLowerCase(Locale.ROOT);
            if (host.startsWith("[") && host.endsWith("]")) {
                host = host.substring(1, host.length() - 1);
            }
            if (host.contains(":")) {
                return globallyRoutableAddress(InetAddress.getByName(host).getAddress());
            }
            if (host.matches("[0-9.]+")) {
                if (!host.matches("(?:[0-9]{1,3}\\.){3}[0-9]{1,3}")) {
                    return false;
                }
                String[] octets = host.split("\\.");
                byte[] address = new byte[4];
                for (int index = 0; index < octets.length; index++) {
                    if (octets[index].length() > 1 && octets[index].startsWith("0")) {
                        return false;
                    }
                    int octetValue = Integer.parseInt(octets[index]);
                    if (octetValue > 255) {
                        return false;
                    }
                    address[index] = (byte) octetValue;
                }
                return globallyRoutableAddress(address);
            }
            return publicDnsHostname(host);
        } catch (IllegalArgumentException | UnknownHostException ignored) {
            return false;
        }
    }

    private static boolean publicDnsHostname(String host) {
        if (host.endsWith(".")) {
            host = host.substring(0, host.length() - 1);
        }
        if (host.length() > 253 || host.contains("..")) {
            return false;
        }
        String normalized = host.toLowerCase(Locale.ROOT);
        if (normalized.equals("localhost") || normalized.endsWith(".localhost")
                || normalized.equals("local") || normalized.endsWith(".local")
                || normalized.equals("internal") || normalized.endsWith(".internal")
                || normalized.equals("lan") || normalized.endsWith(".lan")
                || normalized.equals("home.arpa") || normalized.endsWith(".home.arpa")
                || normalized.equals("test") || normalized.endsWith(".test")
                || normalized.equals("example") || normalized.endsWith(".example")
                || normalized.equals("invalid") || normalized.endsWith(".invalid")
                || normalized.equals("alt") || normalized.endsWith(".alt")
                || normalized.equals("onion") || normalized.endsWith(".onion")
                || normalized.equals("corp") || normalized.endsWith(".corp")
                || normalized.equals("private") || normalized.endsWith(".private")) {
            return false;
        }
        String[] labels = normalized.split("\\.");
        if (labels.length < 2 || labels[labels.length - 1].length() < 2
                || !labels[labels.length - 1].matches("[a-z][a-z0-9-]*")) {
            return false;
        }
        for (String label : labels) {
            if (label.isBlank() || label.length() > 63
                    || !label.matches("[a-z0-9](?:[a-z0-9-]*[a-z0-9])?")) {
                return false;
            }
        }
        return true;
    }

    private static boolean globallyRoutableAddress(byte[] address) {
        if (address.length == 4) {
            int first = Byte.toUnsignedInt(address[0]);
            int second = Byte.toUnsignedInt(address[1]);
            int third = Byte.toUnsignedInt(address[2]);
            return first != 0 && first != 10 && first != 127 && first < 224
                    && !(first == 100 && second >= 64 && second <= 127)
                    && !(first == 169 && second == 254)
                    && !(first == 172 && second >= 16 && second <= 31)
                    && !(first == 192 && (second == 0 || second == 2 || second == 168))
                    && !(first == 192 && second == 88 && third == 99)
                    && !(first == 198 && (second == 18 || second == 19
                            || (second == 51 && third == 100)))
                    && !(first == 203 && second == 0 && third == 113);
        }
        if (address.length != 16) {
            return false;
        }
        boolean ipv4Mapped = true;
        for (int index = 0; index < 10; index++) {
            ipv4Mapped &= address[index] == 0;
        }
        ipv4Mapped &= address[10] == (byte) 0xff && address[11] == (byte) 0xff;
        if (ipv4Mapped) {
            return globallyRoutableAddress(new byte[] { address[12], address[13], address[14], address[15] });
        }

        int first = Byte.toUnsignedInt(address[0]);
        int second = Byte.toUnsignedInt(address[1]);
        int third = Byte.toUnsignedInt(address[2]);
        int fourth = Byte.toUnsignedInt(address[3]);
        return (first & 0xe0) == 0x20 // globally assigned unicast range 2000::/3
                && (first & 0xfe) != 0xfc // unique-local fc00::/7
                && first != 0xff // multicast
                && !(first == 0x20 && second == 0x01 && third == 0x0d && fourth == 0xb8); // documentation prefix
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
