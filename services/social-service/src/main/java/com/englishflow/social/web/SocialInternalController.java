package com.englishflow.social.web;

import java.util.Map;

import com.englishflow.social.domain.SocialService;
import com.englishflow.social.domain.TrustedSocialEvent;
import com.englishflow.social.security.SocialPrincipal;

/**
 * Non-mapped compatibility seam for callers that used the pre-B12 internal adapter.
 * HTTP exposure is intentionally split into TrustedEventController and ModerationController
 * so each boundary has one explicit contract and there are no duplicate mappings.
 */
public final class SocialInternalController {

    private final SocialService service;

    public SocialInternalController(SocialService service) {
        this.service = service;
    }

    public Map<String, Object> trustedEvent(SocialPrincipal source, TrustedSocialEvent event) {
        return service.consumeTrustedEvent(source, event);
    }

    public Map<String, Object> transitionReport(
            SocialPrincipal moderator, String reportId, Map<String, Object> body, String idempotencyKey) {
        return service.moderate(moderator, reportId, body, idempotencyKey);
    }
}
