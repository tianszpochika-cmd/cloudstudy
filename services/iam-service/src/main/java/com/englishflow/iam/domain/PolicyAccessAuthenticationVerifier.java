package com.englishflow.iam.domain;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.time.Clock;
import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Re-checks current server-owned account and session facts before a high-impact policy
 * control-plane command. JWT validation authenticates the token; this verifier additionally
 * prevents a revoked session or permission-removal race from retaining policy authority until
 * access-token expiry.
 */
public final class PolicyAccessAuthenticationVerifier {
    private final AccountStore accounts;
    private final SessionService sessions;
    private final Clock clock;

    public PolicyAccessAuthenticationVerifier(AccountStore accounts, SessionService sessions, Clock clock) {
        this.accounts = Objects.requireNonNull(accounts, "accounts");
        this.sessions = Objects.requireNonNull(sessions, "sessions");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public PolicyActor verify(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken token)
                || !"access".equals(token.getToken().getClaimAsString("token_type"))
                || token.getAuthorities().stream().map(GrantedAuthority::getAuthority)
                .noneMatch("TOKEN_TYPE_access"::equals)) {
            throw invalidProfile();
        }
        try {
            Jwt jwt = token.getToken();
            PrincipalId principal = new PrincipalId(UUID.fromString(jwt.getSubject()));
            String tenant = jwt.getClaimAsString("tenant_id");
            UUID owner = UUID.fromString(jwt.getClaimAsString("owner_id"));
            SessionId sessionId = new SessionId(UUID.fromString(jwt.getClaimAsString("session_id")));
            if (!TenantScope.PLATFORM_TENANT.equals(tenant) || !principal.value().equals(owner)) throw invalidProfile();

            Set<String> claimedPermissions = strictStringClaims(jwt.getClaim("permissions"));
            Set<String> authorityPermissions = authorityPermissions(token.getAuthorities());
            Set<String> scopedPermissions = scopePermissions(jwt.getClaimAsString("scope"));
            if (!claimedPermissions.equals(authorityPermissions) || !claimedPermissions.equals(scopedPermissions)) {
                throw invalidProfile();
            }

            AccountRecord account = accounts.findByPrincipalId(principal).orElseThrow(this::revoked);
            if (account.status() != AccountStatus.ACTIVE) throw revoked();
            if (!account.permissions().equals(claimedPermissions)) {
                throw new IamPolicyException(IamDecisionCode.POLICY_PERMISSION_DENIED,
                        "iam.policy.permission_not_current");
            }
            SessionRecord session = currentSession(sessionId);
            if (!session.principalId().equals(principal) || !session.scope().owner().equals(principal)
                    || !TenantScope.PLATFORM_TENANT.equals(session.scope().tenantId())) {
                throw revoked();
            }
            return new PolicyActor(principal, tenant, account.permissions());
        } catch (IamPolicyException exception) {
            throw exception;
        } catch (IllegalArgumentException | ClassCastException exception) {
            throw invalidProfile();
        }
    }

    private SessionRecord currentSession(SessionId id) {
        try {
            SessionRecord session = sessions.find(id);
            if (session.status() != SessionStatus.ACTIVE || !session.expiresAt().isAfter(Instant.now(clock))) throw revoked();
            return session;
        } catch (IamPolicyException exception) {
            if (exception.code() == IamDecisionCode.SESSION_NOT_FOUND || exception.code() == IamDecisionCode.SESSION_EXPIRED
                    || exception.code() == IamDecisionCode.SESSION_REVOKED) {
                throw revoked();
            }
            throw exception;
        }
    }

    private static Set<String> strictStringClaims(Object raw) {
        if (!(raw instanceof Collection<?> values) || values.isEmpty()) throw invalidProfile();
        LinkedHashSet<String> result = new LinkedHashSet<>();
        for (Object value : values) {
            if (!(value instanceof String text) || !validPermission(text) || !result.add(text)) throw invalidProfile();
        }
        return Set.copyOf(result);
    }

    private static Set<String> authorityPermissions(Collection<? extends GrantedAuthority> authorities) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        for (GrantedAuthority authority : authorities) {
            String value = authority == null ? null : authority.getAuthority();
            if (value != null && value.startsWith("PERM_")) {
                String permission = value.substring("PERM_".length());
                if (!validPermission(permission) || !result.add(permission)) throw invalidProfile();
            }
        }
        return Set.copyOf(result);
    }

    private static Set<String> scopePermissions(String scope) {
        if (scope == null || scope.isBlank()) throw invalidProfile();
        LinkedHashSet<String> result = new LinkedHashSet<>();
        for (String permission : scope.split("\\s+")) {
            if (!validPermission(permission) || !result.add(permission)) throw invalidProfile();
        }
        return Set.copyOf(result);
    }

    private static boolean validPermission(String value) {
        return value != null && value.matches("[a-z][a-z0-9.-]{2,127}");
    }

    private IamPolicyException revoked() {
        return new IamPolicyException(IamDecisionCode.SESSION_REVOKED, "iam.policy.current_session_required");
    }

    private static IamPolicyException invalidProfile() {
        return new IamPolicyException(IamDecisionCode.JWT_TOKEN_TYPE_INVALID, "iam.jwt.access_profile_invalid");
    }
}
