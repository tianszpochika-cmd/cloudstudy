package com.englishflow.adminops.closure;

import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class It7ClosureStudioTest {

    private final It7ClosureStudio studio = new It7ClosureStudio();

    @Test
    void frozenLockIsReadableAndDoesNotExecute() {
        It7ClosureStudio.Result read = studio.handle(staff(), "LOCK_READ", Map.of());
        assertThat(read.status()).isEqualTo(200);
        assertThat(read.data()).containsEntry("writeSwitch", "FROZEN").containsEntry("executed", false);
        assertThat(read.data().get("reason")).asString().isNotBlank();
        assertThat(read.data().get("impact")).asString().isNotBlank();
        assertThat(read.data().get("recovery")).asString().isNotBlank();
        assertThat(studio.handle(learner(), "LOCK_READ", Map.of()).status()).isEqualTo(403);
    }

    @Test
    void filingRequiresASourceAndRejectsSamples() {
        assertThat(studio.handle(staff(), "FILE", Map.of("title", "无来源")).status()).isEqualTo(400);
        assertThat(studio.handle(staff(), "FILE", Map.of("sample", true, "sourceRef", "demo")).error().get("code"))
                .isEqualTo("SAMPLE_REJECTED");
        assertThat(studio.caseCount()).isZero();
        It7ClosureStudio.Result filed = studio.handle(staff(), "FILE", Map.of(
                "sourceRef", "report-source-1", "title", "有来源", "idempotencyKey", "file-1"));
        assertThat(filed.status()).isEqualTo(200);
        assertThat(filed.data()).containsEntry("status", "FILED").containsEntry("disposition", "NOT_STARTED");
        assertThat(studio.handle(staff(), "FILE", Map.of(
                "sourceRef", "report-source-1", "title", "有来源", "idempotencyKey", "file-1")).data().get("caseId"))
                .isEqualTo(filed.data().get("caseId"));
        assertThat(studio.caseCount()).isEqualTo(1);
    }

    @Test
    void dispositionWritesStayClosed() {
        String caseId = fileOne();
        It7ClosureStudio.Result triage = studio.handle(writer(), "TRIAGE", Map.of("caseId", caseId));
        assertThat(triage.error()).containsEntry("code", "DISPOSITION_NOT_ADMITTED").containsEntry("dispatched", false);
        It7ClosureStudio.Result isolate = studio.handle(writer(), "ISOLATE", Map.of("caseId", caseId, "idempotencyKey", "iso-1"));
        assertThat(isolate.error()).containsEntry("unlockAvailable", false).containsEntry("sameAsLock", false);
        assertThat(studio.handle(writer(), "ISOLATE", Map.of("caseId", caseId, "idempotencyKey", "iso-1")).error())
                .containsEntry("isolationWrites", 0);
        assertThat(studio.isolationWrites()).isZero();
        It7ClosureStudio.Result escalate = studio.handle(writer(), "ESCALATE", Map.of("caseId", caseId));
        assertThat(escalate.error()).containsEntry("code", "RECEIVER_UNAVAILABLE").containsEntry("accepted", false)
                .containsEntry("originalRetained", true);
        It7ClosureStudio.Result close = studio.handle(writer(), "CLOSE", Map.of("caseId", caseId));
        assertThat(close.error()).containsEntry("code", "CHAIN_INCOMPLETE").containsEntry("closed", false)
                .containsEntry("claimsFullChain", false);
        assertThat(studio.handle(staff(), "CASES", Map.of()).data().get("items")).asList().hasSize(1);
    }

    @Test
    void emptyCasesAndForbiddenAccessStayDistinct() {
        It7ClosureStudio.Result empty = studio.handle(staff(), "CASES", Map.of());
        assertThat(empty.data()).containsEntry("casesState", "NO_CASES");
        It7ClosureStudio.Result denied = studio.handle(learner(), "CASES", Map.of());
        assertThat(denied.status()).isEqualTo(403);
        assertThat(denied.error()).containsEntry("casesState", "FORBIDDEN");
        assertThat(denied.error()).doesNotContainKey("items");
        assertThat(denied.data()).isNull();
    }

    @Test
    void riskRouteIsNotIndependentAndReportsStayReadOnly() {
        fileOne();
        It7ClosureStudio.Result route = studio.handle(learner(), "RISK_ROUTE", Map.of());
        assertThat(route.data()).containsEntry("independentRiskRoute", false)
                .containsEntry("redirect", "/governance")
                .containsEntry("bypass", false);
        It7ClosureStudio.Result reports = studio.handle(staff(), "REPORTS", Map.of());
        assertThat(reports.data()).containsEntry("dispositionButtons", false).containsEntry("readOnly", true);
        Map<?, ?> report = (Map<?, ?>) ((java.util.List<?>) reports.data().get("items")).get(0);
        assertThat(report.get("readOnly")).isEqualTo(true);
        assertThat(report.containsKey("sourceRef")).isFalse();
        assertThat(studio.handle(It7ClosureStudio.Actor.anonymous(), "REPORTS", Map.of()).status()).isEqualTo(401);
        assertThat(studio.handle(learner(), "REPORTS", Map.of()).status()).isEqualTo(403);
    }

    @Test
    void ticketSubmitDoesNotOpenAClosedLoop() {
        It7ClosureStudio.Result submit = studio.handle(learner(), "TICKET_SUBMIT", Map.of(
                "bodyHash", "abc123hash", "description", "不要保存这段正文", "idempotencyKey", "ticket-1"));
        assertThat(submit.error()).containsEntry("code", "DEC06_NOT_APPROVED")
                .containsEntry("understandable", false)
                .containsEntry("storedRawText", false);
        assertThat(studio.handle(learner(), "TICKET_SUBMIT", Map.of(
                "bodyHash", "abc123hash", "description", "不要保存这段正文", "idempotencyKey", "ticket-1")).error().get("code"))
                .isEqualTo("DEC06_NOT_APPROVED");
        It7ClosureStudio.Result list = studio.handle(learner(), "TICKETS", Map.of());
        assertThat(list.data().get("items")).asList().hasSize(1);
        Map<?, ?> ticket = (Map<?, ?>) ((java.util.List<?>) list.data().get("items")).get(0);
        assertThat(ticket.get("information")).isEqualTo("INSUFFICIENT");
        assertThat(ticket.get("reply")).isNull();
        assertThat(ticket.get("resolved")).isEqualTo(false);
        assertThat(studio.handle(staff(), "TICKETS", Map.of()).data().get("items")).asList().isEmpty();
        assertThat(studio.handle(staff(), "TICKET_GET", Map.of("ticketId", ticket.get("ticketId"))).error().get("code"))
                .isEqualTo("TICKET_NOT_VISIBLE");
        assertThat(studio.handle(learner(), "TICKET_GET", Map.of("ticketId", "missing")).error().get("code"))
                .isEqualTo("TICKET_NOT_VISIBLE");
    }

    @Test
    void exportDeletionAudioAndWorkerStayPartial() {
        assertThat(studio.handle(learner(), "EXPORT", Map.of()).error().get("code")).isEqualTo("IDENTITY_UNCONFIRMED");
        It7ClosureStudio.Result queued = studio.handle(learner(), "EXPORT", Map.of("confirmed", true, "idempotencyKey", "ex-1"));
        assertThat(queued.data()).containsEntry("state", "QUEUED").containsEntry("allComplete", false);
        assertThat(studio.handle(learner(), "EXPORT", Map.of("confirmed", true, "mark", "COMPLETE")).error())
                .containsEntry("code", "WORKER_GAP").containsEntry("allComplete", false);
        assertThat(studio.handle(learner(), "DELETE", Map.of()).error().get("code")).isEqualTo("SECOND_FACTOR_REQUIRED");
        It7ClosureStudio.Result deletion = studio.handle(learner(), "DELETE", Map.of("secondFactor", true, "idempotencyKey", "del-1"));
        assertThat(deletion.data()).containsEntry("accepted", true).containsEntry("accessStopped", false)
                .containsEntry("ownersComplete", false).containsEntry("dataDeleted", false)
                .containsEntry("tokenRevokeMeansDeleted", false);
        assertThat(studio.handle(learner(), "DELETE", Map.of("secondFactor", true, "idempotencyKey", "del-1")).data().get("deletionId"))
                .isEqualTo(deletion.data().get("deletionId"));
        assertThat(studio.handle(learner(), "AUDIO", Map.of("retentionDays", 30)).error().get("code")).isEqualTo("POLICY_NOT_APPROVED");
        assertThat(studio.handle(learner(), "AUDIO", Map.of()).data()).containsEntry("policyApproved", false)
                .containsEntry("retentionDays", null).containsEntry("longTermCapture", false);
        It7ClosureStudio.Result worker = studio.handle(learner(), "WORKER", Map.of());
        assertThat(worker.data()).containsEntry("m6Gap", true).containsEntry("allComplete", false);
        assertThat(worker.data().get("tasks")).asList().isNotEmpty();
        It7ClosureStudio.Result logout = studio.handle(learner(), "SESSION", Map.of("kind", "LOGOUT"));
        It7ClosureStudio.Result accepted = studio.handle(learner(), "SESSION", Map.of("kind", "DELETION_ACCEPTED"));
        assertThat(logout.data()).containsEntry("reloginAllowed", true);
        assertThat(accepted.data()).containsEntry("reloginAllowed", false);
        assertThat(accepted.data().get("prompt")).asString().contains("不能登录");
        assertThat(logout.data().get("prompt")).asString().contains("重新登录");
        assertThat(logout.data().get("prompt")).isNotEqualTo(accepted.data().get("prompt"));
    }

    @Test
    void observationDoesNotLeakSecretsOrClaimProduction() {
        It7ClosureStudio.Result denied = studio.handle(It7ClosureStudio.Actor.anonymous(), "UNAUTHORIZED_ENVELOPE", Map.of(
                "password", "hunter2", "authorization", "Bearer secret-token"));
        assertThat(denied.status()).isEqualTo(401);
        assertThat(denied.error()).containsEntry("secretsLogged", false).containsEntry("idsDistinct", true);
        assertThat(denied.errorBody().toString()).doesNotContain("hunter2").doesNotContain("secret-token");
        It7ClosureStudio.Result learnerIds = studio.handle(learner(), "CORRELATE", Map.of());
        assertThat(learnerIds.data()).containsEntry("auditVisible", false).containsKey("supportNumber").doesNotContainKey("auditId");
        It7ClosureStudio.Result staffIds = studio.handle(auditor(), "CORRELATE", Map.of());
        assertThat(staffIds.data()).containsEntry("idsDistinct", true).containsEntry("sameValueRequired", false);
        assertThat(Set.of(staffIds.data().get("requestId"), staffIds.data().get("traceId"), staffIds.data().get("auditId")))
                .hasSize(3);
        assertThat(studio.handle(staff(), "SAGA", Map.of("name", "MAKE_IT_SO")).error().get("code")).isEqualTo("UNKNOWN_COMPENSATION");
        assertThat(studio.handle(staff(), "SAGA", Map.of("name", "RETRY_EXPORT")).data())
                .containsEntry("compensated", true).containsEntry("originalSuccess", false).containsEntry("reportedAsOriginalSuccess", false);
        assertThat(studio.handle(staff(), "OUTBOX", Map.of("type", "closure.unknown")).error().get("code")).isEqualTo("NOT_WHITELISTED");
        assertThat(studio.handle(staff(), "OUTBOX", Map.of("type", "closure.case.filed", "replay", true)).error().get("code"))
                .isEqualTo("REPLAY_NOT_APPROVED");
        It7ClosureStudio.Result projected = studio.handle(staff(), "OUTBOX", Map.of("type", "closure.case.filed", "expectedRows", 9));
        assertThat(projected.data()).containsEntry("factCount", 1).containsEntry("projectionCount", 1).containsEntry("padded", false);
        assertThat(studio.handle(staff(), "RELEASE_GATE", Map.of("evidence", true)).data()).containsEntry("productionReady", false);
        assertThat(studio.handle(staff(), "ROLLBACK", Map.of("name", "it7-point")).data())
                .containsEntry("anySchemaRollback", false)
                .containsEntry("drill", "NOT_DRILLED");
    }

    @Test
    void auditListIsMaskedAndHiddenFromLearners() {
        fileOne();
        It7ClosureStudio.Result learner = studio.handle(learner(), "AUDIT_LIST", Map.of());
        assertThat(learner.status()).isEqualTo(403);
        assertThat(learner.error()).doesNotContainKey("items");
        It7ClosureStudio.Result page = studio.handle(auditor(), "AUDIT_LIST", Map.of("operation", "CASE_FILED"));
        assertThat(page.data()).containsEntry("masked", true).containsEntry("auditSharedWithLearner", false)
                .containsEntry("exportAllowed", false);
        assertThat(page.data().get("items")).asList().isNotEmpty();
        assertThat(studio.handle(auditor(), "AUDIT_EXPORT", Map.of()).error().get("code")).isEqualTo("AUDIT_EXPORT_FORBIDDEN");
        It7ClosureStudio.Result exporter = studio.handle(exporter(), "AUDIT_EXPORT", Map.of());
        assertThat(exporter.error()).containsEntry("code", "EXPORT_NOT_OPEN").containsEntry("fileCreated", false)
                .containsEntry("auditSharedWithLearner", false);
        It7ClosureStudio.Result board = studio.handle(learner(), "BOARD", Map.of());
        assertThat(board.data()).containsEntry("auditVisible", false).doesNotContainKey("auditItems").doesNotContainKey("cases");
        Map<?, ?> privacy = (Map<?, ?>) board.data().get("privacy");
        assertThat(privacy.get("allComplete")).isEqualTo(false);
        assertThat(privacy.get("longTermCapture")).isEqualTo(false);
    }

    private String fileOne() {
        return String.valueOf(studio.handle(staff(), "FILE", Map.of("sourceRef", "report-source-9", "title", "档案")).data().get("caseId"));
    }

    private static It7ClosureStudio.Actor staff() {
        return new It7ClosureStudio.Actor("staff-1", true, Set.of("admin.risk.read"));
    }

    private static It7ClosureStudio.Actor writer() {
        return new It7ClosureStudio.Actor("staff-1", true, Set.of("admin.risk.read", "admin.risk.write"));
    }

    private static It7ClosureStudio.Actor learner() {
        return new It7ClosureStudio.Actor("learner-1", true, Set.of("learner.home.read"));
    }

    private static It7ClosureStudio.Actor auditor() {
        return new It7ClosureStudio.Actor("audit-1", true, Set.of("admin.audit.read"));
    }

    private static It7ClosureStudio.Actor exporter() {
        return new It7ClosureStudio.Actor("audit-2", true, Set.of("admin.audit.read", "audit.export"));
    }
}
