package com.englishflow.commerce.adapter.http;

import com.englishflow.commerce.application.CommerceApplicationService;
import com.englishflow.commerce.application.CommerceCommands.CreateOrder;
import com.englishflow.commerce.application.CommerceCommands.IssueActivationCode;
import com.englishflow.commerce.application.CommerceCommands.PaymentCallback;
import com.englishflow.commerce.application.CommerceCommands.RefundCallback;
import com.englishflow.commerce.application.CommerceCommands.RedeemActivationCode;
import com.englishflow.commerce.application.CommerceCommands.RequestRefund;
import com.englishflow.commerce.application.CommerceCommands.StartPayment;
import com.englishflow.commerce.domain.CommercePrincipal;
import com.englishflow.commerce.domain.CommerceViews;
import com.englishflow.commerce.domain.PaymentProvider;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/v1/commerce")
public final class CommerceController {
    private final CommerceApplicationService service;
    private final CommercePrincipalResolver principals;
    private final String publicTenantId;

    public CommerceController(CommerceApplicationService service, CommercePrincipalResolver principals,
            @Value("${commerce.public-tenant-id:platform}") String publicTenantId) {
        this.service = service;
        this.principals = principals;
        this.publicTenantId = publicTenantId;
    }
    @GetMapping("/readiness") public CommerceViews.ReadinessView readiness() { return service.readiness(); }
    @GetMapping("/public/catalog") public java.util.Map<String, Object> publicCatalog() {
        return service.publicCatalog(publicTenantId);
    }
    @GetMapping("/skus") public List<CommerceViews.SkuView> skus(Authentication authentication) { return service.listSkus(user(authentication)); }
    @GetMapping("/orders") public List<CommerceViews.OrderView> orders(Authentication authentication) { return service.listOrders(user(authentication)); }
    @GetMapping("/orders/{orderId}") public CommerceViews.OrderView order(@PathVariable String orderId, Authentication authentication) { return service.getOrder(user(authentication), orderId); }

    @PostMapping("/orders") @ResponseStatus(HttpStatus.CREATED)
    public CommerceViews.OrderView createOrder(@Valid @RequestBody CreateOrderRequest request, @RequestHeader("Idempotency-Key") String key, Authentication authentication) { return service.createOrder(user(authentication), new CreateOrder(request.skuId()), key); }
    @PostMapping("/orders/{orderId}/payments") @ResponseStatus(HttpStatus.ACCEPTED)
    public CommerceViews.PaymentStartView startPayment(@PathVariable String orderId, @Valid @RequestBody PaymentRequest request, @RequestHeader("Idempotency-Key") String key, Authentication authentication) { return service.startPayment(user(authentication), new StartPayment(orderId, request.provider()), key); }
    @PostMapping("/orders/{orderId}/payments/recover") public CommerceViews.PaymentStartView recoverPayment(@PathVariable String orderId, @RequestHeader("Idempotency-Key") String key, Authentication authentication) { return service.recoverPayment(user(authentication), orderId, key); }
    @PostMapping("/orders/{orderId}/cancel") public CommerceViews.OrderView cancelOrder(@PathVariable String orderId, @RequestHeader("Idempotency-Key") String key, Authentication authentication) { return service.cancelOrder(user(authentication), orderId, key); }
    @GetMapping("/entitlements/me") public List<CommerceViews.EntitlementView> entitlements(Authentication authentication) { return service.listEntitlements(user(authentication)); }
    @PostMapping("/activation-codes/redeem") public CommerceViews.ActivationRedeemView redeem(@Valid @RequestBody RedeemActivationRequest request, @RequestHeader("Idempotency-Key") String key, Authentication authentication) { return service.redeemActivationCode(user(authentication), new RedeemActivationCode(request.code()), key); }
    @PostMapping("/orders/{orderId}/refunds") @ResponseStatus(HttpStatus.ACCEPTED)
    public CommerceViews.RefundView refund(@PathVariable String orderId, @RequestBody(required = false) RefundRequest request, @RequestHeader("Idempotency-Key") String key, Authentication authentication) { return service.requestRefund(user(authentication), new RequestRefund(orderId, request == null ? "USER_REQUEST" : request.reasonCode()), key); }

    @PostMapping("/providers/{provider}/callbacks")
    public CommerceViews.PaymentCallbackView paymentCallback(@PathVariable PaymentProvider provider, @Valid @RequestBody PaymentCallbackRequest request, Authentication authentication) {
        principals.requireWorkload(authentication);
        return service.receivePaymentCallback(new PaymentCallback(request.providerEventId(), request.orderId(), provider, request.amountMinor(), request.currency(), request.payload(), request.signature(), request.resultCode()));
    }
    @PostMapping("/refunds/callbacks")
    public CommerceViews.RefundCallbackView refundCallback(@Valid @RequestBody RefundCallbackRequest request, Authentication authentication) {
        principals.requireWorkload(authentication);
        return service.receiveRefundCallback(new RefundCallback(request.providerEventId(), request.refundId(), request.provider(), request.amountMinor(), request.currency(), request.payload(), request.signature(), request.resultCode()));
    }
    @PostMapping("/admin/activation-codes") @ResponseStatus(HttpStatus.CREATED)
    public CommerceViews.ActivationCodeIssueView issueActivationCode(@Valid @RequestBody IssueActivationRequest request, @RequestHeader("Idempotency-Key") String key, Authentication authentication) { return service.issueActivationCode(user(authentication), new IssueActivationCode(request.skuId(), request.expiresAt()), key); }
    @GetMapping("/admin/orders/{orderId}/reconciliation") public CommerceViews.ReconciliationView reconcile(@PathVariable String orderId, Authentication authentication) { return service.reconcileOrder(user(authentication), orderId); }

    private CommercePrincipal user(Authentication authentication) { return principals.requireUser(authentication); }
    public record CreateOrderRequest(@NotBlank String skuId) { }
    public record PaymentRequest(@NotNull PaymentProvider provider) { }
    public record RefundRequest(String reasonCode) { }
    public record RedeemActivationRequest(@NotBlank String code) { }
    public record PaymentCallbackRequest(@NotBlank String providerEventId, @NotBlank String orderId, long amountMinor, @NotBlank String currency, @NotBlank String payload, @NotBlank String signature, @NotBlank String resultCode) { }
    public record RefundCallbackRequest(@NotBlank String providerEventId, @NotBlank String refundId, @NotNull PaymentProvider provider, long amountMinor, @NotBlank String currency, @NotBlank String payload, @NotBlank String signature, @NotBlank String resultCode) { }
    public record IssueActivationRequest(@NotBlank String skuId, @NotNull Instant expiresAt) { }
}
