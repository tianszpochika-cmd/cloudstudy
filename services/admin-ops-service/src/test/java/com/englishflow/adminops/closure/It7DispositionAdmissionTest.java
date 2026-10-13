package com.englishflow.adminops.closure;

import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** Disposition mutations stay frozen by default and execute when admitted. */
class It7DispositionAdmissionTest {

    private static It7ClosureStudio.Actor staff() {
        return new It7ClosureStudio.Actor("staff-1", true, Set.of("admin.risk.read", "admin.risk.write"));
    }

    private static It7ClosureStudio.Actor readOnly() {
        return new It7ClosureStudio.Actor("viewer-1", true, Set.of("admin.risk.read"));
    }

    private static It7ClosureStudio.Actor moderator() {
        return new It7ClosureStudio.Actor("mod-1", true, Set.of("admin.moderation.read", "admin.moderation.write"));
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

    @Test
    void readOnlyActorGets403OnEveryDispositionWhenAdmitted() {
        It7ClosureStudio studio = new It7ClosureStudio(new MemoryClosureDeskStore(), true);
        String caseId = String.valueOf(studio.handle(staff(), "FILE", Map.of(
                "sourceRef", "src-ro", "title", "只读", "idempotencyKey", "file-ro")).data().get("caseId"));
        for (String command : new String[] {"TRIAGE", "ISOLATE", "ESCALATE", "CLOSE"}) {
            It7ClosureStudio.Result denied = studio.handle(readOnly(), command, Map.of("caseId", caseId));
            assertThat(denied.status()).as(command).isEqualTo(403);
            assertThat(denied.error()).containsEntry("code", "CLOSURE_WRITE_FORBIDDEN");
        }
        assertThat(studio.handle(staff(), "CASES", Map.of()).data().get("items").toString()).contains("FILED");
        assertThat(studio.isolationWrites()).isZero();
    }

    @Test
    void readOnlyActorGets403WhileFrozenToo() {
        It7ClosureStudio studio = new It7ClosureStudio();
        String caseId = String.valueOf(studio.handle(staff(), "FILE", Map.of(
                "sourceRef", "src-ro2", "title", "只读2")).data().get("caseId"));
        assertThat(studio.handle(readOnly(), "TRIAGE", Map.of("caseId", caseId)).status()).isEqualTo(403);
    }

    @Test
    void moderationWritePermissionIsAccepted() {
        It7ClosureStudio studio = new It7ClosureStudio(new MemoryClosureDeskStore(), true);
        String caseId = String.valueOf(studio.handle(moderator(), "FILE", Map.of(
                "sourceRef", "src-mod", "title", "审核")).data().get("caseId"));
        assertThat(studio.handle(moderator(), "TRIAGE", Map.of("caseId", caseId)).status()).isEqualTo(200);
    }
}
