package com.englishflow.adminops.support;

import com.englishflow.adminops.domain.AdminPrincipal;

/**
 * Authorization seam to media-service. Admin-ops accepts only a typed reference; media ownership
 * and tenant visibility remain facts of media-service and are never copied here.
 */
public interface MediaObjectAuthorizationPort {

    void requireReadable(AdminPrincipal principal, MediaObjectRef mediaObject);
}
