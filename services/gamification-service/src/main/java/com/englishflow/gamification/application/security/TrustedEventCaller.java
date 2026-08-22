package com.englishflow.gamification.application.security;

/** Service identity asserted by the verified internal ingress, not by event payload data. */
public record TrustedEventCaller(String sourceService, boolean authenticated) {
}
