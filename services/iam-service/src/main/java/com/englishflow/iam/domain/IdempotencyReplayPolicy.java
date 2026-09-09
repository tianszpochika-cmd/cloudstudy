package com.englishflow.iam.domain;

import java.util.Set;
import java.util.UUID;

/** Selects whether a completed request may restore an encrypted response snapshot. */
@FunctionalInterface
public interface IdempotencyReplayPolicy {

    ReplayMode modeFor(String normalizedScope);

    enum ReplayMode {
        /** Suitable for non-credential responses whose original representation is still valid. */
        ENCRYPTED_SNAPSHOT,
        /**
         * Never persist or restore a response snapshot. The replay callback must revalidate all
         * endpoint-required current security facts before rebuilding a response.
         */
        REQUIRE_CURRENT_FACTS_CALLBACK
    }

    /**
     * Fail-closed production policy. Unknown or malformed scopes must run their current-facts
     * callback. Only reviewed static response shapes and canonical policy-control mutation scopes
     * may restore an encrypted snapshot.
     */
    static IdempotencyReplayPolicy failClosedDefaults() {
        Set<String> staticSnapshotScopes = Set.of(
                "/api/v1/iam/adult-gate",
                "/api/v1/iam/consents");
        return scope -> staticSnapshotScopes.contains(scope) || isCanonicalPolicyMutation(scope)
                ? ReplayMode.ENCRYPTED_SNAPSHOT
                : ReplayMode.REQUIRE_CURRENT_FACTS_CALLBACK;
    }

    private static boolean isCanonicalPolicyMutation(String scope) {
        if (scope == null) return false;
        String[] segments = scope.split(":", -1);
        if (segments.length == 3 && "policy".equals(segments[0])
                && "create".equals(segments[1])) {
            return canonicalUuid(segments[2]);
        }
        return segments.length == 4 && "policy".equals(segments[0])
                && Set.of("update", "submit", "approve", "activate", "revoke")
                .contains(segments[1])
                && canonicalUuid(segments[2]) && canonicalUuid(segments[3]);
    }

    private static boolean canonicalUuid(String value) {
        try {
            return UUID.fromString(value).toString().equals(value);
        } catch (RuntimeException exception) {
            return false;
        }
    }
}
