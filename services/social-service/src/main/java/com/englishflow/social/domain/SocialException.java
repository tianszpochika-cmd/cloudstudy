package com.englishflow.social.domain;

import java.util.Objects;

/** Stable, transport-neutral social boundary error. */
public final class SocialException extends RuntimeException {

    private final String code;
    private final int status;
    private final boolean retryable;

    public SocialException(String code, String message, int status, boolean retryable) {
        super(Objects.requireNonNull(message, "message is required"));
        this.code = Objects.requireNonNull(code, "code is required");
        this.status = status;
        this.retryable = retryable;
    }

    public String code() {
        return code;
    }

    public int status() {
        return status;
    }

    public boolean retryable() {
        return retryable;
    }

    public static SocialException unauthorized() {
        return new SocialException("UNAUTHENTICATED", "authentication required", 401, false);
    }

    public static SocialException forbidden(String code, String message) {
        return new SocialException(code, message, 403, false);
    }

    public static SocialException notFound(String code, String message) {
        return new SocialException(code, message, 404, false);
    }

    public static SocialException conflict(String code, String message, boolean retryable) {
        return new SocialException(code, message, 409, retryable);
    }

    public static SocialException invalid(String code, String message) {
        return new SocialException(code, message, 400, false);
    }

    public static SocialException unprocessable(String code, String message) {
        return new SocialException(code, message, 422, false);
    }
}
