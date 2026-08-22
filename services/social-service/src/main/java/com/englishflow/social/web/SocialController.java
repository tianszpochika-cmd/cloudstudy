package com.englishflow.social.web;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import com.englishflow.social.domain.SocialService;
import com.englishflow.social.security.SocialAuthenticationToken;
import com.englishflow.social.security.SocialPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** HTTP boundary for member-owned social operations. */
@RestController
@RequestMapping("/api/v1/social")
public final class SocialController {

    private final SocialService socialService;

    public SocialController(SocialService socialService) {
        this.socialService = socialService;
    }

    @GetMapping("/rooms")
    public Map<String, Object> rooms(
            @RequestParam(defaultValue = "20") int limit,
            HttpServletRequest request) {
        return envelope(socialService.listRooms(principal(), limit), request);
    }

    @GetMapping("/rooms/{roomId}")
    public Map<String, Object> room(@PathVariable String roomId, HttpServletRequest request) {
        return envelope(socialService.getRoom(principal(), roomId), request);
    }

    @PostMapping("/rooms/{roomId}/join")
    public Map<String, Object> join(
            @PathVariable String roomId,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            HttpServletRequest request) {
        return envelope(socialService.join(principal(), roomId, body, idempotencyKey), request);
    }

    @PostMapping("/rooms/{roomId}/leave")
    public Map<String, Object> leave(
            @PathVariable String roomId,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            HttpServletRequest request) {
        return envelope(socialService.leave(principal(), roomId, body, idempotencyKey), request);
    }

    @PostMapping("/rooms/{roomId}/disconnect")
    public Map<String, Object> disconnect(
            @PathVariable String roomId,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            HttpServletRequest request) {
        return envelope(socialService.disconnect(principal(), roomId, body, idempotencyKey), request);
    }

    @PostMapping("/rooms/{roomId}/recover")
    public Map<String, Object> recover(
            @PathVariable String roomId,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            HttpServletRequest request) {
        return envelope(socialService.recover(principal(), roomId, body, idempotencyKey), request);
    }

    @PostMapping("/rooms/{roomId}/lease/renew")
    public Map<String, Object> renewLease(
            @PathVariable String roomId,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            HttpServletRequest request) {
        return envelope(socialService.renewLease(principal(), roomId, body, idempotencyKey), request);
    }

    @PostMapping("/rooms/{roomId}/focus")
    public ResponseEntity<Map<String, Object>> startFocus(
            @PathVariable String roomId,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            HttpServletRequest request) {
        return ResponseEntity.status(201).body(envelope(
                socialService.startFocus(principal(), roomId, body, idempotencyKey), request));
    }

    @PatchMapping("/focus-sessions/{focusId}")
    public Map<String, Object> updateFocus(
            @PathVariable String focusId,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            HttpServletRequest request) {
        return envelope(socialService.updateFocus(principal(), focusId, body, idempotencyKey), request);
    }

    @PostMapping("/rooms/{roomId}/interactions")
    public Map<String, Object> interaction(
            @PathVariable String roomId,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            HttpServletRequest request) {
        return envelope(socialService.interaction(principal(), roomId, body, idempotencyKey), request);
    }

    @GetMapping("/leaderboards")
    public Map<String, Object> leaderboard(
            @RequestParam(defaultValue = "FOCUS_MINUTES") String kind,
            @RequestParam(defaultValue = "DAY") String period,
            @RequestParam(required = false) String roomId,
            HttpServletRequest request) {
        return envelope(socialService.leaderboard(principal(), kind, period, roomId), request);
    }

    @PatchMapping("/me/visibility")
    public Map<String, Object> visibility(
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            HttpServletRequest request) {
        return envelope(socialService.setVisibility(principal(), body, idempotencyKey), request);
    }

    @PostMapping("/rooms/{roomId}/reports")
    public Map<String, Object> report(
            @PathVariable String roomId,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            HttpServletRequest request) {
        return envelope(socialService.report(principal(), roomId, body, idempotencyKey), request);
    }

    @GetMapping("/reports/{reportId}")
    public Map<String, Object> getReport(@PathVariable String reportId, HttpServletRequest request) {
        return envelope(socialService.getReport(principal(), reportId), request);
    }

    static SocialPrincipal principal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof SocialAuthenticationToken socialAuthentication
                && socialAuthentication.isAuthenticated()) {
            return socialAuthentication.socialPrincipal();
        }
        return null;
    }

    static Map<String, Object> envelope(Map<String, Object> data, HttpServletRequest request) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("requestId", requestId(request));
        result.put("data", data);
        result.put("meta", Map.of("service", "social-service", "schemaVersion", "social.api.v1"));
        return result;
    }

    static String requestId(HttpServletRequest request) {
        String requestId = request.getHeader("X-Request-Id");
        return requestId == null || requestId.isBlank() ? "req_social_" + UUID.randomUUID() : requestId;
    }
}
