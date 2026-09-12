package com.englishflow.adminops.security;

/** Dynamic policy decision. An unknown revocation state is never treated as not-revoked. */
public record PdpDecision(
        boolean allowed,
        String policyVersion,
        RevocationStatus revocation,
        String reason) {

    public enum RevocationStatus {
        CONFIRMED_NOT_REVOKED,
        REVOKED,
        UNKNOWN
    }

    public static PdpDecision denied(String reason) {
        return new PdpDecision(false, null, RevocationStatus.UNKNOWN, reason);
    }
}
