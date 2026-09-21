package com.englishflow.workflow.application;

/**
 * Transport that asks an owning service to undo a completed saga step.
 *
 * <p>There is deliberately no default implementation that pretends success: a
 * compensation name without a registered transport must fail loudly
 * (COMPENSATION_FAILED, operator-visible) instead of being recorded as
 * APPLIED. Owner transports plug in here as M2-006 follow-up work without
 * touching the executor.
 */
public interface CompensationTransport {

    /**
     * Sends one named compensation to its owner. Throws when the compensation
     * cannot be delivered; the executor records the failure and moves the saga
     * to COMPENSATION_FAILED rather than mis-recording success.
     */
    void send(String compensationName);
}
