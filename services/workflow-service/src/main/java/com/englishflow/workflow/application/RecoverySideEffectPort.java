package com.englishflow.workflow.application;

/** Applies the real subject mutation for an approved recovery. */
public interface RecoverySideEffectPort {

    /** @return a short audit detail of what changed */
    String apply(String recoveryId, String subjectType, String subjectId, String action, String executor);
}
