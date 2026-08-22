package com.englishflow.platform.template.security;

/** Stable JSON error body; HTTP status remains the authentication/authorization distinction. */
public record SecurityErrorEnvelope(String code, String message, String requestId) {
}
