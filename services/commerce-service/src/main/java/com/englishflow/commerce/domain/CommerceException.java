package com.englishflow.commerce.domain;

/** Stable domain error envelope used by HTTP and non-HTTP adapters. */
public final class CommerceException extends RuntimeException {
    private final String code;
    private final int status;
    private final boolean retryable;

    public CommerceException(String code, String message, int status, boolean retryable) {
        super(message);
        this.code = code;
        this.status = status;
        this.retryable = retryable;
    }

    public String code() { return code; }
    public int status() { return status; }
    public boolean retryable() { return retryable; }

    public static CommerceException bad(String code, String message) { return new CommerceException(code, message, 400, false); }
    public static CommerceException unauthorized() { return new CommerceException("UNAUTHORIZED", "verified principal is required", 401, false); }
    public static CommerceException forbidden(String message) { return new CommerceException("FORBIDDEN", message, 403, false); }
    public static CommerceException notFound(String code, String message) { return new CommerceException(code, message, 404, false); }
    public static CommerceException conflict(String code, String message) { return new CommerceException(code, message, 409, false); }
    public static CommerceException unavailable(String code, String message) { return new CommerceException(code, message, 503, true); }
}
