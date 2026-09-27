package com.englishflow.adminops.risk;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

import com.englishflow.adminops.domain.AdminOpsException;
import com.englishflow.adminops.domain.AdminPep;
import com.englishflow.adminops.domain.AdminPermission;
import com.englishflow.adminops.domain.AdminPrincipal;
import com.englishflow.adminops.domain.AuditEvent;
import com.englishflow.adminops.domain.AuditRecord;
import com.englishflow.adminops.domain.AuditTrail;
import com.englishflow.adminops.domain.IdempotencyLedger;
import com.englishflow.adminops.domain.ReferenceRedactor;

/**
 * Risk coordination facts owned by admin-ops and surfaced on the governance
 * page (no standalone risk route). Cases are filed by analysts or by
 * detection rules; decisions move the lifecycle and every step lands an audit
 * record. Containment and escalation are recorded against owner-flow receipts
 * — this service never executes domain isolation itself.
 */
public final class RiskCaseService {

    public static final String RULE_ACCOUNT_LOCKOUT = "ACCOUNT_LOCKOUT";
    public static final String RULE_VERSION_V1 = "RISK_RULES_V1";

    private static final Pattern SAFE_TEXT = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}");

    private final Clock clock;
    private final AdminPep pep;
    private final AuditTrail auditTrail;
    private final IdempotencyLedger idempotency;
    private final RiskCaseStore caseStore;
    private final IamLockoutPort lockouts;

    public RiskCaseService(
            Clock clock,
            AuditTrail auditTrail,
            IdempotencyLedger idempotency,
            RiskCaseStore caseStore,
            IamLockoutPort lockouts) {
        this.clock = Objects.requireNonNull(clock, "clock is required");
        this.pep = new AdminPep();
        this.auditTrail = Objects.requireNonNull(auditTrail, "audit trail is required");
        this.idempotency = Objects.requireNonNull(idempotency, "idempotency is required");
        this.caseStore = Objects.requireNonNull(caseStore, "case store is required");
        this.lockouts = Objects.requireNonNull(lockouts, "lockout port is required");
    }

    public synchronized RiskDecisionResult file(
            AdminPrincipal filer, RiskFileDraft draft, String idempotencyKey, String traceId) {
        pep.requirePermission(filer, AdminPermission.RISK_CASE_WRITE);
        requireIdempotencyKey(idempotencyKey);
        RiskFileDraft valid = validatedDraft(draft);
        String scope = scope(filer, "file");
        String fingerprint = "analyst|" + valid.category() + "|" + valid.severity() + "|" + valid.title();
        IdempotencyLedger.Entry prior = idempotency.find(scope, idempotencyKey).orElse(null);
        if (prior != null) {
            return replay(prior, fingerprint);
        }
        Instant now = clock.instant();
        RiskCase kase = new RiskCase(
                "rsk_" + UUID.randomUUID().toString().replace("-", ""),
                filer.tenantId(), valid.category(), valid.severity(), RiskStatus.OPEN, RiskSource.ANALYST_FILED,
                null, null, valid.title(), valid.subjectRef(), valid.evidenceRefs(), null, null, null, null,
                null, now);
        caseStore.create(kase.snapshot(now));
        AuditRecord audit = auditTrail.append(new AuditEvent(kase.tenantId, filer.subjectId(),
                "RISK_CASE_FILED", kase.caseId, null, safeTrace(traceId), "decision_" + UUID.randomUUID(),
                Map.of("category", kase.category.name(), "severity", kase.severity.name(),
                        "idempotencyKeyHash", ReferenceRedactor.sha256(idempotencyKey)),
                now));
        kase.lastAuditId = audit.auditId();
        caseStore.update(kase.snapshot(now), kase.version);
        RiskDecisionResult result = new RiskDecisionResult(view(kase, now), false, audit.auditId());
        idempotency.put(scope, idempotencyKey, fingerprint, result);
        return result;
    }

    public synchronized List<RiskCaseView> list(AdminPrincipal principal) {
        pep.requirePermission(principal, AdminPermission.RISK_CASE_READ);
        Instant now = clock.instant();
        return caseStore.list(principal.tenantId()).stream()
                .map(RiskCase::fromRecord)
                .map(kase -> view(kase, now))
                .toList();
    }

    public synchronized RiskCaseView get(AdminPrincipal principal, String caseId) {
        pep.requirePermission(principal, AdminPermission.RISK_CASE_READ);
        RiskCase kase = requireCase(principal, caseId);
        pep.requireTenant(principal, kase.tenantId);
        return view(kase, clock.instant());
    }

    public synchronized RiskDecisionResult decide(
            AdminPrincipal operator, String caseId, RiskCommand command, RiskDecisionInput input,
            String idempotencyKey, String traceId) {
        pep.requirePermission(operator, AdminPermission.RISK_CASE_WRITE);
        requireIdempotencyKey(idempotencyKey);
        RiskCase kase = requireCase(operator, caseId);
        pep.requireTenant(operator, kase.tenantId);
        String scope = scope(operator, "decide:" + caseId);
        String fingerprint = command.name() + "|" + caseId + "|" + kase.version;
        IdempotencyLedger.Entry prior = idempotency.find(scope, idempotencyKey).orElse(null);
        if (prior != null) {
            return replay(prior, fingerprint);
        }
        RiskDecisionInput valid = validatedInput(command, input);
        validateTransition(kase, command, valid);
        Instant now = clock.instant();
        kase.apply(command, valid, operator.subjectId(), now);
        String effectiveTrace = safeTrace(traceId);
        AuditRecord audit = auditTrail.append(new AuditEvent(kase.tenantId, operator.subjectId(),
                "RISK_" + command.name(), kase.caseId, null, effectiveTrace,
                "decision_" + UUID.randomUUID(),
                Map.of("status", kase.status.name(), "idempotencyKeyHash",
                        ReferenceRedactor.sha256(idempotencyKey)),
                now));
        kase.lastAuditId = audit.auditId();
        kase.decisions.add(new RiskDecisionRecord("rskd_" + UUID.randomUUID().toString().replace("-", ""),
                command, valid.reason(), operator.subjectId(), now, valid.containmentRef(),
                valid.escalationTarget(), valid.escalationRef(), valid.assigneeNote()));
        caseStore.update(kase.snapshot(now), kase.version);
        kase.version++;
        RiskDecisionResult result = new RiskDecisionResult(view(kase, now), false, audit.auditId());
        idempotency.put(scope, idempotencyKey, fingerprint, result);
        return result;
    }

    /**
     * Evaluate detection rules and file one case per hit. Rule hits dedupe by
     * (rule, subject, UTC day) against open cases: re-evaluation never files
     * duplicates. A rule whose owner facts are unreachable fails the whole
     * evaluation closed instead of filing partial results.
     */
    public synchronized RiskEvaluateResult evaluateRules(
            AdminPrincipal operator, List<String> rules, String bearer, String idempotencyKey, String traceId) {
        pep.requirePermission(operator, AdminPermission.RISK_CASE_WRITE);
        requireIdempotencyKey(idempotencyKey);
        List<String> selected = rules == null || rules.isEmpty() ? List.of(RULE_ACCOUNT_LOCKOUT) : List.copyOf(rules);
        for (String rule : selected) {
            if (!RULE_ACCOUNT_LOCKOUT.equals(rule)) {
                throw AdminOpsException.invalid("RISK_RULE_UNKNOWN", "detection rule is unknown");
            }
        }
        String scope = scope(operator, "evaluate");
        String fingerprint = "evaluate|" + String.join(",", selected);
        IdempotencyLedger.Entry prior = idempotency.find(scope, idempotencyKey).orElse(null);
        if (prior != null) {
            RiskEvaluateResult replayed = replayEvaluate(prior, fingerprint);
            return new RiskEvaluateResult(replayed.evaluatedAt(), replayed.rulesChecked(),
                    replayed.casesFiled(), replayed.caseIds(), true);
        }
        Instant now = clock.instant();
        List<String> filed = new ArrayList<>();
        int checked = 0;
        if (selected.contains(RULE_ACCOUNT_LOCKOUT)) {
            checked++;
            filed.addAll(evaluateAccountLockout(operator, bearer, now, traceId));
        }
        RiskEvaluateResult result = new RiskEvaluateResult(now, checked, filed.size(), List.copyOf(filed), false);
        idempotency.put(scope, idempotencyKey, fingerprint, result);
        return result;
    }

    private List<String> evaluateAccountLockout(
            AdminPrincipal operator, String bearer, Instant now, String traceId) {
        List<LockedAccount> locked = lockouts.lockedAccounts(bearer, 100);
        List<String> filed = new ArrayList<>();
        String day = now.atZone(java.time.ZoneOffset.UTC).toLocalDate().toString();
        for (LockedAccount hit : locked) {
            if (hit.subjectRef() == null || hit.subjectRef().isBlank()) {
                continue;
            }
            boolean alreadyOpen = !caseStore
                    .findOpenByRuleSubject(operator.tenantId(), RULE_ACCOUNT_LOCKOUT, hit.subjectRef())
                    .isEmpty();
            if (alreadyOpen) {
                continue;
            }
            RiskSeverity severity = hit.failedAttempts() >= 10 ? RiskSeverity.CRITICAL
                    : hit.failedAttempts() >= 5 ? RiskSeverity.HIGH : RiskSeverity.MEDIUM;
            RiskCase kase = new RiskCase(
                    "rsk_" + UUID.randomUUID().toString().replace("-", ""),
                    operator.tenantId(), RiskCategory.ACCOUNT_SECURITY, severity, RiskStatus.OPEN,
                    RiskSource.RULE_HIT, RULE_ACCOUNT_LOCKOUT, RULE_VERSION_V1,
                    "Account locked after " + hit.failedAttempts() + " failed attempts (" + day + ")",
                    hit.subjectRef(), List.of(), null, null, null, null, null, now);
            caseStore.create(kase.snapshot(now));
            AuditRecord audit = auditTrail.append(new AuditEvent(kase.tenantId, operator.subjectId(),
                    "RISK_CASE_FILED", kase.caseId, null, safeTrace(traceId),
                    "decision_" + UUID.randomUUID(),
                    Map.of("rule", RULE_ACCOUNT_LOCKOUT, "severity", severity.name()), now));
            kase.lastAuditId = audit.auditId();
            caseStore.update(kase.snapshot(now), kase.version);
            kase.version++;
            filed.add(kase.caseId);
        }
        return filed;
    }

    private RiskCase requireCase(AdminPrincipal principal, String caseId) {
        if (caseId == null || caseId.isBlank()) {
            throw AdminOpsException.invalid("RISK_CASE_ID_REQUIRED", "case id is required");
        }
        RiskCase kase = caseStore.find(principal.tenantId(), caseId).map(RiskCase::fromRecord).orElse(null);
        if (kase == null) {
            throw AdminOpsException.notFound("RISK_CASE_NOT_FOUND", "risk case is not visible");
        }
        return kase;
    }

    private static void validateTransition(RiskCase kase, RiskCommand command, RiskDecisionInput input) {
        boolean valid = switch (kase.status) {
            case OPEN -> command == RiskCommand.TRIAGE || command == RiskCommand.CLOSE;
            case TRIAGED -> command == RiskCommand.ISOLATE || command == RiskCommand.ESCALATE
                    || command == RiskCommand.CLOSE;
            case ACTIONED -> command == RiskCommand.UNISOLATE || command == RiskCommand.ESCALATE
                    || command == RiskCommand.CLOSE;
            case ESCALATED -> command == RiskCommand.CLOSE;
            case CLOSED -> false;
        };
        if (!valid) {
            throw AdminOpsException.conflict("RISK_INVALID_TRANSITION", "case state cannot accept this decision");
        }
        if (command == RiskCommand.ISOLATE && (input.containmentRef() == null || input.containmentRef().isBlank())) {
            throw AdminOpsException.invalid("RISK_CONTAINMENT_REQUIRED",
                    "isolation must reference its owner-flow containment receipt");
        }
        if (command == RiskCommand.ESCALATE && (input.escalationTarget() == null || input.escalationTarget().isBlank())) {
            throw AdminOpsException.invalid("RISK_ESCALATION_REQUIRED", "escalation needs a support|audit target");
        }
        if (command == RiskCommand.CLOSE && (input.reason() == null || input.reason().isBlank())) {
            throw AdminOpsException.invalid("RISK_REASON_REQUIRED", "closing needs a resolution reason");
        }
    }

    private RiskDecisionResult replay(IdempotencyLedger.Entry prior, String fingerprint) {
        if (!fingerprint.equals(prior.fingerprint())) {
            throw AdminOpsException.conflict("RISK_IDEMPOTENCY_KEY_REUSED",
                    "Idempotency-Key was reused for another risk action");
        }
        if (!(prior.result() instanceof RiskDecisionResult priorResult)) {
            throw AdminOpsException.conflict("RISK_IDEMPOTENCY_RESULT_INVALID", "stored risk result is invalid");
        }
        return new RiskDecisionResult(priorResult.kase(), true, priorResult.auditId());
    }

    private RiskEvaluateResult replayEvaluate(IdempotencyLedger.Entry prior, String fingerprint) {
        if (!fingerprint.equals(prior.fingerprint())) {
            throw AdminOpsException.conflict("RISK_IDEMPOTENCY_KEY_REUSED",
                    "Idempotency-Key was reused for another risk action");
        }
        if (!(prior.result() instanceof RiskEvaluateResult priorResult)) {
            throw AdminOpsException.conflict("RISK_IDEMPOTENCY_RESULT_INVALID", "stored risk result is invalid");
        }
        return priorResult;
    }

    private static RiskCaseView view(RiskCase kase, Instant now) {
        return new RiskCaseView(kase.caseId, kase.category, kase.severity, kase.status,
                kase.source, kase.ruleId, kase.ruleVersion, kase.title, kase.subjectRef, kase.evidenceRefs,
                kase.assigneeNote, kase.containmentRef, kase.escalationTarget, kase.escalationRef,
                kase.closedReason, List.copyOf(kase.decisions), kase.lastAuditId, kase.version,
                kase.createdAt, now);
    }

    private static RiskFileDraft validatedDraft(RiskFileDraft draft) {
        if (draft == null || draft.category() == null || draft.severity() == null) {
            throw AdminOpsException.invalid("RISK_FILE_INVALID", "category and severity are required");
        }
        String title = text(draft.title(), 1, 255, "RISK_TITLE_INVALID", "title is required");
        String subjectRef = ref(draft.subjectRef(), false);
        List<String> evidence = refs(draft.evidenceRefs());
        String note = note(draft.note());
        return new RiskFileDraft(draft.category(), draft.severity(), title, subjectRef, evidence, note);
    }

    private static RiskDecisionInput validatedInput(RiskCommand command, RiskDecisionInput input) {
        if (input == null) {
            throw AdminOpsException.invalid("RISK_DECISION_INVALID", "decision input is required");
        }
        String reason = text(input.reason(), 1, 512, "RISK_REASON_REQUIRED", "decision reason is required");
        return new RiskDecisionInput(command, reason, note(input.assigneeNote()),
                ref(input.containmentRef(), true), escalation(input.escalationTarget()),
                ref(input.escalationRef(), true));
    }

    private static String text(String value, int min, int max, String code, String message) {
        if (value == null || value.isBlank() || value.trim().length() < min || value.trim().length() > max) {
            throw AdminOpsException.invalid(code, message);
        }
        return value.trim();
    }

    private static String ref(String value, boolean allowBlank) {
        if (value == null || value.isBlank()) {
            return null;
        }
        if (!SAFE_TEXT.matcher(value.trim()).matches()) {
            throw AdminOpsException.invalid("RISK_REF_INVALID", "reference is not a safe token");
        }
        return value.trim();
    }

    private static List<String> refs(List<String> values) {
        if (values == null) {
            return List.of();
        }
        if (values.size() > 8) {
            throw AdminOpsException.invalid("RISK_EVIDENCE_INVALID", "at most 8 evidence references");
        }
        List<String> result = new ArrayList<>();
        for (String value : values) {
            if (value == null || value.isBlank() || !SAFE_TEXT.matcher(value.trim()).matches()) {
                throw AdminOpsException.invalid("RISK_EVIDENCE_INVALID", "evidence reference is invalid");
            }
            result.add(value.trim());
        }
        return List.copyOf(result);
    }

    private static String note(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        if (value.trim().length() > 512) {
            throw AdminOpsException.invalid("RISK_NOTE_INVALID", "note is too long");
        }
        return value.trim();
    }

    private static String escalation(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toUpperCase(java.util.Locale.ROOT);
        if (!normalized.equals("SUPPORT") && !normalized.equals("AUDIT")) {
            throw AdminOpsException.invalid("RISK_ESCALATION_INVALID", "escalation target must be SUPPORT or AUDIT");
        }
        return normalized;
    }

    private static String scope(AdminPrincipal principal, String operation) {
        return principal.tenantId() + ":" + principal.subjectId() + ":" + operation;
    }

    private static String safeTrace(String traceId) {
        String normalized = traceId == null || traceId.isBlank()
                ? "trace_risk_" + UUID.randomUUID() : traceId.trim();
        if (normalized.length() > 160) {
            throw AdminOpsException.invalid("RISK_TRACE_INVALID", "trace id must be a bounded safe token");
        }
        return normalized;
    }

    private static void requireIdempotencyKey(String value) {
        if (value == null || value.trim().length() < 8 || value.trim().length() > 160) {
            throw AdminOpsException.invalid("RISK_IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required");
        }
    }

    /** Mutable lifecycle holder; snapshots persist through the store. */
    private static final class RiskCase {
        final String caseId;
        final String tenantId;
        final RiskCategory category;
        final RiskSeverity severity;
        RiskStatus status;
        final RiskSource source;
        final String ruleId;
        final String ruleVersion;
        final String title;
        final String subjectRef;
        final List<String> evidenceRefs;
        String assigneeNote;
        String containmentRef;
        String escalationTarget;
        String escalationRef;
        String closedReason;
        final List<RiskDecisionRecord> decisions = new ArrayList<>();
        String lastAuditId;
        long version = 1;
        final Instant createdAt;

        RiskCase(String caseId, String tenantId, RiskCategory category, RiskSeverity severity,
                RiskStatus status, RiskSource source, String ruleId, String ruleVersion, String title,
                String subjectRef, List<String> evidenceRefs, String assigneeNote, String containmentRef,
                String escalationTarget, String escalationRef, String closedReason, Instant createdAt) {
            this.caseId = caseId;
            this.tenantId = tenantId;
            this.category = category;
            this.severity = severity;
            this.status = status;
            this.source = source;
            this.ruleId = ruleId;
            this.ruleVersion = ruleVersion;
            this.title = title;
            this.subjectRef = subjectRef;
            this.evidenceRefs = List.copyOf(evidenceRefs == null ? List.of() : evidenceRefs);
            this.assigneeNote = assigneeNote;
            this.containmentRef = containmentRef;
            this.escalationTarget = escalationTarget;
            this.escalationRef = escalationRef;
            this.closedReason = closedReason;
            this.createdAt = createdAt;
        }

        void apply(RiskCommand command, RiskDecisionInput input, String operator, Instant now) {
            switch (command) {
                case TRIAGE -> {
                    status = RiskStatus.TRIAGED;
                    if (input.assigneeNote() != null) {
                        assigneeNote = input.assigneeNote();
                    }
                }
                case ISOLATE -> {
                    status = RiskStatus.ACTIONED;
                    containmentRef = input.containmentRef();
                }
                case UNISOLATE -> {
                    status = RiskStatus.TRIAGED;
                    containmentRef = null;
                }
                case ESCALATE -> {
                    status = RiskStatus.ESCALATED;
                    escalationTarget = input.escalationTarget();
                    escalationRef = input.escalationRef();
                }
                case CLOSE -> {
                    status = RiskStatus.CLOSED;
                    closedReason = input.reason();
                }
            }
        }

        RiskCaseRecord snapshot(Instant updatedAt) {
            return new RiskCaseRecord(caseId, tenantId, category, severity, status, source, ruleId,
                    ruleVersion, title, subjectRef, evidenceRefs, assigneeNote, containmentRef,
                    escalationTarget, escalationRef, closedReason, List.copyOf(decisions), lastAuditId,
                    version, createdAt, updatedAt);
        }

        static RiskCase fromRecord(RiskCaseRecord record) {
            RiskCase kase = new RiskCase(record.caseId(), record.tenantId(), record.category(),
                    record.severity(), record.status(), record.source(), record.ruleId(),
                    record.ruleVersion(), record.title(), record.subjectRef(), record.evidenceRefs(),
                    record.assigneeNote(), record.containmentRef(), record.escalationTarget(),
                    record.escalationRef(), record.closedReason(), record.createdAt());
            kase.decisions.addAll(record.decisions() == null ? List.of() : record.decisions());
            kase.lastAuditId = record.lastAuditId();
            kase.version = record.version();
            return kase;
        }
    }

    /** Rule evaluation receipt (idempotent). */
    public record RiskEvaluateResult(Instant evaluatedAt, int rulesChecked, int casesFiled,
            List<String> caseIds, boolean replayed) {
    }

    /** Decision input: command comes from the path-level enum binding. */
    public record RiskDecisionInput(RiskCommand command, String reason, String assigneeNote,
            String containmentRef, String escalationTarget, String escalationRef) {
    }

}
