package com.englishflow.gamification.adapter.http;

import com.englishflow.gamification.application.GamificationAccessPolicy;
import com.englishflow.gamification.domain.GamificationDomainException;
import com.englishflow.gamification.domain.TrustedCompletionEvent;
import java.util.Set;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.stream.Collectors;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/** Converts only verified JWT facts into user or trusted-service principals. */
@Component
public final class GamificationPrincipalResolver {

    private static final String READ_PERMISSION = "gamification.read";
    private static final String CLAIM_PERMISSION = "gamification.rewards.claim";
    private static final String EVENT_PERMISSION = "gamification.events.consume";

    private final GamificationAccessPolicy access;

    public GamificationPrincipalResolver(GamificationAccessPolicy access) {
        this.access = access;
    }

    public String requireUser(Authentication authentication) {
        JwtAuthenticationToken jwt = requireJwt(authentication);
        Set<String> authorities = authorities(jwt);
        access.requirePermission(authorities, READ_PERMISSION);
        String subject = jwt.getToken().getSubject();
        if (subject == null || subject.isBlank()) {
            throw GamificationDomainException.unauthorized();
        }
        return subject;
    }

    public String requireRewardClaimer(Authentication authentication) {
        JwtAuthenticationToken jwt = requireJwt(authentication);
        Set<String> authorities = authorities(jwt);
        access.requirePermission(authorities, CLAIM_PERMISSION);
        String subject = jwt.getToken().getSubject();
        if (subject == null || subject.isBlank()) {
            throw GamificationDomainException.unauthorized();
        }
        return subject;
    }

    public String requireTrustedEventConsumer(Authentication authentication) {
        JwtAuthenticationToken jwt = requireJwt(authentication);
        access.requirePermission(authorities(jwt), EVENT_PERMISSION);
        Object source = jwt.getToken().getClaims().get("source_service");
        if (!(source instanceof String sourceService)
                || !TrustedCompletionEvent.isAllowlistedSource(sourceService)) {
            throw GamificationDomainException.forbidden();
        }
        return sourceService;
    }

    private static JwtAuthenticationToken requireJwt(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken
                || !(authentication instanceof JwtAuthenticationToken jwt)) {
            throw GamificationDomainException.unauthorized();
        }
        return jwt;
    }

    private static Set<String> authorities(JwtAuthenticationToken jwt) {
        Set<String> authorities = jwt.getAuthorities().stream().map(GrantedAuthority::getAuthority)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        addClaimValues(authorities, jwt.getToken().getClaims().get("permissions"));
        return Set.copyOf(authorities);
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
}
