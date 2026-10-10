package com.englishflow.adminops.closure;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

/**
 * IT-7 closure desk. Disposition writes stay frozen. Hash-only tickets are traces,
 * not a claim that support understood the problem. The desk keeps its facts in this
 * process; a restart must replay them. It does not replace the older risk service.
 */
@Component
public class It7ClosureStudio {

    public static final String WRITE_SWITCH = "FROZEN";
    private static final Set<String> COMPENSATION = Set.of("RETRY_EXPORT", "REVOKE_SESSION");
    private static final Set<String> OUTBOX = Set.of(
            "closure.case.filed", "closure.export.queued", "closure.deletion.accepted");
    private static final Set<String> EXPORT_MARKS = Set.of(
            "QUEUED", "PROCESSING", "PARTIAL_FAILURE", "DOWNLOADABLE", "EXPIRED");
    private static final Pattern SECRET_KEY = Pattern.compile("(?i)password|token|authorization|secret|cookie");

    private final Object guard = new Object();
    private final List<Case> cases = new ArrayList<>();
    private final List<Trace> traces = new ArrayList<>();
    private final List<ExportJob> exports = new ArrayList<>();
    private final List<Deletion> deletions = new ArrayList<>();
    private final List<AuditRow> audits = new ArrayList<>();
    private final List<String> outboxFacts = new ArrayList<>();
    private final List<String> deadLetters = new ArrayList<>();
    private final Map<String, Result> idempotency = new LinkedHashMap<>();
    private final Map<String, String> idempotencyFingerprint = new LinkedHashMap<>();
    private int isolationWrites;

    public int caseCount() {
        synchronized (guard) {
            return cases.size();
        }
    }

    public int isolationWrites() {
        synchronized (guard) {
            return isolationWrites;
        }
    }

    public Result handle(Actor actor, String command, Map<String, Object> input) {
        Map<String, Object> safeInput = input == null ? Map.of() : input;
        synchronized (guard) {
            String name = command == null ? "" : command.trim().toUpperCase(Locale.ROOT);
            String key = text(safeInput.get("idempotencyKey"));
            String fingerprint = name + "|" + fingerprint(safeInput);
            if (!key.isBlank()) {
                Result prior = idempotency.get(key);
                if (prior != null) {
                    if (!fingerprint.equals(idempotencyFingerprint.get(key))) {
                        return Result.fail(409, "CLOSURE_KEY_REUSED", "同一个幂等键不能改成另一项操作", Map.of());
                    }
                    return prior;
                }
            }
            Result result = dispatch(actor == null ? Actor.anonymous() : actor, name, safeInput);
            if (!key.isBlank()) {
                idempotency.put(key, result);
                idempotencyFingerprint.put(key, fingerprint);
            }
            return result;
        }
    }

    private Result dispatch(Actor actor, String command, Map<String, Object> input) {
        if (!actor.authenticated() && !"UNAUTHORIZED_ENVELOPE".equals(command)) {
            return Result.fail(401, "CLOSURE_UNAUTHENTICATED", "需要已验证的身份", Map.of("secretsLogged", false));
        }
        return switch (command) {
            case "BOARD" -> board(actor);
            case "LOCK_READ" -> lockRead(actor);
            case "FILE" -> file(actor, input);
            case "TRIAGE" -> refuseDisposition(actor, input, "DISPOSITION_NOT_ADMITTED", "分诊写链还没准入", false);
            case "ISOLATE" -> isolate(actor, input);
            case "ESCALATE" -> escalate(actor, input);
            case "CLOSE" -> refuseDisposition(actor, input, "CHAIN_INCOMPLETE", "关闭所需的步骤原文还没补齐", true);
            case "CASES" -> cases(actor, input);
            case "RISK_ROUTE" -> riskRoute(actor);
            case "REPORTS" -> reports(actor);
            case "TICKET_SUBMIT" -> ticketSubmit(actor, input);
            case "TICKETS" -> tickets(actor);
            case "TICKET_GET" -> ticketGet(actor, input);
            case "EXPORT" -> export(actor, input);
            case "DELETE" -> delete(actor, input);
            case "AUDIO" -> audio(input);
            case "WORKER" -> worker(actor);
            case "SESSION" -> session(input);
            case "UNAUTHORIZED_ENVELOPE" -> unauthorizedEnvelope(input);
            case "CORRELATE" -> correlate(actor);
            case "SAGA" -> saga(input);
            case "OUTBOX" -> outbox(input);
            case "RELEASE_GATE" -> releaseGate();
            case "ROLLBACK" -> rollback(input);
            case "AUDIT_LIST" -> auditList(actor, input);
            case "AUDIT_EXPORT" -> auditExport(actor);
            default -> Result.fail(400, "CLOSURE_COMMAND_INVALID", "收口命令不受支持", Map.of());
        };
    }

    private Result board(Actor actor) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("surface", "IT7");
        data.put("writeSwitch", WRITE_SWITCH);
        data.put("dispositionOpen", false);
        data.put("lockCopy", "写入开关未开启。可以查看锁定理由、影响和恢复条件，这次不会锁定账号或内容。");
        data.put("impact", "不会改变账号或内容的可用状态");
        data.put("recovery", "恢复条件要等处置写链准入后才能执行");
        data.put("ticketCopy", "受控正文尚未批准。这里不能提交一份客服能够理解并闭环处理的工单。只有摘要的记录会标成信息不足。");
        data.put("closedLoop", false);
        data.put("understandable", false);
        data.put("supportNumber", supportNumber(actor.subject()));
        data.put("tickets", traces.stream()
                .filter(trace -> trace.owner().equals(actor.subject()))
                .map(this::traceView)
                .toList());
        data.put("auditVisible", false);
        data.put("auditSharedWithLearner", false);
        Map<String, Object> privacy = new LinkedHashMap<>();
        privacy.put("exportState", latestExportState(actor.subject()));
        privacy.put("allComplete", false);
        privacy.put("deletionAccepted", !deletionsFor(actor.subject()).isEmpty());
        privacy.put("accessStopped", false);
        privacy.put("ownersComplete", false);
        privacy.put("dataDeleted", false);
        privacy.put("tokenRevokeMeansDeleted", false);
        privacy.put("audioPolicyApproved", false);
        privacy.put("retentionDays", null);
        privacy.put("longTermCapture", false);
        privacy.put("workerGap", true);
        privacy.put("logoutCanRelogin", true);
        privacy.put("deletionPromptsRelogin", false);
        privacy.put("audioCopy", "音频保留策略尚未批准，不会采集长期原始录音，也不填写保留天数。");
        privacy.put("deletionCopy", "删除申请受理后，访问停止和各服务处理完成要分开看。受理不等于数据已经删除。");
        privacy.put("sessionCopy", "普通退出后可以重新登录。删除申请受理后不会提示登录继续学习。");
        data.put("privacy", privacy);
        if (actor.can("admin.risk.read") || actor.can("admin.moderation.read")) {
            data.put("casesState", cases.isEmpty() ? "NO_CASES" : "HAS_CASES");
            data.put("cases", cases.stream().map(this::caseView).toList());
            data.put("independentRiskRoute", false);
            data.put("riskRedirect", "/governance");
            data.put("reportsReadOnly", true);
            data.put("dispositionButtons", false);
            data.put("reports", maskedReports());
        }
        if (actor.can("admin.audit.read")) {
            data.put("auditVisible", true);
            data.put("observation", observation());
            data.put("auditItems", audits.stream().map(this::auditView).toList());
            data.put("exportAllowed", actor.can("audit.export"));
        }
        return Result.ok(data);
    }

    private Result lockRead(Actor actor) {
        if (!governance(actor)) {
            return forbidden();
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("writeSwitch", WRITE_SWITCH);
        data.put("executed", false);
        data.put("reason", "处置写链未准入，锁定没有执行");
        data.put("impact", "账号和内容都保持原状态");
        data.put("recovery", "恢复条件可读，但现在不能靠这个页面解锁");
        return Result.ok(data);
    }

    private Result file(Actor actor, Map<String, Object> input) {
        if (!governance(actor)) {
            return forbidden();
        }
        if (truthy(input.get("sample"))) {
            return Result.fail(409, "SAMPLE_REJECTED", "示例不能当成真实案件", Map.of("caseCount", cases.size()));
        }
        String source = text(input.get("sourceRef"));
        if (source.isBlank()) {
            return Result.fail(400, "SOURCE_REQUIRED", "建档必须有来源", Map.of("caseCount", cases.size()));
        }
        String title = text(input.get("title"));
        if (title.isBlank()) {
            title = "有来源的档案";
        }
        Case filed = new Case("case-" + UUID.randomUUID(), actor.subject(), source, title, Instant.now().toString());
        cases.add(filed);
        audits.add(new AuditRow("audit-" + UUID.randomUUID(), "CASE_FILED", mask(source), Instant.now().toString()));
        Map<String, Object> data = caseView(filed);
        data.put("disposition", "NOT_STARTED");
        data.put("sample", false);
        return Result.ok(data);
    }

    private Result isolate(Actor actor, Map<String, Object> input) {
        Result denied = requireGovernanceCase(actor, input);
        if (denied != null) {
            return denied;
        }
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("effect", "ISOLATION");
        extra.put("sameAsLock", false);
        extra.put("unlockAvailable", false);
        extra.put("isolationWrites", isolationWrites);
        extra.put("dispatched", false);
        return Result.fail(409, "DISPOSITION_NOT_ADMITTED", "隔离还没准入，也不能在页面上直接解除", extra);
    }

    private Result escalate(Actor actor, Map<String, Object> input) {
        Result denied = requireGovernanceCase(actor, input);
        if (denied != null) {
            return denied;
        }
        boolean receiver = truthy(input.get("receiverAvailable"));
        String code = receiver ? "DISPOSITION_NOT_ADMITTED" : "RECEIVER_UNAVAILABLE";
        String message = receiver ? "处置写链还没准入" : "接收方不可用，不能显示成已经接单";
        return Result.fail(409, code, message, Map.of(
                "accepted", false,
                "originalRetained", true,
                "dispatched", false));
    }

    private Result refuseDisposition(Actor actor, Map<String, Object> input, String code, String message, boolean close) {
        Result denied = requireGovernanceCase(actor, input);
        if (denied != null) {
            return denied;
        }
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("dispatched", false);
        extra.put("assigned", false);
        extra.put("closed", false);
        extra.put("claimsFullChain", false);
        if (!close) {
            extra.put("statusUnchanged", true);
        }
        return Result.fail(409, code, message, extra);
    }

    private Result cases(Actor actor, Map<String, Object> input) {
        if (!governance(actor)) {
            return forbidden();
        }
        String filter = text(input.get("status"));
        List<Map<String, Object>> items = new ArrayList<>();
        for (Case item : cases) {
            if (!filter.isBlank() && !filter.equals(item.status())) {
                continue;
            }
            items.add(caseView(item));
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", items);
        data.put("casesState", items.isEmpty() ? "NO_CASES" : "HAS_CASES");
        data.put("filtered", !filter.isBlank());
        return Result.ok(data);
    }

    private Result riskRoute(Actor actor) {
        if (!actor.authenticated()) {
            return Result.fail(401, "CLOSURE_UNAUTHENTICATED", "需要已验证的身份", Map.of());
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("independentRiskRoute", false);
        data.put("redirect", "/governance");
        data.put("bypass", false);
        data.put("permissionStillRequired", true);
        return Result.ok(data);
    }

    private Result reports(Actor actor) {
        if (!governance(actor)) {
            return forbidden();
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", maskedReports());
        data.put("nextCursor", null);
        data.put("readOnly", true);
        data.put("dispositionButtons", false);
        data.put("masked", true);
        return Result.ok(data);
    }

    private Result ticketSubmit(Actor actor, Map<String, Object> input) {
        String hash = text(input.get("bodyHash"));
        if (!hash.isBlank()) {
            traces.add(new Trace("trace-" + UUID.randomUUID(), actor.subject(), hash));
        }
        return Result.fail(409, "DEC06_NOT_APPROVED", "受控正文尚未批准，不能开放可被客服理解的提交", Map.of(
                "closedLoop", false,
                "understandable", false,
                "storedRawText", false));
    }

    private Result tickets(Actor actor) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (Trace trace : traces) {
            if (trace.owner().equals(actor.subject())) {
                items.add(traceView(trace));
            }
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", items);
        data.put("ownerOnly", true);
        return Result.ok(data);
    }

    private Result ticketGet(Actor actor, Map<String, Object> input) {
        String ticketId = text(input.get("ticketId"));
        for (Trace trace : traces) {
            if (trace.id().equals(ticketId) && trace.owner().equals(actor.subject())) {
                return Result.ok(traceView(trace));
            }
        }
        return Result.fail(404, "TICKET_NOT_VISIBLE", "这张工单不可见", Map.of());
    }

    private Result export(Actor actor, Map<String, Object> input) {
        if (!truthy(input.get("confirmed"))) {
            return Result.fail(403, "IDENTITY_UNCONFIRMED", "导出前需要确认是本人", Map.of("allComplete", false));
        }
        String mark = text(input.get("mark")).toUpperCase(Locale.ROOT);
        if ("COMPLETE".equals(mark)) {
            return Result.fail(409, "WORKER_GAP", "跨服务处理还没完成，不能显示全部完成", Map.of("allComplete", false));
        }
        if (mark.isBlank()) {
            mark = "QUEUED";
        }
        if (!EXPORT_MARKS.contains(mark)) {
            return Result.fail(400, "EXPORT_STATE_INVALID", "导出状态不受支持", Map.of());
        }
        ExportJob job = new ExportJob("export-" + UUID.randomUUID(), actor.subject(), mark);
        exports.add(job);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("exportId", job.id());
        data.put("state", job.state());
        data.put("allComplete", false);
        data.put("downloadable", "DOWNLOADABLE".equals(job.state()));
        data.put("ownerOnly", true);
        data.put("states", List.of("QUEUED", "PROCESSING", "PARTIAL_FAILURE", "DOWNLOADABLE", "EXPIRED"));
        return Result.ok(data);
    }

    private Result delete(Actor actor, Map<String, Object> input) {
        if (!truthy(input.get("secondFactor"))) {
            return Result.fail(403, "SECOND_FACTOR_REQUIRED", "删除申请需要二次确认", Map.of("dataDeleted", false));
        }
        Deletion deletion = new Deletion("delete-" + UUID.randomUUID(), actor.subject());
        deletions.add(deletion);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("deletionId", deletion.id());
        data.put("accepted", true);
        data.put("accessStopped", false);
        data.put("ownersComplete", false);
        data.put("dataDeleted", false);
        data.put("tokenRevokeMeansDeleted", false);
        data.put("copy", "申请已受理。这还不等于访问已停止，也不等于各服务已经删除数据。");
        return Result.ok(data);
    }

    private Result audio(Map<String, Object> input) {
        if (input.get("retentionDays") != null) {
            return Result.fail(409, "POLICY_NOT_APPROVED", "策略未批准，不能填写保留天数", Map.of(
                    "policyApproved", false,
                    "longTermCapture", false));
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("policyApproved", false);
        data.put("retentionDays", null);
        data.put("longTermCapture", false);
        data.put("copy", "音频保留策略尚未批准，不会采集长期原始录音。");
        return Result.ok(data);
    }

    private Result worker(Actor actor) {
        List<Map<String, Object>> tasks = new ArrayList<>();
        for (ExportJob job : exports) {
            if (job.owner().equals(actor.subject())) {
                tasks.add(task("EXPORT", job.id(), job.state(), "PARTIAL_FAILURE".equals(job.state())));
            }
        }
        for (Deletion deletion : deletions) {
            if (deletion.owner().equals(actor.subject())) {
                tasks.add(task("DELETE", deletion.id(), "ACCEPTED", false));
            }
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("m6Gap", true);
        data.put("allComplete", false);
        data.put("tasks", tasks);
        data.put("copy", tasks.isEmpty()
                ? "尚无跨服务任务。不能把空表显示成全部完成。"
                : "这些任务可以重试和对账。未全部符合策略前不能返回全部完成。");
        return Result.ok(data);
    }

    private Result session(Map<String, Object> input) {
        String kind = text(input.get("kind")).toUpperCase(Locale.ROOT);
        if ("LOGOUT".equals(kind)) {
            return Result.ok(Map.of(
                    "kind", "LOGOUT",
                    "reloginAllowed", true,
                    "prompt", "可以重新登录"));
        }
        if ("DELETION_ACCEPTED".equals(kind)) {
            return Result.ok(Map.of(
                    "kind", "DELETION_ACCEPTED",
                    "reloginAllowed", false,
                    "prompt", "删除申请已受理。请查询处理状态，不能登录继续学习。"));
        }
        return Result.fail(400, "SESSION_KIND_INVALID", "需要说明是普通退出还是删除受理", Map.of());
    }

    private Result unauthorizedEnvelope(Map<String, Object> input) {
        boolean plantedSecret = input.keySet().stream().anyMatch(key -> SECRET_KEY.matcher(key).find());
        String requestId = plantedSecret ? "" : text(input.get("requestId"));
        String traceId = plantedSecret ? "" : text(input.get("traceId"));
        if (requestId.isBlank()) {
            requestId = "req-" + UUID.randomUUID();
        }
        if (traceId.isBlank()) {
            traceId = "trace-" + UUID.randomUUID();
        }
        String auditId = "audit-" + UUID.randomUUID();
        String factId = "fact-" + UUID.randomUUID();
        String receiptId = "receipt-" + UUID.randomUUID();
        audits.add(new AuditRow(auditId, "GATEWAY_401", "redacted", Instant.now().toString()));
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", "CLOSURE_UNAUTHENTICATED");
        error.put("message", "需要已验证的身份");
        error.put("retryable", false);
        error.put("factId", factId);
        error.put("receiptId", receiptId);
        error.put("requestId", requestId);
        error.put("traceId", traceId);
        error.put("auditId", auditId);
        error.put("supportNumber", supportNumber("anonymous"));
        error.put("secretsLogged", false);
        error.put("idsDistinct", distinct(requestId, traceId, auditId));
        return new Result(401, null, error);
    }

    private Result correlate(Actor actor) {
        String requestId = "req-" + UUID.randomUUID();
        String traceId = "trace-" + UUID.randomUUID();
        String auditId = "audit-" + UUID.randomUUID();
        String support = supportNumber(actor.subject());
        if (!actor.can("admin.audit.read")) {
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("supportNumber", support);
            data.put("idsDistinct", true);
            data.put("auditVisible", false);
            return Result.ok(data);
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("requestId", requestId);
        data.put("traceId", traceId);
        data.put("auditId", auditId);
        data.put("supportNumber", support);
        data.put("idsDistinct", distinct(requestId, traceId, auditId));
        data.put("sameValueRequired", false);
        data.put("auditVisible", true);
        return Result.ok(data);
    }

    private Result saga(Map<String, Object> input) {
        String name = text(input.get("name"));
        if (!COMPENSATION.contains(name)) {
            return Result.fail(409, "UNKNOWN_COMPENSATION", "未知补偿名不能执行", Map.of(
                    "originalSuccess", false,
                    "reportedAsOriginalSuccess", false));
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("name", name);
        data.put("compensated", true);
        data.put("originalSuccess", false);
        data.put("reportedAsOriginalSuccess", false);
        data.put("retryRecorded", true);
        return Result.ok(data);
    }

    private Result outbox(Map<String, Object> input) {
        String type = text(input.get("type"));
        if (!OUTBOX.contains(type)) {
            return Result.fail(409, "NOT_WHITELISTED", "这个事件不在投递白名单里", Map.of());
        }
        if (truthy(input.get("fail"))) {
            deadLetters.add(type);
            return Result.ok(Map.of(
                    "deadLetters", List.copyOf(deadLetters),
                    "observable", true,
                    "factCount", outboxFacts.size(),
                    "projectionCount", outboxFacts.size(),
                    "padded", false));
        }
        if (truthy(input.get("replay")) && !truthy(input.get("approved"))) {
            return Result.fail(409, "REPLAY_NOT_APPROVED", "重放需要单独批准", Map.of(
                    "factCount", outboxFacts.size(),
                    "projectionCount", outboxFacts.size(),
                    "padded", false));
        }
        outboxFacts.add(type);
        return Result.ok(Map.of(
                "factCount", outboxFacts.size(),
                "projectionCount", outboxFacts.size(),
                "padded", false,
                "deadLetters", List.copyOf(deadLetters)));
    }

    private Result releaseGate() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("productionReady", false);
        data.put("evidencePresent", false);
        data.put("sbomRecorded", false);
        data.put("gracefulShutdownDrilled", false);
        data.put("copy", "没有发布证据，不能标成已可生产发布。");
        return Result.ok(data);
    }

    private Result rollback(Map<String, Object> input) {
        String name = text(input.get("name"));
        if (name.isBlank()) {
            return Result.fail(400, "ROLLBACK_NAME_REQUIRED", "回滚需要一个名称", Map.of("anySchemaRollback", false));
        }
        String drill = text(input.get("drillNote"));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("name", name);
        data.put("anySchemaRollback", false);
        data.put("limits", "不能承诺任意数据库变更都可以直接回滚");
        data.put("drill", drill.isBlank() ? "NOT_DRILLED" : drill);
        return Result.ok(data);
    }

    private Result auditList(Actor actor, Map<String, Object> input) {
        if (!actor.can("admin.audit.read")) {
            return Result.fail(403, "CLOSURE_AUDIT_FORBIDDEN", "内部审计不向这个身份提供", Map.of(
                    "auditSharedWithLearner", false));
        }
        String operation = text(input.get("operation"));
        List<Map<String, Object>> items = new ArrayList<>();
        for (AuditRow row : audits) {
            if (!operation.isBlank() && !operation.equals(row.operation())) {
                continue;
            }
            items.add(auditView(row));
        }
        int pageSize = 20;
        if (items.size() > pageSize) {
            items = items.subList(0, pageSize);
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", items);
        data.put("pageSize", pageSize);
        data.put("masked", true);
        data.put("exportAllowed", actor.can("audit.export"));
        data.put("auditSharedWithLearner", false);
        return Result.ok(data);
    }

    private Result auditExport(Actor actor) {
        if (!actor.can("audit.export")) {
            return Result.fail(403, "AUDIT_EXPORT_FORBIDDEN", "导出需要单独的内部权限", Map.of(
                    "auditSharedWithLearner", false,
                    "fileCreated", false));
        }
        return Result.fail(409, "EXPORT_NOT_OPEN", "内部导出不生成给学习端的文件", Map.of(
                "auditSharedWithLearner", false,
                "fileCreated", false));
    }

    private Result requireGovernanceCase(Actor actor, Map<String, Object> input) {
        if (!governance(actor)) {
            return forbidden();
        }
        String caseId = text(input.get("caseId"));
        if (caseId.isBlank() || cases.stream().noneMatch(item -> item.id().equals(caseId))) {
            return Result.fail(404, "CASE_NOT_VISIBLE", "这件档案不可见", Map.of("dispatched", false));
        }
        return null;
    }

    private static Result forbidden() {
        return Result.fail(403, "CLOSURE_FORBIDDEN", "没有查看这一区的权限", Map.of("casesState", "FORBIDDEN"));
    }

    private boolean governance(Actor actor) {
        return actor.can("admin.risk.read") || actor.can("admin.moderation.read");
    }

    private String latestExportState(String subject) {
        String state = "NONE";
        for (ExportJob job : exports) {
            if (job.owner().equals(subject)) {
                state = job.state();
            }
        }
        return state;
    }

    private List<Deletion> deletionsFor(String subject) {
        return deletions.stream().filter(item -> item.owner().equals(subject)).toList();
    }

    private List<Map<String, Object>> maskedReports() {
        List<Map<String, Object>> items = new ArrayList<>();
        for (Case item : cases) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("caseId", item.id());
            row.put("source", mask(item.sourceRef()));
            row.put("status", item.status());
            row.put("updatedAt", item.updatedAt());
            row.put("readOnly", true);
            items.add(row);
        }
        return items;
    }

    private Map<String, Object> caseView(Case item) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("caseId", item.id());
        view.put("sourceRef", item.sourceRef());
        view.put("title", item.title());
        view.put("status", item.status());
        view.put("disposition", item.disposition());
        view.put("updatedAt", item.updatedAt());
        return view;
    }

    private Map<String, Object> traceView(Trace trace) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("ticketId", trace.id());
        view.put("information", "INSUFFICIENT");
        view.put("reply", null);
        view.put("resolved", false);
        view.put("understandable", false);
        return view;
    }

    private Map<String, Object> auditView(AuditRow row) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("auditId", row.id());
        view.put("operation", row.operation());
        view.put("resourceRef", row.resourceRef());
        view.put("occurredAt", row.occurredAt());
        view.put("masked", true);
        return view;
    }

    private static Map<String, Object> task(String kind, String id, String state, boolean failed) {
        Map<String, Object> task = new LinkedHashMap<>();
        task.put("kind", kind);
        task.put("id", id);
        task.put("state", state);
        task.put("failed", failed);
        task.put("retained", "ACCEPTED".equals(state));
        task.put("retryable", true);
        return task;
    }

    private static Map<String, Object> observation() {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("productionReady", false);
        view.put("anySchemaRollback", false);
        view.put("secretsLogged", false);
        return view;
    }

    private static String supportNumber(String subject) {
        String seed = subject == null || subject.isBlank() ? "anonymous" : subject;
        return "IT7-" + Integer.toUnsignedString(seed.hashCode(), 36);
    }

    private static String mask(String value) {
        if (value == null || value.length() < 6) {
            return "***";
        }
        return value.substring(0, 2) + "***" + value.substring(value.length() - 2);
    }

    private static boolean distinct(String first, String second, String third) {
        return !first.equals(second) && !first.equals(third) && !second.equals(third);
    }

    private static boolean truthy(Object value) {
        if (value instanceof Boolean flag) {
            return flag;
        }
        return "true".equalsIgnoreCase(text(value));
    }

    private static String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private static String fingerprint(Map<String, Object> input) {
        StringBuilder builder = new StringBuilder();
        input.entrySet().stream()
                .filter(entry -> !"idempotencyKey".equals(entry.getKey()))
                .filter(entry -> !SECRET_KEY.matcher(entry.getKey()).find())
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> builder.append(entry.getKey()).append('=').append(entry.getValue()).append(';'));
        return builder.toString();
    }

    public record Actor(String subject, boolean authenticated, Set<String> permissions) {
        public Actor {
            subject = subject == null ? "" : subject;
            permissions = permissions == null ? Set.of() : Set.copyOf(permissions);
        }

        public static Actor anonymous() {
            return new Actor("", false, Set.of());
        }

        public boolean can(String permission) {
            return authenticated && permissions.contains(permission);
        }
    }

    public record Result(int status, Map<String, Object> data, Map<String, Object> error) {
        public static Result ok(Map<String, Object> data) {
            return new Result(200, data, null);
        }

        public static Result fail(int status, String code, String message, Map<String, Object> extra) {
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("code", code);
            error.put("message", message);
            error.put("retryable", false);
            if (extra != null) {
                error.putAll(extra);
            }
            return new Result(status, null, error);
        }

        public Map<String, Object> errorBody() {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("error", error);
            return body;
        }
    }

    private record Case(String id, String owner, String sourceRef, String title, String updatedAt) {
        private String status() {
            return "FILED";
        }

        private String disposition() {
            return "NOT_STARTED";
        }
    }

    private record Trace(String id, String owner, String bodyHash) {
    }

    private record ExportJob(String id, String owner, String state) {
    }

    private record Deletion(String id, String owner) {
    }

    private record AuditRow(String id, String operation, String resourceRef, String occurredAt) {
    }
}
