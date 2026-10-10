package com.englishflow.learner.web;

import com.englishflow.learner.application.TargetPinService;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Owner-side target content pin for the plan wiring ("定级完成自动 pin 定级内容").
 *
 * <p>Only learning-service calls this after verifying the placement report;
 * the pin values are never accepted from an unverified source. The pin is
 * advisory routing metadata, not a trust root: plan creation re-verifies the
 * report, so a directly written pin can never smuggle an unverified version
 * into a plan. Pin writes never bump the profile version; goal content edits
 * clear the pin. Natural PUT idempotency: identical re-pin converges, re-pin
 * on a new placement overwrites.
 */
@RestController
@RequestMapping("/internal/v1/learner/targets")
@ConditionalOnProperty(prefix = "learner.persistence", name = "mode", havingValue = "jdbc")
public final class TargetPinController {

    private final TargetPinService pins;
    private final LearningConsentRecheck consentRecheck;

    public TargetPinController(TargetPinService pins) {
        this(pins, (LearningConsentRecheck) null);
    }

    @Autowired
    public TargetPinController(TargetPinService pins, ObjectProvider<LearningConsentRecheck> recheck) {
        this(pins, recheck == null ? null : recheck.getIfAvailable());
    }

    TargetPinController(TargetPinService pins, LearningConsentRecheck consentRecheck) {
        this.pins = pins;
        this.consentRecheck = consentRecheck;
    }

    @PutMapping("/pin")
    public Map<String, Object> pinTarget(
            @RequestBody(required = false) Map<String, Object> body,
            Authentication authentication,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        var principal = LearnerHttpPrincipals.requireLearningAccess(
                authentication, "learner.target.write", consentRecheck);
        requireKey(idempotencyKey);
        if (body == null) throw bad("pin request is required");
        long targetId = positiveLong(body.get("targetId"));
        long contentVersionId = positiveLong(body.get("contentVersionId"));
        Object epoch = body.get("contentEpoch");
        long contentEpoch = epoch instanceof Number number && number.longValue() >= 0
                ? number.longValue() : badLong("contentEpoch must be non-negative");
        String reportId = body.get("placementReportId") instanceof String text && !text.isBlank()
                && text.length() <= 128 ? text : null;
        if (reportId == null) throw bad("placementReportId is required");
        TargetPinService.TargetPin before = pins.findPin(principal.subject()).orElse(null);
        TargetPinService.TargetPin pinned;
        try {
            pinned = pins.pinTarget(principal.subject(), targetId, contentVersionId, contentEpoch);
        } catch (IllegalArgumentException invalid) {
            throw bad(invalid.getMessage());
        } catch (IllegalStateException missing) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, missing.getMessage());
        }
        boolean replayed = before != null && before.targetId() == targetId
                && before.contentVersionId() == contentVersionId && before.contentEpoch() == contentEpoch;
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("targetId", pinned.targetId());
        data.put("contentVersionId", pinned.contentVersionId());
        data.put("contentEpoch", pinned.contentEpoch());
        data.put("pinned", true);
        data.put("replayed", replayed);
        return Map.of("data", data);
    }

    private static long positiveLong(Object value) {
        if (value instanceof Number number && number.longValue() > 0) return number.longValue();
        throw bad("positive pin identifier is required");
    }

    private static long badLong(String message) {
        throw bad(message);
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static void requireKey(String key) {
        if (key == null || key.isBlank() || key.length() > 192) {
            throw bad("Idempotency-Key is required");
        }
    }
}
