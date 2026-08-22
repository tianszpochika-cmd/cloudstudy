package com.englishflow.gamification.port;

import com.englishflow.gamification.domain.UserFacts;
import java.util.function.Function;

/** Transaction seam for the service-owned gamification facts. */
public interface GamificationFactStore {

    <T> T inUserTransaction(String subjectId, Function<UserFacts, T> work);
}
