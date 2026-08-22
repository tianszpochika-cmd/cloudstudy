package com.englishflow.modules.support.b5;

import java.util.LinkedHashMap;
import java.util.Map;

import com.englishflow.modules.b5.B5Exception;
import com.englishflow.modules.user.UserRequestContext;
import com.englishflow.modules.user.api.RequestAttributeUserContextResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestController
@RequestMapping("/")
public final class B5SupportController {
    private final B5SupportService service;

    public B5SupportController(B5SupportService service) { this.service = service; }

    @GetMapping("/support/tickets") public Map<String, Object> list(HttpServletRequest request) { return service.listMine(user(request)); }
    @PostMapping("/support/tickets") public ResponseEntity<Map<String, Object>> create(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return ResponseEntity.status(201).body(service.create(user(request), body, key)); }
    @GetMapping("/support/tickets/{ticketId}") public Map<String, Object> get(@PathVariable String ticketId, HttpServletRequest request) { return service.getMine(user(request), ticketId); }
    @PostMapping("/support/tickets/{ticketId}/messages") public ResponseEntity<Map<String, Object>> message(@PathVariable String ticketId, @RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return ResponseEntity.status(201).body(service.addMessage(user(request), ticketId, body, key)); }

    private static long user(HttpServletRequest request) { Object value = request.getAttribute(RequestAttributeUserContextResolver.REQUEST_ATTRIBUTE); if (value instanceof UserRequestContext context) return context.userId(); throw new B5Exception("B5_AUTH_REQUIRED", "需要登录", 401, false); }

    @RestControllerAdvice(assignableTypes = B5SupportController.class)
    public static final class ExceptionAdvice {
        @ExceptionHandler(B5Exception.class)
        public ResponseEntity<Map<String, Object>> handle(B5Exception exception, HttpServletRequest request) { Map<String, Object> error = new LinkedHashMap<>(); error.put("code", exception.code()); error.put("message", exception.getMessage()); error.put("retryable", exception.retryable()); return ResponseEntity.status(exception.status()).body(Map.of("requestId", "req_b5_support_error", "error", error)); }
    }
}
