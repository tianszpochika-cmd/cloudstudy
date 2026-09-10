package com.englishflow.commerce;

import com.englishflow.commerce.application.CommerceApplicationService;
import com.englishflow.commerce.application.CommerceCommands.IssueActivationCode;
import com.englishflow.commerce.application.CommerceCommands.RedeemActivationCode;
import com.englishflow.commerce.domain.ActivationCode;
import com.englishflow.commerce.domain.ActivationCodeStatus;
import com.englishflow.commerce.domain.CommerceException;
import com.englishflow.commerce.domain.CommerceViews.ActivationCodeIssueView;
import com.englishflow.commerce.domain.CommerceViews.ActivationRedeemView;
import com.englishflow.commerce.domain.CommerceViews.EntitlementView;
import com.englishflow.commerce.domain.Entitlement;
import com.englishflow.commerce.domain.EntitlementStatus;
import com.englishflow.commerce.domain.PaymentGate;
import com.englishflow.commerce.domain.PriceSnapshot;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Activation-code issuance/redemption and entitlement idempotency + boundaries. */
class ActivationCodeEntitlementTest {
    private final CommerceTestFixtures.Bundle bundle = new CommerceTestFixtures.Bundle(PaymentGate.sandbox());
    private final CommerceApplicationService service = bundle.service;

    @Test
    void issueThenRedeemGrantsEntitlement() {
        bundle.seedCatalog();
        ActivationCodeIssueView issued = service.issueActivationCode(CommerceTestFixtures.staff(),
                new IssueActivationCode(CommerceTestFixtures.SKU, CommerceTestFixtures.NOW.plusSeconds(3600)), "issue-01");
        ActivationRedeemView redeemed = service.redeemActivationCode(CommerceTestFixtures.user(),
                new RedeemActivationCode(issued.code()), "redeem-1");
        assertEquals("REDEEMED", redeemed.state());
        assertEquals(1, service.listEntitlements(CommerceTestFixtures.user()).size());
        EntitlementView view = service.listEntitlements(CommerceTestFixtures.user()).get(0);
        assertEquals(EntitlementStatus.ACTIVE, view.status());
    }

    @Test
    void redeemIsIdempotentForSameKey() {
        bundle.seedCatalog();
        ActivationCodeIssueView issued = service.issueActivationCode(CommerceTestFixtures.staff(),
                new IssueActivationCode(CommerceTestFixtures.SKU, CommerceTestFixtures.NOW.plusSeconds(3600)), "issue-02");
        ActivationRedeemView first = service.redeemActivationCode(CommerceTestFixtures.user(),
                new RedeemActivationCode(issued.code()), "redeem-2");
        ActivationRedeemView second = service.redeemActivationCode(CommerceTestFixtures.user(),
                new RedeemActivationCode(issued.code()), "redeem-2");
        assertTrue(second.replayed());
        assertEquals(first.entitlementId(), second.entitlementId());
        assertEquals(1, service.listEntitlements(CommerceTestFixtures.user()).size());
    }

    @Test
    void redeemAlreadyRedeemedCodeWithNewKeyIsUnavailable() {
        bundle.seedCatalog();
        ActivationCodeIssueView issued = service.issueActivationCode(CommerceTestFixtures.staff(),
                new IssueActivationCode(CommerceTestFixtures.SKU, CommerceTestFixtures.NOW.plusSeconds(3600)), "issue-03");
        service.redeemActivationCode(CommerceTestFixtures.user(), new RedeemActivationCode(issued.code()), "redeem-3a");
        CommerceException ex = assertThrows(CommerceException.class, () ->
                service.redeemActivationCode(CommerceTestFixtures.user(), new RedeemActivationCode(issued.code()), "redeem-3b"));
        assertEquals("ACTIVATION_CODE_UNAVAILABLE", ex.code());
    }

    @Test
    void redeemAtExactExpiryIsRejected() {
        bundle.seedCatalog();
        Instant expiry = CommerceTestFixtures.NOW.plusSeconds(3600);
        ActivationCodeIssueView issued = service.issueActivationCode(CommerceTestFixtures.staff(),
                new IssueActivationCode(CommerceTestFixtures.SKU, expiry), "issue-04");
        // Clock reaches exactly the expiry instant: isAfter(expiry) is false.
        bundle.clock.set(expiry);
        CommerceException ex = assertThrows(CommerceException.class, () ->
                service.redeemActivationCode(CommerceTestFixtures.user(), new RedeemActivationCode(issued.code()), "redeem-4"));
        assertEquals("ACTIVATION_CODE_EXPIRED", ex.code());
    }

    @Test
    void issueWithExpiryNotInFutureIsRejected() {
        bundle.seedCatalog();
        CommerceException ex = assertThrows(CommerceException.class, () ->
                service.issueActivationCode(CommerceTestFixtures.staff(),
                        new IssueActivationCode(CommerceTestFixtures.SKU, CommerceTestFixtures.NOW), "issue-05"));
        assertEquals("ACTIVATION_EXPIRY_INVALID", ex.code());
    }

    @Test
    void idempotencyKeyReusedWithDifferentCodeIsRejected() {
        bundle.seedCatalog();
        ActivationCodeIssueView a = service.issueActivationCode(CommerceTestFixtures.staff(),
                new IssueActivationCode(CommerceTestFixtures.SKU, CommerceTestFixtures.NOW.plusSeconds(3600)), "issue-6a");
        ActivationCodeIssueView b = service.issueActivationCode(CommerceTestFixtures.staff(),
                new IssueActivationCode(CommerceTestFixtures.SKU, CommerceTestFixtures.NOW.plusSeconds(7200)), "issue-6b");
        service.redeemActivationCode(CommerceTestFixtures.user(), new RedeemActivationCode(a.code()), "redeem-6");
        CommerceException ex = assertThrows(CommerceException.class, () ->
                service.redeemActivationCode(CommerceTestFixtures.user(), new RedeemActivationCode(b.code()), "redeem-6"));
        assertEquals("IDEMPOTENCY_KEY_REUSED", ex.code());
    }

    @Test
    void issueWithSameKeyIsIdempotent() {
        bundle.seedCatalog();
        ActivationCodeIssueView first = service.issueActivationCode(CommerceTestFixtures.staff(),
                new IssueActivationCode(CommerceTestFixtures.SKU, CommerceTestFixtures.NOW.plusSeconds(3600)), "issue-07");
        ActivationCodeIssueView second = service.issueActivationCode(CommerceTestFixtures.staff(),
                new IssueActivationCode(CommerceTestFixtures.SKU, CommerceTestFixtures.NOW.plusSeconds(3600)), "issue-07");
        assertEquals(first.code(), second.code());
    }

    @Test
    void activationCodeRejectsMalformedHash() {
        PriceSnapshot snapshot = new PriceSnapshot("sku", 1, "Title", "CODE", "CNY", 9900, CommerceTestFixtures.NOW);
        CommerceException ex = assertThrows(CommerceException.class, () ->
                new ActivationCode("t", "not-a-hash", "sku", snapshot, ActivationCodeStatus.AVAILABLE,
                        CommerceTestFixtures.NOW.plusSeconds(3600), null, null));
        assertEquals("ACTIVATION_CODE_INVALID", ex.code());
    }

    @Test
    void entitlementRejectsIncompleteFields() {
        Instant now = CommerceTestFixtures.NOW;
        CommerceException ex = assertThrows(CommerceException.class, () ->
                new Entitlement("t", "e", "s", "sku", "CODE", "ORDER", "o",
                        new PriceSnapshot("sku", 1, "Title", "CODE", "CNY", 9900, now),
                        EntitlementStatus.ACTIVE, null, null, ""));
        assertEquals("ENTITLEMENT_INVALID", ex.code());
    }
}
