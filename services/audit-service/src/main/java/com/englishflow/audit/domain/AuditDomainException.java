package com.englishflow.audit.domain;

public final class AuditDomainException extends RuntimeException {

    private final String code;
    private final int status;

    private AuditDomainException(String code, String message, int status) {
        super(message);
        this.code = code;
        this.status = status;
    }

    public String code() { return code; }
    public int status() { return status; }

    public static AuditDomainException invalid(String message) {
        return new AuditDomainException("AUDIT_EVENT_INVALID", message, 400);
    }

    public static AuditDomainException forbidden(String message) {
        return new AuditDomainException("AUDIT_FORBIDDEN", message, 403);
    }

    public static AuditDomainException unavailable(String message) {
        return new AuditDomainException("AUDIT_UNAVAILABLE", message, 503);
    }
}
