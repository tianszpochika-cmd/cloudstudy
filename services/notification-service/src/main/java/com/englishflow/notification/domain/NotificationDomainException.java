package com.englishflow.notification.domain;

/** Safe domain error; messages never contain request payloads or raw media. */
public final class NotificationDomainException extends RuntimeException {

    public enum Code {
        INVALID_ARGUMENT,
        UNAUTHORIZED,
        FORBIDDEN,
        NOT_FOUND,
        IDEMPOTENCY_CONFLICT,
        VERSION_CONFLICT,
        SEQUENCE_CONFLICT,
        STORAGE_FULL,
        PERMISSION_DENIED,
        NETWORK_UNAVAILABLE,
        RETRY_EXHAUSTED,
        RECOVERY_NOT_ALLOWED,
        PAYLOAD_NOT_ALLOWED,
        TRUSTED_EVENT_REJECTED,
        CONSENT_REQUIRED,
        RETRY_NOT_DUE,
        TERMINAL_FAILURE,
        TEMPLATE_NOT_ALLOWED
    }

    private final Code code;

    public NotificationDomainException(Code code, String message) {
        super(message);
        this.code = code;
    }

    public Code code() {
        return code;
    }

    public static NotificationDomainException invalid(String message) {
        return new NotificationDomainException(Code.INVALID_ARGUMENT, message);
    }
}
