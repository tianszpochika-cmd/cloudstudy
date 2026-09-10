package com.englishflow.media.application;

import com.englishflow.media.domain.MediaAsset;
import com.englishflow.media.domain.MediaAssetStatus;
import com.englishflow.media.domain.MediaAuthorizationContext;
import com.englishflow.media.domain.MediaContentReference;
import com.englishflow.media.domain.MediaDeliveryChannel;
import com.englishflow.media.domain.MediaKind;
import com.englishflow.media.domain.MediaOperationException;
import com.englishflow.media.domain.MediaRightsReference;
import com.englishflow.media.domain.MediaRightsStatus;
import com.englishflow.media.domain.TranscodingStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Service-side PEP for media. Every missing fact must produce an explicit deny — never an
 * empty result — so the order and the code of each rejection are part of the contract.
 */
class MediaAccessPolicyTest {

    private static final String TENANT = "platform";
    private static final String OWNER = "prn_owner00000001";
    private static final String CHECKSUM = "a".repeat(64);
    private static final long SIZE = 1024L;
    private static final Instant NOW = Instant.parse("2026-09-10T00:00:00Z");
    private static final Instant START = NOW.minusSeconds(3600);
    private static final Instant EXPIRY = NOW.plusSeconds(3600);

    private static String codeOf(Throwable thrown) {
        assertThat(thrown).isInstanceOf(MediaOperationException.class);
        return ((MediaOperationException) thrown).code();
    }

    private static MediaRightsReference rights(MediaRightsStatus status, Set<String> channels, boolean allowOffline) {
        return new MediaRightsReference("rights-1", "cv-1", "LIC-1",
                status, channels, START, EXPIRY, allowOffline, "evidence-1");
    }

    private static MediaAsset asset(MediaAssetStatus status, MediaRightsReference rights) {
        return new MediaAsset("asset-1", TENANT, OWNER, "key-1", MediaKind.AUDIO, "audio/mpeg", "s3", "bucket-1",
                "objects/key-1", "v1", CHECKSUM, SIZE, true, 512, 2, status, TranscodingStatus.NOT_REQUIRED,
                new MediaContentReference("cv-1", "primary", null), rights, List.of(), 1, NOW, NOW);
    }

    private static MediaAsset activeAsset(Set<String> channels, boolean allowOffline) {
        return asset(MediaAssetStatus.ACTIVE, rights(MediaRightsStatus.ACTIVE, channels, allowOffline));
    }

    private static MediaAuthorizationContext ctx(String subject, String tenant, Set<String> permissions,
                                                 Set<String> roles, Set<String> contentRights,
                                                 String phase, boolean consent, boolean deviceTrusted) {
        return MediaAuthorizationContext.verified(subject, tenant, roles, permissions, phase, contentRights,
                consent, deviceTrusted, "req-0001");
    }

    private static MediaAuthorizationContext owner(Set<String> permissions) {
        return ctx(OWNER, TENANT, permissions, Set.of(), Set.of(), "phase-1", true, false);
    }

    // --- authentication ---

    @Test
    void anonymousContextIsUnauthenticated() {
        assertThatThrownBy(() -> MediaAccessPolicy.requireWrite(MediaAuthorizationContext.anonymous()))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("MEDIA_AUTHENTICATION_REQUIRED"));
    }

    @Test
    void nullContextIsUnauthenticated() {
        assertThatThrownBy(() -> MediaAccessPolicy.requireWrite(null))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("MEDIA_AUTHENTICATION_REQUIRED"));
    }

    @Test
    void anonymousSubjectOrUnknownTenantIsUnauthenticatedEvenWhenFlagIsTrue() {
        MediaAuthorizationContext spoofedSubject = ctx("anonymous", TENANT, Set.of("media:write"),
                Set.of(), Set.of(), "phase-1", true, false);
        MediaAuthorizationContext spoofedTenant = ctx(OWNER, "unknown", Set.of("media:write"),
                Set.of(), Set.of(), "phase-1", true, false);

        assertThatThrownBy(() -> MediaAccessPolicy.requireWrite(spoofedSubject))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("MEDIA_AUTHENTICATION_REQUIRED"));
        assertThatThrownBy(() -> MediaAccessPolicy.requireWrite(spoofedTenant))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("MEDIA_AUTHENTICATION_REQUIRED"));
    }

    // --- write ---

    @Test
    void writeWithoutPermissionIsForbidden() {
        assertThatThrownBy(() -> MediaAccessPolicy.requireWrite(owner(Set.of("media:read"))))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("MEDIA_WRITE_FORBIDDEN"));
    }

    @Test
    void writePermissionAnyAliasGrantsWrite() {
        assertThatCode(() -> MediaAccessPolicy.requireWrite(owner(Set.of("media:asset:create"))))
                .doesNotThrowAnyException();
        assertThatCode(() -> MediaAccessPolicy.requireWrite(owner(Set.of("media:admin"))))
                .doesNotThrowAnyException();
    }

    // --- mutation ---

    @Test
    void mutationByNonOwnerWithoutDelegationIsForbidden() {
        MediaAuthorizationContext other = ctx("prn_other0000000001", TENANT, Set.of("media:write"),
                Set.of(), Set.of(), "phase-1", true, false);

        assertThatThrownBy(() -> MediaAccessPolicy.requireMutation(activeAsset(Set.of("STREAM"), false), other))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("MEDIA_OWNER_FORBIDDEN"));
    }

    @Test
    void mutationByOwnerPasses() {
        assertThatCode(() -> MediaAccessPolicy.requireMutation(
                activeAsset(Set.of("STREAM"), false), owner(Set.of("media:write"))))
                .doesNotThrowAnyException();
    }

    @Test
    void mutationByDelegatedWriterOrDefaultAdminRolePasses() {
        MediaAsset asset = activeAsset(Set.of("STREAM"), false);
        MediaAuthorizationContext writeAny = ctx("prn_other0000000001", TENANT, Set.of("media:write", "media:write:any"),
                Set.of(), Set.of(), "phase-1", true, false);
        MediaAuthorizationContext roleAdmin = ctx("prn_other0000000001", TENANT, Set.of("media:write"),
                Set.of("media_admin"), Set.of(), "phase-1", true, false);

        assertThatCode(() -> MediaAccessPolicy.requireMutation(asset, writeAny)).doesNotThrowAnyException();
        assertThatCode(() -> MediaAccessPolicy.requireMutation(asset, roleAdmin)).doesNotThrowAnyException();
    }

    @Test
    void mutationAcrossTenantIsForbidden() {
        MediaAuthorizationContext otherTenant = ctx(OWNER, "other-tenant", Set.of("media:write"),
                Set.of(), Set.of(), "phase-1", true, false);

        assertThatThrownBy(() -> MediaAccessPolicy.requireMutation(activeAsset(Set.of("STREAM"), false), otherTenant))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("MEDIA_TENANT_FORBIDDEN"));
    }

    // --- read: ordered guards ---

    @Test
    void readAcrossTenantIsForbidden() {
        MediaAuthorizationContext otherTenant = ctx(OWNER, "other-tenant", Set.of("media:read"),
                Set.of(), Set.of(), "phase-1", true, false);

        assertThatThrownBy(() -> MediaAccessPolicy.requireRead(
                activeAsset(Set.of("STREAM"), false), otherTenant, MediaDeliveryChannel.STREAM, NOW))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("MEDIA_TENANT_FORBIDDEN"));
    }

    @Test
    void unknownPhaseIsForbidden() {
        MediaAuthorizationContext unknownPhase = ctx(OWNER, TENANT, Set.of("media:read"),
                Set.of(), Set.of(), "UNKNOWN", true, false);

        assertThatThrownBy(() -> MediaAccessPolicy.requireRead(
                activeAsset(Set.of("STREAM"), false), unknownPhase, MediaDeliveryChannel.STREAM, NOW))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("MEDIA_PHASE_UNKNOWN"));
    }

    @Test
    void readWithoutConsentIsForbidden() {
        MediaAuthorizationContext noConsent = ctx(OWNER, TENANT, Set.of("media:read"),
                Set.of(), Set.of(), "phase-1", false, false);

        assertThatThrownBy(() -> MediaAccessPolicy.requireRead(
                activeAsset(Set.of("STREAM"), false), noConsent, MediaDeliveryChannel.STREAM, NOW))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("MEDIA_CONSENT_REQUIRED"));
    }

    @Test
    void downloadOnUntrustedDeviceIsForbidden() {
        MediaAuthorizationContext untrusted = ctx(OWNER, TENANT, Set.of("media:read", "media:download"),
                Set.of(), Set.of(), "phase-1", true, false);

        assertThatThrownBy(() -> MediaAccessPolicy.requireRead(
                activeAsset(Set.of("DOWNLOAD"), false), untrusted, MediaDeliveryChannel.DOWNLOAD, NOW))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("MEDIA_DEVICE_UNTRUSTED"));
    }

    @Test
    void readWithoutReadPermissionIsForbidden() {
        assertThatThrownBy(() -> MediaAccessPolicy.requireRead(
                activeAsset(Set.of("STREAM"), false), owner(Set.of("media:write")),
                MediaDeliveryChannel.STREAM, NOW))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("MEDIA_READ_FORBIDDEN"));
    }

    @Test
    void downloadWithoutDownloadPermissionIsForbiddenEvenWithRead() {
        MediaAuthorizationContext readOnly = ctx(OWNER, TENANT, Set.of("media:read"),
                Set.of(), Set.of(), "phase-1", true, true);

        assertThatThrownBy(() -> MediaAccessPolicy.requireRead(
                activeAsset(Set.of("DOWNLOAD"), false), readOnly, MediaDeliveryChannel.DOWNLOAD, NOW))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("MEDIA_DOWNLOAD_FORBIDDEN"));
    }

    @Test
    void readByNonOwnerWithoutContentRightIsForbidden() {
        MediaAuthorizationContext other = ctx("prn_other0000000001", TENANT, Set.of("media:read"),
                Set.of(), Set.of("LIC-OTHER"), "phase-1", true, false);

        assertThatThrownBy(() -> MediaAccessPolicy.requireRead(
                activeAsset(Set.of("STREAM"), false), other, MediaDeliveryChannel.STREAM, NOW))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("MEDIA_OWNER_FORBIDDEN"));
    }

    @Test
    void rightsDeniedForChannelIsForbidden() {
        // principal may read and owns the asset, but the licence only permits PREVIEW
        assertThatThrownBy(() -> MediaAccessPolicy.requireRead(
                activeAsset(Set.of("PREVIEW"), false), owner(Set.of("media:read")),
                MediaDeliveryChannel.STREAM, NOW))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("MEDIA_RIGHTS_DENIED"));
    }

    @Test
    void revokedAssetIsForbidden() {
        MediaAsset revoked = asset(MediaAssetStatus.REVOKED, rights(MediaRightsStatus.ACTIVE, Set.of("STREAM"), false));

        assertThatThrownBy(() -> MediaAccessPolicy.requireRead(
                revoked, owner(Set.of("media:read")), MediaDeliveryChannel.STREAM, NOW))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("MEDIA_REVOKED"));
    }

    @Test
    void deletedAssetIsForbidden() {
        MediaAsset deleted = asset(MediaAssetStatus.DELETED, rights(MediaRightsStatus.ACTIVE, Set.of("STREAM"), false));

        assertThatThrownBy(() -> MediaAccessPolicy.requireRead(
                deleted, owner(Set.of("media:read")), MediaDeliveryChannel.STREAM, NOW))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("MEDIA_REVOKED"));
    }

    // --- read: success paths ---

    @Test
    void ownerWithReadPermissionMayStream() {
        assertThatCode(() -> MediaAccessPolicy.requireRead(
                activeAsset(Set.of("STREAM"), false), owner(Set.of("media:read")),
                MediaDeliveryChannel.STREAM, NOW))
                .doesNotThrowAnyException();
    }

    @Test
    void contentRightHolderWhoIsNotOwnerMayRead() {
        MediaAuthorizationContext licensee = ctx("prn_other0000000001", TENANT, Set.of("media:read"),
                Set.of(), Set.of("rights-1"), "phase-1", true, false);

        assertThatCode(() -> MediaAccessPolicy.requireRead(
                activeAsset(Set.of("STREAM"), false), licensee, MediaDeliveryChannel.STREAM, NOW))
                .doesNotThrowAnyException();
    }

    @Test
    void trustedDeviceWithDownloadPermissionMayDownload() {
        MediaAuthorizationContext trusted = ctx(OWNER, TENANT, Set.of("media:read", "media:download"),
                Set.of(), Set.of(), "phase-1", true, true);

        assertThatCode(() -> MediaAccessPolicy.requireRead(
                activeAsset(Set.of("DOWNLOAD"), false), trusted, MediaDeliveryChannel.DOWNLOAD, NOW))
                .doesNotThrowAnyException();
    }

    // --- tenant guard ---

    @Test
    void requireTenantOnlyChecksTenantAndDoesNotGateOnPermission() {
        assertThatCode(() -> MediaAccessPolicy.requireTenant(activeAsset(Set.of("STREAM"), false), owner(Set.of())))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> MediaAccessPolicy.requireTenant(
                activeAsset(Set.of("STREAM"), false),
                ctx(OWNER, "other-tenant", Set.of(), Set.of(), Set.of(), "phase-1", true, false)))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("MEDIA_TENANT_FORBIDDEN"));
    }
}
