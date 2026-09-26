package com.englishflow.notification.domain;

import java.util.Optional;

/** Canonical notification preference categories from M1-016. */
public enum NotificationCategory {
    LEARNING,
    REVIEW,
    STREAK,
    EXAM,
    CHECKPOINT,
    STUDY_ROOM,
    REWARDS,
    COURSE,
    MEMBERSHIP,
    MARKETING,
    SECURITY,
    ACCOUNT,
    PAYMENT,
    SYSTEM;

    /**
     * Resolve the exact public path type to its canonical category. The purpose
     * aliases are intentionally explicit and case-sensitive.
     */
    public static Optional<NotificationCategory> fromPathType(String type) {
        if (type == null) return Optional.empty();
        return switch (type) {
            case "LEARNING" -> Optional.of(LEARNING);
            case "REVIEW" -> Optional.of(REVIEW);
            case "STREAK" -> Optional.of(STREAK);
            case "EXAM" -> Optional.of(EXAM);
            case "CHECKPOINT" -> Optional.of(CHECKPOINT);
            case "STUDY_ROOM" -> Optional.of(STUDY_ROOM);
            case "REWARDS" -> Optional.of(REWARDS);
            case "COURSE" -> Optional.of(COURSE);
            case "MEMBERSHIP" -> Optional.of(MEMBERSHIP);
            case "MARKETING" -> Optional.of(MARKETING);
            case "SECURITY" -> Optional.of(SECURITY);
            case "ACCOUNT" -> Optional.of(ACCOUNT);
            case "PAYMENT" -> Optional.of(PAYMENT);
            case "SYSTEM" -> Optional.of(SYSTEM);
            case "ACCOUNT_VERIFICATION", "PHONE_BINDING_CHANGE" -> Optional.of(ACCOUNT);
            case "SECURITY_ALERT" -> Optional.of(SECURITY);
            case "CRITICAL_ACCOUNT_PAYMENT" -> Optional.of(PAYMENT);
            default -> Optional.empty();
        };
    }

    /**
     * Map only explicitly supported historical producer names. Unknown older
     * message names do not inherit an enabled preference.
     */
    public static Optional<NotificationCategory> fromMessageType(String type) {
        Optional<NotificationCategory> canonical = fromPathType(type);
        if (canonical.isPresent()) return canonical;
        if (type == null) return Optional.empty();
        return switch (type) {
            case "assessment.result.ready" -> Optional.of(EXAM);
            case "learning.mastery.updated" -> Optional.of(LEARNING);
            case "learning.review.due" -> Optional.of(REVIEW);
            case "learning.recovery.required" -> Optional.of(LEARNING);
            case "sync.conflict.detected", "sync.recovered", "notification.recovery.completed" ->
                    Optional.of(SYSTEM);
            default -> Optional.empty();
        };
    }

    public static boolean isSmsPurposeType(String type) {
        return "ACCOUNT_VERIFICATION".equals(type)
                || "SECURITY_ALERT".equals(type)
                || "PHONE_BINDING_CHANGE".equals(type)
                || "CRITICAL_ACCOUNT_PAYMENT".equals(type);
    }
}
