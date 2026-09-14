package com.englishflow.workflow.domain;

/**
 * Where a saga is.
 *
 * <p>The compensations are the point of this type. A saga that has completed steps and then fails has to
 * undo them in reverse order, so the states distinguish "failed, compensations still to run" from "failed,
 * compensations done" and from "compensations themselves failed", which is the state an operator has to be
 * called for.
 */
public enum SagaStatus {
    /** Accepted and no step has started. */
    STARTED,
    /** A step is in flight. */
    RUNNING,
    /** Every step completed. */
    COMPLETED,
    /** A step failed and its compensations have not run yet. */
    COMPENSATING,
    /** Every completed step was compensated. */
    COMPENSATED,
    /** A compensation failed, so the saga cannot finish without a person. */
    COMPENSATION_FAILED;

    /** Whether no further automatic transition is expected. */
    public boolean isTerminal() {
        return this == COMPLETED || this == COMPENSATED || this == COMPENSATION_FAILED;
    }

    /**
     * Whether an operator has to be involved.
     *
     * <p>A compensation that failed left the system in a state no automatic step will resolve, so it is
     * reported as needing a person rather than as finished.
     */
    public boolean needsOperator() {
        return this == COMPENSATION_FAILED;
    }
}
