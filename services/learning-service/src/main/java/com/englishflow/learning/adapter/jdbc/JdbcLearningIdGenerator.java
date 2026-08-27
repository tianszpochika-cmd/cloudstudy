package com.englishflow.learning.adapter.jdbc;

import com.englishflow.learning.port.LearningIdGenerator;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

/** Allocates service-local numeric identifiers from the learning-owned sequence table. */
public final class JdbcLearningIdGenerator implements LearningIdGenerator {

    private final JdbcTemplate jdbc;

    public JdbcLearningIdGenerator(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public long nextId(String aggregateType) {
        if (aggregateType == null || !aggregateType.matches("[a-z][a-z0-9_]{1,63}")) {
            throw new IllegalArgumentException("aggregateType is invalid");
        }
        try {
            Long current = jdbc.queryForObject(
                    "SELECT next_value FROM learning_id_sequence WHERE aggregate_type = ? FOR UPDATE",
                    Long.class, aggregateType);
            if (current == null || current < 1) {
                throw new JdbcLearningPersistenceException("learning id sequence contains an invalid value");
            }
            jdbc.update("UPDATE learning_id_sequence SET next_value = next_value + 1 WHERE aggregate_type = ?",
                    aggregateType);
            return current;
        } catch (EmptyResultDataAccessException exception) {
            throw new JdbcLearningPersistenceException(
                    "learning id sequence is missing for aggregate: " + aggregateType, exception);
        }
    }
}
