package com.englishflow.modules.learning.b3;

public final class B3Exception extends RuntimeException {
    private final String code;
    private final int status;
    private final boolean retryable;

    public B3Exception(String code, String message, int status, boolean retryable) {
        super(message);
        this.code = code;
        this.status = status;
        this.retryable = retryable;
    }

    public String code() { return code; }
    public int status() { return status; }
    public boolean retryable() { return retryable; }
}
