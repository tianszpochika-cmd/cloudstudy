package com.englishflow.iam.domain;

import java.util.Optional;

/** Fail-closed reset storage used when durable IAM persistence cannot be constructed. */
public final class FailClosedPasswordResetChallengeStore implements PasswordResetChallengeStore {

    @Override
    public PasswordResetChallenge save(PasswordResetChallenge challenge) {
        throw unavailable();
    }

    @Override
    public Optional<PasswordResetChallenge> findByTokenDigest(String tokenDigest) {
        throw unavailable();
    }

    @Override
    public PasswordResetChallenge consume(String challengeId) {
        throw unavailable();
    }

    private static IamPolicyException unavailable() {
        return new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.persistence.unavailable");
    }
}
