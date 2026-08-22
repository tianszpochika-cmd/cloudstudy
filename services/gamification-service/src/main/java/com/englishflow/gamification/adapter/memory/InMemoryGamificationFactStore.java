package com.englishflow.gamification.adapter.memory;

import com.englishflow.gamification.domain.UserFacts;
import com.englishflow.gamification.port.GamificationFactStore;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

/** Deterministic local adapter used by smoke tests and the no-infrastructure dev profile. */
public final class InMemoryGamificationFactStore implements GamificationFactStore {

    private final ConcurrentHashMap<String, UserFacts> factsBySubject = new ConcurrentHashMap<>();

    @Override
    public <T> T inUserTransaction(String subjectId, Function<UserFacts, T> work) {
        UserFacts facts = factsBySubject.computeIfAbsent(subjectId, UserFacts::new);
        synchronized (facts) {
            return work.apply(facts);
        }
    }
}
