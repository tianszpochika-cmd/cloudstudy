package com.englishflow.modules.admin.b5;

import java.util.LinkedHashMap;
import java.util.Map;

import com.englishflow.modules.b5.B5Exception;
import com.englishflow.modules.commerce.b5.B5CommerceService;
import com.englishflow.modules.support.b5.B5SupportService;
import com.englishflow.modules.user.UserRequestContext;
import com.englishflow.modules.user.api.RequestAttributeUserContextResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
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
public final class B5AdminController {
    private final B5AdminService service;
    private final B5CommerceService commerce;
    private final B5SupportService support;

    public B5AdminController(B5AdminService service, B5CommerceService commerce, B5SupportService support) { this.service = service; this.commerce = commerce; this.support = support; }

    @PostMapping("/admin/content") public ResponseEntity<Map<String, Object>> createContent(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return ResponseEntity.status(201).body(service.createContentDraft(actor(request), body, key)); }
    @PutMapping("/admin/content/{contentId}/draft") public Map<String, Object> saveContent(@PathVariable String contentId, @RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.saveContentDraft(contentId, body, actor(request), key); }
    @PostMapping("/admin/content/{contentId}/validate") public Map<String, Object> validateContent(@PathVariable String contentId, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.validateContentDraft(contentId, actor(request), key); }
    @PostMapping("/admin/content/{contentId}/submit-review") public ResponseEntity<Map<String, Object>> submitReview(@PathVariable String contentId, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return ResponseEntity.status(202).body(service.submitContentReview(contentId, actor(request), key)); }
    @GetMapping("/admin/reviews") public Map<String, Object> reviews(@RequestParam(required = false) String cursor, @RequestParam(defaultValue = "20") int limit, HttpServletRequest request) { actor(request); return service.listReviewTasks(cursor, limit); }
    @PostMapping("/admin/reviews/{reviewTaskId}/decision") public Map<String, Object> decision(@PathVariable String reviewTaskId, @RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.decideReviewTask(reviewTaskId, body, actor(request), role(request), key); }
    @PostMapping("/admin/content/{contentId}/publish") public Map<String, Object> publish(@PathVariable String contentId, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.publishContent(contentId, actor(request), key); }
    @PostMapping("/admin/content/{contentId}/rollback") public Map<String, Object> rollback(@PathVariable String contentId, @RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.rollbackContent(contentId, body, actor(request), key); }
    @PostMapping("/admin/import-jobs") public ResponseEntity<Map<String, Object>> importJob(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return ResponseEntity.status(202).body(service.createImportJob(body, actor(request), key)); }
    @GetMapping("/admin/import-jobs/{importJobId}") public Map<String, Object> importStatus(@PathVariable String importJobId, HttpServletRequest request) { actor(request); return service.getImportJob(importJobId); }
    @GetMapping("/admin/correction-tickets") public Map<String, Object> correctionTickets(HttpServletRequest request) { actor(request); return support.listAll(); }
    @PostMapping("/admin/correction-tickets/{ticketId}/resolve") public Map<String, Object> resolveTicket(@PathVariable String ticketId, @RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { actor(request); return support.resolve(ticketId, body, actor(request)); }
    @GetMapping("/admin/risk/users/{userId}") public Map<String, Object> risk(@PathVariable long userId, HttpServletRequest request) { actor(request); return service.getRiskProfile(userId); }
    @PostMapping("/admin/risk/users/{userId}/actions") public Map<String, Object> riskAction(@PathVariable long userId, @RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.applyRiskAction(userId, body, actor(request), key); }
    @GetMapping("/admin/dashboard/metrics") public Map<String, Object> metrics(HttpServletRequest request) { actor(request); return service.dashboardMetrics(commerce.commerceSnapshot()); }
    @GetMapping("/admin/reconciliation/batches") public Map<String, Object> reconciliation(HttpServletRequest request) { actor(request); return service.listReconciliationBatches(); }
    @PostMapping("/admin/reconciliation/batches/import") public ResponseEntity<Map<String, Object>> importReconciliation(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return ResponseEntity.status(202).body(service.importReconciliationBatch(body, actor(request), key)); }
    @PostMapping("/admin/reconciliation/items/{itemId}/resolve") public Map<String, Object> resolveReconciliation(@PathVariable String itemId, @RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.resolveReconciliationItem(itemId, body, actor(request), key); }
    @GetMapping("/admin/feature-flags") public Map<String, Object> flags(HttpServletRequest request) { actor(request); return service.listFeatureFlags(); }
    @PutMapping("/admin/feature-flags/{flagKey}") public Map<String, Object> flag(@PathVariable String flagKey, @RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.updateFeatureFlag(flagKey, body, actor(request), key); }
    @PostMapping("/admin/activation-batches") public ResponseEntity<Map<String, Object>> activationBatch(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return ResponseEntity.status(201).body(commerce.createActivationBatch(actor(request), body, key)); }
    @PostMapping("/admin/activation-codes/{code}/revoke") public Map<String, Object> revokeActivation(@PathVariable String code, HttpServletRequest request) { actor(request); return commerce.revokeActivationCode(code); }
    @PostMapping("/admin/commerce/orders/{orderId}/adjust") public Map<String, Object> adjustOrder(@PathVariable String orderId, @RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return commerce.adjustOrder(actor(request), orderId, body, key); }
    @GetMapping("/admin/commerce/orders") public Map<String, Object> adminOrders(@RequestParam(required = false) String cursor, @RequestParam(defaultValue = "20") int limit, HttpServletRequest request) { actor(request); return commerce.listAdminOrders(cursor, limit); }
    @GetMapping("/admin/commerce/users/{userId}/entitlements") public Map<String, Object> adminEntitlements(@PathVariable long userId, HttpServletRequest request) { actor(request); return commerce.adminEntitlements(userId); }
    @GetMapping("/admin/session") public Map<String, Object> adminSession(HttpServletRequest request) { long actorId = actor(request); return Map.of("requestId", "req_b5_admin", "data", Map.of("actorId", actorId, "role", role(request), "permissions", java.util.List.of("CONTENT_EDIT", "CONTENT_REVIEW_L1", "CONTENT_REVIEW_L2", "COMMERCE_READ", "OPS_ANALYST"), "menuVersion", "b5-v1")); }
    @GetMapping("/admin/audit-logs") public Map<String, Object> audit(@RequestParam(required = false) String cursor, @RequestParam(defaultValue = "20") int limit, HttpServletRequest request) { actor(request); return service.searchAuditLogs(cursor, limit); }
    @PostMapping("/admin/audit-logs/export") public ResponseEntity<Map<String, Object>> exportAudit(@RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return ResponseEntity.status(202).body(service.exportAuditReport(actor(request), key)); }

    private static long actor(HttpServletRequest request) { Object value = request.getAttribute(RequestAttributeUserContextResolver.REQUEST_ATTRIBUTE); if (value instanceof UserRequestContext context) return context.userId(); throw new B5Exception("B5_ADMIN_AUTH_REQUIRED", "需要管理员登录", 401, false); }
    private static String role(HttpServletRequest request) { String value = request.getHeader("X-B5-Role"); if (value == null || value.isBlank()) throw new B5Exception("B5_ADMIN_ROLE_REQUIRED", "需要管理员角色", 403, false); return value.trim(); }

    @RestControllerAdvice(assignableTypes = B5AdminController.class)
    public static final class ExceptionAdvice {
        @ExceptionHandler(B5Exception.class)
        public ResponseEntity<Map<String, Object>> handle(B5Exception exception, HttpServletRequest request) { Map<String, Object> error = new LinkedHashMap<>(); error.put("code", exception.code()); error.put("message", exception.getMessage()); error.put("retryable", exception.retryable()); return ResponseEntity.status(exception.status()).body(Map.of("requestId", "req_b5_admin_error", "error", error)); }
    }
}
