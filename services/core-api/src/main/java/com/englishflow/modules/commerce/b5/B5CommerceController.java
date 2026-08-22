package com.englishflow.modules.commerce.b5;

import java.util.LinkedHashMap;
import java.util.Map;

import com.englishflow.modules.b5.B5Exception;
import com.englishflow.modules.user.UserRequestContext;
import com.englishflow.modules.user.api.RequestAttributeUserContextResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestController
@RequestMapping("/")
public final class B5CommerceController {
    private final B5CommerceService service;

    public B5CommerceController(B5CommerceService service) { this.service = service; }

    @GetMapping("/commerce/skus") public Map<String, Object> skus() { return service.listSkus(); }
    @GetMapping("/commerce/skus/{skuId}") public Map<String, Object> sku(@PathVariable String skuId) { return service.getSku(skuId); }
    @GetMapping("/commerce/orders") public Map<String, Object> orders(@RequestParam(required = false) String cursor, @RequestParam(defaultValue = "20") int limit, HttpServletRequest request) { return service.listOrders(user(request), cursor, limit); }
    @PostMapping("/commerce/orders") public ResponseEntity<Map<String, Object>> createOrder(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return ResponseEntity.status(201).body(service.createOrder(user(request), body, key)); }
    @GetMapping("/commerce/orders/{orderId}") public Map<String, Object> order(@PathVariable String orderId, HttpServletRequest request) { return service.getOrder(user(request), orderId); }
    @PostMapping("/commerce/orders/{orderId}/payment-attempts") public ResponseEntity<Map<String, Object>> paymentAttempt(@PathVariable String orderId, @RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return ResponseEntity.status(201).body(service.createPaymentAttempt(user(request), orderId, body, key)); }
    @PostMapping("/commerce/wechat/callback") public Map<String, Object> wechat(@RequestBody Map<String, Object> body) { return service.receiveWechatCallback(body); }
    @PostMapping("/commerce/alipay/notify") public Map<String, Object> alipay(@RequestBody Map<String, Object> body) { return service.receiveAlipayNotify(body); }
    @PostMapping("/commerce/apple/transactions/verify") public Map<String, Object> appleVerify(@RequestBody Map<String, Object> body, HttpServletRequest request) { return service.verifyAppleTransaction(user(request), body); }
    @PostMapping("/commerce/apple/recovery/scan") public Map<String, Object> appleRecovery(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest request) { return service.scanAppleRecovery(user(request), body == null ? Map.of() : body); }
    @PostMapping("/commerce/apple/notifications") public Map<String, Object> appleNotification(@RequestBody Map<String, Object> body) { return service.receiveAppleNotification(body); }
    @GetMapping("/commerce/entitlements/me") public Map<String, Object> entitlements(HttpServletRequest request) { return service.entitlements(user(request)); }
    @PostMapping("/commerce/households") public ResponseEntity<Map<String, Object>> household(@RequestBody(required = false) Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return ResponseEntity.status(201).body(service.createHousehold(user(request), body == null ? Map.of() : body, key)); }
    @PostMapping("/commerce/households/{householdId}/invitations") public ResponseEntity<Map<String, Object>> invite(@PathVariable String householdId, @RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return ResponseEntity.status(201).body(service.createInvitation(user(request), householdId, body, key)); }
    @PostMapping("/commerce/households/invitations/accept") public Map<String, Object> accept(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.acceptInvitation(user(request), body, key); }
    @DeleteMapping("/commerce/households/{householdId}/members/{memberUserId}") public Map<String, Object> removeMember(@PathVariable String householdId, @PathVariable long memberUserId, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.removeMember(user(request), householdId, memberUserId); }
    @PostMapping("/commerce/activation-codes/redeem") public Map<String, Object> redeem(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return service.redeemActivationCode(user(request), String.valueOf(body.get("code")), key); }
    @PostMapping("/commerce/orders/{orderId}/refunds") public ResponseEntity<Map<String, Object>> refund(@PathVariable String orderId, @RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return ResponseEntity.status(202).body(service.requestRefund(user(request), orderId, body, key)); }
    @GetMapping("/commerce/invoices") public Map<String, Object> invoices(HttpServletRequest request) { return service.listInvoices(user(request)); }
    @PostMapping("/commerce/invoices") public ResponseEntity<Map<String, Object>> invoice(@RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) { return ResponseEntity.status(201).body(service.createInvoice(user(request), body, key)); }

    private static long user(HttpServletRequest request) {
        Object value = request.getAttribute(RequestAttributeUserContextResolver.REQUEST_ATTRIBUTE);
        if (value instanceof UserRequestContext context) return context.userId();
        throw new B5Exception("B5_AUTH_REQUIRED", "需要登录", 401, false);
    }

    @RestControllerAdvice(assignableTypes = B5CommerceController.class)
    public static final class ExceptionAdvice {
        @ExceptionHandler(B5Exception.class)
        public ResponseEntity<Map<String, Object>> handle(B5Exception exception, HttpServletRequest request) {
            Map<String, Object> error = new LinkedHashMap<>(); error.put("code", exception.code()); error.put("message", exception.getMessage()); error.put("retryable", exception.retryable());
            return ResponseEntity.status(exception.status()).body(Map.of("requestId", request.getHeader("X-Request-Id") == null ? "req_b5_error" : request.getHeader("X-Request-Id"), "error", error));
        }
    }
}
