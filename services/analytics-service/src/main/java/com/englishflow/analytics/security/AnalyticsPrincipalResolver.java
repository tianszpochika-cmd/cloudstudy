package com.englishflow.analytics.security;

import com.englishflow.analytics.domain.AnalyticsDomainException;
import com.englishflow.analytics.domain.AnalyticsErrorCode;
import com.englishflow.analytics.domain.AnalyticsEventAllowlist;
import com.englishflow.analytics.domain.TenantScope;
import java.util.Set;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.stream.Collectors;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/** Derives tenant/source/permission only from decoder-verified JWT claims. */
@Component
public final class AnalyticsPrincipalResolver {

    public AnalyticsCaller requireQueryCaller(Authentication authentication) {
        JwtAuthenticationToken jwt = requireJwt(authentication);
        requirePermission(jwt, "analytics.read");
        return caller(jwt, false);
    }

    public AnalyticsCaller requireRecomputeCaller(Authentication authentication) {
        JwtAuthenticationToken jwt = requireJwt(authentication);
        requirePermission(jwt, "analytics.recompute");
        return caller(jwt, false);
    }

    public AnalyticsCaller requireTrustedEventCaller(Authentication authentication) {
        JwtAuthenticationToken jwt = requireJwt(authentication);
        requirePermission(jwt, "analytics.events.consume");
        AnalyticsCaller caller = caller(jwt, true);
        if (caller.sourceService() == null || caller.sourceService().isBlank()
                || AnalyticsEventAllowlist.eventNames().stream()
                        .map(name -> AnalyticsEventAllowlist.definition(name).sourceService())
                        .noneMatch(caller.sourceService()::equals)) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.FORBIDDEN,
                    "verified source service is not allowed to publish analytics input");
        }
        return caller;
    }

    private static AnalyticsCaller caller(JwtAuthenticationToken jwt, boolean requireSource) {
        String subject = jwt.getToken().getSubject();
        String tenant = firstString(jwt, "tenant_id", "tenant");
        String source = firstString(jwt, "source_service", "client_id");
        if (subject == null || subject.isBlank() || tenant == null || tenant.isBlank()
                || (requireSource && (source == null || source.isBlank()))) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.UNAUTHENTICATED,
                    "verified JWT is missing required analytics identity facts");
        }
        if (Boolean.TRUE.equals(jwt.getToken().getClaims().get("revoked"))
                || "REVOKED".equals(jwt.getToken().getClaims().get("revocation_status"))
                || "SUSPENDED".equals(jwt.getToken().getClaims().get("account_status"))) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.FORBIDDEN,
                    "verified principal is not active");
        }
        return new AnalyticsCaller(new TenantScope(tenant), subject, source);
    }

    private static JwtAuthenticationToken requireJwt(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken
                || !(authentication instanceof JwtAuthenticationToken jwt)) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.UNAUTHENTICATED,
                    "verified JWT is required");
        }
        return jwt;
    }

    private static void requirePermission(JwtAuthenticationToken jwt, String permission) {
        Set<String> authorities = jwt.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        addClaimValues(authorities, jwt.getToken().getClaims().get("permissions"));
        if (!authorities.contains(permission) && !authorities.contains("PERM_" + permission)
                && !authorities.contains("SCOPE_" + permission) && !authorities.contains("ROLE_ANALYTICS_ADMIN")) {
            throw AnalyticsDomainException.rejected(AnalyticsErrorCode.FORBIDDEN,
                    "analytics permission is required");
        }
    }

    private static void addClaimValues(Set<String> target, Object value) {
        if (value instanceof Collection<?> values) {
            values.stream().filter(item -> item != null && !item.toString().isBlank())
                    .map(Object::toString).forEach(target::add);
        } else if (value != null) {
            for (String item : value.toString().split("[ ,]+")) {
                if (!item.isBlank()) target.add(item);
            }
        }
    }

    private static String firstString(JwtAuthenticationToken jwt, String... names) {
        for (String name : names) {
            String value = jwt.getToken().getClaimAsString(name);
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }
}
