package com.englishflow.workflow.domain;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The two-person rule, which is the reason manual recovery is a workflow and not a button.
 *
 * <p>An operator who can approve their own intervention has no oversight, so these tests exist to make sure
 * that path is closed and stays closed. Each refusal is asserted on the message as well as the type, because
 * a transition rejected for the wrong reason is not the same as one rejected by this rule.
 */
class ManualRecoveryRequestTest {

    private static final String REQUESTER = "operator-a";
    private static final String APPROVER = "operator-b";

    @Test
    void theRequesterCannotApproveTheirOwnRecovery() {
        ManualRecoveryRequest request = ManualRecoveryRequest.requested("r-1", REQUESTER);

        ManualRecoveryRequest.RecoveryNotAllowed refusal = assertThrows(
                ManualRecoveryRequest.RecoveryNotAllowed.class, () -> request.approve(REQUESTER));

        assertTrue(refusal.getMessage().contains("cannot approve their own"), refusal.getMessage());
        assertEquals(ManualRecoveryRequest.Status.REQUESTED, request.status(),
                "a refused approval must not move the request");
        assertEquals(null, request.approvedBy());
    }

    @Test
    void aDifferentOperatorCanApproveAndTheApproverIsRecorded() {
        ManualRecoveryRequest request = ManualRecoveryRequest.requested("r-2", REQUESTER);

        request.approve(APPROVER);

        assertEquals(ManualRecoveryRequest.Status.APPROVED, request.status());
        assertEquals(APPROVER, request.approvedBy(), "who approved it has to be on the record");
        assertEquals(REQUESTER, request.requestedBy(), "and so does who asked");
    }

    @Test
    void anUnapprovedRecoveryCannotBeExecuted() {
        ManualRecoveryRequest request = ManualRecoveryRequest.requested("r-3", REQUESTER);

        ManualRecoveryRequest.RecoveryNotAllowed refusal = assertThrows(
                ManualRecoveryRequest.RecoveryNotAllowed.class, request::execute);

        assertTrue(refusal.getMessage().contains("has to be approved"), refusal.getMessage());
        assertEquals(ManualRecoveryRequest.Status.REQUESTED, request.status());
    }

    @Test
    void anApprovedRecoveryExecutesOnceAndCannotBeApprovedAgain() {
        ManualRecoveryRequest request = ManualRecoveryRequest.requested("r-4", REQUESTER);
        request.approve(APPROVER);
        request.execute();
        assertEquals(ManualRecoveryRequest.Status.EXECUTED, request.status());

        // Re-approving an executed request would rewrite who authorised it after the fact.
        ManualRecoveryRequest.RecoveryNotAllowed refusal = assertThrows(
                ManualRecoveryRequest.RecoveryNotAllowed.class, () -> request.approve("operator-c"));
        assertTrue(refusal.getMessage().contains("cannot be approved"), refusal.getMessage());
        assertEquals(APPROVER, request.approvedBy(), "the original approver must survive a refused re-approval");
    }

    @Test
    void theRequesterCannotRejectTheirOwnRequestEither() {
        ManualRecoveryRequest request = ManualRecoveryRequest.requested("r-5", REQUESTER);

        ManualRecoveryRequest.RecoveryNotAllowed refusal = assertThrows(
                ManualRecoveryRequest.RecoveryNotAllowed.class, () -> request.reject(REQUESTER, "not needed"));

        assertTrue(refusal.getMessage().contains("cannot reject their own"), refusal.getMessage());
        assertEquals(ManualRecoveryRequest.Status.REQUESTED, request.status());
    }

    @Test
    void aRejectedRequestCannotBeExecuted() {
        ManualRecoveryRequest request = ManualRecoveryRequest.requested("r-6", REQUESTER);
        request.reject(APPROVER, "insufficient evidence");

        assertEquals(ManualRecoveryRequest.Status.REJECTED, request.status());
        assertThrows(ManualRecoveryRequest.RecoveryNotAllowed.class, request::execute);
    }

    @Test
    void aFailedExecutionKeepsItsReasonAndCannotBeSilentlyRetried() {
        ManualRecoveryRequest request = ManualRecoveryRequest.requested("r-7", REQUESTER);
        request.approve(APPROVER);
        request.fail("target row had already been removed");

        assertEquals(ManualRecoveryRequest.Status.FAILED, request.status());
        assertEquals("target row had already been removed", request.failureMessage());
        // A retry needs a new request, so the failure stays visible instead of being overwritten by success.
        assertThrows(ManualRecoveryRequest.RecoveryNotAllowed.class, request::execute);
    }

    @Test
    void anApprovalHasToNameSomeone() {
        ManualRecoveryRequest request = ManualRecoveryRequest.requested("r-8", REQUESTER);

        assertThrows(ManualRecoveryRequest.RecoveryNotAllowed.class, () -> request.approve("  "));
        assertThrows(ManualRecoveryRequest.RecoveryNotAllowed.class, () -> request.approve(null));
        assertEquals(ManualRecoveryRequest.Status.REQUESTED, request.status());
    }

    @Test
    void aRequestHasToNameWhoAskedForIt() {
        assertThrows(ManualRecoveryRequest.RecoveryNotAllowed.class,
                () -> ManualRecoveryRequest.requested("r-9", null));
    }
}
