package com.englishflow.analytics.domain;

/** Domain exception that deliberately carries no raw event payload or personal data. */
public final class AnalyticsDomainException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final AnalyticsErrorCode code;
    private final boolean retryable;

    public AnalyticsDomainException(AnalyticsErrorCode code, String message, boolean retryable) {
        super(message);
        this.code = code;
        this.retryable = retryable;
    }

    public AnalyticsErrorCode code() {
        return code;
    }

    public boolean retryable() {
        return retryable;
    }

    public static AnalyticsDomainException rejected(AnalyticsErrorCode code, String message) {
        return new AnalyticsDomainException(code, message, false);
    }

    public static AnalyticsDomainException transientFailure(AnalyticsErrorCode code, String message) {
        return new AnalyticsDomainException(code, message, true);
    }
}
