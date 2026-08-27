package com.englishflow.gamification.adapter.failclosed;

import com.englishflow.gamification.domain.GamificationPersistenceException;
import com.englishflow.gamification.domain.UserFacts;
import com.englishflow.gamification.port.GamificationFactStore;
import java.util.function.Function;

/**
 * Safe local-real boundary until the complete gamification aggregate has a durable adapter.
 * It never creates an in-memory aggregate and never returns an empty success response.
 */
public final class FailClosedGamificationFactStore implements GamificationFactStore {

    @Override
    public <T> T inUserTransaction(String subjectId, Function<UserFacts, T> work) {
        throw GamificationPersistenceException.localRealUnavailable(
                "gamification owner-schema JDBC aggregate store");
    }
}
