package com.englishflow.workflow.domain;

/**
 * A manual recovery that has to be approved by someone other than the person who asked for it.
 *
 * <p>The rule lives here rather than in a controller because it is the reason this workflow exists: an
 * operator who can approve their own intervention has no oversight, and the recovery table exists precisely
 * so that two names are recorded. Every transition is expressed as a method that either returns the next
 * state or throws, so no caller can move a request to APPROVED without going through the check.
 */
public final class ManualRecoveryRequest {

    /** The states a request moves through. */
    public enum Status {
        REQUESTED,
        APPROVED,
        REJECTED,
        EXECUTED,
        FAILED
    }

    private final String recoveryId;
    private final String requestedBy;
    private Status status;
    private String approvedBy;
    private String failureMessage;

    private ManualRecoveryRequest(String recoveryId, String requestedBy, Status status, String approvedBy,
                                  String failureMessage) {
        this.recoveryId = recoveryId;
        this.requestedBy = requestedBy;
        this.status = status;
        this.approvedBy = approvedBy;
        this.failureMessage = failureMessage;
    }

    /** A newly requested recovery, awaiting an approver. */
    public static ManualRecoveryRequest requested(String recoveryId, String requestedBy) {
        if (requestedBy == null || requestedBy.isBlank()) {
            throw new RecoveryNotAllowed("a recovery request has to name who asked for it");
        }
        return new ManualRecoveryRequest(recoveryId, requestedBy, Status.REQUESTED, null, null);
    }

    /** Rehydrates a request that was already decided. */
    public static ManualRecoveryRequest rehydrated(String recoveryId, String requestedBy, Status status,
                                                   String approvedBy, String failureMessage) {
        return new ManualRecoveryRequest(recoveryId, requestedBy, status, approvedBy, failureMessage);
    }

    /**
     * Approves the request.
     *
     * <p>Refused when the approver is the requester, and refused when the request is not awaiting approval,
     * so an already executed or rejected request cannot be re-approved to look authorised.
     */
    public void approve(String approver) {
        if (approver == null || approver.isBlank()) {
            throw new RecoveryNotAllowed("an approval has to name who approved it");
        }
        if (approver.equals(requestedBy)) {
            throw new RecoveryNotAllowed("the requester cannot approve their own recovery");
        }
        if (status != Status.REQUESTED) {
            throw new RecoveryNotAllowed("a recovery in state " + status + " cannot be approved");
        }
        this.approvedBy = approver;
        this.status = Status.APPROVED;
    }

    /** Rejects the request. The same independence rule applies, so a requester cannot bury their own request. */
    public void reject(String approver, String reason) {
        if (approver == null || approver.isBlank()) {
            throw new RecoveryNotAllowed("a rejection has to name who rejected it");
        }
        if (approver.equals(requestedBy)) {
            throw new RecoveryNotAllowed("the requester cannot reject their own recovery");
        }
        if (status != Status.REQUESTED) {
            throw new RecoveryNotAllowed("a recovery in state " + status + " cannot be rejected");
        }
        this.approvedBy = approver;
        this.failureMessage = reason;
        this.status = Status.REJECTED;
    }

    /**
     * Records that the approved recovery ran.
     *
     * <p>Refused unless the request was approved first, so an unapproved intervention cannot be executed and
     * then described as approved.
     */
    public void execute() {
        if (status == Status.REQUESTED) {
            throw new RecoveryNotAllowed("a recovery has to be approved before it is executed");
        }
        if (status != Status.APPROVED) {
            throw new RecoveryNotAllowed("a recovery in state " + status + " cannot be executed");
        }
        this.status = Status.EXECUTED;
    }

    /** Records a failed execution, keeping the reason. */
    public void fail(String message) {
        if (status != Status.APPROVED) {
            throw new RecoveryNotAllowed("a recovery in state " + status + " cannot fail from execution");
        }
        this.failureMessage = message;
        this.status = Status.FAILED;
    }

    public String recoveryId() {
        return recoveryId;
    }

    public String requestedBy() {
        return requestedBy;
    }

    public Status status() {
        return status;
    }

    public String approvedBy() {
        return approvedBy;
    }

    public String failureMessage() {
        return failureMessage;
    }

    /** Thrown when a transition the two-person rule forbids is attempted. */
    public static final class RecoveryNotAllowed extends RuntimeException {
        public RecoveryNotAllowed(String message) {
            super(message);
        }
    }
}
