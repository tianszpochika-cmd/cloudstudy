package com.englishflow.assessment.domain;

/** Stable domain error; transport adapters map codes without leaking answer rules. */
public final class AssessmentDomainException extends RuntimeException {
    private static final long serialVersionUID = 1L;
    private final String code;
    private final boolean retryable;

    public AssessmentDomainException(String code, String message, boolean retryable) {
        super(message);
        if (code == null || !code.matches("[A-Z][A-Z0-9_.-]{2,63}")) throw new IllegalArgumentException("domain error code is invalid");
        this.code = code;
        this.retryable = retryable;
    }

    public String code() { return code; }
    public boolean retryable() { return retryable; }
    public static AssessmentDomainException forbidden(String message) { return new AssessmentDomainException("ASM_FORBIDDEN", message, false); }
    public static AssessmentDomainException notFound(String message) { return new AssessmentDomainException("ASM_NOT_FOUND", message, false); }
    public static AssessmentDomainException conflict(String code, String message) { return new AssessmentDomainException(code, message, false); }
    public static AssessmentDomainException invalid(String code, String message) { return new AssessmentDomainException(code, message, false); }
    public static AssessmentDomainException retryable(String code, String message) { return new AssessmentDomainException(code, message, true); }
}
