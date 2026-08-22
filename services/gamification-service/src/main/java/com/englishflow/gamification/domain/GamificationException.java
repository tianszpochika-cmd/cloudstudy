package com.englishflow.gamification.domain;

/** Error with an explicit transport decision; callers must not turn deny into an empty result. */
public final class GamificationException extends RuntimeException {

    private final String code;
    private final int status;
    private final boolean retryable;

    public GamificationException(String code, String message, int status, boolean retryable) {
        super(message);
        this.code = code;
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

    public static GamificationException badRequest(String code, String message) {
        return new GamificationException(code, message, 400, false);
    }

    public static GamificationException unauthenticated() {
        return new GamificationException("UNAUTHENTICATED", "authentication is required", 401, false);
    }

    public static GamificationException forbidden(String message) {
        return new GamificationException("FORBIDDEN", message, 403, false);
    }

    public static GamificationException notFound(String code, String message) {
        return new GamificationException(code, message, 404, false);
    }

    public static GamificationException conflict(String code, String message) {
        return new GamificationException(code, message, 409, false);
    }
}
