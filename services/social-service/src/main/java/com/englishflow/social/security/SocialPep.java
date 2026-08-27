package com.englishflow.social.security;

import com.englishflow.social.domain.SocialException;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Small service-side PEP. It validates verified identity facts first, then resource tenant,
 * owner and permission facts. Missing facts always deny instead of becoming an empty result.
 */
@Component
public final class SocialPep {

    public static final String ROOM_READ = "social.room.read";
    public static final String ROOM_JOIN = "social.room.join";
    public static final String ROOM_MEMBER_READ = "social.room.member.read";
    public static final String ROOM_WRITE = "social.room.write";
    public static final String FOCUS_WRITE = "social.focus.write";
    public static final String INTERACTION_SEND = "social.interaction.send";
    public static final String LEADERBOARD_READ = "social.leaderboard.read";
    public static final String REPORT_CREATE = "social.report.create";
    public static final String REPORT_READ = "social.report.read";
    public static final String VISIBILITY_WRITE = "social.visibility.write";
    public static final String MODERATION_REVIEW = "social.moderation.review";
    public static final String EVENTS_CONSUME = "social.events.consume";

    public void requireIdentity(SocialPrincipal principal) {
        if (principal == null) {
            throw SocialException.unauthorized();
        }
        if (!principal.isUsablePhaseOne()) {
            throw SocialException.forbidden("SOCIAL_PRINCIPAL_INACTIVE", "verified principal is not active for Phase 1");
        }
    }

    public void requirePermission(SocialPrincipal principal, String permission) {
        requireIdentity(principal);
        if (permission == null || permission.isBlank() || !principal.hasPermission(permission)) {
            throw SocialException.forbidden("SOCIAL_PERMISSION_DENIED", "social permission is required");
        }
    }

    public void requireAnyPermission(SocialPrincipal principal, Set<String> permissions) {
        requireIdentity(principal);
        if (permissions == null || permissions.isEmpty()
                || permissions.stream().noneMatch(principal::hasPermission)) {
            throw SocialException.forbidden("SOCIAL_PERMISSION_DENIED", "one of the social admin permissions is required");
        }
    }

    public void requireTenant(SocialPrincipal principal, String resourceTenantId) {
        requireIdentity(principal);
        if (resourceTenantId == null || resourceTenantId.isBlank()
                || !resourceTenantId.equals(principal.tenantId())) {
            throw SocialException.forbidden("SOCIAL_TENANT_FORBIDDEN", "resource is outside the verified tenant scope");
        }
    }

    public void requireOwner(SocialPrincipal principal, String resourceTenantId, String resourceOwnerId,
                             String permission) {
        requirePermission(principal, permission);
        requireTenant(principal, resourceTenantId);
        if (resourceOwnerId == null || resourceOwnerId.isBlank()
                || !resourceOwnerId.equals(principal.subjectId())) {
            throw SocialException.forbidden("SOCIAL_OWNER_FORBIDDEN", "resource owner does not match the verified subject");
        }
    }
}
