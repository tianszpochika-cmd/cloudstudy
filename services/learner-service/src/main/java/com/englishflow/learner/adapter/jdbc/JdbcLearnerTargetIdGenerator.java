package com.englishflow.learner.adapter.jdbc;

import com.englishflow.learner.domain.LearnerDecisionCode;
import com.englishflow.learner.domain.LearnerDomainException;
import com.englishflow.learner.domain.LearnerTenantScope;
import com.englishflow.learner.port.LearnerTargetIdGenerator;

import java.util.Objects;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

/** Allocates learner target ids from a row locked in the learner-owned MySQL schema. */
public final class JdbcLearnerTargetIdGenerator implements LearnerTargetIdGenerator {

    private static final String SEQUENCE_NAME = "learner-target";

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactionTemplate;

    public JdbcLearnerTargetIdGenerator(JdbcTemplate jdbc, TransactionTemplate transactionTemplate) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc is required");
        this.transactionTemplate = Objects.requireNonNull(transactionTemplate, "transactionTemplate is required");
    }

    @Override
    public long nextId(LearnerTenantScope scope) {
        Objects.requireNonNull(scope, "scope is required");
        try {
            Long allocated = transactionTemplate.execute(status -> {
                Long next = jdbc.queryForObject("""
                        SELECT next_value
                        FROM learner_target_sequence
                        WHERE sequence_name = ?
                        FOR UPDATE
                        """, Long.class, SEQUENCE_NAME);
                if (next == null || next < 1) {
                    throw new LearnerDomainException(LearnerDecisionCode.STORE_FAILURE,
                            "learner target sequence is invalid", true);
                }
                jdbc.update("""
                        UPDATE learner_target_sequence
                        SET next_value = ?
                        WHERE sequence_name = ?
                        """, next + 1, SEQUENCE_NAME);
                return next;
            });
            if (allocated == null || allocated < 1) {
                throw new LearnerDomainException(LearnerDecisionCode.STORE_FAILURE,
                        "learner target sequence returned no id", true);
            }
            return allocated;
        } catch (LearnerDomainException exception) {
            throw exception;
        } catch (DataAccessException exception) {
            throw new LearnerDomainException(LearnerDecisionCode.STORE_FAILURE,
                    "learner target id allocation failed", true);
        } catch (RuntimeException exception) {
            throw new LearnerDomainException(LearnerDecisionCode.STORE_FAILURE,
                    "learner target id allocation failed", true);
        }
    }
}
