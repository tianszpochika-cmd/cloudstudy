package com.englishflow.learning.adapter.failclosed;

/** Explicit runtime signal for a service started without a durable store or approved fixture. */
public final class LearningPersistenceUnavailableException extends RuntimeException {

    public LearningPersistenceUnavailableException(String message) {
        super(message);
    }
}
