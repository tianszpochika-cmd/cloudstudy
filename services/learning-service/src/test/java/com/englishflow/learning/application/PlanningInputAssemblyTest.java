package com.englishflow.learning.application;

import com.englishflow.learning.adapter.http.VerifiedPlacementReport.PlacementPins;
import com.englishflow.learning.domain.LearningItemType;
import com.englishflow.learning.domain.LearningPlan;
import com.englishflow.learning.domain.LearningPlanStatus;
import com.englishflow.learning.domain.LearningTask;
import com.englishflow.learning.domain.LearningTaskType;
import com.englishflow.learning.domain.LearningTenantScope;
import com.englishflow.learning.port.LearnerTargetPort.LearnerTargetSnapshot;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The assembled planning input carries exactly the B9 contract required
 * fields (no missing pin, no extra leak) and the plan reference binds to it.
 */
class PlanningInputAssemblyTest {

    private static final Set<String> INPUT_KEYS = Set.of("pinId", "pinVersion", "pinDigest",
            "targetId", "targetVersion", "profileVersion", "preferenceVersion", "goalCatalogVersion",
            "dailyQuotaMinutes", "timezone", "weeklyStudyDays", "contentLocale", "contentVersionId",
            "contentEpoch", "projectionVersion", "rightsSnapshotVersion", "eligibilitySnapshotVersion",
            "eligibilitySnapshotDigest", "placementBaseline", "planningRuleVersion", "inputFactWatermark",
            "sourceEventId", "rootEventId");
    private static final Set<String> PLAN_REF_KEYS = Set.of("planId", "planVersion",
            "planningInputPinId", "planningInputPinVersion", "planningInputDigest", "inputFactWatermark",
            "contentEpoch", "projectionVersion", "generatedAt");
    private static final Set<String> BASELINE_KEYS = Set.of("resultKind", "placementSessionId",
            "sessionStateVersion", "sessionSnapshotDigest", "placementResultId", "resultVersion",
            "resultDigest", "reportId", "reportVersion", "reportDigest", "baselineConfidence",
            "referenceLevel", "completionStatus", "manifest", "contentPin", "answerRulePin",
            "targetPin", "completedAt", "sourceEventId", "rootEventId", "placementFactWatermark");

    @Test
    @SuppressWarnings("unchecked")
    void assemblyCarriesExactlyTheContractFields() {
        Instant now = Instant.parse("2026-09-27T12:00:00Z");
        PlacementPins pins = pins();
        LearnerTargetSnapshot target = new LearnerTargetSnapshot(
                LearningTenantScope.forPhaseOne("prn_plantest0000001", 7001),
                71001L, "zero_basis", 15, "Asia/Shanghai", 266100L, 3L);
        LearningPlan plan = LearningPlan.draft(100001L,
                LearningTenantScope.forPhaseOne("prn_plantest0000001", 7001),
                71001L, "zero_basis", 266100L, 1L, "Asia/Shanghai", 15,
                List.of(LearningTask.planned(200001L, LearningTaskType.GRAMMAR_PRACTICE, 266004L,
                        266100L, LocalDate.of(2026, 9, 27), now)),
                now);
        PlanningInputAssembler.AssembledPlanView view = PlanningInputAssembler.assemble(pins, target,
                5L, 2L, "en-US", List.of(1, 2, 3, 4, 5, 6, 7), plan, 1L,
                "c172aa8f-adfa-4eb8-b243-379a5903fbf8", "platform", "PASSED", "GRANTED", now);

        assertEquals(INPUT_KEYS, view.planningInput().keySet());
        assertEquals(PLAN_REF_KEYS, view.planRef().keySet());
        assertEquals(BASELINE_KEYS, ((Map<String, Object>) view.planningInput().get("placementBaseline")).keySet());
        assertTrue(view.pinDigest().matches("[a-f0-9]{64}"));
        assertTrue(view.watermark().matches("[a-f0-9]{64}"));
        assertEquals("plan-pin-71001-266100", view.pinId());
        assertEquals("plan-100001", view.planRef().get("planId"));
        assertEquals(view.pinDigest(), view.planRef().get("planningInputDigest"));
        assertEquals(view.watermark(), view.planRef().get("inputFactWatermark"));
        assertEquals(view.watermark(), view.planningInput().get("inputFactWatermark"));
        assertEquals("P1_PLAN_ASSEMBLY_V1", view.planningInput().get("planningRuleVersion"));
        assertEquals(List.of(1, 2, 3, 4, 5, 6, 7), view.planningInput().get("weeklyStudyDays"));
    }

    @Test
    void uuidSubjectsAreAcceptedAsVerifiedCallerIdentity() {
        LearningTenantScope scope = LearningTenantScope.forPhaseOne("c172aa8f-adfa-4eb8-b243-379a5903fbf8",
                LearningTenantScope.stableUserIdFor("c172aa8f-adfa-4eb8-b243-379a5903fbf8"));
        assertTrue(scope.userId() > 0);
    }

    private static PlacementPins pins() {
        Map<String, Object> manifest = Map.of("placementManifestId", "P1_PLACEMENT_V1",
                "placementManifestVersion", "P1_PLACEMENT_V1",
                "placementManifestDigest", "a".repeat(64), "dimensionSetDigest", "b".repeat(64),
                "totalItemCount", 10);
        return new PlacementPins("asess_abc", 11L, "c".repeat(64), "plr_abc", 1L, "d".repeat(64),
                "rpt_abc", 1L, "e".repeat(64), "ASSESSED", "HIGH", "C2", "2026-09-27T12:00:00Z",
                71001L, 3L, "f".repeat(64), 266100L, 1L, "snap_p1.placement.v1-266100",
                "a".repeat(64), "p1-placement-bank-v1", "p1-choice-v1", "b".repeat(64), manifest);
    }
}
