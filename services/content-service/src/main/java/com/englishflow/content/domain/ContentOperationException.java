package com.englishflow.content.domain;

/** Stable domain error used by adapters to map validation, authorization and conflicts. */
public final class ContentOperationException extends RuntimeException {

    private final String code;
    private final int status;
    private final boolean retryable;

    public ContentOperationException(String code, String message, int status, boolean retryable) {
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

    public static ContentOperationException badRequest(String code, String message) {
        return new ContentOperationException(code, message, 400, false);
    }

    public static ContentOperationException forbidden(String code, String message) {
        return new ContentOperationException(code, message, 403, false);
    }

    public static ContentOperationException notFound(String code, String message) {
        return new ContentOperationException(code, message, 404, false);
    }

    public static ContentOperationException conflict(String code, String message) {
        return new ContentOperationException(code, message, 409, false);
    }

    public static ContentOperationException unavailable(String code, String message) {
        return new ContentOperationException(code, message, 503, true);
    }
}
