package com.englishflow.media.domain;

/** Stable domain error mapped by the HTTP adapter without exposing storage details. */
public final class MediaOperationException extends RuntimeException {

    private final String code;
    private final int status;
    private final boolean retryable;

    public MediaOperationException(String code, String message, int status, boolean retryable) {
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

    public static MediaOperationException badRequest(String code, String message) {
        return new MediaOperationException(code, message, 400, false);
    }

    public static MediaOperationException unauthorized(String code, String message) {
        return new MediaOperationException(code, message, 401, false);
    }

    public static MediaOperationException forbidden(String code, String message) {
        return new MediaOperationException(code, message, 403, false);
    }

    public static MediaOperationException notFound(String code, String message) {
        return new MediaOperationException(code, message, 404, false);
    }

    public static MediaOperationException gone(String code, String message) {
        return new MediaOperationException(code, message, 410, false);
    }

    public static MediaOperationException rangeNotSatisfiable(String code, String message) {
        return new MediaOperationException(code, message, 416, false);
    }

    public static MediaOperationException conflict(String code, String message) {
        return new MediaOperationException(code, message, 409, false);
    }

    public static MediaOperationException unavailable(String code, String message) {
        return new MediaOperationException(code, message, 503, true);
    }
}
