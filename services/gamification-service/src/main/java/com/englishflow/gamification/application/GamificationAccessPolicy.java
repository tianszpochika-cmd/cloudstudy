package com.englishflow.gamification.application;

import com.englishflow.gamification.domain.GamificationDomainException;
import java.util.Set;

/** Resource-owner PEP: owner is always the verified JWT subject, never request data. */
public final class GamificationAccessPolicy {

    public void requireSelf(String verifiedSubject, String resourceOwner) {
        if (verifiedSubject == null || resourceOwner == null || !verifiedSubject.equals(resourceOwner)) {
            throw GamificationDomainException.forbidden();
        }
    }

    public void requirePermission(Set<String> authorities, String permission) {
        if (authorities == null || authorities.stream().noneMatch(value -> hasPermission(value, permission))) {
            throw GamificationDomainException.forbidden();
        }
    }

    private static boolean hasPermission(String authority, String permission) {
        return authority.equals(permission)
                || authority.equals("PERM_" + permission)
                || authority.equals("SCOPE_" + permission);
    }
}
