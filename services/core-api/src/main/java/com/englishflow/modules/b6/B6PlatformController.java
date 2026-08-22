package com.englishflow.modules.b6;

import java.util.LinkedHashMap;
import java.util.Map;

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
public final class B6PlatformController {
    private final B6PlatformService service;

    public B6PlatformController(B6PlatformService service) { this.service = service; }

    @GetMapping("/platform/release-matrix") public Map<String, Object> releaseMatrix() { return service.listReleaseMatrix(); }
    @PostMapping("/platform/builds") public ResponseEntity<Map<String, Object>> registerBuild(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { actor(request); return ResponseEntity.status(201).body(service.registerBuild(body, key)); }
    @GetMapping("/platform/builds/{buildId}") public Map<String, Object> build(@PathVariable String buildId) { return service.getBuild(buildId); }
    @PostMapping("/platform/compatibility-checks") public ResponseEntity<Map<String, Object>> compatibility(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { actor(request); return ResponseEntity.status(201).body(service.recordCompatibilityCheck(body, key)); }
    @GetMapping("/platform/performance/budget") public Map<String, Object> performance() { return service.performanceBudget(); }
    @GetMapping("/platform/accessibility/checklist") public Map<String, Object> accessibility() { return service.accessibilityChecklist(); }
    @GetMapping("/platform/responsive/checklist") public Map<String, Object> responsive() { return service.responsiveChecklist(); }
    @PostMapping("/quality/e2e-runs") public ResponseEntity<Map<String, Object>> e2e(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { actor(request); return ResponseEntity.status(201).body(service.recordE2ERun(body, key)); }
    @GetMapping("/quality/e2e-runs/{runId}") public Map<String, Object> e2eRun(@PathVariable String runId) { return service.getE2ERun(runId); }
    @PostMapping("/quality/security-scans") public ResponseEntity<Map<String, Object>> security(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { actor(request); return ResponseEntity.status(201).body(service.recordSecurityScan(body, key)); }
    @GetMapping("/quality/security-scans/{scanId}") public Map<String, Object> securityScan(@PathVariable String scanId) { return service.getSecurityScan(scanId); }
    @PostMapping("/quality/reliability-runs") public ResponseEntity<Map<String, Object>> reliability(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { actor(request); return ResponseEntity.status(201).body(service.recordReliabilityRun(body, key)); }
    @GetMapping("/quality/reliability-runs/{runId}") public Map<String, Object> reliabilityRun(@PathVariable String runId) { return service.getReliabilityRun(runId); }
    @GetMapping("/observability/dashboard") public Map<String, Object> observability() { return service.observabilityDashboard(); }
    @PostMapping("/data-reliability/drills") public ResponseEntity<Map<String, Object>> drill(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { actor(request); return ResponseEntity.status(201).body(service.recordBackupDrill(body, key)); }
    @GetMapping("/data-reliability/drills/{drillId}") public Map<String, Object> backupDrill(@PathVariable String drillId) { return service.getBackupDrill(drillId); }
    @PostMapping("/release/gates/evaluate") public ResponseEntity<Map<String, Object>> gate(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { actor(request); return ResponseEntity.status(201).body(service.evaluateReleaseGate(body, key)); }
    @GetMapping("/release/gates/{gateId}") public Map<String, Object> releaseGate(@PathVariable String gateId) { return service.getReleaseGate(gateId); }

    private static long actor(HttpServletRequest request) {
        Object value = request.getAttribute(RequestAttributeUserContextResolver.REQUEST_ATTRIBUTE);
        if (value instanceof UserRequestContext context) return context.userId();
        throw new B6Exception("B6_AUTH_REQUIRED", "需要已认证的发布或质量操作者", 401, false);
    }

    @RestControllerAdvice(assignableTypes = B6PlatformController.class)
    public static final class ExceptionAdvice {
        @ExceptionHandler(B6Exception.class)
        public ResponseEntity<Map<String, Object>> handle(B6Exception exception, HttpServletRequest request) {
            Map<String, Object> error = new LinkedHashMap<>(); error.put("code", exception.code()); error.put("message", exception.getMessage()); error.put("retryable", exception.retryable());
            String requestId = request.getHeader("X-Request-Id") == null ? "req_b6_error" : request.getHeader("X-Request-Id");
            return ResponseEntity.status(exception.status()).body(Map.of("requestId", requestId, "error", error));
        }
    }
}
