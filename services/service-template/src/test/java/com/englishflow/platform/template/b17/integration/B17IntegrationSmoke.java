package com.englishflow.platform.template.b17.integration;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/** Pure Java B17 integration contract smoke; it does not claim HTTP, MySQL, Kafka or Spring runtime. */
public final class B17IntegrationSmoke {
    public static void main(String[] args) {
        B17AuthorizationContext context = new B17AuthorizationContext("user-1", "platform", "user-1", "phase-1");
        LearningReadChain chain = new LearningReadChain(
                ignored -> Optional.of(new LearningReadChain.LearnerFact("user-1", "platform", "profile-1", "FOUNDATION", 1)),
                (ignored, contentId, version) -> Optional.of(new LearningReadChain.ContentFact(contentId, version, true, true, "rights-1")),
                (ignored, taskId, version) -> Optional.of(new LearningReadChain.LearningTaskFact(taskId, "user-1", version, "READY")));
        LearningReadChain.Result read = chain.load(new LearningReadChain.Request(context, "content-1", 3, "task-1"));
        require(read.status() == LearningReadChain.Status.READY, "read chain must be ready");

        Map<String, AssessmentLearningWriteChain.ProjectionResult> applied = new HashMap<>();
        AssessmentLearningWriteChain writes = new AssessmentLearningWriteChain(
                submission -> new AssessmentLearningWriteChain.AssessmentOutcome(
                        submission.context(), submission.attemptId(), submission.assessmentVersion(),
                        "assessment-event-1", "PASS", java.util.List.of(), "ADVANCED"),
                outcome -> applied.computeIfAbsent(outcome.sourceEventId(), ignored ->
                        new AssessmentLearningWriteChain.ProjectionResult("mastery-event-1", 1, false)));
        AssessmentLearningWriteChain.AssessmentSubmission submission = new AssessmentLearningWriteChain.AssessmentSubmission(
                context, "attempt-1", 3, "idempotency-1", "answer-digest");
        AssessmentLearningWriteChain.Result write = writes.submit(submission, 3);
        require(write.events().size() == 3, "write chain must expose submitted/assessed/mastery events");
        require(write.events().get(2).eventName().equals("learning.mastery.projected.v1"), "mastery event must be canonical");
        require(!write.assessment().toString().contains("answer"), "assessment outcome must not expose raw answer");
        System.out.println("B17 integration contract smoke: PASS");
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
