package com.englishflow.adminops.web;

import com.englishflow.adminops.domain.AdminPrincipal;
import com.englishflow.adminops.security.AdminOpsAuthenticationToken;
import org.springframework.security.core.Authentication;

/** Resolves only the authentication token produced by the verified resource-server adapter. */
public final class AdminOpsPrincipalResolver {

    private AdminOpsPrincipalResolver() {
    }

    public static AdminPrincipal resolve(Authentication authentication) {
        if (authentication instanceof AdminOpsAuthenticationToken token && token.isAuthenticated()) {
            return token.adminPrincipal();
        }
        return null;
    }
}
