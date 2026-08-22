package com.englishflow.adminops.adapter.memory;

import java.util.HashSet;
import java.util.Set;

import com.englishflow.adminops.domain.AdminOpsException;
import com.englishflow.adminops.domain.AdminPep;
import com.englishflow.adminops.domain.AdminPrincipal;
import com.englishflow.adminops.support.MediaObjectAuthorizationPort;
import com.englishflow.adminops.support.MediaObjectRef;

/**
 * Local-only authorization seam. It stores grants for smoke/local wiring, not media metadata or
 * bytes; production replaces it with a media-service authorization client.
 */
public final class InMemoryMediaObjectAuthorization implements MediaObjectAuthorizationPort {

    private final AdminPep pep = new AdminPep();
    private final Set<String> grants = new HashSet<>();

    public synchronized InMemoryMediaObjectAuthorization grant(
            String tenantId, String subjectId, MediaObjectRef mediaObject) {
        if (tenantId == null || tenantId.isBlank() || subjectId == null || subjectId.isBlank()) {
            throw AdminOpsException.invalid("SUPPORT_MEDIA_GRANT_INVALID", "media grant scope is incomplete");
        }
        grants.add(key(tenantId, subjectId, mediaObject));
        return this;
    }

    @Override
    public synchronized void requireReadable(AdminPrincipal principal, MediaObjectRef mediaObject) {
        pep.requireAuthenticated(principal);
        if (mediaObject == null
                || !grants.contains(key(principal.tenantId(), principal.subjectId(), mediaObject))) {
            throw AdminOpsException.forbidden(
                    "SUPPORT_ATTACHMENT_FORBIDDEN", "media reference is not readable in the current scope");
        }
    }

    private static String key(String tenantId, String subjectId, MediaObjectRef mediaObject) {
        if (mediaObject == null) {
            return tenantId + "|" + subjectId + "|<missing>";
        }
        return tenantId + "|" + subjectId + "|" + mediaObject.objectRef() + "|" + mediaObject.objectVersion();
    }
}
