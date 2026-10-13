package com.englishflow.workflow.application;

/** Applies the real subject mutation for an approved recovery, through the subject's owner service. */
public interface RecoverySideEffectPort {

    /**
     * @param bearerToken the executor's verified access token, forwarded so the owner service
     *                    authorises and audits the mutation under the executor's own identity
     * @return a short audit detail of what changed
     * @throws com.englishflow.workflow.domain.ManualRecoveryRequest.RecoveryNotAllowed the owner refused definitively
     * @throws SideEffectUncertain the outcome is unknown (transport, 5xx); the request must stay retryable
     */
    String apply(String recoveryId, String subjectType, String subjectId, String action, String executor,
                 String bearerToken);

    /** Outcome unknown. The owner call is idempotent on the recovery id, so a retry is safe. */
    final class SideEffectUncertain extends RuntimeException {
        public SideEffectUncertain(String message) {
            super(message);
        }

        public SideEffectUncertain(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
