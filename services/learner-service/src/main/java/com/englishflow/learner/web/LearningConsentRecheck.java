package com.englishflow.learner.web;

/**
 * Reads the current learning-consent fact from IAM. A stale access-token claim is not authority
 * for this check. Implementations must fail closed: an unreadable fact is not a grant.
 */
public interface LearningConsentRecheck {

    boolean currentlyGranted(String principalId);
}
