package com.englishflow.platform.template.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Internal deterministic decision-id derivation; callers cannot submit a decision id. */
final class DecisionId {

    private DecisionId() {
    }

    static String derive(
            AuthorizationContext context,
            PolicyVersion policyVersion,
            DecisionEffect effect,
            DecisionReason reason,
            Instant evaluatedAt) {
        List<String> rights = new ArrayList<>(context == null ? List.of() : context.requiredContentRights());
        Collections.sort(rights);
        String canonical = String.join("\u001f",
                "b8-pep-v1",
                context == null ? "" : context.subjectId(),
                context == null ? "" : context.principal().claims().tokenId(),
                context == null ? "" : context.tenantScopeId(),
                context == null ? "" : safe(context.action()),
                context == null ? "" : safe(context.resourceType()),
                context == null ? "" : safe(context.resourceId()),
                context == null ? "" : safe(context.resourceTenantId()),
                context == null ? "" : safe(context.resourceOwnerId()),
                context == null ? "" : safe(context.resourcePhase()),
                String.join(",", rights),
                context == null ? "" : String.valueOf(context.resourceConsent()),
                policyVersion == null ? "" : policyVersion.value(),
                effect.name(),
                reason.name(),
                evaluatedAt.toString());
        return "dec_" + sha256(canonical);
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(bytes.length * 2);
            for (byte item : bytes) {
                result.append(Character.forDigit((item >>> 4) & 0x0f, 16));
                result.append(Character.forDigit(item & 0x0f, 16));
            }
            return result.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required by the runtime", exception);
        }
    }
}
