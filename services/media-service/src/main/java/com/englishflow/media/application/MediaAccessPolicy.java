package com.englishflow.media.application;

import com.englishflow.media.domain.MediaAsset;
import com.englishflow.media.domain.MediaAssetStatus;
import com.englishflow.media.domain.MediaAuthorizationContext;
import com.englishflow.media.domain.MediaDeliveryChannel;
import com.englishflow.media.domain.MediaOperationException;

import java.time.Instant;

/** Service-side PEP for media resources. Missing facts always produce an explicit deny. */
public final class MediaAccessPolicy {

    private MediaAccessPolicy() {
    }

    public static void requireWrite(MediaAuthorizationContext context) {
        requireAuthenticated(context);
        if (!context.hasAnyPermission("media:write", "media:asset:create", "media:admin")) {
            throw MediaOperationException.forbidden("MEDIA_WRITE_FORBIDDEN", "media write permission is required");
        }
    }

    public static void requireMutation(MediaAsset asset, MediaAuthorizationContext context) {
        requireWrite(context);
        requireTenant(asset, context);
        if (!asset.ownerId().equals(context.subjectId())
                && !context.hasAnyPermission("media:admin", "media:write:any")
                && !context.hasRole("media_admin")) {
            throw MediaOperationException.forbidden("MEDIA_OWNER_FORBIDDEN", "media owner or delegated write permission is required");
        }
    }

    public static void requireRead(
            MediaAsset asset,
            MediaAuthorizationContext context,
            MediaDeliveryChannel channel,
            Instant now) {
        requireAuthenticated(context);
        requireTenant(asset, context);
        if (context.phase().equalsIgnoreCase("UNKNOWN")) {
            throw MediaOperationException.forbidden("MEDIA_PHASE_UNKNOWN", "phase is required for media access");
        }
        if (!context.consentGranted()) {
            throw MediaOperationException.forbidden("MEDIA_CONSENT_REQUIRED", "media consent is required");
        }
        if (channel == MediaDeliveryChannel.DOWNLOAD || channel == MediaDeliveryChannel.OFFLINE) {
            if (!context.deviceTrusted()) {
                throw MediaOperationException.forbidden("MEDIA_DEVICE_UNTRUSTED", "trusted device is required for download");
            }
        }
        boolean readPermission = context.hasAnyPermission("media:read", "media:asset:read", "media:stream", "media:download", "media:read:any", "media:admin");
        if (!readPermission) {
            throw MediaOperationException.forbidden("MEDIA_READ_FORBIDDEN", "media read permission is required");
        }
        if ((channel == MediaDeliveryChannel.DOWNLOAD || channel == MediaDeliveryChannel.OFFLINE)
                && !context.hasAnyPermission("media:download", "media:asset:download", "media:read:any", "media:admin")) {
            throw MediaOperationException.forbidden("MEDIA_DOWNLOAD_FORBIDDEN", "media download permission is required");
        }
        if (!asset.ownerId().equals(context.subjectId())
                && !context.hasAnyPermission("media:read:any", "media:admin")
                && !context.hasRole("media_admin")
                && !context.hasContentRight(asset.rightsReference().rightsId())
                && !context.hasContentRight(asset.rightsReference().licenseCode())) {
            throw MediaOperationException.forbidden("MEDIA_OWNER_FORBIDDEN", "resource owner or content right is required");
        }
        if (!asset.rightsReference().allows(channel, now)) {
            throw MediaOperationException.forbidden("MEDIA_RIGHTS_DENIED", "media rights do not allow this delivery channel");
        }
        if (asset.status() == MediaAssetStatus.REVOKED || asset.status() == MediaAssetStatus.DELETED) {
            throw MediaOperationException.forbidden("MEDIA_REVOKED", "media asset has been revoked");
        }
    }

    public static void requireTenant(MediaAsset asset, MediaAuthorizationContext context) {
        if (!asset.tenantId().equals(context.tenantId())) {
            throw MediaOperationException.forbidden("MEDIA_TENANT_FORBIDDEN", "media tenant does not match principal tenant");
        }
    }

    private static void requireAuthenticated(MediaAuthorizationContext context) {
        if (context == null || !context.authenticated()
                || context.subjectId().equalsIgnoreCase("anonymous")
                || context.tenantId().equalsIgnoreCase("unknown")) {
            throw MediaOperationException.unauthorized("MEDIA_AUTHENTICATION_REQUIRED", "verified authentication is required");
        }
    }
}
