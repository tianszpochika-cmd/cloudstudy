package com.englishflow.media.web;

import com.englishflow.media.application.MediaAssetCommandService;
import com.englishflow.media.application.MediaReadService;
import com.englishflow.media.domain.MediaAsset;
import com.englishflow.media.domain.MediaAssetDraft;
import com.englishflow.media.domain.MediaAuthorizationContext;
import com.englishflow.media.domain.MediaContentReference;
import com.englishflow.media.domain.MediaDeliveryChannel;
import com.englishflow.media.domain.MediaKind;
import com.englishflow.media.domain.MediaOperationException;
import com.englishflow.media.domain.MediaRenditionDraft;
import com.englishflow.media.domain.MediaRightsReference;
import com.englishflow.media.domain.MediaRightsStatus;
import com.englishflow.media.domain.RenditionStatus;
import com.englishflow.media.domain.SignedMediaUrl;
import com.englishflow.media.domain.SignedUrlGrant;
import com.englishflow.media.domain.TranscodingStatus;

import java.time.Duration;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Internal service API. There is no byte upload/download controller: only metadata, manifests,
 * lifecycle callbacks and short-lived delivery grants cross this boundary.
 */
@RestController
@Validated
@RequestMapping("/internal/v1/media")
public class MediaController {

    private final MediaAssetCommandService commandService;
    private final MediaReadService readService;

    public MediaController(MediaAssetCommandService commandService, MediaReadService readService) {
        this.commandService = commandService;
        this.readService = readService;
    }

    @PostMapping("/assets")
    public ResponseEntity<Map<String, Object>> register(
            @RequestHeader(name = "Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody RegisterRequest request,
            Authentication authentication) {
        MediaAsset asset = commandService.register(
                request.toDraft(), context(authentication), idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("asset", asset.safeView()));
    }

    @GetMapping("/assets/{assetId}")
    public Map<String, Object> metadata(@PathVariable String assetId, Authentication authentication) {
        return Map.of("asset", readService.describe(assetId, context(authentication)).safeView());
    }

    @GetMapping("/assets/{assetId}/manifest")
    public Object manifest(@PathVariable String assetId, Authentication authentication) {
        return readService.manifest(assetId, context(authentication));
    }

    @PostMapping("/assets/{assetId}/signed-url")
    public SignedMediaUrl signedUrl(
            @PathVariable String assetId,
            @RequestHeader(name = "Range", required = false) String rangeHeader,
            @Valid @RequestBody(required = false) SignedUrlRequest request,
            Authentication authentication) {
        SignedUrlRequest effective = request == null ? new SignedUrlRequest(null, null) : request;
        return readService.issueSignedUrl(
                assetId, effective.deliveryChannel(), rangeHeader, effective.ttl(), context(authentication));
    }

    @PostMapping("/signed-urls/{token}/assets/{assetId}/validate")
    public Map<String, Object> validateSignedUrl(
            @PathVariable String token,
            @PathVariable String assetId,
            @RequestHeader(name = "Range", required = false) String rangeHeader,
            Authentication authentication) {
        SignedUrlGrant grant = readService.validateSignedUrl(token, assetId, rangeHeader, context(authentication));
        return Map.of(
                "assetId", grant.assetId(),
                "assetVersion", grant.assetVersion(),
                "channel", grant.channel().name(),
                "rangeStart", grant.range().startInclusive(),
                "rangeEnd", grant.range().endInclusive(),
                "rangeTotalSize", grant.range().totalSize(),
                "expiresAt", grant.expiresAt().toString());
    }

    @PutMapping("/assets/{assetId}/active")
    public Map<String, Object> activate(
            @PathVariable String assetId,
            @Valid @RequestBody ActivationRequest request,
            Authentication authentication) {
        return Map.of("asset", commandService.markActive(
                assetId, request.verifiedChecksumSha256(), request.verifiedSizeBytes(), context(authentication)).safeView());
    }

    @PutMapping("/assets/{assetId}/transcoding")
    public Map<String, Object> transcoding(
            @PathVariable String assetId,
            @Valid @RequestBody TranscodingRequest request,
            Authentication authentication) {
        return Map.of("asset", commandService.updateTranscoding(
                assetId, request.status(), request.failureCode(), context(authentication)).safeView());
    }

    @PutMapping("/assets/{assetId}/renditions/{renditionKey}")
    public Map<String, Object> rendition(
            @PathVariable String assetId,
            @PathVariable String renditionKey,
            @Valid @RequestBody RenditionRequest request,
            Authentication authentication) {
        return Map.of("asset", commandService.upsertRendition(
                assetId, request.toDraft(renditionKey), context(authentication)).safeView());
    }

    @PostMapping("/assets/{assetId}/revoke")
    public Map<String, Object> revoke(
            @PathVariable String assetId,
            @Valid @RequestBody RevokeRequest request,
            Authentication authentication) {
        return Map.of("asset", commandService.revoke(assetId, request.reason(), context(authentication)).safeView());
    }

    /**
     * M3-004 processing-task workbench view: transcoding state plus every rendition
     * (including subtitle tracks) from the committed aggregate. Read-only.
     */
    @GetMapping("/assets/{assetId}/tasks")
    public Map<String, Object> tasks(@PathVariable String assetId, Authentication authentication) {
        MediaAsset asset = readService.describe(assetId, context(authentication));
        return Map.of("tasks", Map.of(
                "assetId", asset.assetId(),
                "assetVersion", asset.assetVersion(),
                "status", asset.status().name(),
                "transcodingStatus", asset.transcodingStatus().name(),
                "renditions", asset.renditions().stream().map(r -> Map.of(
                        "renditionKey", r.renditionKey(),
                        "mimeType", r.mimeType(),
                        "status", r.status().name(),
                        "sizeBytes", r.sizeBytes(),
                        "updatedAt", r.updatedAt().toString())).toList()));
    }

    /**
     * M3-004 failure retry: FAILED transcoding/renditions return to QUEUED.
     * Idempotent in effect (nothing FAILED → 409 MEDIA_NOTHING_TO_RETRY).
     */
    @PostMapping("/assets/{assetId}/retry")
    public Map<String, Object> retry(
            @PathVariable String assetId,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            Authentication authentication) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw MediaOperationException.badRequest("MEDIA_IDEMPOTENCY_KEY_INVALID", "Idempotency-Key is required");
        }
        return Map.of("asset", commandService.retryFailed(assetId, context(authentication)).safeView());
    }

    /**
     * M3-004 subtitle track upsert (VTT/SRT, zh-CN/en-US), stored as a reserved rendition.
     */
    @PostMapping("/assets/{assetId}/subtitles")
    public Map<String, Object> subtitle(
            @PathVariable String assetId,
            @Valid @RequestBody SubtitleRequest request,
            Authentication authentication) {
        return Map.of("asset", commandService.upsertSubtitle(
                assetId, request.locale(), request.format(), request.checksumSha256(),
                request.sizeBytes(), context(authentication)).safeView());
    }

    /**
     * M3-004 short-lived upload grant: metadata only, bytes never cross this service.
     * Issued on the RECORDING channel with a capped TTL (at most 15 minutes).
     */
    @PostMapping("/assets/{assetId}/upload-url")
    public SignedMediaUrl uploadUrl(
            @PathVariable String assetId,
            @Valid @RequestBody(required = false) UploadUrlRequest request,
            Authentication authentication) {
        Duration ttl = request == null || request.ttlSeconds() == null
                ? Duration.ofMinutes(5)
                : Duration.ofSeconds(Math.max(60, Math.min(request.ttlSeconds(), 900)));
        return readService.issueSignedUrl(
                assetId, MediaDeliveryChannel.RECORDING, null, ttl, context(authentication));
    }

    /**
     * M5-004 waveform integrity descriptor: which peaks payload the owner registered
     * for this asset (peaks are extracted client-side with the Web Audio API from the
     * authorized bytes and verified against this checksum).
     */
    @GetMapping("/assets/{assetId}/waveform")
    public Map<String, Object> waveform(@PathVariable String assetId, Authentication authentication) {
        MediaAsset asset = readService.describe(assetId, context(authentication));
        return asset.renditions().stream()
                .filter(r -> "waveform:peaks:v1".equals(r.renditionKey()))
                .findFirst()
                .map(r -> Map.<String, Object>of(
                        "assetId", asset.assetId(),
                        "assetVersion", asset.assetVersion(),
                        "renditionKey", r.renditionKey(),
                        "peakChecksumSha256", r.checksumSha256(),
                        "registeredAt", r.updatedAt().toString()))
                .map(Map::copyOf)
                .orElse(Map.of("assetId", asset.assetId(), "assetVersion", asset.assetVersion()));
    }

    /**
     * M5-004 waveform registration: stores the peaks integrity anchor as a reserved
     * rendition (peaks bytes never cross this service; see {@code upsertWaveform}).
     */
    @PostMapping("/assets/{assetId}/waveform")
    public Map<String, Object> waveform(
            @PathVariable String assetId,
            @Valid @RequestBody WaveformRequest request,
            Authentication authentication) {
        return Map.of("asset", commandService.upsertWaveform(
                assetId, request.peaks(), request.sampleCount(), request.durationMs(),
                request.extractor(), context(authentication)).safeView());
    }

    @ExceptionHandler(MediaOperationException.class)
    ResponseEntity<ProblemResponse> handleMediaException(MediaOperationException exception) {
        return ResponseEntity.status(exception.status())
                .body(new ProblemResponse(exception.code(), exception.getMessage(), exception.retryable()));
    }

    private static MediaAuthorizationContext context(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken jwtAuthentication)
                || !authentication.isAuthenticated()) {
            return MediaAuthorizationContext.anonymous();
        }
        MediaHttpPrincipals.VerifiedMediaPrincipal principal = MediaHttpPrincipals.requireJwt(authentication);
        Jwt jwt = jwtAuthentication.getToken();
        String phase = firstClaim(jwt, "phase");
        String consentClaim = firstClaim(jwt, "media_consent", "consent");
        boolean consent = "true".equalsIgnoreCase(consentClaim) || "granted".equalsIgnoreCase(consentClaim);
        boolean deviceTrusted = Boolean.TRUE.equals(jwt.getClaims().get("device_trusted"))
                || "true".equalsIgnoreCase(firstClaim(jwt, "device_trusted"));
        return MediaAuthorizationContext.verified(
                principal.subject(),
                principal.tenantId(),
                principal.roles(),
                principal.permissions(),
                phase == null ? "UNKNOWN" : phase,
                claimValues(jwt.getClaims().get("content_rights")),
                consent,
                deviceTrusted,
                "request-" + UUID.randomUUID());
    }

    private static String firstClaim(Jwt jwt, String... names) {
        for (String name : names) {
            String value = jwt.getClaimAsString(name);
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private static Set<String> claimValues(Object claim) {
        LinkedHashSet<String> values = new LinkedHashSet<>();
        if (claim instanceof Collection<?> collection) {
            for (Object value : collection) {
                if (value != null && !value.toString().isBlank()) {
                    values.add(value.toString());
                }
            }
        } else if (claim != null) {
            for (String value : claim.toString().split("[ ,]+")) {
                if (!value.isBlank()) {
                    values.add(value);
                }
            }
        }
        return values;
    }

    public record RegisterRequest(
            @NotBlank String assetId,
            @NotBlank String assetKey,
            @NotNull MediaKind kind,
            @NotBlank String mimeType,
            @NotBlank String storageProvider,
            @NotBlank String bucketName,
            @NotBlank String objectKey,
            String objectVersion,
            @NotBlank String checksumSha256,
            @Positive long sizeBytes,
            boolean supportsRange,
            @PositiveOrZero long chunkSizeBytes,
            @PositiveOrZero int partCount,
            @NotBlank String contentVersionId,
            @NotBlank String contentRole,
            String segmentId,
            @NotBlank String rightsId,
            @NotBlank String licenseCode,
            @NotNull MediaRightsStatus rightsStatus,
            @NotEmpty Set<String> permittedChannels,
            java.time.Instant rightsStartsAt,
            java.time.Instant rightsExpiresAt,
            boolean allowOffline,
            String authorizationEvidenceRef) {

        MediaAssetDraft toDraft() {
            return new MediaAssetDraft(
                    assetId, assetKey, kind, mimeType, storageProvider, bucketName, objectKey,
                    objectVersion, checksumSha256, sizeBytes, supportsRange, chunkSizeBytes, partCount,
                    new MediaContentReference(contentVersionId, contentRole, segmentId),
                    new MediaRightsReference(
                            rightsId, contentVersionId, licenseCode, rightsStatus, permittedChannels,
                            rightsStartsAt, rightsExpiresAt, allowOffline, authorizationEvidenceRef));
        }
    }

    public record ActivationRequest(@NotBlank String verifiedChecksumSha256, @Positive long verifiedSizeBytes) {
    }

    public record SignedUrlRequest(String channel, Long ttlSeconds) {

        MediaDeliveryChannel deliveryChannel() {
            return MediaDeliveryChannel.parse(channel);
        }

        Duration ttl() {
            return ttlSeconds == null || ttlSeconds <= 0 ? null : Duration.ofSeconds(ttlSeconds);
        }
    }

    public record TranscodingRequest(@NotNull TranscodingStatus status, String failureCode) {
    }

    public record RenditionRequest(
            @NotBlank String mimeType,
            String objectVersion,
            @NotBlank String checksumSha256,
            @Positive long sizeBytes,
            boolean supportsRange,
            @NotNull RenditionStatus status,
            String failureCode) {

        MediaRenditionDraft toDraft(String renditionKey) {
            return new MediaRenditionDraft(
                    renditionKey, mimeType, objectVersion, checksumSha256, sizeBytes,
                    supportsRange, status, failureCode);
        }
    }

    public record RevokeRequest(@NotBlank String reason) {
    }

    public record SubtitleRequest(
            @NotBlank String locale,
            @NotBlank String format,
            @NotBlank String checksumSha256,
            @Positive long sizeBytes) {
    }

    public record UploadUrlRequest(Long ttlSeconds) {
    }

    public record WaveformRequest(
            @NotNull java.util.List<Double> peaks,
            @Positive long sampleCount,
            @Positive long durationMs,
            String extractor) {
    }

    public record ProblemResponse(String code, String message, boolean retryable) {
    }
}
