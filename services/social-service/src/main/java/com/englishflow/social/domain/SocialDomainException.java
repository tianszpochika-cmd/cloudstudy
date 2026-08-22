package com.englishflow.social.domain;

/** Bounded domain error mapped to a stable HTTP error envelope. */
public final class SocialDomainException extends RuntimeException {

    private final String code;
    private final int status;
    private final boolean retryable;

    public SocialDomainException(String code, String message, int status, boolean retryable) {
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

    public static SocialDomainException unauthenticated() {
        return new SocialDomainException("UNAUTHENTICATED", "authentication required", 401, false);
    }

    public static SocialDomainException forbidden(String code, String message) {
        return new SocialDomainException(code, message, 403, false);
    }

    public static SocialDomainException notFound(String code, String message) {
        return new SocialDomainException(code, message, 404, false);
    }

    public static SocialDomainException conflict(String code, String message, boolean retryable) {
        return new SocialDomainException(code, message, 409, retryable);
    }

    public static SocialDomainException invalid(String code, String message) {
        return new SocialDomainException(code, message, 400, false);
    }

    public static SocialDomainException unprocessable(String code, String message) {
        return new SocialDomainException(code, message, 422, false);
    }
}
