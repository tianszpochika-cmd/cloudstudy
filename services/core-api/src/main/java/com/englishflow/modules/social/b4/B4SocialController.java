package com.englishflow.modules.social.b4;

import java.util.LinkedHashMap;
import java.util.Map;

import com.englishflow.modules.b4.B4Exception;
import com.englishflow.modules.user.UserRequestContext;
import com.englishflow.modules.user.api.RequestAttributeUserContextResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestController
@RequestMapping("/")
public final class B4SocialController {
    private final B4SocialService service;

    public B4SocialController(B4SocialService service) { this.service = service; }

    @GetMapping("/social/rooms")
    public Map<String, Object> rooms(@RequestParam(required = false) String cursor, @RequestParam(defaultValue = "20") int limit, HttpServletRequest request) { return service.rooms(user(request), cursor, limit); }

    @GetMapping("/social/rooms/{roomId}")
    public Map<String, Object> room(@PathVariable String roomId, HttpServletRequest request) { return service.room(user(request), roomId); }

    @PostMapping("/social/rooms/{roomId}/join")
    public Map<String, Object> join(@PathVariable String roomId, @RequestBody(required = false) Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.joinRoom(user(request), roomId, body == null ? Map.of() : body, key); }

    @PostMapping("/social/rooms/{roomId}/leave")
    public Map<String, Object> leave(@PathVariable String roomId, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.leaveRoom(user(request), roomId, key); }

    @PostMapping("/social/rooms/{roomId}/focus-sessions")
    public ResponseEntity<Map<String, Object>> startFocus(@PathVariable String roomId, @RequestBody(required = false) Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return ResponseEntity.status(201).body(service.startFocus(user(request), roomId, body == null ? Map.of() : body, key)); }

    @PatchMapping("/social/focus-sessions/{sessionId}")
    public Map<String, Object> updateFocus(@PathVariable String sessionId, @RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.updateFocus(user(request), sessionId, body, key); }

    @PostMapping("/social/rooms/{roomId}/interactions")
    public Map<String, Object> interaction(@PathVariable String roomId, @RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.interactions(user(request), roomId, body, key); }

    @GetMapping("/social/leaderboards")
    public Map<String, Object> leaderboard(@RequestParam String roomId, HttpServletRequest request) { return service.leaderboard(user(request), roomId); }

    @PostMapping("/social/ws-ticket")
    public Map<String, Object> wsTicket(@RequestBody(required = false) Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.issueWsTicket(user(request), body == null ? Map.of() : body, key); }

    @GetMapping("/user/notifications")
    public Map<String, Object> notifications(@RequestParam(defaultValue = "20") int limit, HttpServletRequest request) { return service.notifications(user(request), limit); }

    @PutMapping("/user/notifications/{messageId}/read")
    public Map<String, Object> readNotification(@PathVariable String messageId, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.readNotification(user(request), messageId, key); }

    @PutMapping("/user/notifications/read-all")
    public Map<String, Object> readAll(@RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.readAllNotifications(user(request), key); }

    @GetMapping("/user/notification-preferences")
    public Map<String, Object> notificationPreferences(HttpServletRequest request) { return service.notificationPreferences(user(request)); }

    @PatchMapping("/user/notification-preferences")
    public Map<String, Object> saveNotificationPreferences(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.saveNotificationPreferences(user(request), body, key); }

    @GetMapping("/sync/offline-packages")
    public Map<String, Object> offlinePackages(@RequestParam(defaultValue = "20") int limit, HttpServletRequest request) { return service.offlinePackages(user(request), limit); }

    @PostMapping("/sync/offline-packages/{packageId}/authorize")
    public Map<String, Object> authorizeOffline(@PathVariable String packageId, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.authorizeOfflinePackage(user(request), packageId, key); }

    @GetMapping("/sync/changes")
    public Map<String, Object> changes(@RequestParam(required = false) String cursor, @RequestParam(defaultValue = "50") int limit, HttpServletRequest request) { return service.syncChanges(user(request), cursor, limit); }

    @PostMapping("/sync/events")
    public Map<String, Object> syncEvents(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.pushSync(user(request), body, key); }

    @PutMapping("/sync/checkpoints/{entityId}")
    public Map<String, Object> checkpoint(@PathVariable String entityId, @RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.checkpoint(user(request), entityId, body, key); }

    @PostMapping("/offline/sync/push")
    public Map<String, Object> push(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.pushSync(user(request), body, key); }

    @GetMapping("/offline/sync/pull")
    public Map<String, Object> pull(@RequestParam(required = false) String cursor, @RequestParam(defaultValue = "50") int limit, HttpServletRequest request) { return service.syncChanges(user(request), cursor, limit); }

    @PostMapping("/social/moderation/reports")
    public Map<String, Object> report(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.report(user(request), body, key); }

    @PostMapping("/social/moderation/blocks")
    public Map<String, Object> block(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.block(user(request), longValue(body.get("targetUserId")), key); }

    @PostMapping("/social/rooms/{roomId}/mutes")
    public Map<String, Object> mute(@PathVariable String roomId, @RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.mute(user(request), roomId, longValue(body.get("targetUserId")), key); }

    private static long user(HttpServletRequest request) {
        Object value = request.getAttribute(RequestAttributeUserContextResolver.REQUEST_ATTRIBUTE);
        if (value instanceof UserRequestContext context) return context.userId();
        throw new B4Exception("B4_AUTH_REQUIRED", "需要登录", 401, false);
    }

    private static long longValue(Object value) { if (value instanceof Number number) return number.longValue(); try { return Long.parseLong(String.valueOf(value)); } catch (Exception exception) { throw new B4Exception("SOC_SCHEMA_INVALID", "targetUserId is required", 400, false); } }

    @RestControllerAdvice(assignableTypes = B4SocialController.class)
    public static final class ExceptionAdvice {
        @ExceptionHandler(B4Exception.class)
        public ResponseEntity<Map<String, Object>> handle(B4Exception exception, HttpServletRequest request) {
            Map<String, Object> error = new LinkedHashMap<>(); error.put("code", exception.code()); error.put("message", exception.getMessage()); error.put("retryable", exception.retryable());
            String requestId = request.getHeader("X-Request-Id") == null ? "req_social_error" : request.getHeader("X-Request-Id");
            return ResponseEntity.status(exception.status()).body(Map.of("requestId", requestId, "error", error));
        }
    }
}
