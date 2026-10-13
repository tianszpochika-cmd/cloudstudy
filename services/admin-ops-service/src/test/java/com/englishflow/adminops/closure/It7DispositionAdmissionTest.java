package com.englishflow.adminops.closure;

import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** Disposition mutations stay frozen by default and execute when admitted. */
class It7DispositionAdmissionTest {

    private static It7ClosureStudio.Actor staff() {
        return new It7ClosureStudio.Actor("staff-1", true, Set.of("admin.risk.read"));
    }

    @Test
    void defaultStudioKeepsDispositionFrozen() {
        It7ClosureStudio studio = new It7ClosureStudio();
        It7ClosureStudio.Result board = studio.handle(staff(), "BOARD", Map.of());
        assertThat(board.data()).containsEntry("writeSwitch", "FROZEN").containsEntry("dispositionOpen", false);

        It7ClosureStudio.Result filed = studio.handle(staff(), "FILE", Map.of(
                "sourceRef", "src-1", "title", "案件甲", "idempotencyKey", "file-frozen-1"));
        String caseId = String.valueOf(filed.data().get("caseId"));
        It7ClosureStudio.Result triage = studio.handle(staff(), "TRIAGE", Map.of(
                "caseId", caseId, "idempotencyKey", "triage-frozen-1"));
        assertThat(triage.status()).isEqualTo(409);
        assertThat(triage.error()).containsEntry("code", "DISPOSITION_NOT_ADMITTED");
    }

    @Test
    void admittedStudioRunsTriageIsolateEscalateClose() {
        It7ClosureStudio studio = new It7ClosureStudio(new MemoryClosureDeskStore(), true);
        assertThat(studio.dispositionAdmitted()).isTrue();

        It7ClosureStudio.Result board = studio.handle(staff(), "BOARD", Map.of());
        assertThat(board.data()).containsEntry("writeSwitch", "OPEN").containsEntry("dispositionOpen", true)
                .containsEntry("dispositionButtons", true);

        It7ClosureStudio.Result filed = studio.handle(staff(), "FILE", Map.of(
                "sourceRef", "src-open-1", "title", "案件乙", "idempotencyKey", "file-open-1"));
        String caseId = String.valueOf(filed.data().get("caseId"));

        It7ClosureStudio.Result triage = studio.handle(staff(), "TRIAGE", Map.of(
                "caseId", caseId, "idempotencyKey", "triage-open-1"));
        assertThat(triage.status()).isEqualTo(200);
        assertThat(triage.data()).containsEntry("status", "TRIAGED").containsEntry("disposition", "IN_TRIAGE");

        It7ClosureStudio.Result isolate = studio.handle(staff(), "ISOLATE", Map.of(
                "caseId", caseId, "idempotencyKey", "isolate-open-1"));
        assertThat(isolate.status()).isEqualTo(200);
        assertThat(isolate.data()).containsEntry("status", "ISOLATED").containsEntry("dispatched", true);

        It7ClosureStudio.Result escalate = studio.handle(staff(), "ESCALATE", Map.of(
                "caseId", caseId, "idempotencyKey", "escalate-open-1"));
        assertThat(escalate.status()).isEqualTo(200);
        assertThat(escalate.data()).containsEntry("status", "ESCALATED").containsEntry("accepted", true);

        It7ClosureStudio.Result closed = studio.handle(staff(), "CLOSE", Map.of(
                "caseId", caseId, "idempotencyKey", "close-open-1"));
        assertThat(closed.status()).isEqualTo(200);
        assertThat(closed.data()).containsEntry("status", "CLOSED").containsEntry("closed", true);
    }

    @Test
    void admittedStudioRefusesCloseStraightFromFiled() {
        It7ClosureStudio studio = new It7ClosureStudio(new MemoryClosureDeskStore(), true);
        It7ClosureStudio.Result filed = studio.handle(staff(), "FILE", Map.of(
                "sourceRef", "src-open-2", "title", "案件丙", "idempotencyKey", "file-open-2"));
        String caseId = String.valueOf(filed.data().get("caseId"));
        It7ClosureStudio.Result closed = studio.handle(staff(), "CLOSE", Map.of(
                "caseId", caseId, "idempotencyKey", "close-early-1"));
        assertThat(closed.status()).isEqualTo(409);
        assertThat(closed.error()).containsEntry("code", "CHAIN_INCOMPLETE");
    }
}
