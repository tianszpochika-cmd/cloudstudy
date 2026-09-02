package com.englishflow.iam.domain;

import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/** Actor facts derived solely from a verified access JWT. */
public record PolicyActor(PrincipalId principalId, String tenantId, Set<String> permissions) {

    public PolicyActor {
        Objects.requireNonNull(principalId, "principalId");
        if (!TenantScope.PLATFORM_TENANT.equals(tenantId)) {
            throw new IamPolicyException(IamDecisionCode.CLIENT_TRUSTED_INPUT_REJECTED,
                    "iam.policy.tenant_not_server_derived");
        }
        LinkedHashSet<String> copy = new LinkedHashSet<>();
        if (permissions != null) {
            for (String permission : permissions) {
                if (permission == null || permission.isBlank() || permission.length() > 128
                        || permission.chars().anyMatch(Character::isWhitespace)) {
                    throw new IamPolicyException(IamDecisionCode.CLIENT_TRUSTED_INPUT_REJECTED,
                            "iam.policy.permissions_invalid");
                }
                copy.add(permission);
            }
        }
        permissions = Set.copyOf(copy);
    }

    public void require(String permission) {
        Objects.requireNonNull(permission, "permission");
        if (!permissions.contains(permission)) {
            throw new IamPolicyException(IamDecisionCode.POLICY_PERMISSION_DENIED,
                    "iam.policy.permission_denied");
        }
    }
}
