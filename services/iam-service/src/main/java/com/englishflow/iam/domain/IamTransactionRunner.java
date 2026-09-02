package com.englishflow.iam.domain;

import java.util.function.Supplier;

/**
 * Application transaction boundary used by workflows that span more than one IAM store.
 * The production composition root supplies a JDBC transaction implementation; unit tests may
 * use the direct implementation without pretending that an in-memory store is a database.
 */
@FunctionalInterface
public interface IamTransactionRunner {

    <T> T execute(Supplier<T> operation);

    static IamTransactionRunner direct() {
        return new IamTransactionRunner() {
            @Override public <T> T execute(Supplier<T> operation) { return operation.get(); }
        };
    }
}
