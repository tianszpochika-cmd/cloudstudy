package com.englishflow.learning.adapter.jdbc;

/** Durable adapter failure that must be surfaced as unavailable rather than as fixture data. */
public final class JdbcLearningPersistenceException extends RuntimeException {

    public JdbcLearningPersistenceException(String message, Throwable cause) {
        super(message, cause);
    }

    public JdbcLearningPersistenceException(String message) {
        super(message);
    }
}
