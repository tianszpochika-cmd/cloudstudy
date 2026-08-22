package com.englishflow.learning.domain;

import java.util.Set;

/**
 * The single ownership boundary for learning facts. A JDBC/Flyway adapter may map these names to
 * tables later; no domain code is allowed to read or write another service's schema.
 */
public final class LearningSchema {

    public static final String SERVICE_OWNER = "learning-service";
    public static final String SCHEMA_NAME = "learning_service";
    private static final Set<String> OWNED_FACTS = Set.of(
            "learning_plan",
            "learning_task",
            "learning_progress",
            "srs_state",
            "review_event",
            "mastery_projection",
            "idempotency_record",
            "outbox_event");

    private LearningSchema() {
    }

    public static Set<String> ownedFacts() {
        return OWNED_FACTS;
    }

    public static void requireOwnedFact(String factName) {
        if (!OWNED_FACTS.contains(factName)) {
            throw new IllegalArgumentException("learning-service cannot access fact: " + factName);
        }
    }
}
