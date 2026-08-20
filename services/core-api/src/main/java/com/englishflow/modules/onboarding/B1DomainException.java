package com.englishflow.modules.onboarding;

import org.springframework.http.HttpStatus;

public class B1DomainException extends RuntimeException {
    private final String errorCode;
    private final HttpStatus status;

    public B1DomainException(String errorCode, String message, HttpStatus status) {
        super(message);
        this.errorCode = errorCode;
        this.status = status;
    }

    public String errorCode() {
        return errorCode;
    }

    public HttpStatus status() {
        return status;
    }

    public static B1DomainException notFound(String message) {
        return new B1DomainException("NOT_FOUND", message, HttpStatus.NOT_FOUND);
    }

    public static B1DomainException conflict(String code, String message) {
        return new B1DomainException(code, message, HttpStatus.CONFLICT);
    }

    public static B1DomainException gone(String code, String message) {
        return new B1DomainException(code, message, HttpStatus.GONE);
    }
}
