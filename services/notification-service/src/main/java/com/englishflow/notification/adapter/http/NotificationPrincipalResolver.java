package com.englishflow.notification.adapter.http;

import com.englishflow.notification.domain.NotificationDomainException;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

/** Converts only verified JWT facts into the application principal context. */
@Component
public final class NotificationPrincipalResolver {

    public NotificationPrincipalContext require(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken
                || !(authentication instanceof JwtAuthenticationToken jwt)) {
            throw new NotificationDomainException(NotificationDomainException.Code.UNAUTHORIZED,
                    "verified JWT principal is required");
        }
        String tenantId = claim(jwt, "tenant_id");
        String deviceId = claim(jwt, "device_id");
        String principalId = jwt.getToken().getSubject();
        Set<String> authorities = jwt.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toUnmodifiableSet());
        Set<String> permissions = authorities.stream()
                .map(value -> value.startsWith("PERM_") || value.startsWith("SCOPE_")
                        ? value.substring(value.indexOf('_') + 1) : value)
                .collect(Collectors.toCollection(HashSet::new));
        // Permissions are accepted only from provider-signed JWT claims.  The default
        // Spring converter exposes scope/role authorities, but the IAM JWT may
        // publish an explicit permissions array instead; clients cannot submit this claim.
        permissions.addAll(claimValues(jwt, "permissions"));
        return new NotificationPrincipalContext(tenantId, principalId, deviceId, authorities, permissions);
    }

    /** Service-to-service JWT path; device_id is optional because this is not a learner action. */
    public NotificationPrincipalContext requireTrustedEventCaller(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken
                || !(authentication instanceof JwtAuthenticationToken jwt)) {
            throw new NotificationDomainException(NotificationDomainException.Code.UNAUTHORIZED,
                    "verified service JWT principal is required");
        }
        String tenantId = claim(jwt, "tenant_id");
        String principalId = jwt.getToken().getSubject();
        if (principalId == null || principalId.isBlank()) {
            throw new NotificationDomainException(NotificationDomainException.Code.UNAUTHORIZED,
                    "verified service subject is missing");
        }
        String deviceId = optionalClaim(jwt, "device_id").orElse("service-" + principalId);
        Set<String> authorities = jwt.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toUnmodifiableSet());
        Set<String> permissions = authorities.stream()
                .map(value -> value.startsWith("PERM_") || value.startsWith("SCOPE_")
                        ? value.substring(value.indexOf('_') + 1) : value)
                .collect(Collectors.toCollection(HashSet::new));
        permissions.addAll(claimValues(jwt, "permissions"));
        return new NotificationPrincipalContext(tenantId, principalId, deviceId, authorities, permissions);
    }

    private static Set<String> claimValues(JwtAuthenticationToken authentication, String name) {
        Object raw = authentication.getToken().getClaims().get(name);
        if (raw instanceof Collection<?> values) {
            return values.stream().filter(String.class::isInstance).map(String.class::cast)
                    .filter(value -> !value.isBlank()).collect(Collectors.toUnmodifiableSet());
        }
        if (raw instanceof String value && !value.isBlank()) {
            return Set.of(value);
        }
        return Set.of();
    }

    private static String claim(JwtAuthenticationToken authentication, String name) {
        Object value = authentication.getToken().getClaims().get(name);
        if (!(value instanceof String string) || string.isBlank()) {
            throw new NotificationDomainException(NotificationDomainException.Code.UNAUTHORIZED,
                    "required principal claim is missing");
        }
        return string;
    }

    private static java.util.Optional<String> optionalClaim(JwtAuthenticationToken authentication, String name) {
        Object value = authentication.getToken().getClaims().get(name);
        return value instanceof String string && !string.isBlank()
                ? java.util.Optional.of(string) : java.util.Optional.empty();
    }
}
