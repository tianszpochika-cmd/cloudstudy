package com.englishflow.iam.web;

import com.englishflow.iam.auth.ServiceTokenService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Exchanges service client credentials for a short-lived service token (ADR-0016).
 *
 * <p>This path is the one exception to {@code /internal/v1/**} requiring a service token, because requiring one
 * to obtain one is a closed loop. It is reachable without a token and authenticates on the credentials in the
 * body instead, which is the same shape as {@code /api/v1/auth/login}: permitted by the filter chain, verified by
 * the controller, and refusing without saying which part of the credentials was wrong.
 */
@RestController
@RequestMapping("/internal/v1/iam")
public class IamServiceTokenController {

    private final ServiceTokenService serviceTokens;

    public IamServiceTokenController(ServiceTokenService serviceTokens) {
        this.serviceTokens = serviceTokens;
    }

    /** Issues a token, or refuses with 401 and no detail about why. */
    @PostMapping("/service-token")
    public ResponseEntity<Map<String, Object>> issue(@RequestBody ServiceTokenRequest request) {
        ServiceTokenService.IssuedServiceToken issued;
        try {
            issued = serviceTokens.issue(request.clientId(), request.clientSecret());
        } catch (ServiceTokenService.CredentialsRejected rejected) {
            // Deliberately no hint: distinguishing an unknown client from a wrong secret tells an attacker which
            // half of a guess was right.
            return ResponseEntity.status(401).body(Map.of("error", "invalid_client"));
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("accessToken", issued.value());
        body.put("tokenType", "service");
        body.put("serviceId", issued.serviceId());
        body.put("permissions", issued.permissions());
        body.put("issuedAt", issued.issuedAt().toString());
        body.put("expiresAt", issued.expiresAt().toString());
        // No refresh token by design: a service that needs another token asks again, so a leaked token expires
        // rather than renewing itself.
        body.put("expiresIn", java.time.Duration.between(issued.issuedAt(), issued.expiresAt()).toSeconds());
        return ResponseEntity.ok(body);
    }

    /** The request body. A record so the field names are the contract. */
    public record ServiceTokenRequest(String clientId, String clientSecret) {
    }
}
