package com.englishflow.gamification.application.security;

/** Principal produced by the verified authentication adapter; no client role/tenant fields. */
public record AuthenticatedPrincipal(String subject, boolean authenticated) {

    public AuthenticatedPrincipal {
        if (authenticated && (subject == null || subject.isBlank())) {
            throw new IllegalArgumentException("authenticated subject is required");
        }
    }

    public static AuthenticatedPrincipal authenticated(String subject) {
        return new AuthenticatedPrincipal(subject, true);
    }
}
