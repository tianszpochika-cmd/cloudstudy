package com.englishflow.analytics.security;

/** Minimal dynamic-policy request; every field comes from verified server-side facts. */
public record PdpRequest(String subject, String tenant, String action) {
}
