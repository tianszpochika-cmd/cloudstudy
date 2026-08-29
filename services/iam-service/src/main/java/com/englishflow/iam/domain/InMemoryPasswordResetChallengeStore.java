package com.englishflow.iam.domain;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

public final class InMemoryPasswordResetChallengeStore implements PasswordResetChallengeStore {
    private final Map<String, PasswordResetChallenge> byId = new ConcurrentHashMap<>();
    private final Map<String, String> idByDigest = new ConcurrentHashMap<>();

    @Override
    public synchronized PasswordResetChallenge save(PasswordResetChallenge challenge) {
        byId.put(challenge.challengeId(), challenge);
        idByDigest.put(challenge.tokenDigest(), challenge.challengeId());
        return challenge;
    }

    @Override
    public Optional<PasswordResetChallenge> findByTokenDigest(String tokenDigest) {
        String id = idByDigest.get(tokenDigest);
        return id == null ? Optional.empty() : Optional.ofNullable(byId.get(id));
    }

    @Override
    public synchronized PasswordResetChallenge consume(String challengeId) {
        PasswordResetChallenge current = byId.get(challengeId);
        if (current == null) {
            throw new IamPolicyException(IamDecisionCode.PASSWORD_RESET_INVALID, "iam.password_reset.invalid");
        }
        if (current.consumed()) {
            throw new IamPolicyException(IamDecisionCode.PASSWORD_RESET_INVALID, "iam.password_reset.invalid");
        }
        PasswordResetChallenge consumed = current.consume();
        byId.put(challengeId, consumed);
        return consumed;
    }
}
