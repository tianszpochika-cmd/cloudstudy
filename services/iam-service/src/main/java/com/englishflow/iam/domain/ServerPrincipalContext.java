package com.englishflow.iam.domain;

import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/**
 * A server-created authorization context. Roles here are assigned by a trusted IAM policy
 * source; they are not copied from request headers or client JSON.
 */
public record ServerPrincipalContext(TenantScope scope, Set<String> serverRoles) {

    public ServerPrincipalContext {
        Objects.requireNonNull(scope, "scope");
        serverRoles = serverRoles == null
                ? Set.of()
                : Set.copyOf(new LinkedHashSet<>(serverRoles));
    }

    public static ServerPrincipalContext forPlatform(PrincipalId principalId, Set<String> serverRoles) {
        return new ServerPrincipalContext(TenantScope.derive(principalId), serverRoles);
    }

    public PrincipalId principalId() {
        return scope.subject();
    }

    public void rejectClientAuthority(ClientAuthorityClaims claims) {
        scope.rejectClientAuthority(claims);
    }
}
