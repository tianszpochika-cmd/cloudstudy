package com.englishflow.notification.adapter.http;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.englishflow.notification.domain.NotificationAccessPolicy;
import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Local-real owner for B4 offline manifests and the client event queue.
 * Every returned manifest, download state and accepted event is persisted in
 * notification_service; this controller never manufactures a client snapshot.
 */
@RestController
@RequestMapping("/internal/v1/sync")
@ConditionalOnProperty(prefix = "notification.persistence", name = "mode", havingValue = "jdbc")
public final class NotificationLocalOfflineController {

    private static final List<String> MANIFEST_STATES = List.of(
            "PUBLISHED", "AUTHORIZED", "DOWNLOADING", "PAUSED", "VERIFYING", "ACTIVE_LOCAL", "EXPIRED", "DELETED");

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final NotificationPrincipalResolver principals;
    private final NotificationAccessPolicy access;

    public NotificationLocalOfflineController(JdbcTemplate jdbc, ObjectMapper json,
            NotificationPrincipalResolver principals, NotificationAccessPolicy access) {
        this.jdbc = jdbc;
        this.json = json;
        this.principals = principals;
        this.access = access;
    }

    @GetMapping("/offline-packages")
    public Map<String, Object> packages(Authentication authentication,
            @RequestParam(defaultValue = "20") int limit) {
        NotificationPrincipalContext context = owner(authentication, "notification.read");
        int boundedLimit = Math.max(1, Math.min(limit, 100));
        List<Map<String, Object>> items = jdbc.query("""
                SELECT p.package_id, p.package_code, p.version_code, p.state, p.size_bytes, p.part_count,
                       p.sha256, p.signature, p.min_client_version, p.expires_at, p.signed_part_urls_json,
                       d.download_id, d.state AS download_state, d.completed_parts_json, d.downloaded_bytes
                FROM notification_offline_package p
                LEFT JOIN notification_offline_download d
                  ON d.package_id = p.package_id AND d.tenant_id = ? AND d.principal_id = ? AND d.device_id = ?
                WHERE p.state <> 'DELETED' AND p.expires_at > UTC_TIMESTAMP(6)
                ORDER BY p.created_at DESC
                LIMIT ?
                """, (rs, row) -> packageView(rs, context, false), context.tenantId(), context.principalId(),
                context.deviceId(), boundedLimit);
        return response("items", items, "manifestStateMachine", MANIFEST_STATES);
    }

    @PostMapping("/offline-packages/{packageId}/authorize")
    public Map<String, Object> authorize(Authentication authentication, @PathVariable String packageId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        NotificationPrincipalContext context = owner(authentication, "sync.write");
        PackageFact packageFact = findPackage(packageId);
        if (!"PUBLISHED".equals(packageFact.state()) && !"AUTHORIZED".equals(packageFact.state())) {
            throw new NotificationDomainException(NotificationDomainException.Code.VERSION_CONFLICT,
                    "offline package is not available for authorization");
        }
        if (!packageFact.expiresAt().isAfter(Instant.now())) {
            throw new NotificationDomainException(NotificationDomainException.Code.NOT_FOUND,
                    "offline package has expired");
        }
        DownloadFact download = findDownload(packageId, context);
        if (download == null) {
            String downloadId = "download-" + UUID.randomUUID();
            Instant now = Instant.now();
            jdbc.update("""
                    INSERT INTO notification_offline_download
                        (download_id, package_id, tenant_id, principal_id, device_id, state,
                         completed_parts_json, downloaded_bytes, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 'AUTHORIZED', '[]', 0, ?, ?)
                    """, downloadId, packageId, context.tenantId(), context.principalId(), context.deviceId(),
                    timestamp(now), timestamp(now));
        } else if ("CLEANED".equals(download.state())) {
            jdbc.update("""
                    UPDATE notification_offline_download
                    SET state = 'AUTHORIZED', completed_parts_json = '[]', downloaded_bytes = 0, updated_at = ?
                    WHERE download_id = ? AND tenant_id = ? AND principal_id = ? AND device_id = ?
                    """, timestamp(Instant.now()), download.downloadId(), context.tenantId(), context.principalId(),
                    context.deviceId());
        }
        return authorizationView(packageId, context);
    }

    @PatchMapping("/offline-downloads/{downloadId}")
    public Map<String, Object> updateDownload(Authentication authentication, @PathVariable String downloadId,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        NotificationPrincipalContext context = owner(authentication, "sync.write");
        DownloadFact download = requireDownload(downloadId, context);
        PackageFact packageFact = findPackage(download.packageId());
        String action = text(body, "action").toUpperCase();
        List<Integer> completed = new ArrayList<>(download.completedParts());
        String nextState;
        switch (action) {
            case "PAUSE" -> {
                if (!List.of("AUTHORIZED", "DOWNLOADING").contains(download.state())) {
                    throw conflict("download cannot be paused in its current state");
                }
                nextState = "PAUSED";
            }
            case "RESUME" -> {
                if (!List.of("AUTHORIZED", "PAUSED", "DOWNLOADING").contains(download.state())) {
                    throw conflict("download cannot be resumed in its current state");
                }
                nextState = completed.isEmpty() ? "AUTHORIZED" : "DOWNLOADING";
            }
            case "PART_RECEIVED" -> {
                if (!List.of("AUTHORIZED", "PAUSED", "DOWNLOADING").contains(download.state())) {
                    throw conflict("download is not accepting parts");
                }
                int partIndex = integer(body, "partIndex");
                if (partIndex < 0 || partIndex >= packageFact.partCount()) {
                    throw invalid("partIndex is outside the manifest");
                }
                String expectedEtag = partEtag(packageFact, partIndex);
                if (!expectedEtag.equals(text(body, "etag"))) {
                    throw invalid("part ETag does not match the signed manifest");
                }
                if (!completed.contains(partIndex)) completed.add(partIndex);
                completed.sort(Comparator.naturalOrder());
                nextState = completed.size() == packageFact.partCount() ? "VERIFYING" : "DOWNLOADING";
            }
            default -> throw invalid("action must be PAUSE, RESUME or PART_RECEIVED");
        }
        long downloadedBytes = downloadedBytes(packageFact, completed);
        jdbc.update("""
                UPDATE notification_offline_download
                SET state = ?, completed_parts_json = ?, downloaded_bytes = ?, updated_at = ?
                WHERE download_id = ? AND tenant_id = ? AND principal_id = ? AND device_id = ?
                """, nextState, writeJson(completed), downloadedBytes, timestamp(Instant.now()), downloadId,
                context.tenantId(), context.principalId(), context.deviceId());
        DownloadFact updated = requireDownload(downloadId, context);
        return response("download", downloadView(packageFact, updated, context, false),
                "serverVerificationRequired", "VERIFYING".equals(updated.state()));
    }

    @PostMapping("/offline-downloads/{downloadId}/cleanup")
    public Map<String, Object> cleanup(Authentication authentication, @PathVariable String downloadId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        NotificationPrincipalContext context = owner(authentication, "sync.write");
        requireDownload(downloadId, context);
        int updated = jdbc.update("""
                UPDATE notification_offline_download
                SET state = 'CLEANED', completed_parts_json = '[]', downloaded_bytes = 0, updated_at = ?
                WHERE download_id = ? AND tenant_id = ? AND principal_id = ? AND device_id = ?
                """, timestamp(Instant.now()), downloadId, context.tenantId(), context.principalId(), context.deviceId());
        return response("cleaned", updated == 1, "downloadId", downloadId, "state", "CLEANED");
    }

    @GetMapping("/changes")
    public Map<String, Object> changes(Authentication authentication,
            @RequestParam(defaultValue = "0") String cursor,
            @RequestParam(defaultValue = "50") int limit) {
        NotificationPrincipalContext context = owner(authentication, "notification.read");
        long from = parseCursor(cursor);
        int boundedLimit = Math.max(1, Math.min(limit, 100));
        List<Map<String, Object>> changes = jdbc.query("""
                SELECT event_seq, client_batch_id, client_event_id, event_type, entity_id,
                       entity_version, occurred_at, payload_json
                FROM notification_offline_event
                WHERE tenant_id = ? AND principal_id = ? AND device_id = ? AND event_seq > ?
                ORDER BY event_seq
                LIMIT ?
                """, (rs, row) -> eventView(rs), context.tenantId(), context.principalId(), context.deviceId(), from,
                boundedLimit + 1);
        boolean hasMore = changes.size() > boundedLimit;
        if (hasMore) changes = new ArrayList<>(changes.subList(0, boundedLimit));
        long next = changes.isEmpty() ? from : ((Number) changes.get(changes.size() - 1).get("sequence")).longValue();
        return response("changes", changes, "items", changes, "cursor", Long.toString(next),
                "nextCursor", Long.toString(next), "hasMore", hasMore, "resetRequired", false,
                "serverTime", Instant.now().toString());
    }

    @PostMapping("/events")
    public Map<String, Object> events(Authentication authentication, @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        NotificationPrincipalContext context = owner(authentication, "sync.write");
        String batchId = text(body, "clientBatchId");
        Object raw = body == null ? null : body.get("events");
        if (!(raw instanceof List<?> eventList) || eventList.size() > 100) {
            throw invalid("events must contain 0-100 items");
        }
        List<Map<String, Object>> results = new ArrayList<>();
        List<String> acceptedIds = new ArrayList<>();
        int applied = 0;
        for (Object value : eventList) {
            if (!(value instanceof Map<?, ?> rawEvent)) {
                results.add(response("status", "REJECTED", "resultCode", "SYNC_PAYLOAD_INVALID"));
                continue;
            }
            Map<String, Object> event = stringMap(rawEvent);
            try {
                String clientEventId = text(event, "clientEventId");
                String eventType = text(event, "eventType");
                Instant occurredAt = Instant.parse(text(event, "occurredAt"));
                String entityId = optionalText(event.get("entityId"));
                long entityVersion = number(event.get("entityVersion"), 0);
                Object payload = event.getOrDefault("payload", Map.of());
                int inserted = jdbc.update("""
                        INSERT IGNORE INTO notification_offline_event
                            (tenant_id, principal_id, device_id, client_batch_id, client_event_id,
                             event_type, entity_id, entity_version, occurred_at, payload_json, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, context.tenantId(), context.principalId(), context.deviceId(), batchId, clientEventId,
                        eventType, entityId, entityVersion, timestamp(occurredAt), writeJson(payload),
                        timestamp(Instant.now()));
                String status = inserted == 1 ? "ACCEPTED" : "REPLAYED";
                results.add(response("clientEventId", clientEventId, "status", status,
                        "resultCode", inserted == 1 ? "APPLIED" : "IDEMPOTENT_REPLAY"));
                acceptedIds.add(clientEventId);
                if (inserted == 1) applied++;
            } catch (RuntimeException exception) {
                results.add(response("clientEventId", optionalText(event.get("clientEventId")),
                        "status", "REJECTED", "resultCode", "SYNC_PAYLOAD_INVALID"));
            }
        }
        long nextCursor = jdbc.queryForObject("""
                SELECT COALESCE(MAX(event_seq), 0) FROM notification_offline_event
                WHERE tenant_id = ? AND principal_id = ? AND device_id = ?
                """, Long.class, context.tenantId(), context.principalId(), context.deviceId());
        return response("clientBatchId", batchId, "results", results, "accepted", !acceptedIds.isEmpty(),
                "acceptedCount", acceptedIds.size(), "acceptedEventIds", acceptedIds, "applied", applied,
                "conflicts", 0, "nextCursor", Long.toString(nextCursor));
    }

    private Map<String, Object> authorizationView(String packageId, NotificationPrincipalContext context) {
        PackageFact packageFact = findPackage(packageId);
        DownloadFact download = requireDownloadForPackage(packageId, context);
        return response("downloadId", download.downloadId(), "deviceId", context.deviceId(),
                "manifest", packageView(packageFact, download, context, true),
                "signedPartUrls", signedPartUrls(packageFact, download), "expiresAt", packageFact.expiresAt());
    }

    private Map<String, Object> packageView(ResultSet rs, NotificationPrincipalContext context, boolean authorized)
            throws java.sql.SQLException {
        PackageFact packageFact = new PackageFact(rs.getString("package_id"), rs.getString("package_code"),
                rs.getString("version_code"), rs.getString("state"), rs.getLong("size_bytes"),
                rs.getInt("part_count"), rs.getString("sha256"), rs.getString("signature"),
                rs.getString("min_client_version"), rs.getTimestamp("expires_at").toInstant());
        String downloadId = rs.getString("download_id");
        if (downloadId == null) return packageView(packageFact, null, context, authorized);
        DownloadFact download = new DownloadFact(downloadId, packageFact.packageId(), rs.getString("download_state"),
                readParts(rs.getString("completed_parts_json")), rs.getLong("downloaded_bytes"));
        return packageView(packageFact, download, context, authorized);
    }

    private Map<String, Object> packageView(PackageFact packageFact, DownloadFact download,
            NotificationPrincipalContext context, boolean authorized) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("packageId", packageFact.packageId());
        view.put("packageCode", packageFact.packageCode());
        view.put("version", packageFact.versionCode());
        view.put("state", packageFact.state());
        view.put("sizeBytes", packageFact.sizeBytes());
        view.put("partCount", packageFact.partCount());
        view.put("sha256", packageFact.sha256());
        view.put("signature", packageFact.signature());
        view.put("minClientVersion", packageFact.minClientVersion());
        view.put("downloadId", download == null ? null : download.downloadId());
        view.put("downloadState", download == null ? null : download.state());
        view.put("completedPartCount", download == null ? 0 : download.completedParts().size());
        view.put("downloadedBytes", download == null ? 0 : download.downloadedBytes());
        view.put("signedPartUrls", authorized && download != null ? signedPartUrls(packageFact, download) : List.of());
        view.put("expiresAt", packageFact.expiresAt());
        return view;
    }

    private Map<String, Object> downloadView(PackageFact packageFact, DownloadFact download,
            NotificationPrincipalContext context, boolean authorized) {
        return packageView(packageFact, download, context, authorized);
    }

    private List<String> signedPartUrls(PackageFact packageFact, DownloadFact download) {
        List<String> urls = new ArrayList<>();
        for (int index = 0; index < packageFact.partCount(); index++) {
            urls.add("signed-part-token:" + download.downloadId() + ":" + index + ":"
                    + packageFact.expiresAt().toEpochMilli());
        }
        return urls;
    }

    private PackageFact findPackage(String packageId) {
        return jdbc.query("""
                SELECT package_id, package_code, version_code, state, size_bytes, part_count,
                       sha256, signature, min_client_version, expires_at
                FROM notification_offline_package WHERE package_id = ?
                """, (rs, row) -> new PackageFact(rs.getString("package_id"), rs.getString("package_code"),
                rs.getString("version_code"), rs.getString("state"), rs.getLong("size_bytes"),
                rs.getInt("part_count"), rs.getString("sha256"), rs.getString("signature"),
                rs.getString("min_client_version"), rs.getTimestamp("expires_at").toInstant()), packageId)
                .stream().findFirst().orElseThrow(() -> new NotificationDomainException(
                        NotificationDomainException.Code.NOT_FOUND, "offline package does not exist"));
    }

    private DownloadFact findDownload(String packageId, NotificationPrincipalContext context) {
        return jdbc.query("""
                SELECT download_id, package_id, state, completed_parts_json, downloaded_bytes
                FROM notification_offline_download
                WHERE package_id = ? AND tenant_id = ? AND principal_id = ? AND device_id = ?
                """, (rs, row) -> new DownloadFact(rs.getString("download_id"), rs.getString("package_id"),
                rs.getString("state"), readParts(rs.getString("completed_parts_json")), rs.getLong("downloaded_bytes")),
                packageId, context.tenantId(), context.principalId(), context.deviceId()).stream().findFirst().orElse(null);
    }

    private DownloadFact requireDownload(String downloadId, NotificationPrincipalContext context) {
        return jdbc.query("""
                SELECT download_id, package_id, state, completed_parts_json, downloaded_bytes
                FROM notification_offline_download
                WHERE download_id = ? AND tenant_id = ? AND principal_id = ? AND device_id = ?
                """, (rs, row) -> new DownloadFact(rs.getString("download_id"), rs.getString("package_id"),
                rs.getString("state"), readParts(rs.getString("completed_parts_json")), rs.getLong("downloaded_bytes")),
                downloadId, context.tenantId(), context.principalId(), context.deviceId()).stream().findFirst().orElseThrow(
                        () -> new NotificationDomainException(NotificationDomainException.Code.NOT_FOUND,
                                "offline download does not exist"));
    }

    private DownloadFact requireDownloadForPackage(String packageId, NotificationPrincipalContext context) {
        DownloadFact download = findDownload(packageId, context);
        if (download == null) {
            throw new NotificationDomainException(NotificationDomainException.Code.NOT_FOUND,
                    "offline download does not exist");
        }
        return download;
    }

    private Map<String, Object> eventView(ResultSet rs) throws java.sql.SQLException {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("sequence", rs.getLong("event_seq"));
        view.put("clientBatchId", rs.getString("client_batch_id"));
        view.put("clientEventId", rs.getString("client_event_id"));
        view.put("eventType", rs.getString("event_type"));
        view.put("entityId", rs.getString("entity_id"));
        view.put("entityVersion", rs.getLong("entity_version"));
        view.put("occurredAt", rs.getTimestamp("occurred_at").toInstant());
        view.put("payload", readJson(rs.getString("payload_json")));
        return view;
    }

    private NotificationPrincipalContext owner(Authentication authentication, String permission) {
        NotificationPrincipalContext context = principals.require(authentication);
        access.requirePermission(context, permission);
        return context;
    }

    private static long downloadedBytes(PackageFact packageFact, List<Integer> completed) {
        long base = packageFact.sizeBytes() / packageFact.partCount();
        long remainder = packageFact.sizeBytes() % packageFact.partCount();
        long total = 0;
        for (Integer part : completed) total += base + (part < remainder ? 1 : 0);
        return total;
    }

    private static String partEtag(PackageFact packageFact, int partIndex) {
        return "ETAG-" + packageFact.packageId() + "-" + packageFact.versionCode() + "-" + partIndex;
    }

    private List<Integer> readParts(String value) {
        try {
            JsonNode root = json.readTree(value == null || value.isBlank() ? "[]" : value);
            List<Integer> result = new ArrayList<>();
            if (root != null && root.isArray()) root.forEach(item -> result.add(item.asInt()));
            return result;
        } catch (JacksonException exception) {
            throw invalid("offline download state is invalid");
        }
    }

    private Object readJson(String value) {
        try {
            return json.readTree(value == null || value.isBlank() ? "{}" : value);
        } catch (JacksonException exception) {
            throw invalid("offline event payload is invalid");
        }
    }

    private String writeJson(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (JacksonException exception) {
            throw invalid("offline payload could not be encoded");
        }
    }

    private static Map<String, Object> stringMap(Map<?, ?> value) {
        Map<String, Object> result = new LinkedHashMap<>();
        value.forEach((key, item) -> { if (key != null) result.put(String.valueOf(key), item); });
        return result;
    }

    private static String text(Map<String, Object> body, String key) {
        Object value = body == null ? null : body.get(key);
        String text = value == null ? "" : String.valueOf(value).trim();
        if (text.isBlank()) throw invalid(key + " is required");
        return text;
    }

    private static String optionalText(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private static int integer(Map<String, Object> body, String key) {
        Object value = body == null ? null : body.get(key);
        try { return value instanceof Number number ? number.intValue() : Integer.parseInt(String.valueOf(value)); }
        catch (RuntimeException exception) { throw invalid(key + " is invalid"); }
    }

    private static long number(Object value, long fallback) {
        if (value == null) return fallback;
        try { return value instanceof Number number ? number.longValue() : Long.parseLong(String.valueOf(value)); }
        catch (RuntimeException exception) { throw invalid("entityVersion is invalid"); }
    }

    private static long parseCursor(String cursor) {
        try { return Math.max(0, Long.parseLong(cursor == null || cursor.isBlank() ? "0" : cursor)); }
        catch (NumberFormatException exception) { throw invalid("cursor is invalid"); }
    }

    private static String writePartState(List<Integer> parts) { return parts.toString(); }

    private static Timestamp timestamp(Instant value) { return Timestamp.from(value); }

    private static NotificationDomainException invalid(String message) {
        return new NotificationDomainException(NotificationDomainException.Code.INVALID_ARGUMENT, message);
    }

    private static NotificationDomainException conflict(String message) {
        return new NotificationDomainException(NotificationDomainException.Code.VERSION_CONFLICT, message);
    }

    private static Map<String, Object> response(Object... values) {
        Map<String, Object> response = new LinkedHashMap<>();
        for (int index = 0; index + 1 < values.length; index += 2) response.put(String.valueOf(values[index]), values[index + 1]);
        return response;
    }

    private record PackageFact(String packageId, String packageCode, String versionCode, String state,
            long sizeBytes, int partCount, String sha256, String signature, String minClientVersion,
            Instant expiresAt) { }

    private record DownloadFact(String downloadId, String packageId, String state,
            List<Integer> completedParts, long downloadedBytes) { }
}
