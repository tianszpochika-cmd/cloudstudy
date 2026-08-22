package com.englishflow.content.domain;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Verified principal facts assembled by IAM/Gateway or a trusted service identity.
 *
 * <p>This type has no factory that accepts HTTP headers. Tenant, subject, roles and permissions
 * must be populated by a trusted adapter; command handlers reject missing facts by default.</p>
 */
public record ContentActor(
        String subjectId,
        String tenantId,
        Set<String> roles,
        Set<String> permissions,
        boolean servicePrincipal) {

    private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:-]{1,127}");

    public ContentActor {
        requireId(subjectId, "subjectId");
        requireId(tenantId, "tenantId");
        roles = immutableSet(roles);
        permissions = immutableSet(permissions);
    }

    public boolean hasRole(String role) {
        return role != null && roles.contains(role);
    }

    public boolean hasPermission(String permission) {
        return permission != null && permissions.contains(permission);
    }

    public boolean canEdit() {
        return hasRole("content-editor") || hasPermission("content:write");
    }

    public boolean canReviewFirst() {
        return hasRole("review-l1") || hasPermission("content:review:first");
    }

    public boolean canReviewFinal() {
        return hasRole("review-l2") || hasPermission("content:review:final");
    }

    public boolean canPublish() {
        return hasRole("content-publisher") || hasPermission("content:publish");
    }

    public boolean canReadAnswerRules() {
        return servicePrincipal && hasPermission("content:answer-rules:read");
    }

    private static Set<String> immutableSet(Set<String> values) {
        if (values == null || values.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<String> copy = new LinkedHashSet<>();
        for (String value : values) {
            if (value == null || value.isBlank() || value.length() > 128) {
                throw ContentOperationException.badRequest("ACTOR_FACT_INVALID", "actor authority fact is invalid");
            }
            copy.add(value);
        }
        return Collections.unmodifiableSet(copy);
    }

    private static void requireId(String value, String field) {
        Objects.requireNonNull(value, field + " is required");
        if (!SAFE_ID.matcher(value).matches()) {
            throw ContentOperationException.badRequest("ACTOR_FACT_INVALID", field + " has an unsafe format");
        }
    }
}
