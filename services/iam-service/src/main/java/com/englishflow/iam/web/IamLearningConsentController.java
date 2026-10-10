package com.englishflow.iam.web;

import com.englishflow.iam.domain.ConsentService;
import com.englishflow.iam.domain.PrincipalId;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Current learning-consent fact for a trusted PEP. The answer is read from the consent store,
 * never from the caller's JWT claims, so a previously issued GRANTED access token cannot keep a
 * withdrawn learning capability open.
 */
@RestController
@RequestMapping("/internal/v1/iam/principals/{principalId}/learning-consent")
public final class IamLearningConsentController {

    static final String READ_PERMISSION = "iam.consent.read";

    private final ConsentService consents;

    public IamLearningConsentController(ConsentService consents) {
        this.consents = Objects.requireNonNull(consents, "consents");
    }

    @GetMapping
    public Map<String, Object> current(@PathVariable String principalId, Authentication authentication) {
        requireReader(authentication);
        PrincipalId principal = parsePrincipal(principalId);
        boolean granted = consents.hasRequiredConsentFor(principal, "LEARNING");
        return snapshot(principal.toString(), granted);
    }

    static Map<String, Object> snapshot(String principalId, boolean granted) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("principalId", principalId);
        data.put("learningConsent", granted ? "GRANTED" : "WITHDRAWN");
        data.put("learningAccess", granted ? "ELIGIBLE" : "RESTRICTED");
        return Map.of("data", data);
    }

    static void requireReader(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken token) || !token.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "service token is required");
        }
        boolean service = token.getAuthorities().stream()
                .anyMatch(authority -> "TOKEN_TYPE_service".equals(authority.getAuthority()))
                || "service".equals(token.getToken().getClaimAsString("token_type"));
        if (!service || !hasPermission(token.getToken(), READ_PERMISSION)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "iam.consent.read is required");
        }
    }

    static boolean hasPermission(Jwt jwt, String permission) {
        Object claim = jwt.getClaims().get("permissions");
        if (claim instanceof Iterable<?> values) {
            for (Object value : values) {
                if (permission.equals(value)) return true;
            }
        }
        String scope = jwt.getClaimAsString("scope");
        if (scope == null) return false;
        for (String value : scope.split(" ")) {
            if (permission.equals(value)) return true;
        }
        return false;
    }

    private static PrincipalId parsePrincipal(String principalId) {
        try {
            return new PrincipalId(java.util.UUID.fromString(principalId));
        } catch (RuntimeException invalid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "principal id is invalid");
        }
    }
}
