package com.englishflow.modules.auth;

import java.util.EnumSet;

/** Explicit transition rules for device sessions and refresh token families. */
public final class AuthStateMachine {

    private AuthStateMachine() {
    }

    public enum SessionTransition {
        REVOKE,
        KICK,
        EXPIRE
    }

    public static SessionStatus transition(SessionStatus current, SessionTransition transition) {
        if (current == null || transition == null) {
            throw new IllegalArgumentException("state transition is required");
        }
        if (current == SessionStatus.REVOKED || current == SessionStatus.KICKED || current == SessionStatus.EXPIRED) {
            return current;
        }
        return switch (transition) {
            case REVOKE -> SessionStatus.REVOKED;
            case KICK -> SessionStatus.KICKED;
            case EXPIRE -> SessionStatus.EXPIRED;
        };
    }

    public static TokenFamilyStatus revokeFamily(TokenFamilyStatus current, boolean reuseDetected) {
        if (current == TokenFamilyStatus.REUSE_DETECTED) return current;
        if (reuseDetected) return TokenFamilyStatus.REUSE_DETECTED;
        if (current == TokenFamilyStatus.EXPIRED) return current;
        return TokenFamilyStatus.REVOKED;
    }

    public static TokenFamilyStatus expireFamily(TokenFamilyStatus current) {
        if (current == TokenFamilyStatus.REUSE_DETECTED || current == TokenFamilyStatus.REVOKED) {
            return current;
        }
        return TokenFamilyStatus.EXPIRED;
    }

    public static boolean isTerminal(SessionStatus status) {
        return EnumSet.of(SessionStatus.REVOKED, SessionStatus.KICKED, SessionStatus.EXPIRED).contains(status);
    }
}
