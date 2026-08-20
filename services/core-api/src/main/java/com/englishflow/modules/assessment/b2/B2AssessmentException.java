package com.englishflow.modules.assessment.b2;

public final class B2AssessmentException extends RuntimeException {
    private final String code;
    private final int status;
    private final boolean retryable;

    public B2AssessmentException(String code, String message, int status, boolean retryable) {
        super(message);
        this.code = code;
        this.status = status;
        this.retryable = retryable;
    }

    public String code() { return code; }
    public int status() { return status; }
    public boolean retryable() { return retryable; }
}
