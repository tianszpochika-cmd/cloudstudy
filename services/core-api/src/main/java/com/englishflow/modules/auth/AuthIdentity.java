package com.englishflow.modules.auth;

import java.time.Instant;

/** Identity aggregate. Only a lookup hash is retained for phone login. */
public final class AuthIdentity {

    private final long userId;
    private final String userUuid;
    private final String phoneLookupHash;
    private final Instant createdAt;
    private final Instant adultConfirmedAt;
    private final Instant privacyConsentedAt;
    private final String privacyPolicyVersion;
    private volatile AuthIdentityStatus status;
    private volatile Instant updatedAt;
    private volatile Instant lastLoginAt;

    public AuthIdentity(
            long userId,
            String userUuid,
            String phoneLookupHash,
            AuthIdentityStatus status,
            Instant createdAt,
            Instant adultConfirmedAt,
            Instant privacyConsentedAt,
            String privacyPolicyVersion,
            Instant updatedAt,
            Instant lastLoginAt
    ) {
        this.userId = userId;
        this.userUuid = userUuid;
        this.phoneLookupHash = phoneLookupHash;
        this.status = status;
        this.createdAt = createdAt;
        this.adultConfirmedAt = adultConfirmedAt;
        this.privacyConsentedAt = privacyConsentedAt;
        this.privacyPolicyVersion = privacyPolicyVersion;
        this.updatedAt = updatedAt;
        this.lastLoginAt = lastLoginAt;
    }

    public long userId() {
        return userId;
    }

    public String userUuid() {
        return userUuid;
    }

    public String phoneLookupHash() {
        return phoneLookupHash;
    }

    public AuthIdentityStatus status() {
        return status;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public Instant adultConfirmedAt() {
        return adultConfirmedAt;
    }

    public Instant privacyConsentedAt() {
        return privacyConsentedAt;
    }

    public String privacyPolicyVersion() {
        return privacyPolicyVersion;
    }

    public Instant updatedAt() {
        return updatedAt;
    }

    public Instant lastLoginAt() {
        return lastLoginAt;
    }

    public void recordLogin(Instant at) {
        this.lastLoginAt = at;
        this.updatedAt = at;
    }

    public boolean hasPrivacyConsent() {
        return privacyConsentedAt != null && privacyPolicyVersion != null && !privacyPolicyVersion.isBlank();
    }

    public boolean isActive() {
        return status == AuthIdentityStatus.ACTIVE;
    }

    public void lock() {
        status = AuthIdentityStatus.LOCKED;
    }

    @Override
    public String toString() {
        return "AuthIdentity{" +
                "userId=" + userId +
                ", status=" + status +
                ", hasAdultConfirmation=" + (adultConfirmedAt != null) +
                ", hasPrivacyConsent=" + hasPrivacyConsent() +
                '}';
    }
}
