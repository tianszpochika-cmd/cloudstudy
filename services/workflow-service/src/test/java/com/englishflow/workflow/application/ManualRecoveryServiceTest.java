package com.englishflow.workflow.application;

import com.englishflow.workflow.domain.ManualRecoveryRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The service layer must not be a way around the two-person rule.
 *
 * <p>The rule itself lives in the domain type, and these tests exist to show that the service has no method
 * that can bypass it. The signature of every approval takes one name, so a caller cannot present itself as
 * both people even if it wanted to.
 */
class ManualRecoveryServiceTest {

    private FakeRecoveryStore store;
    private ManualRecoveryService service;

    @BeforeEach
    void setUp() {
        store = new FakeRecoveryStore();
        service = new ManualRecoveryService(store);
    }

    @Test
    void aRequestIsRecordedWithItsRequesterAndStartsAwaitingApproval() {
        ManualRecoveryService.RecoveryView view = service.request("operator-a", "saga", "s-1", "retry-step",
                "the downstream call timed out twice");

        assertEquals("REQUESTED", view.status());
        assertEquals("operator-a", view.requestedBy());
        assertEquals(null, view.approvedBy());
        assertTrue(store.saved.containsKey(view.recoveryId()), "the request has to be stored before it can be approved");
    }

    @Test
    void approvingThroughTheServiceStillRefusesASelfApproval() {
        ManualRecoveryService.RecoveryView view = service.request("operator-a", "saga", "s-2", "retry-step", "reason");

        ManualRecoveryRequest.RecoveryNotAllowed refusal = assertThrows(
                ManualRecoveryRequest.RecoveryNotAllowed.class,
                () -> service.approve(view.recoveryId(), "operator-a"));

        assertTrue(refusal.getMessage().contains("cannot approve their own"), refusal.getMessage());
        // Compared as the enum it is: asserting a String against it fails on the type rather than on the
        // state, which is a test that can never pass however correct the service is.
        assertEquals(ManualRecoveryRequest.Status.REQUESTED,
                store.saved.get(view.recoveryId()).request().status(),
                "a refused approval must leave the stored request untouched");
    }

    @Test
    void aSecondOperatorApprovesAndTheApproverIsPersisted() {
        ManualRecoveryService.RecoveryView view = service.request("operator-a", "saga", "s-3", "retry-step", "reason");

        ManualRecoveryService.RecoveryView approved = service.approve(view.recoveryId(), "operator-b");

        assertEquals("APPROVED", approved.status());
        assertEquals("operator-b", approved.approvedBy());
        assertEquals("operator-b", store.saved.get(view.recoveryId()).request().approvedBy());
    }

    @Test
    void executingAnUnapprovedRecoveryIsRefusedAndWritesNoReceipt() {
        ManualRecoveryService.RecoveryView view = service.request("operator-a", "saga", "s-4", "retry-step", "reason");

        assertThrows(ManualRecoveryRequest.RecoveryNotAllowed.class,
                () -> service.execute(view.recoveryId(), "operator-b"));

        assertTrue(store.receipts.isEmpty(), "an unapproved recovery must not leave a receipt claiming it ran");
    }

    @Test
    void anApprovedRecoveryExecutesAndRecordsWhoRanIt() {
        ManualRecoveryService.RecoveryView view = service.request("operator-a", "saga", "s-5", "retry-step", "reason");
        service.approve(view.recoveryId(), "operator-b");

        ManualRecoveryService.RecoveryView executed = service.execute(view.recoveryId(), "operator-c");

        assertEquals("EXECUTED", executed.status());
        assertEquals(1, store.receipts.size());
        assertTrue(store.receipts.getFirst().containsKey("executor"));
        assertEquals("operator-c", store.receipts.getFirst().get("executor"));
        // The receipt names both deciders, so the trail is complete without the request row.
        assertEquals("operator-a", store.receipts.getFirst().get("requestedBy"));
        assertEquals("operator-b", store.receipts.getFirst().get("approvedBy"));
    }

    @Test
    void anUnknownRecoveryIsRefusedRatherThanTreatedAsSuccess() {
        assertThrows(ManualRecoveryRequest.RecoveryNotAllowed.class,
                () -> service.approve("does-not-exist", "operator-b"));
    }

    /** Keeps recoveries in memory so the service rules can be tested without a database. */
    private static final class FakeRecoveryStore implements ManualRecoveryService.RecoveryStore {
        final Map<String, ManualRecoveryService.StoredRecovery> saved = new LinkedHashMap<>();
        final java.util.List<Map<String, Object>> receipts = new java.util.ArrayList<>();

        @Override
        public void save(ManualRecoveryRequest request, String subjectType, String subjectId, String action, String reason) {
            saved.put(request.recoveryId(), new ManualRecoveryService.StoredRecovery(request, subjectType, subjectId, action, reason));
        }

        @Override
        public void update(ManualRecoveryRequest request) {
            ManualRecoveryService.StoredRecovery existing = saved.get(request.recoveryId());
            saved.put(request.recoveryId(), new ManualRecoveryService.StoredRecovery(request,
                    existing.subjectType(), existing.subjectId(), existing.action(), existing.reason()));
        }

        @Override
        public void recordReceipt(ManualRecoveryRequest request, String executor) {
            Map<String, Object> receipt = new LinkedHashMap<>();
            receipt.put("recoveryId", request.recoveryId());
            receipt.put("requestedBy", request.requestedBy());
            receipt.put("approvedBy", request.approvedBy());
            receipt.put("executor", executor);
            receipts.add(receipt);
        }

        @Override
        public Optional<ManualRecoveryService.StoredRecovery> find(String recoveryId) {
            return Optional.ofNullable(saved.get(recoveryId));
        }
    }
}
