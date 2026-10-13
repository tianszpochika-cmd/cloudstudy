package com.englishflow.adminops.risk;

import com.englishflow.adminops.adapter.memory.InMemoryAuditTrail;
import com.englishflow.adminops.adapter.memory.InMemoryIdempotencyLedger;
import com.englishflow.adminops.adapter.memory.InMemoryRiskCaseStore;
import com.englishflow.adminops.domain.AdminOpsException;
import com.englishflow.adminops.domain.AdminPrincipal;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RiskCaseServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-28T00:00:00Z");

    private InMemoryRiskCaseStore cases;
    private RiskCaseService risks;
    private AdminPrincipal analyst;

    @BeforeEach
    void setUp() {
        cases = new InMemoryRiskCaseStore();
        risks = new RiskCaseService(Clock.fixed(NOW, ZoneOffset.UTC),
                new InMemoryAuditTrail(), new InMemoryIdempotencyLedger(), cases,
                (bearer, limit) -> List.of());
        analyst = AdminPrincipal.user("analyst-1", "platform", "admin.risk.read", "admin.risk.write");
    }

    private RiskFileDraft draft() {
        return new RiskFileDraft(RiskCategory.ACCOUNT_SECURITY, RiskSeverity.HIGH,
                "Suspicious lockout burst", "opaque-subject-1", List.of("iam:lockout"), "watch");
    }

    @Test
    void fileListDecideCloseFullCycle() {
        RiskDecisionResult filed = risks.file(analyst, draft(), "risk-file-key-00000001", null);
        assertFalse(filed.replayed());
        assertTrue(filed.kase().caseId().startsWith("rsk_"));
        assertEquals(RiskStatus.OPEN, filed.kase().status());

        assertEquals(1, risks.list(analyst).size());

        RiskDecisionResult triaged = risks.decide(analyst, filed.kase().caseId(), RiskCommand.TRIAGE,
                new RiskCaseService.RiskDecisionInput(RiskCommand.TRIAGE, "taking ownership", "analyst-1", null, null, null),
                "risk-decide-key-00000001", null);
        assertEquals(RiskStatus.TRIAGED, triaged.kase().status());
        assertEquals(1, triaged.kase().decisions().size());

        RiskDecisionResult isolated = risks.decide(analyst, filed.kase().caseId(), RiskCommand.ISOLATE,
                new RiskCaseService.RiskDecisionInput(RiskCommand.ISOLATE, "account stays locked",
                        null, "iam:lockout:opaque-subject-1", null, null),
                "risk-decide-key-00000002", null);
        assertEquals(RiskStatus.ACTIONED, isolated.kase().status());

        RiskDecisionResult closed = risks.decide(analyst, filed.kase().caseId(), RiskCommand.CLOSE,
                new RiskCaseService.RiskDecisionInput(RiskCommand.CLOSE, "no further anomaly", null, null, null, null),
                "risk-decide-key-00000003", null);
        assertEquals(RiskStatus.CLOSED, closed.kase().status());
        assertEquals(3, closed.kase().decisions().size());
    }

    @Test
    void invalidTransitionsFailClosed() {
        RiskDecisionResult filed = risks.file(analyst, draft(), "risk-file-key-00000002", null);
        // OPEN cannot ISOLATE directly.
        assertThrows(AdminOpsException.class, () -> risks.decide(analyst, filed.kase().caseId(),
                RiskCommand.ISOLATE,
                new RiskCaseService.RiskDecisionInput(RiskCommand.ISOLATE, "skip triage", null, "ref-1", null, null),
                "risk-decide-key-00000004", null));
        // ISOLATE without a containment receipt is rejected.
        risks.decide(analyst, filed.kase().caseId(), RiskCommand.TRIAGE,
                new RiskCaseService.RiskDecisionInput(RiskCommand.TRIAGE, "own it", null, null, null, null),
                "risk-decide-key-00000005", null);
        assertThrows(AdminOpsException.class, () -> risks.decide(analyst, filed.kase().caseId(),
                RiskCommand.ISOLATE,
                new RiskCaseService.RiskDecisionInput(RiskCommand.ISOLATE, "no receipt", null, null, null, null),
                "risk-decide-key-00000006", null));
        // ESCALATE needs a target.
        assertThrows(AdminOpsException.class, () -> risks.decide(analyst, filed.kase().caseId(),
                RiskCommand.ESCALATE,
                new RiskCaseService.RiskDecisionInput(RiskCommand.ESCALATE, "up", null, null, null, null),
                "risk-decide-key-00000007", null));
    }

    @Test
    void replayReturnsOriginalDecision() {
        RiskDecisionResult first = risks.file(analyst, draft(), "risk-file-key-00000003", null);
        RiskDecisionResult replay = risks.file(analyst, draft(), "risk-file-key-00000003", null);
        assertTrue(replay.replayed());
        assertEquals(first.kase().caseId(), replay.kase().caseId());
    }

    @Test
    void ruleEvaluationFilesOneCasePerSubjectPerDay() {
        RiskCaseService withHits = new RiskCaseService(Clock.fixed(NOW, ZoneOffset.UTC),
                new InMemoryAuditTrail(), new InMemoryIdempotencyLedger(), cases,
                (bearer, limit) -> List.of(
                        new LockedAccount("opaque-a", 7, NOW.plusSeconds(600), NOW),
                        new LockedAccount("opaque-b", 3, NOW.plusSeconds(600), NOW)));
        RiskCaseService.RiskEvaluateResult first =
                withHits.evaluateRules(analyst, null, "Bearer staff", "risk-eval-key-00000001", null);
        assertFalse(first.replayed());
        assertEquals(2, first.casesFiled());
        assertEquals(2, first.caseIds().size());

        RiskCaseService.RiskEvaluateResult second =
                withHits.evaluateRules(analyst, null, "Bearer staff", "risk-eval-key-00000002", null);
        assertEquals(0, second.casesFiled());

        RiskCaseService.RiskEvaluateResult replay =
                withHits.evaluateRules(analyst, null, "Bearer staff", "risk-eval-key-00000001", null);
        assertTrue(replay.replayed());
        assertEquals(2, replay.casesFiled());
    }

    @Test
    void readOnlyPrincipalGets403OnEveryGovernanceDecision() {
        RiskDecisionResult filed = risks.file(analyst, draft(), "risk-file-key-00000006", null);
        String caseId = filed.kase().caseId();
        AdminPrincipal reader = AdminPrincipal.user("reader-2", "platform", "admin.risk.read");
        // Only read permission: every governance write fails 403 before any state check.
        assertDecisionForbidden(reader, caseId, RiskCommand.TRIAGE,
                new RiskCaseService.RiskDecisionInput(RiskCommand.TRIAGE, "taking ownership", null, null, null, null),
                "risk-decide-key-00000008");
        assertDecisionForbidden(reader, caseId, RiskCommand.ISOLATE,
                new RiskCaseService.RiskDecisionInput(RiskCommand.ISOLATE, "account stays locked",
                        null, "iam:lockout:opaque-subject-1", null, null),
                "risk-decide-key-00000009");
        assertDecisionForbidden(reader, caseId, RiskCommand.ESCALATE,
                new RiskCaseService.RiskDecisionInput(RiskCommand.ESCALATE, "needs audit eyes",
                        null, null, "SUPPORT", null),
                "risk-decide-key-00000010");
        assertDecisionForbidden(reader, caseId, RiskCommand.CLOSE,
                new RiskCaseService.RiskDecisionInput(RiskCommand.CLOSE, "no further anomaly", null, null, null, null),
                "risk-decide-key-00000011");
        AdminOpsException fileError = assertThrows(AdminOpsException.class,
                () -> risks.file(reader, draft(), "risk-file-key-00000007", null));
        assertEquals(403, fileError.status());
        assertEquals("ADMIN_PERMISSION_DENIED", fileError.code());
        // Nothing mutated: the filed case is still OPEN with no decisions.
        assertEquals(RiskStatus.OPEN, risks.get(analyst, caseId).status());
        assertTrue(risks.get(analyst, caseId).decisions().isEmpty());
    }

    private void assertDecisionForbidden(AdminPrincipal reader, String caseId, RiskCommand command,
            RiskCaseService.RiskDecisionInput input, String idempotencyKey) {
        AdminOpsException error = assertThrows(AdminOpsException.class,
                () -> risks.decide(reader, caseId, command, input, idempotencyKey, null));
        assertEquals(403, error.status(), command.name());
        assertEquals("ADMIN_PERMISSION_DENIED", error.code(), command.name());
    }

    @Test
    void unknownRulesAndMissingPermsFailClosed() {
        assertThrows(AdminOpsException.class, () -> risks.evaluateRules(analyst,
                List.of("NOPE_RULE"), "Bearer staff", "risk-eval-key-00000003", null));
        AdminPrincipal reader = AdminPrincipal.user("reader-1", "platform", "admin.risk.read");
        assertThrows(AdminOpsException.class,
                () -> risks.file(reader, draft(), "risk-file-key-00000004", null));
        risks.file(analyst, draft(), "risk-file-key-00000005", null);
        assertEquals(1, risks.list(reader).size());
    }
}
