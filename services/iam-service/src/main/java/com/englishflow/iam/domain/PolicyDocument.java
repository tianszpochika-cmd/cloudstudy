package com.englishflow.iam.domain;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * The intentionally small declarative P1 policy language. It has no executable expressions,
 * callbacks, client authority fields, or Phase 2/3 escape hatch.
 */
public record PolicyDocument(String name, String description, List<RoleBinding> roleBindings,
                             List<PolicyRule> rules) {
    private static final Pattern ROLE = Pattern.compile("[a-z][a-z0-9-]{1,63}");
    private static final Pattern PERMISSION = Pattern.compile("[a-z][a-z0-9.-]{2,127}");

    public PolicyDocument {
        requireText(name, 160, "policy name");
        if (description != null && (description.length() > 2000
                || description.chars().anyMatch(Character::isISOControl))) {
            throw invalid("iam.policy.document_invalid");
        }
        roleBindings = copy(roleBindings, "role bindings");
        rules = copy(rules, "policy rules");
        if (roleBindings.isEmpty() || rules.isEmpty()) throw invalid("iam.policy.document_invalid");
        Set<String> roles = new LinkedHashSet<>();
        for (RoleBinding binding : roleBindings) {
            if (!roles.add(binding.roleCode())) throw invalid("iam.policy.document_invalid");
        }
    }

    public record RoleBinding(String roleCode, List<String> permissions, String assignmentScope) {
        public RoleBinding {
            if (roleCode == null || !ROLE.matcher(roleCode).matches()
                    || !"SERVER_DERIVED_PLATFORM_TENANT".equals(assignmentScope)) {
                throw invalid("iam.policy.document_invalid");
            }
            permissions = copy(permissions, "role permissions");
            if (permissions.isEmpty()) throw invalid("iam.policy.document_invalid");
            Set<String> unique = new LinkedHashSet<>();
            for (String permission : permissions) {
                if (permission == null || !PERMISSION.matcher(permission).matches() || !unique.add(permission)) {
                    throw invalid("iam.policy.document_invalid");
                }
            }
        }
    }

    public record PolicyRule(String effect, List<String> requiredPermissions, List<String> actions,
                             List<String> resourceTypes, Conditions conditions) {
        public PolicyRule {
            if (!"ALLOW".equals(effect) && !"DENY".equals(effect)) {
                throw invalid("iam.policy.document_invalid");
            }
            requiredPermissions = copy(requiredPermissions, "required permissions");
            actions = copy(actions, "actions");
            resourceTypes = copy(resourceTypes, "resource types");
            if (requiredPermissions.isEmpty() || actions.isEmpty() || resourceTypes.isEmpty()) {
                throw invalid("iam.policy.document_invalid");
            }
            requirePermissions(requiredPermissions);
            requireTokens(actions);
            requireTokens(resourceTypes);
            Objects.requireNonNull(conditions, "conditions");
        }
    }

    public record Conditions(List<String> phases, Boolean requiresAdultEligibility,
                             List<String> requiredConsentPurposes, String minimumDeviceTrust,
                             List<String> contentRights, Boolean ownerMatchRequired,
                             Boolean tenantMatchRequired) {
        public Conditions {
            phases = copyNullable(phases, "phases");
            requiredConsentPurposes = copyNullable(requiredConsentPurposes, "consent purposes");
            contentRights = copyNullable(contentRights, "content rights");
            for (String phase : phases) {
                if (!"P1".equals(phase)) throw new IamPolicyException(IamDecisionCode.POLICY_PHASE_FORBIDDEN,
                        "iam.policy.phase_not_supported");
            }
            if (minimumDeviceTrust != null && !Set.of("REGISTERED", "VERIFIED").contains(minimumDeviceTrust)) {
                throw invalid("iam.policy.document_invalid");
            }
            Set<String> uniquePurposes = new LinkedHashSet<>();
            for (String purpose : requiredConsentPurposes) {
                if (!Set.of("ACCOUNT_TERMS", "PRIVACY_NOTICE", "ADULT_LEARNING_ELIGIBILITY",
                        "PRODUCT_ANALYTICS", "ADULT_VOICE_RECORDING_REMOTE_STORAGE_AND_REPLAY").contains(purpose)
                        || !uniquePurposes.add(purpose)) {
                    throw invalid("iam.policy.document_invalid");
                }
            }
            for (String right : contentRights) {
                if (!Set.of("VALID", "NOT_APPLICABLE").contains(right)) {
                    throw invalid("iam.policy.document_invalid");
                }
            }
        }
    }

    private static List<String> copyNullable(List<String> values, String field) {
        if (values == null) return List.of();
        return copy(values, field);
    }

    private static <T> List<T> copy(List<T> values, String field) {
        if (values == null) throw invalid("iam.policy.document_invalid");
        List<T> copy = List.copyOf(values);
        if (copy.stream().anyMatch(Objects::isNull)) throw invalid("iam.policy.document_invalid");
        return copy;
    }

    private static void requirePermissions(List<String> values) {
        Set<String> unique = new LinkedHashSet<>();
        for (String value : values) {
            if (!PERMISSION.matcher(value).matches() || !unique.add(value)) {
                throw invalid("iam.policy.document_invalid");
            }
        }
    }

    private static void requireTokens(List<String> values) {
        Set<String> unique = new LinkedHashSet<>();
        for (String value : values) {
            if (value == null || value.isBlank() || value.length() > 128
                    || value.chars().anyMatch(Character::isISOControl) || !unique.add(value)) {
                throw invalid("iam.policy.document_invalid");
            }
        }
    }

    private static void requireText(String value, int max, String field) {
        if (value == null || value.isBlank() || value.length() > max
                || value.chars().anyMatch(Character::isISOControl)) {
            throw invalid("iam.policy.document_invalid");
        }
    }

    private static IamPolicyException invalid(String key) {
        return new IamPolicyException(IamDecisionCode.POLICY_DOCUMENT_INVALID, key);
    }
}
