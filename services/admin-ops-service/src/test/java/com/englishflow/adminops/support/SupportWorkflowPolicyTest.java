package com.englishflow.adminops.support;

import com.englishflow.adminops.domain.AdminOpsException;
import com.englishflow.adminops.support.SupportWorkflowPolicy.Actor;
import com.englishflow.adminops.support.SupportWorkflowPolicy.Evidence;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SupportWorkflowPolicyTest {

    private static Evidence ready() {
        return new Evidence(4, 4, 2, true, true, true, true, false, true);
    }

    @Test
    void canonicalSevenStateJourneyNeedsOwnerEvidenceAndLearnerConfirmation() {
        assertThat(SupportWorkflowPolicy.requireTransition(SupportWorkflowState.OPEN,
                SupportWorkflowState.ASSIGNED, Actor.STAFF, ready())).isEqualTo(SupportWorkflowState.ASSIGNED);
        assertThat(SupportWorkflowPolicy.requireTransition(SupportWorkflowState.ASSIGNED,
                SupportWorkflowState.WAITING_USER, Actor.STAFF, ready())).isEqualTo(SupportWorkflowState.WAITING_USER);
        assertThat(SupportWorkflowPolicy.requireTransition(SupportWorkflowState.WAITING_USER,
                SupportWorkflowState.ASSIGNED, Actor.LEARNER, ready())).isEqualTo(SupportWorkflowState.ASSIGNED);
        assertThat(SupportWorkflowPolicy.requireTransition(SupportWorkflowState.ASSIGNED,
                SupportWorkflowState.WAITING_INTERNAL, Actor.STAFF, ready())).isEqualTo(SupportWorkflowState.WAITING_INTERNAL);
        assertThat(SupportWorkflowPolicy.requireTransition(SupportWorkflowState.WAITING_INTERNAL,
                SupportWorkflowState.RESOLVED, Actor.STAFF, ready())).isEqualTo(SupportWorkflowState.RESOLVED);
        assertThat(SupportWorkflowPolicy.requireTransition(SupportWorkflowState.RESOLVED,
                SupportWorkflowState.CLOSED, Actor.LEARNER, ready())).isEqualTo(SupportWorkflowState.CLOSED);
        assertThat(SupportWorkflowPolicy.requireTransition(SupportWorkflowState.CLOSED,
                SupportWorkflowState.REOPENED, Actor.LEARNER, ready())).isEqualTo(SupportWorkflowState.REOPENED);
        assertThat(SupportWorkflowPolicy.requireTransition(SupportWorkflowState.REOPENED,
                SupportWorkflowState.ASSIGNED, Actor.STAFF, ready())).isEqualTo(SupportWorkflowState.ASSIGNED);
    }

    @Test
    void staleVersionAndUnverifiedReferencesFailClosed() {
        rejects("SUPPORT_VERSION_CONFLICT", SupportWorkflowState.OPEN,
                SupportWorkflowState.ASSIGNED, Actor.STAFF,
                new Evidence(4, 3, 2, true, true, true, true, false, true));
        rejects("SUPPORT_CONTENT_UNVERIFIED", SupportWorkflowState.OPEN,
                SupportWorkflowState.ASSIGNED, Actor.STAFF,
                new Evidence(4, 4, 2, false, true, true, true, false, true));
        rejects("SUPPORT_RESOLUTION_UNVERIFIED", SupportWorkflowState.ASSIGNED,
                SupportWorkflowState.RESOLVED, Actor.STAFF,
                new Evidence(4, 4, 2, true, false, true, true, false, true));
        rejects("SUPPORT_INVALID_TRANSITION", SupportWorkflowState.OPEN,
                SupportWorkflowState.RESOLVED, Actor.STAFF, ready());
    }

    @Test
    void learnerCannotAssignOrCloseWithoutReconciliationAndReopenWindow() {
        rejects("SUPPORT_INVALID_TRANSITION", SupportWorkflowState.OPEN,
                SupportWorkflowState.ASSIGNED, Actor.LEARNER, ready());
        rejects("SUPPORT_INVALID_TRANSITION", SupportWorkflowState.RESOLVED,
                SupportWorkflowState.CLOSED, Actor.LEARNER,
                new Evidence(4, 4, 2, true, true, true, false, false, true));
        rejects("SUPPORT_INVALID_TRANSITION", SupportWorkflowState.CLOSED,
                SupportWorkflowState.REOPENED, Actor.LEARNER,
                new Evidence(4, 4, 2, true, true, true, true, false, false));
        rejects("SUPPORT_INVALID_TRANSITION", SupportWorkflowState.RESOLVED,
                SupportWorkflowState.CLOSED, Actor.STAFF, ready());
    }

    private static void rejects(String code, SupportWorkflowState from, SupportWorkflowState to,
            Actor actor, Evidence evidence) {
        assertThatThrownBy(() -> SupportWorkflowPolicy.requireTransition(from, to, actor, evidence))
                .isInstanceOfSatisfying(AdminOpsException.class,
                        error -> assertThat(error.code()).isEqualTo(code));
    }
}
