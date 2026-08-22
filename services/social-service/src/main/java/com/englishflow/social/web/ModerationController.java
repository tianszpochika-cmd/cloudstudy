package com.englishflow.social.web;

import java.util.Map;

import com.englishflow.social.domain.SocialService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Privileged moderation state transition boundary; reviewer permission is checked in the PEP. */
@RestController
@RequestMapping("/internal/v1/social/moderation")
public final class ModerationController {

    private final SocialService socialService;

    public ModerationController(SocialService socialService) {
        this.socialService = socialService;
    }

    @PostMapping("/reports/{reportId}/decision")
    public Map<String, Object> decide(
            @PathVariable String reportId,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            HttpServletRequest request) {
        return SocialController.envelope(
                socialService.moderate(SocialController.principal(), reportId, body, idempotencyKey), request);
    }
}
