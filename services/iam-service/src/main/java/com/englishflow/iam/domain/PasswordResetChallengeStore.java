package com.englishflow.iam.domain;

import java.util.Optional;

public interface PasswordResetChallengeStore {
    PasswordResetChallenge save(PasswordResetChallenge challenge);
    Optional<PasswordResetChallenge> findByTokenDigest(String tokenDigest);
    PasswordResetChallenge consume(String challengeId);
}
