package com.englishflow.notification.security;

/** Minimal dynamic-policy request; every field comes from verified server-side facts. */
public record PdpRequest(String subject, String tenant, String action) {
}
