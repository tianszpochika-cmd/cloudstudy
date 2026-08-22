package com.englishflow.platform.template.security;

/** Revocation must be positively known before a protected request is allowed. */
public enum RevocationStatus {
    CONFIRMED_ACTIVE,
    REVOKED,
    UNKNOWN
}
