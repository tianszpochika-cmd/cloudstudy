package com.englishflow.learning.application;

import com.englishflow.learning.adapter.http.VerifiedPlacementReport.PlacementPins;
import com.englishflow.learning.domain.LearningPlan;
import com.englishflow.learning.port.LearnerTargetPort.LearnerTargetSnapshot;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Assembles the immutable B9 planning-input snapshot and plan reference for
 * plans:ensure. Pure function: every field comes from a verified upstream
 * fact (placement report+session, active target, profile/preferences, bank
 * pins); the only owned constants are the rule/frozen-catalog identifiers
 * documented below. Key sets mirror the B9 contract required lists exactly;
 * see PlanningInputAssemblyTest.
 *
 * <p>Owner-defined constants (learning-service facts, not user data):
 * <ul>
 *   <li>{@code P1_PLAN_ASSEMBLY_V1} — the frozen plan assembly rule version;</li>
 *   <li>{@code p1-goal-catalog-v1} — the frozen Phase-1 goal catalog identifier;</li>
 *   <li>eligibility observation schema v1 — digest over the verified JWT
 *   eligibility facts (subject, tenant, adult gate, consent);</li>
 *   <li>rights snapshot ≡ the pinned content version's {@code state_version};</li>
 *   <li>source/root event ids derived deterministically from the placement
 *   session (first completion root, stored immutably).</li>
 * </ul>
 */
public final class PlanningInputAssembler {

    public static final String PLANNING_RULE_VERSION = "P1_PLAN_ASSEMBLY_V1";
    public static final String GOAL_CATALOG_VERSION = "p1-goal-catalog-v1";
    public static final long PROJECTION_VERSION = 1L;

    public record AssembledPlanView(
            Map<String, Object> planningInput,
            Map<String, Object> planRef,
            String pinId,
            long pinVersion,
            String pinDigest,
            String watermark) {
    }

    private PlanningInputAssembler() {
    }

    public static AssembledPlanView assemble(
            PlacementPins pins,
            LearnerTargetSnapshot target,
            long profileVersion,
            long preferenceVersion,
            String contentLocale,
            List<Integer> weeklyStudyDays,
            LearningPlan plan,
            long rightsStateVersion,
            String subject,
            String tenant,
            String adultGate,
            String consentState,
            Instant now) {
        String pinId = "plan-pin-" + target.targetId() + "-" + target.contentVersionId();
        long pinVersion = 1L;
        String pinDigest = sha256(String.join("|", pinId,
                String.valueOf(target.targetId()), String.valueOf(target.targetVersion()),
                digestOf(target), String.valueOf(target.contentVersionId()),
                String.valueOf(pins.contentVersionId()), pins.snapshotHash(), pins.ruleDigest()));
        String sourceEventId = "derived:assessment.placement.completed.v1:placement-" + pins.sessionId();
        String rootEventId = sourceEventId;
        String placementFactWatermark = sha256(pins.sessionSnapshotDigest() + "|" + pins.reportDigest());
        String eligibilityDigest = sha256(String.join("|", subject, tenant, adultGate, consentState));

        Map<String, Object> baseline = new LinkedHashMap<>();
        baseline.put("resultKind", pins.resultKind());
        baseline.put("placementSessionId", pins.sessionId());
        baseline.put("sessionStateVersion", pins.sessionStateVersion());
        baseline.put("sessionSnapshotDigest", pins.sessionSnapshotDigest());
        baseline.put("placementResultId", pins.placementResultId());
        baseline.put("resultVersion", pins.resultVersion());
        baseline.put("resultDigest", pins.resultDigest());
        baseline.put("reportId", pins.reportId());
        baseline.put("reportVersion", pins.reportVersion());
        baseline.put("reportDigest", pins.reportDigest());
        baseline.put("baselineConfidence", pins.confidence());
        baseline.put("referenceLevel", pins.referenceLevel());
        baseline.put("completionStatus", "COMPLETED");
        baseline.put("manifest", pins.manifest());
        Map<String, Object> contentPin = new LinkedHashMap<>();
        contentPin.put("contentVersionId", pins.contentVersionId());
        contentPin.put("contentEpoch", pins.contentEpoch());
        contentPin.put("snapshotId", pins.snapshotId());
        contentPin.put("snapshotHash", pins.snapshotHash());
        baseline.put("contentPin", contentPin);
        Map<String, Object> rulePin = new LinkedHashMap<>();
        rulePin.put("answerRuleSetVersion", pins.answerRuleSetVersion());
        rulePin.put("answerRuleVersion", pins.answerRuleVersion());
        rulePin.put("ruleDigest", pins.ruleDigest());
        rulePin.put("completionRuleVersion", "P1_PLACEMENT_V1");
        baseline.put("answerRulePin", rulePin);
        Map<String, Object> targetPin = new LinkedHashMap<>();
        targetPin.put("targetId", pins.targetId());
        targetPin.put("targetVersion", pins.targetVersion());
        targetPin.put("targetSnapshotDigest", pins.targetSnapshotDigest());
        baseline.put("targetPin", targetPin);
        baseline.put("completedAt", pins.completedAt());
        baseline.put("sourceEventId", sourceEventId);
        baseline.put("rootEventId", rootEventId);
        baseline.put("placementFactWatermark", placementFactWatermark);

        Map<String, Object> input = new LinkedHashMap<>();
        input.put("pinId", pinId);
        input.put("pinVersion", pinVersion);
        input.put("pinDigest", pinDigest);
        input.put("targetId", target.targetId());
        input.put("targetVersion", target.targetVersion());
        input.put("profileVersion", profileVersion);
        input.put("preferenceVersion", preferenceVersion);
        input.put("goalCatalogVersion", GOAL_CATALOG_VERSION);
        input.put("dailyQuotaMinutes", target.dailyQuotaMinutes());
        input.put("timezone", target.timeZoneId());
        input.put("weeklyStudyDays", new ArrayList<>(weeklyStudyDays));
        input.put("contentLocale", contentLocale);
        input.put("contentVersionId", target.contentVersionId());
        input.put("contentEpoch", pins.contentEpoch());
        input.put("projectionVersion", PROJECTION_VERSION);
        input.put("rightsSnapshotVersion", rightsStateVersion);
        input.put("eligibilitySnapshotVersion", 1L);
        input.put("eligibilitySnapshotDigest", eligibilityDigest);
        input.put("placementBaseline", baseline);
        input.put("planningRuleVersion", PLANNING_RULE_VERSION);
        String watermark = sha256(String.join("|", pinDigest, placementFactWatermark,
                String.valueOf(profileVersion), String.valueOf(preferenceVersion),
                String.valueOf(plan.planId()), String.valueOf(plan.version())));
        input.put("inputFactWatermark", watermark);
        input.put("sourceEventId", sourceEventId);
        input.put("rootEventId", rootEventId);

        Map<String, Object> planRef = new LinkedHashMap<>();
        planRef.put("planId", "plan-" + plan.planId());
        planRef.put("planVersion", plan.version());
        planRef.put("planningInputPinId", pinId);
        planRef.put("planningInputPinVersion", pinVersion);
        planRef.put("planningInputDigest", pinDigest);
        planRef.put("inputFactWatermark", watermark);
        planRef.put("contentEpoch", pins.contentEpoch());
        planRef.put("projectionVersion", PROJECTION_VERSION);
        planRef.put("generatedAt", now.toString());

        return new AssembledPlanView(Map.copyOf(input), Map.copyOf(planRef),
                pinId, pinVersion, pinDigest, watermark);
    }

    private static String digestOf(LearnerTargetSnapshot target) {
        return sha256(target.targetId() + "|" + target.targetVersion() + "|"
                + target.goalCode() + "|" + target.dailyQuotaMinutes() + "|"
                + target.timeZoneId() + "|" + target.contentVersionId());
    }

    public static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
