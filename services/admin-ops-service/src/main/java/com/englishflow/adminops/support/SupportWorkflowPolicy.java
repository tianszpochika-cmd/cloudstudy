package com.englishflow.adminops.support;

import com.englishflow.adminops.domain.AdminOpsException;

/** Pure transition policy. The owner must verify evidence before setting any evidence flag. */
public final class SupportWorkflowPolicy {

    public enum Actor { LEARNER, STAFF, SYSTEM }

    public record Evidence(
            long currentVersion,
            long expectedVersion,
            long assignmentVersion,
            boolean verifiedContentRef,
            boolean verifiedOwnerResult,
            boolean resolutionReady,
            boolean ownerReconciled,
            boolean legalHold,
            boolean withinReopenWindow) { }

    private SupportWorkflowPolicy() { }

    public static SupportWorkflowState requireTransition(
            SupportWorkflowState from, SupportWorkflowState to, Actor actor, Evidence evidence) {
        if (from == null || to == null || actor == null || evidence == null) {
            throw AdminOpsException.invalid("SUPPORT_TRANSITION_INVALID", "transition context is required");
        }
        if (evidence.currentVersion() < 1 || evidence.expectedVersion() != evidence.currentVersion()) {
            throw AdminOpsException.conflict("SUPPORT_VERSION_CONFLICT", "ticket changed; reload before retrying");
        }
        if (!evidence.verifiedContentRef()) {
            throw AdminOpsException.unprocessable("SUPPORT_CONTENT_UNVERIFIED", "verified content reference is required");
        }
        boolean staff = actor == Actor.STAFF;
        boolean allowed = switch (from) {
            case OPEN -> to == SupportWorkflowState.ASSIGNED && staff && evidence.assignmentVersion() > 0;
            case ASSIGNED -> staff && (to == SupportWorkflowState.WAITING_USER
                    || to == SupportWorkflowState.WAITING_INTERNAL
                    || to == SupportWorkflowState.RESOLVED);
            case WAITING_USER -> (to == SupportWorkflowState.ASSIGNED
                    && (staff || actor == Actor.LEARNER))
                    || (to == SupportWorkflowState.RESOLVED && staff);
            case WAITING_INTERNAL -> staff && evidence.verifiedOwnerResult()
                    && (to == SupportWorkflowState.ASSIGNED || to == SupportWorkflowState.RESOLVED);
            case RESOLVED -> (to == SupportWorkflowState.CLOSED
                    && (actor == Actor.LEARNER || actor == Actor.SYSTEM)
                    && evidence.ownerReconciled() && !evidence.legalHold())
                    || (to == SupportWorkflowState.REOPENED && actor == Actor.LEARNER
                    && evidence.withinReopenWindow());
            case CLOSED -> to == SupportWorkflowState.REOPENED && actor == Actor.LEARNER
                    && evidence.withinReopenWindow() && !evidence.legalHold();
            case REOPENED -> to == SupportWorkflowState.ASSIGNED && staff && evidence.assignmentVersion() > 0;
        };
        if (!allowed) {
            throw AdminOpsException.conflict("SUPPORT_INVALID_TRANSITION", "ticket state cannot accept this action");
        }
        if (to == SupportWorkflowState.RESOLVED
                && (!evidence.resolutionReady() || !evidence.verifiedOwnerResult())) {
            throw AdminOpsException.unprocessable("SUPPORT_RESOLUTION_UNVERIFIED",
                    "verified owner result and resolution are required");
        }
        return to;
    }
}
