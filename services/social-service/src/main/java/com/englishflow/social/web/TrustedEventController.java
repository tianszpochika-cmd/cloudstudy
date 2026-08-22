package com.englishflow.social.web;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.Set;

import com.englishflow.social.domain.SocialException;
import com.englishflow.social.domain.SocialService;
import com.englishflow.social.domain.TrustedSocialEvent;
import com.englishflow.social.security.SocialPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Internal trusted-event consumer boundary; it is not a client sync endpoint. */
@RestController
@RequestMapping("/internal/v1/social")
public final class TrustedEventController {

    private static final Set<String> FIELDS = Set.of(
            "eventId", "traceId", "schemaVersion", "eventType", "sourceService",
            "subjectId", "occurredAt", "payload");

    private final SocialService socialService;

    public TrustedEventController(SocialService socialService) {
        this.socialService = socialService;
    }

    @PostMapping("/trusted-events")
    public Map<String, Object> consume(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        if (body == null) {
            throw SocialException.invalid("SOC_TRUSTED_EVENT_SCHEMA_INVALID", "event envelope is required");
        }
        for (String key : body.keySet()) {
            if (!FIELDS.contains(key)) {
                throw SocialException.unprocessable("SOC_TRUSTED_EVENT_SCHEMA_INVALID", "event envelope contains an unsupported field");
            }
        }
        String eventId = requiredString(body.get("eventId"), "eventId");
        String traceId = requiredString(body.get("traceId"), "traceId");
        String schemaVersion = requiredString(body.get("schemaVersion"), "schemaVersion");
        String eventType = requiredString(body.get("eventType"), "eventType");
        String sourceService = requiredString(body.get("sourceService"), "sourceService");
        String subjectId = requiredString(body.get("subjectId"), "subjectId");
        String occurredAtText = requiredString(body.get("occurredAt"), "occurredAt");
        Instant occurredAt;
        try {
            occurredAt = Instant.parse(occurredAtText);
        } catch (DateTimeParseException exception) {
            throw SocialException.unprocessable("SOC_TRUSTED_EVENT_SCHEMA_INVALID", "occurredAt must be ISO-8601");
        }
        if (!(body.get("payload") instanceof Map<?, ?> payload)) {
            throw SocialException.unprocessable("SOC_TRUSTED_EVENT_SCHEMA_INVALID", "payload must be an object");
        }
        SocialPrincipal caller = principal();
        if (caller == null) {
            throw SocialException.unauthorized();
        }
        // Tenant scope comes from the verified workload identity. It is never accepted from
        // the event body, so a producer cannot cross a tenant boundary by changing JSON.
        TrustedSocialEvent event = new TrustedSocialEvent(eventId, traceId, schemaVersion, eventType,
                sourceService, subjectId, caller.tenantId(), occurredAt, stringMap(payload));
        return SocialController.envelope(socialService.consumeTrustedEvent(caller, event), request);
    }

    private static SocialPrincipal principal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof com.englishflow.social.security.SocialAuthenticationToken token
                && token.isAuthenticated()) {
            return token.socialPrincipal();
        }
        return null;
    }

    private static String requiredString(Object value, String field) {
        if (!(value instanceof String string) || string.isBlank()) {
            throw SocialException.invalid("SOC_TRUSTED_EVENT_SCHEMA_INVALID", field + " is required");
        }
        return string;
    }

    private static Map<String, Object> stringMap(Map<?, ?> source) {
        Map<String, Object> result = new java.util.LinkedHashMap<>();
        source.forEach((key, value) -> result.put(String.valueOf(key), value));
        return result;
    }
}
