package com.englishflow.media.adapter.jdbc;

import com.englishflow.media.domain.MediaAsset;
import com.englishflow.media.domain.MediaAssetStatus;
import com.englishflow.media.domain.MediaContentReference;
import com.englishflow.media.domain.MediaKind;
import com.englishflow.media.domain.MediaRendition;
import com.englishflow.media.domain.MediaRightsReference;
import com.englishflow.media.domain.MediaRightsStatus;
import com.englishflow.media.domain.RenditionStatus;
import com.englishflow.media.domain.TranscodingStatus;
import com.englishflow.media.port.MediaRepository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DuplicateKeyException;

/** Media-owned JDBC repository used by the local-real profile. */
public final class JdbcMediaRepository implements MediaRepository {

    private final JdbcTemplate jdbc;

    public JdbcMediaRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<MediaAsset> findById(String assetId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT asset_id, tenant_id, owner_subject, asset_key, kind, mime_type,
                       storage_provider, bucket_name, object_key, object_version,
                       checksum_sha256, size_bytes, supports_range, chunk_size_bytes, part_count,
                       asset_status, transcoding_status, content_version_id, content_role, segment_id,
                       rights_id, license_code, rights_status, permitted_channels,
                       rights_starts_at, rights_expires_at, allow_offline, authorization_evidence_ref,
                       asset_version, created_at, updated_at
                  FROM media_asset WHERE asset_id = ?
                """, assetId);
        if (rows.isEmpty()) {
            return Optional.empty();
        }
        Map<String, Object> row = rows.getFirst();
        List<MediaRendition> renditions = jdbc.queryForList("""
                SELECT rendition_key, mime_type, object_version, checksum_sha256,
                       size_bytes, supports_range, rendition_status, created_at, failure_code
                  FROM media_rendition WHERE asset_id = ? ORDER BY rendition_key
                """, assetId).stream().map(JdbcMediaRepository::rendition).toList();
        return Optional.of(asset(row, renditions));
    }

    @Override
    public MediaAsset save(MediaAsset asset) {
        String insertSql = """
                INSERT INTO media_asset (
                    asset_id, tenant_id, owner_subject, asset_key, kind, mime_type,
                    storage_provider, bucket_name, object_key, object_version, checksum_sha256,
                    size_bytes, supports_range, chunk_size_bytes, part_count, asset_status,
                    transcoding_status, content_version_id, content_role, segment_id, rights_id,
                    license_code, rights_status, permitted_channels, rights_starts_at,
                    rights_expires_at, allow_offline, authorization_evidence_ref, asset_version,
                    created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """;
        String updateSql = """
                ON DUPLICATE KEY UPDATE
                    tenant_id = VALUES(tenant_id), owner_subject = VALUES(owner_subject),
                    asset_key = VALUES(asset_key), kind = VALUES(kind), mime_type = VALUES(mime_type),
                    storage_provider = VALUES(storage_provider), bucket_name = VALUES(bucket_name),
                    object_key = VALUES(object_key), object_version = VALUES(object_version),
                    checksum_sha256 = VALUES(checksum_sha256), size_bytes = VALUES(size_bytes),
                    supports_range = VALUES(supports_range), chunk_size_bytes = VALUES(chunk_size_bytes),
                    part_count = VALUES(part_count), asset_status = VALUES(asset_status),
                    transcoding_status = VALUES(transcoding_status), content_version_id = VALUES(content_version_id),
                    content_role = VALUES(content_role), segment_id = VALUES(segment_id),
                    rights_id = VALUES(rights_id), license_code = VALUES(license_code),
                    rights_status = VALUES(rights_status), permitted_channels = VALUES(permitted_channels),
                    rights_starts_at = VALUES(rights_starts_at), rights_expires_at = VALUES(rights_expires_at),
                    allow_offline = VALUES(allow_offline), authorization_evidence_ref = VALUES(authorization_evidence_ref),
                    asset_version = VALUES(asset_version), updated_at = VALUES(updated_at)
                """;
        try {
            // A new asset must never turn a simultaneous registration with a different
            // key into an overwrite. MySQL's PK arbitrates that race across instances.
            jdbc.update(asset.assetVersion() == 1 ? insertSql : insertSql + updateSql,
                asset.assetId(), asset.tenantId(), asset.ownerId(), asset.assetKey(), asset.kind().name(),
                asset.mimeType(), asset.storageProvider(), asset.bucketName(), asset.objectKey(), asset.objectVersion(),
                asset.checksumSha256(), asset.sizeBytes(), asset.supportsRange(), asset.chunkSizeBytes(), asset.partCount(),
                asset.status().name(), asset.transcodingStatus().name(), Long.parseLong(asset.contentReference().contentVersionId()),
                asset.contentReference().role(), asset.contentReference().segmentId(), asset.rightsReference().rightsId(),
                asset.rightsReference().licenseCode(), asset.rightsReference().status().name(),
                String.join(",", asset.rightsReference().permittedChannels()),
                timestamp(asset.rightsReference().startsAt()), timestamp(asset.rightsReference().expiresAt()),
                asset.rightsReference().allowOffline(), asset.rightsReference().authorizationEvidenceRef(),
                asset.assetVersion(), timestamp(asset.createdAt()), timestamp(asset.updatedAt()));
        } catch (DuplicateKeyException duplicate) {
            if (asset.assetVersion() == 1) {
                throw com.englishflow.media.domain.MediaOperationException.conflict(
                        "MEDIA_ASSET_EXISTS", "media asset already exists");
            }
            throw duplicate;
        }

        jdbc.update("DELETE FROM media_rendition WHERE asset_id = ?", asset.assetId());
        for (MediaRendition rendition : asset.renditions()) {
            jdbc.update("""
                    INSERT INTO media_rendition
                        (rendition_id, asset_id, rendition_key, rendition_version, rendition_status,
                         object_reference, mime_type, object_version, checksum_sha256, size_bytes,
                         supports_range, failure_code, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, asset.assetId() + ":" + rendition.renditionKey(), asset.assetId(),
                    rendition.renditionKey(), asset.assetVersion(), rendition.status().name(),
                    asset.objectKey(), rendition.mimeType(), rendition.objectVersion(), rendition.checksumSha256(),
                    rendition.sizeBytes(), rendition.supportsRange(), rendition.failureCode(), timestamp(rendition.updatedAt()));
        }
        return asset;
    }

    private static MediaAsset asset(Map<String, Object> row, List<MediaRendition> renditions) {
        String contentVersion = String.valueOf(row.get("content_version_id"));
        return new MediaAsset(
                text(row, "asset_id"), text(row, "tenant_id"), text(row, "owner_subject"), text(row, "asset_key"),
                MediaKind.parse(text(row, "kind")), text(row, "mime_type"), text(row, "storage_provider"),
                text(row, "bucket_name"), text(row, "object_key"), nullableText(row.get("object_version")),
                text(row, "checksum_sha256"), number(row, "size_bytes"), bool(row, "supports_range"),
                number(row, "chunk_size_bytes"), intNumber(row, "part_count"),
                MediaAssetStatus.valueOf(text(row, "asset_status")),
                TranscodingStatus.valueOf(text(row, "transcoding_status")),
                new MediaContentReference(contentVersion, text(row, "content_role"), nullableText(row.get("segment_id"))),
                new MediaRightsReference(
                        text(row, "rights_id"), contentVersion, text(row, "license_code"),
                        MediaRightsStatus.valueOf(text(row, "rights_status")), channels(row.get("permitted_channels")),
                        instant(row.get("rights_starts_at")), instant(row.get("rights_expires_at")),
                        bool(row, "allow_offline"), nullableText(row.get("authorization_evidence_ref"))),
                renditions, intNumber(row, "asset_version"), instant(row.get("created_at")), instant(row.get("updated_at")));
    }

    private static MediaRendition rendition(Map<String, Object> row) {
        return new MediaRendition(
                text(row, "rendition_key"), text(row, "mime_type"), nullableText(row.get("object_version")),
                text(row, "checksum_sha256"), number(row, "size_bytes"), bool(row, "supports_range"),
                RenditionStatus.valueOf(text(row, "rendition_status")), instant(row.get("created_at")),
                nullableText(row.get("failure_code")));
    }

    private static Set<String> channels(Object raw) {
        if (raw == null || String.valueOf(raw).isBlank()) return Set.of("*");
        return Arrays.stream(String.valueOf(raw).split(","))
                .map(String::trim).filter(value -> !value.isBlank())
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    private static String text(Map<String, Object> row, String key) { return String.valueOf(row.get(key)); }
    private static String nullableText(Object value) { return value == null ? null : String.valueOf(value); }
    private static long number(Map<String, Object> row, String key) { return ((Number) row.get(key)).longValue(); }
    private static int intNumber(Map<String, Object> row, String key) { return ((Number) row.get(key)).intValue(); }
    private static boolean bool(Map<String, Object> row, String key) {
        Object value = row.get(key);
        if (value instanceof Boolean booleanValue) return booleanValue;
        if (value instanceof Number numberValue) return numberValue.intValue() != 0;
        return value != null && Boolean.parseBoolean(String.valueOf(value));
    }
    private static Instant instant(Object value) {
        if (value == null) return null;
        if (value instanceof Timestamp timestamp) return timestamp.toInstant();
        if (value instanceof java.time.LocalDateTime localDateTime) return localDateTime.toInstant(java.time.ZoneOffset.UTC);
        return Instant.parse(String.valueOf(value));
    }
    private static Timestamp timestamp(Instant value) { return value == null ? null : Timestamp.from(value); }
}
