package com.englishflow.adminops.risk;

import java.time.Instant;

/** One IAM lockout fact for the ACCOUNT_LOCKOUT rule. Opaque ref only. */
public record LockedAccount(String subjectRef, int failedAttempts, Instant lockedUntil, Instant updatedAt) {
}
