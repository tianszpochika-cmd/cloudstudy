package com.englishflow.gamification.application.security;

import com.englishflow.gamification.domain.GamificationException;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ResourceOwnerPolicyTest {

    private final AuthenticatedPrincipal principal = AuthenticatedPrincipal.authenticated("learner-1");

    @Test
    void ownerMustMatchTheVerifiedSubject() {
        assertEquals("learner-1", ResourceOwnerPolicy.requireSelf(principal, "learner-1"));
    }

    @Test
    void anotherSubjectCannotAccessTheResource() {
        assertThrows(GamificationException.class, () -> ResourceOwnerPolicy.requireSelf(principal, "learner-2"));
        assertThrows(GamificationException.class, () -> ResourceOwnerPolicy.requireSelf(principal, null));
    }

    @Test
    void unauthenticatedPrincipalIsRejected() {
        assertThrows(GamificationException.class, () -> ResourceOwnerPolicy.requireSelf(null, "learner-1"));
        assertThrows(GamificationException.class,
                () -> ResourceOwnerPolicy.requireSelf(new AuthenticatedPrincipal("learner-1", false), "learner-1"));
    }
}
