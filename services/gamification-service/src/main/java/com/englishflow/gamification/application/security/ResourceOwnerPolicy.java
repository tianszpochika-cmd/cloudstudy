package com.englishflow.gamification.application.security;

import com.englishflow.gamification.domain.GamificationException;

/** Default-deny owner PEP for learner-facing facts. */
public final class ResourceOwnerPolicy {

    private ResourceOwnerPolicy() {
    }

    public static String requireSelf(AuthenticatedPrincipal principal, String resourceSubject) {
        if (principal == null || !principal.authenticated()) {
            throw GamificationException.unauthenticated();
        }
        if (resourceSubject == null || resourceSubject.isBlank()
                || !principal.subject().equals(resourceSubject)) {
            throw GamificationException.forbidden("resource is not owned by the authenticated subject");
        }
        return principal.subject();
    }

    public static void requireAuthenticated(AuthenticatedPrincipal principal) {
        if (principal == null || !principal.authenticated()) {
            throw GamificationException.unauthenticated();
        }
    }
}
