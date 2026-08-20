package com.englishflow.modules.user;

/** Stable, non-sensitive error raised by the user module. */
public final class UserModuleException extends RuntimeException {

    private final String code;
    private final int httpStatus;
    private final boolean retryable;

    public UserModuleException(String code, String message, int httpStatus, boolean retryable) {
        super(message);
        this.code = code;
        this.httpStatus = httpStatus;
        this.retryable = retryable;
    }

    public String code() {
        return code;
    }

    public int httpStatus() {
        return httpStatus;
    }

    public boolean retryable() {
        return retryable;
    }
}
