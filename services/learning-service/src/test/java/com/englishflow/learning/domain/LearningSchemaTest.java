package com.englishflow.learning.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Single learning-owned fact boundary; learning-service never touches another schema. */
class LearningSchemaTest {

    @Test
    void ownedFactsIncludeLearningSchema() {
        assertThat(LearningSchema.ownedFacts()).contains("srs_state");
        assertThat(LearningSchema.ownedFacts()).contains("mastery_projection");
        assertThat(LearningSchema.ownedFacts()).contains("learning_plan");
        assertThat(LearningSchema.ownedFacts()).contains("outbox_event");
    }

    @Test
    void requireOwnedFactAcceptsKnownAndRejectsForeignFacts() {
        LearningSchema.requireOwnedFact("srs_state");
        assertThatThrownBy(() -> LearningSchema.requireOwnedFact("content_version"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot access fact");
        assertThatThrownBy(() -> LearningSchema.requireOwnedFact(null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void serviceOwnerIsLearningService() {
        assertThat(LearningSchema.SERVICE_OWNER).isEqualTo("learning-service");
        assertThat(LearningSchema.SCHEMA_NAME).isEqualTo("learning_service");
    }
}
