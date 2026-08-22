package com.englishflow.gamification.domain;

/** Safe domain error; it never includes the rejected event payload. */
public final class GamificationDomainException extends RuntimeException {

    public enum Code {
        INVALID_ARGUMENT,
        INVALID_EVENT,
        UNTRUSTED_FIELD,
        UNAUTHORIZED,
        FORBIDDEN,
        NOT_FOUND,
        IDEMPOTENCY_CONFLICT,
        EVENT_CONFLICT,
        LEDGER_INVARIANT
    }

    private final Code code;

    public GamificationDomainException(Code code, String message) {
        super(message);
        this.code = code;
    }

    public Code code() {
        return code;
    }

    public static GamificationDomainException invalid(String message) {
        return new GamificationDomainException(Code.INVALID_ARGUMENT, message);
    }

    public static GamificationDomainException invalidEvent(String message) {
        return new GamificationDomainException(Code.INVALID_EVENT, message);
    }

    public static GamificationDomainException untrustedField(String message) {
        return new GamificationDomainException(Code.UNTRUSTED_FIELD, message);
    }

    public static GamificationDomainException unauthorized() {
        return new GamificationDomainException(Code.UNAUTHORIZED, "verified principal is required");
    }

    public static GamificationDomainException forbidden() {
        return new GamificationDomainException(Code.FORBIDDEN, "policy denied this operation");
    }

    public static GamificationDomainException notFound() {
        return new GamificationDomainException(Code.NOT_FOUND, "resource was not found");
    }
}
