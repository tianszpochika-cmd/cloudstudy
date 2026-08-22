package com.englishflow.gamification.application.security;

import com.englishflow.gamification.domain.GamificationException;
import com.englishflow.gamification.domain.TrustedCompletionEvent;

/** Default-deny PEP for the internal trusted-event boundary. */
public final class TrustedEventPep {

    public void requireAllowedCaller(TrustedEventCaller caller, TrustedCompletionEvent event) {
        if (caller == null || !caller.authenticated() || caller.sourceService() == null
                || caller.sourceService().isBlank()) {
            throw GamificationException.unauthenticated();
        }
        if (!caller.sourceService().equals(event.sourceService())) {
            throw GamificationException.forbidden("caller is not the event source service");
        }
    }
}
