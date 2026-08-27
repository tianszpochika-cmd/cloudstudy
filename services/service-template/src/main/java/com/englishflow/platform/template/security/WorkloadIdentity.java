package com.englishflow.platform.template.security;

import java.util.Optional;

import jakarta.servlet.http.HttpServletRequest;

/** Verified service caller derived from an mTLS client certificate, never from an HTTP header. */
public record WorkloadIdentity(String callerId, String subject, String certificateSerial) {

    public static final String REQUEST_ATTRIBUTE = WorkloadIdentity.class.getName() + ".verified";

    public WorkloadIdentity {
        requireText(callerId, "callerId");
        requireText(subject, "subject");
        requireText(certificateSerial, "certificateSerial");
    }

    public static Optional<WorkloadIdentity> from(HttpServletRequest request) {
        if (request == null) {
            return Optional.empty();
        }
        Object value = request.getAttribute(REQUEST_ATTRIBUTE);
        return value instanceof WorkloadIdentity identity
                ? Optional.of(identity) : Optional.empty();
    }

    private static void requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
    }
}
