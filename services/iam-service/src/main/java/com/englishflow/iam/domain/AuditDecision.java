package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Structured, replayable security decision. Only safe dimensions are accepted; token material,
 * temporary authentication material, code verifiers and secrets are rejected from the audit attribute map.
 */
public record AuditDecision(
        UUID decisionId,
        String decisionType,
        IamDecisionCode code,
        boolean allowed,
        PrincipalId principalId,
        String tenantId,
        Instant occurredAt,
        Set<String> factsCreated,
        Set<String> factsForbidden,
        Map<String, String> safeAttributes) {

    private static final Pattern KEY = Pattern.compile("[a-z][a-z0-9_.-]{0,63}");
    private static final Set<String> SECRET_WORDS = Set.of(
            "token", "secret", "password", "verifier", "authorization-code", "refresh");

    public AuditDecision {
        Objects.requireNonNull(decisionId, "decisionId");
        requireSafeText(decisionType, "decisionType");
        Objects.requireNonNull(code, "code");
        Objects.requireNonNull(principalId, "principalId");
        requireSafeText(tenantId, "tenantId");
        Objects.requireNonNull(occurredAt, "occurredAt");
        factsCreated = factsCreated == null ? Set.of() : Set.copyOf(factsCreated);
        factsForbidden = factsForbidden == null ? Set.of() : Set.copyOf(factsForbidden);
        validateFacts(factsCreated);
        validateFacts(factsForbidden);
        safeAttributes = safeAttributes == null ? Map.of() : Map.copyOf(new LinkedHashMap<>(safeAttributes));
        safeAttributes.forEach((key, value) -> {
            if (key == null || !KEY.matcher(key).matches() || containsSecretWord(key)
                    || value == null || value.chars().anyMatch(Character::isISOControl)
                    || containsSecretWord(value)) {
                throw new IllegalArgumentException("audit attributes must be safe and non-sensitive");
            }
        });
    }

    public static AuditDecision of(
            String decisionType,
            IamDecisionCode code,
            boolean allowed,
            TenantScope scope,
            Instant occurredAt,
            Set<String> factsCreated,
            Set<String> factsForbidden) {
        return new AuditDecision(
                UUID.randomUUID(),
                decisionType,
                code,
                allowed,
                scope.subject(),
                scope.tenantId(),
                occurredAt,
                factsCreated,
                factsForbidden,
                Map.of());
    }

    /**
     * Records an attempt that cannot be bound to a platform principal, such as a password-reset
     * request for an unknown identifier. The unresolved subject lets security monitoring
     * correlate denied attempts without storing the identifier.
     */
    public static AuditDecision unresolved(
            String decisionType,
            IamDecisionCode code,
            boolean allowed,
            Instant occurredAt) {
        return new AuditDecision(
                UUID.randomUUID(),
                decisionType,
                code,
                allowed,
                PrincipalId.unresolved(),
                TenantScope.PLATFORM_TENANT,
                occurredAt,
                Set.of(),
                Set.of(),
                Map.of());
    }

    private static void requireSafeText(String value, String name) {
        if (value == null || value.isBlank() || value.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException(name + " must be safe text");
        }
    }

    private static boolean containsSecretWord(String value) {
        String lower = value.toLowerCase(java.util.Locale.ROOT);
        return SECRET_WORDS.stream().anyMatch(lower::contains);
    }

    private static void validateFacts(Set<String> facts) {
        facts.forEach(fact -> {
            if (fact == null || !KEY.matcher(fact).matches() || containsSecretWord(fact)) {
                throw new IllegalArgumentException("audit facts must be safe non-sensitive identifiers");
            }
        });
    }
}
