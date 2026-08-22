package com.englishflow.adminops.domain;

/** Stable, transport-neutral error for the admin and support boundary. */
public final class AdminOpsException extends RuntimeException {

    private final String code;
    private final int status;
    private final boolean retryable;

    public AdminOpsException(String code, String message, int status, boolean retryable) {
        super(message);
        this.code = code;
        this.status = status;
        this.retryable = retryable;
    }

    public String code() { return code; }
    public int status() { return status; }
    public boolean retryable() { return retryable; }

    public static AdminOpsException unauthenticated() {
        return new AdminOpsException("ADMIN_UNAUTHENTICATED", "verified principal is required", 401, false);
    }
    public static AdminOpsException forbidden(String code, String message) {
        return new AdminOpsException(code, message, 403, false);
    }
    public static AdminOpsException notFound(String code, String message) {
        return new AdminOpsException(code, message, 404, false);
    }
    public static AdminOpsException invalid(String code, String message) {
        return new AdminOpsException(code, message, 400, false);
    }
    public static AdminOpsException conflict(String code, String message) {
        return new AdminOpsException(code, message, 409, false);
    }
    public static AdminOpsException unprocessable(String code, String message) {
        return new AdminOpsException(code, message, 422, false);
    }
}
