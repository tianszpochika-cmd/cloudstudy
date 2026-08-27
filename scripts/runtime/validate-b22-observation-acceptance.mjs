import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const root = path.resolve(path.dirname(scriptPath), '..', '..')
const manifestRelativePath = 'config/b22-observation-acceptance.json'
const runtimeRequestedByProcess = process.argv.includes('--require-runtime') || process.env.B22_REQUIRE_RUNTIME === '1'
const expectedTasks = ['V2-B22-OPS-003', 'V2-B22-TEST-004']
const expectedGateIds = [
  'B22-OPS-003-OBSERVATION',
  'B22-OPS-003-ESCALATION',
  'B22-OPS-003-INCIDENT',
  'B22-TEST-004-ACCEPTANCE',
  'B22-TEST-004-EVIDENCE',
  'B22-TEST-004-MAINTENANCE',
]
const expectedB21Tasks = [
  'V2-B21-DEP-001',
  'V2-B21-STG-002',
  'V2-B21-OBS-003',
  'V2-B21-RC-004',
  'V2-B21-GATE-005',
  'V2-B21-TEST-006',
]
const allowedRuntimeStatuses = new Set(['pending', 'blocked'])

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireCondition(condition, message, errors) {
  if (!condition) errors.push(message)
}

function requireArray(value, label, errors, minimum = 1) {
  requireCondition(Array.isArray(value) && value.length >= minimum, `${label} must contain at least ${minimum} item(s)`, errors)
}

function requireString(value, label, errors) {
  requireCondition(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`, errors)
}

function unique(values, label, errors) {
  const normalized = values.filter((value) => typeof value === 'string')
  requireCondition(new Set(normalized).size === normalized.length, `${label} must be unique`, errors)
}

function safeRepositoryPath(relativePath) {
  const absolutePath = path.resolve(root, relativePath)
  requireCondition(absolutePath === root || absolutePath.startsWith(`${root}${path.sep}`), `source path escapes repository: ${relativePath}`, [])
  return absolutePath
}

function readJson(relativePath, errors) {
  const absolutePath = safeRepositoryPath(relativePath)
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
  } catch (error) {
    errors.push(`cannot read JSON ${relativePath}: ${error.message}`)
    return null
  }
}

function readText(relativePath, errors) {
  const absolutePath = safeRepositoryPath(relativePath)
  if (!fs.existsSync(absolutePath)) {
    errors.push(`missing source path ${relativePath}`)
    return ''
  }
  try {
    return fs.readFileSync(absolutePath, 'utf8')
  } catch (error) {
    errors.push(`cannot read source path ${relativePath}: ${error.message}`)
    return ''
  }
}

function scanValues(value, location, errors) {
  if (typeof value === 'string') {
    const forbidden = [
      /Bearer\s+[A-Za-z0-9._~-]+/i,
      /\bsk-[A-Za-z0-9]/i,
      /-----BEGIN [A-Z ]+-----/i,
      /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./,
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
      /(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/,
    ]
    for (const pattern of forbidden) requireCondition(!pattern.test(value), `${location} looks like real PII or a secret`, errors)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) scanValues(child, `${location}.${key}`, errors)
}

function flattenChecks(manifest) {
  return (manifest.qualityGates ?? []).flatMap((gate) => [
    ...(gate.staticChecks ?? []).map((check) => ({ ...check, gateId: gate.id })),
    ...(gate.runtimeChecks ?? []).map((check) => ({ ...check, gateId: gate.id })),
  ])
}

function validateTaskContract(manifest, errors) {
  const tasks = manifest.tasks ?? []
  const taskIds = tasks.map((task) => task?.id)
  requireCondition(JSON.stringify(taskIds) === JSON.stringify(expectedTasks), 'B22 task scope must contain OPS-003 and TEST-004 in order', errors)
  unique(taskIds, 'B22 task ids', errors)
  for (const task of tasks) {
    requireString(task?.id, 'task.id', errors)
    requireCondition(task?.status === 'defined', `${task?.id} must remain defined for runtime acceptance`, errors)
    requireCondition(task?.runtimeRequired === true, `${task?.id} must require runtime evidence`, errors)
    requireCondition(task?.defaultDecision === 'NO-GO', `${task?.id} must default to NO-GO`, errors)
    requireArray(task?.dependsOn, `${task?.id}.dependsOn`, errors, 2)
    requireArray(task?.scope, `${task?.id}.scope`, errors, 7)
  }
}

function validateRuntimeGate(runtimeGate, errors) {
  requireCondition(runtimeGate?.staticOnlyByDefault === true, 'runtime gate must be static-only by default', errors)
  requireCondition(runtimeGate?.requireRuntimeEnv === 'B22_REQUIRE_RUNTIME', 'runtime request env must be B22_REQUIRE_RUNTIME', errors)
  requireCondition(runtimeGate?.runtimeEvidenceMustBeCapturedExternally === true, 'runtime evidence must be captured externally', errors)
  requireCondition(runtimeGate?.runtimeEvidenceMustRemainPendingOrBlocked === true, 'runtime evidence must remain pending or blocked', errors)
  requireCondition(runtimeGate?.staticValidatorCannotPromoteRuntime === true, 'static validator cannot promote runtime', errors)
  requireCondition(runtimeGate?.runtimeStatusWhenMissing === 'blocked', 'missing runtime evidence must block', errors)
  requireArray(runtimeGate?.requiredEnv, 'runtimeGate.requiredEnv', errors, 6)
  unique(runtimeGate?.requiredEnv ?? [], 'runtime required env', errors)
  for (const name of runtimeGate?.requiredEnv ?? []) requireCondition(/^B22_RUNTIME_[A-Z0-9_]+$/.test(name), `invalid B22 runtime env ${name}`, errors)
  requireArray(runtimeGate?.requiredEvidence, 'runtimeGate.requiredEvidence', errors, 6)
  for (const boundary of ['static-manifest-only', 'synthetic-fixture-only', 'development-http-200', 'unreproducible-report', 'open-p0-or-p1']) {
    requireCondition(runtimeGate?.cannotBeSatisfiedBy?.includes(boundary), `runtime fake-pass boundary missing ${boundary}`, errors)
  }
}

function validateExecutionAndSafety(manifest, errors) {
  requireCondition(manifest.execution?.mode === 'static-fixture-only', 'execution mode must be static-fixture-only', errors)
  requireCondition(manifest.execution?.runtimeBlocked === true, 'execution runtime must remain blocked', errors)
  requireCondition(manifest.execution?.allowUnverifiedPass === false, 'unverified pass must be forbidden', errors)
  requireCondition(manifest.execution?.staticValidatorCannotPromoteRuntime === true, 'static execution cannot promote runtime', errors)
  requireCondition(manifest.execution?.runtimeEvidence === null, 'runtime evidence must be null until externally captured', errors)
  for (const field of ['productionMutationAllowed', 'trafficSwitchAllowed', 'destructiveOperationAllowed', 'paymentOperationAllowed']) {
    requireCondition(manifest.execution?.[field] === false, `${field} must remain false`, errors)
  }
  const safety = manifest.safetyBoundaries
  for (const field of ['noRealCredentials', 'noPII', 'noProductionData', 'noPayment', 'noDeletion', 'noTrafficSwitch', 'noProductionMutation']) {
    requireCondition(safety?.[field] === true, `safety boundary ${field} must be true`, errors)
  }
  requireCondition(safety?.runtimeCollectionMustUseApprovedRunner === true, 'runtime collection must use an approved runner', errors)
  requireCondition(safety?.runtimeCollectionMustNotWriteRepository === true, 'runtime collection must not write the repository', errors)
}

function validateB21Prerequisite(prerequisite, errors) {
  requireCondition(prerequisite?.required === true, 'B21 must be required', errors)
  requireCondition(prerequisite?.requiredBatch === 'B21', 'B21 prerequisite batch is invalid', errors)
  requireCondition(JSON.stringify(prerequisite?.requiredTasks) === JSON.stringify(expectedB21Tasks), 'B21 prerequisite task list is incomplete or reordered', errors)
  requireCondition(prerequisite?.requiredDecision === 'GO', 'B22 must require B21 GO', errors)
  requireCondition(prerequisite?.currentDecision === 'BLOCKED', 'B21 current decision must remain BLOCKED', errors)
  requireCondition(prerequisite?.status === 'blocked', 'B21 prerequisite must remain blocked', errors)
  requireCondition(prerequisite?.runtimeEvidenceStatus === 'pending' && prerequisite?.acceptanceEvidenceStatus === 'pending', 'B21 evidence must remain pending', errors)
  requireCondition(prerequisite?.missingEvidenceBlocks === true && prerequisite?.staticValidatorCannotOverride === true, 'B21 missing evidence must block and cannot be overridden', errors)
  requireArray(prerequisite?.requiredEvidence, 'B21 required evidence', errors, expectedB21Tasks.length)
  requireCondition(JSON.stringify(prerequisite?.sourceManifests) === JSON.stringify([
    'config/b21-deployment-staging.json',
    'config/b21-observability-rc.json',
    'config/b21-release-gate-evidence.json',
  ]), 'B21 source manifest list is incomplete or reordered', errors)
  for (const relativePath of prerequisite?.sourceManifests ?? []) {
    const b21 = readJson(relativePath, errors)
    if (!b21) continue
    requireCondition(b21.batch === 'B21', `${relativePath} must be a B21 manifest`, errors)
    requireCondition(b21.status === 'static-foundation', `${relativePath} must remain a static foundation`, errors)
    requireCondition(b21.releaseGate?.status === 'BLOCKED' || b21.execution?.runtimeStatus === 'blocked' || b21.runtimeDecision === 'BLOCKED', `${relativePath} must not claim runtime acceptance`, errors)
  }
}

function validateObservationPolicy(policy, errors) {
  requireCondition(policy?.status === 'pending', 'observation policy must remain pending', errors)
  requireCondition(policy?.environment === 'production', 'observation environment must be production', errors)
  requireCondition(policy?.realObservationRequired === true && policy?.syntheticObservationCannotCloseGate === true, 'real observation and synthetic exclusion are required', errors)
  requireCondition(policy?.developmentHttp200CannotCloseGate === true, 'development HTTP 200 must not close the gate', errors)
  const windows = policy?.windows ?? {}
  requireCondition(JSON.stringify(Object.keys(windows)) === JSON.stringify(['short', 'long']), 'short and long observation windows are required', errors)
  for (const [name, window] of Object.entries(windows)) {
    requireString(window?.id, `${name} observation window id`, errors)
    requireCondition(window?.environment === 'production' && window?.realTrafficRequired === true && window?.productionLikeOnly === true, `${name} window must require real production traffic`, errors)
    requireCondition(window?.status === 'pending' && window?.runtimeRequired === true, `${name} window must remain pending and runtime-required`, errors)
    requireString(window?.evidenceId, `${name} window evidence id`, errors)
  }
  requireArray(policy?.closeConditions, 'observation close conditions', errors, 5)
}

function validateObservability(observability, errors) {
  requireCondition(observability?.runtimeStatus === 'pending', 'observability runtime status must remain pending', errors)
  const signalStandard = observability?.signalStandard
  requireCondition(signalStandard?.provider === 'OpenTelemetry', 'observability provider must be OpenTelemetry', errors)
  requireCondition(JSON.stringify(signalStandard?.signals) === JSON.stringify(['traces', 'metrics', 'logs']), 'OTel traces/metrics/logs are all required', errors)
  for (const field of ['service.name', 'service.version', 'deployment.environment']) requireCondition(signalStandard?.requiredResourceAttributes?.includes(field), `OTel resource attribute missing ${field}`, errors)
  for (const field of ['requestId', 'traceId', 'eventId', 'decisionId']) requireCondition(signalStandard?.correlationFields?.includes(field), `telemetry correlation field missing ${field}`, errors)
  requireCondition(signalStandard?.sensitiveDataPolicy === 'redact-or-do-not-record' && signalStandard?.exporterEndpointSource === 'runtime-env-only' && signalStandard?.runtimeStatus === 'pending', 'OTel privacy/runtime policy is incomplete', errors)
  requireArray(observability?.slis, 'observability SLIs', errors, 3)
  for (const sli of observability?.slis ?? []) requireCondition(sli.status === 'not-measured' && sli.windowRefs?.length === 2, `${sli.id} must remain unmeasured for both windows`, errors)
  requireArray(observability?.slos, 'observability SLOs', errors, 3)
  for (const slo of observability?.slos ?? []) requireCondition(slo.status === 'target-not-measured', `${slo.id} must remain unmeasured`, errors)
  const budget = observability?.errorBudget
  requireCondition(budget?.status === 'target-not-measured' && budget?.measurementRequired === true && budget?.consumedPercent === null, 'errorBudget must remain unmeasured', errors)
  requireCondition(budget?.overrunBlocksAcceptance === true && budget?.overrunDecision === 'STOP-EXPANSION-AND-ROLLBACK', 'error budget overrun must stop expansion and rollback', errors)
  const alertRouting = observability?.alertRouting
  requireCondition(alertRouting?.runtimeStatus === 'pending' && alertRouting?.escalationRequired === true, 'alert escalation must remain pending and required', errors)
  for (const severity of ['P0', 'P1', 'P2']) requireCondition(alertRouting?.routes?.some((route) => route.severity === severity), `${severity} alert route is missing`, errors)
  requireCondition(alertRouting?.unownedAlertDecision === 'PAGE-PLATFORM-AND-BLOCK-ACCEPTANCE', 'unowned alerts must page and block acceptance', errors)
  requireCondition(alertRouting?.silence?.status === 'not-executed' && alertRouting?.silence?.auditRequired === true, 'silence audit must remain pending', errors)
  requireArray(observability?.dashboards, 'observability dashboards', errors, 3)
  for (const dashboard of observability?.dashboards ?? []) requireCondition(dashboard.status === 'pending', `${dashboard.id} must remain pending`, errors)
  const support = observability?.customerSupport
  requireCondition(support?.status === 'pending' && support?.ticketSystemRequired === true && support?.ticketEvidenceRequired === true, 'customer support ticket evidence is required', errors)
  for (const field of ['ticketRef', 'severity', 'createdAt', 'acknowledgedAt', 'ownerRef', 'resolutionOrEscalation', 'releaseVersion', 'observationWindowRef']) requireCondition(support?.requiredFields?.includes(field), `support field missing ${field}`, errors)
  requireCondition(support?.redactedViewOnly === true && support?.rawPiiAllowed === false && support?.slaBreachesEscalate === true, 'support data policy is unsafe or incomplete', errors)
  const onCall = observability?.onCall
  requireCondition(onCall?.status === 'pending' && onCall?.handoffRequiresAudit === true && onCall?.acknowledgementRequired === true && onCall?.escalationChainRequired === true, 'on-call evidence is incomplete', errors)
  requireCondition(onCall?.noOwnerDecision === 'PAGE-PLATFORM-AND-BLOCK-ACCEPTANCE' && onCall?.rosterEvidenceStatus === 'pending', 'unowned on-call policy is incomplete', errors)
  requireArray(observability?.incidentDrills, 'incident drills', errors, 3)
  for (const drill of observability?.incidentDrills ?? []) requireCondition(drill.status === 'pending' && drill.runtimeRequired === true, `${drill.id} must remain pending and runtime-required`, errors)
  requireCondition(observability?.incidentReview?.status === 'pending' && observability?.incidentReview?.required === true && observability?.incidentReview?.blamelessReviewRequired === true && observability?.incidentReview?.unresolvedP0P1Blocks === true, 'incident review policy is incomplete', errors)
  const feedback = observability?.userFeedback
  requireCondition(feedback?.status === 'pending' && feedback?.mustCoverShortAndLongWindow === true && feedback?.mustBindToReleaseVersion === true && feedback?.rawTextAndPiiAllowed === false, 'user feedback policy is incomplete', errors)
  requireCondition(feedback?.unresolvedCriticalFeedbackDecision === 'BLOCK-ACCEPTANCE-AND-ESCALATE', 'critical feedback must block acceptance', errors)
  const risks = observability?.legacyRisks
  requireCondition(risks?.status === 'pending' && risks?.required === true && risks?.mustHaveOwner === true && risks?.mustHaveExpiry === true && risks?.expiredDecision === 'BLOCKED', 'legacy risk owner/expiry policy is incomplete', errors)
  requireArray(risks?.items, 'legacy risks', errors, 1)
  for (const risk of risks?.items ?? []) requireCondition(risk.ownerRef === null && risk.expiresAt === null && typeof risk.riskId === 'string' && risk.riskId.startsWith('risk-ref://synthetic/'), `${risk.riskId} must not be accepted without owner and expiry`, errors)
  const audit = observability?.auditTrail
  requireCondition(audit?.status === 'pending' && audit?.required === true && audit?.appendOnly === true && audit?.replayable === true, 'audit trail must be append-only, replayable and pending', errors)
  for (const field of ['eventId', 'requestId', 'traceId', 'decisionId', 'actorRef', 'timestamp', 'action', 'outcome', 'artifactRef']) requireCondition(audit?.requiredFields?.includes(field), `audit field missing ${field}`, errors)
}

function validateReleaseAcceptance(acceptance, errors) {
  requireCondition(acceptance?.status === 'pending' && acceptance?.phase === 'phase-1' && acceptance?.runtimeEvidenceStatus === 'pending', 'Phase 1 acceptance must remain pending', errors)
  for (const domain of ['production-smoke', 'key-journeys', 'permission', 'privacy', 'backup', 'release', 'monitoring', 'support', 'audit']) requireCondition(acceptance?.requiredEvidenceDomains?.includes(domain), `acceptance evidence domain missing ${domain}`, errors)
  requireArray(acceptance?.keyJourneySmoke, 'key journey smoke', errors, 4)
  for (const journey of acceptance?.keyJourneySmoke ?? []) requireCondition(journey.status === 'pending' && journey.runtimeRequired === true && journey.productionLikeRequired === true, `${journey.id} smoke must remain pending and runtime-required`, errors)
  requireCondition(acceptance?.permissionPrivacyEvidence?.status === 'pending' && acceptance?.permissionPrivacyEvidence?.permissionDeniedAndTenantScopeRequired === true && acceptance?.permissionPrivacyEvidence?.privacyRedactionAndConsentRequired === true && acceptance?.permissionPrivacyEvidence?.productionSubjectDataAllowed === false, 'permission/privacy evidence policy is incomplete', errors)
  requireCondition(acceptance?.backupEvidence?.status === 'pending' && acceptance?.backupEvidence?.backupAndRestoreRequired === true && acceptance?.backupEvidence?.rpoRtoRequired === true && acceptance?.backupEvidence?.restorePointRequired === true && acceptance?.backupEvidence?.postRestoreReconciliationRequired === true && acceptance?.backupEvidence?.destructiveDowngradeAllowed === false, 'backup/restore evidence policy is incomplete', errors)
  requireCondition(acceptance?.releaseEvidence?.status === 'pending' && acceptance?.releaseEvidence?.requiresB21GoEvidence === true && acceptance?.releaseEvidence?.requiresRollbackPoint === true && acceptance?.releaseEvidence?.requiresVersionedRelease === true, 'release evidence policy is incomplete', errors)
  const binding = acceptance?.artifactBinding
  requireCondition(binding?.status === 'pending' && binding?.algorithm === 'SHA-256' && binding?.immutableDigestOnly === true, 'artifact binding must remain pending and immutable', errors)
  for (const field of ['releaseVersion', 'sourceRevision', 'lockfileDigest', 'artifactDigest', 'manifestDigest', 'environmentRef', 'artifactSignatureRef']) requireCondition(binding?.requiredFields?.includes(field), `artifact binding field missing ${field}`, errors)
  requireCondition(binding?.missingBindingDecision === 'NO-GO' && binding?.artifactDigest === null && binding?.environmentRef === null, 'missing artifact binding must be NO-GO', errors)
  const owner = acceptance?.maintenanceOwner
  requireCondition(owner?.status === 'not-assigned' && owner?.required === true && owner?.ownerRef === null && owner?.handoffEvidenceStatus === 'pending', 'maintenance owner must remain unassigned until runtime handoff', errors)
  for (const field of ['on-call', 'incident-review', 'legacy-risks', 'P1-follow-up', 'audit-retention']) requireCondition(owner?.scopeMustInclude?.includes(field), `maintenance scope missing ${field}`, errors)
  requireCondition(owner?.missingOwnerDecision === 'BLOCKED', 'missing maintenance owner must block', errors)
  const p1 = acceptance?.p1Disposition
  requireCondition(p1?.status === 'pending' && p1?.openP1 === 0 && p1?.noOpenP1ForGo === true, 'P1 disposition must remain pending with no accepted open P1', errors)
  requireCondition(p1?.allowedActions?.includes('close') && p1?.allowedActions?.includes('transfer'), 'P1 must support close or transfer only', errors)
  for (const field of ['verified-fix', 'regression-evidence', 'independent-review', 'audit-record']) requireCondition(p1?.closeRequires?.includes(field), `P1 close requirement missing ${field}`, errors)
  for (const field of ['named-maintenance-owner', 'expiry', 'mitigation', 'acceptance-record']) requireCondition(p1?.transferRequires?.includes(field), `P1 transfer requirement missing ${field}`, errors)
  requireCondition(p1?.missingDispositionDecision === 'BLOCKED', 'missing P1 disposition must block', errors)
  const reproducibility = acceptance?.reportReproducibility
  requireCondition(reproducibility?.status === 'pending' && reproducibility?.missingReproductionDecision === 'NO-GO', 'report reproducibility must remain pending and NO-GO', errors)
  for (const field of ['generatorVersionRequired', 'manifestDigestRequired', 'sourceRevisionRequired', 'toolVersionsRequired', 'deterministicInputRefsRequired', 'reportHashRequired']) requireCondition(reproducibility?.[field] === true, `report reproducibility missing ${field}`, errors)
}

function validateReleaseGate(gate, errors) {
  requireCondition(gate?.status === 'BLOCKED' && gate?.defaultDecision === 'NO-GO', 'B22 release gate must be BLOCKED/NO-GO', errors)
  for (const field of ['requiresB21Go', 'requiresBothObservationWindows', 'requiresCompleteEvidence', 'requiresReproducibleReport', 'requiresMaintenanceOwner', 'requiresNoOpenP0P1']) requireCondition(gate?.[field] === true, `release gate missing ${field}`, errors)
  for (const condition of [
    'b21-gate-not-go', 'b21-runtime-evidence-pending-or-blocked', 'b22-rel-or-data-prerequisite-missing', 'any-required-evidence-missing',
    'short-observation-window-missing', 'long-observation-window-missing', 'slo-or-error-budget-not-measured', 'error-budget-exhausted-or-overrun',
    'otel-trace-metric-log-missing', 'alert-escalation-or-oncall-missing', 'customer-support-ticket-evidence-missing', 'incident-drill-or-review-missing',
    'open-p0-or-p1', 'stop-or-rollback-decision-missing', 'user-feedback-missing', 'legacy-risk-owner-or-expiry-missing', 'audit-trail-missing',
    'production-smoke-or-key-journey-missing', 'permission-or-privacy-evidence-missing', 'backup-or-restore-evidence-missing', 'release-evidence-missing',
    'artifact-hash-version-environment-binding-missing', 'report-not-reproducible', 'maintenance-owner-missing', 'p1-not-closed-or-transferred',
    'synthetic-or-development-http-200-only',
  ]) requireCondition(gate?.blockingConditions?.includes(condition), `release blocker missing ${condition}`, errors)
  const stopRollback = gate?.stopRollback
  requireCondition(stopRollback?.status === 'not-established' && stopRollback?.openP0 === 0 && stopRollback?.openP1 === 0, 'P0/P1 stop-rollback gate must remain unestablished and closed until runtime', errors)
  requireCondition(stopRollback?.anyOpenDecision === 'STOP-EXPANSION-AND-ROLLBACK' && stopRollback?.errorBudgetOverrunDecision === 'STOP-EXPANSION-AND-ROLLBACK', 'P0/P1 and budget overrun must stop expansion and rollback', errors)
  for (const field of ['requiresImmutableArtifact', 'requiresRestorePoint', 'requiresNamedOwner', 'requiresPostRollbackReconciliation']) requireCondition(stopRollback?.[field] === true, `stop/rollback missing ${field}`, errors)
  const dualReview = gate?.dualReview
  requireCondition(dualReview?.required === true && dualReview?.minimumReviewers >= 2 && dualReview?.independentReviewers === true && dualReview?.samePersonCannotSatisfyBoth === true && dualReview?.status === 'not-present', 'dual review policy is incomplete', errors)
  const maintenance = gate?.maintenance
  requireCondition(maintenance?.required === true && maintenance?.ownerStatus === 'not-assigned' && maintenance?.handoffStatus === 'pending' && maintenance?.p1CloseOrTransferRequired === true, 'maintenance handoff policy is incomplete', errors)
}

function validateStaticAssertion(check, errors) {
  requireArray(check?.sourcePaths, `${check?.id}.sourcePaths`, errors)
  requireArray(check?.assertions, `${check?.id}.assertions`, errors)
  const sourceText = (check?.sourcePaths ?? []).map((relativePath) => readText(relativePath, errors)).join('\n')
  for (const assertion of check?.assertions ?? []) {
    if (typeof assertion?.contains === 'string') requireCondition(sourceText.includes(assertion.contains), `${check?.id} missing marker ${assertion.contains}`, errors)
    else if (typeof assertion?.regex === 'string') {
      try {
        requireCondition(new RegExp(assertion.regex, assertion.flags ?? '').test(sourceText), `${check?.id} regex did not match ${assertion.regex}`, errors)
      } catch (error) {
        errors.push(`${check?.id} has invalid regex: ${error.message}`)
      }
    } else errors.push(`${check?.id} assertion must contain contains or regex`)
  }
}

function validateChecks(manifest, errors) {
  const gates = manifest.qualityGates ?? []
  requireCondition(JSON.stringify(gates.map((gate) => gate?.id)) === JSON.stringify(expectedGateIds), 'B22 quality gate ids are incomplete or reordered', errors)
  for (const gate of gates) {
    requireCondition(gate?.decision === 'BLOCKED', `${gate?.id} must remain BLOCKED`, errors)
    requireArray(gate?.evidenceIds, `${gate?.id}.evidenceIds`, errors, 2)
    requireArray(gate?.staticChecks, `${gate?.id}.staticChecks`, errors)
    requireArray(gate?.runtimeChecks, `${gate?.id}.runtimeChecks`, errors)
  }
  const checks = flattenChecks(manifest)
  requireCondition(checks.length >= 12, 'B22 static/runtime checks are incomplete', errors)
  const checkIds = checks.map((check) => check?.id)
  unique(checkIds, 'B22 quality check ids', errors)
  for (const check of checks) {
    requireString(check?.id, 'quality check.id', errors)
    requireString(check?.evidenceId, `${check?.id}.evidenceId`, errors)
    if (check?.evidenceClass === 'static') {
      requireCondition(check?.status === 'defined' && check?.runtimeRequired === false, `${check?.id} static state is invalid`, errors)
      validateStaticAssertion(check, errors)
    } else if (check?.evidenceClass === 'runtime') {
      requireCondition(allowedRuntimeStatuses.has(check?.status) && check?.runtimeRequired === true, `${check?.id} runtime state must remain pending/blocked`, errors)
      requireArray(check?.tools, `${check?.id}.tools`, errors)
      requireArray(check?.evidenceRequired, `${check?.id}.evidenceRequired`, errors)
      requireArray(check?.cannotBeSatisfiedBy, `${check?.id}.cannotBeSatisfiedBy`, errors)
    } else errors.push(`${check?.id} evidenceClass must be static or runtime`)
  }
  return checks
}

function validateEvidenceIndex(manifest, checks, errors) {
  const evidence = manifest.evidenceIndex ?? []
  requireArray(evidence, 'evidenceIndex', errors, 12)
  const evidenceIds = evidence.map((item) => item?.id)
  unique(evidenceIds, 'evidence ids', errors)
  const gateIds = new Set((manifest.qualityGates ?? []).map((gate) => gate?.id))
  const referencedEvidence = new Set(checks.map((check) => check?.evidenceId))
  for (const item of evidence) {
    requireString(item?.id, 'evidence.id', errors)
    requireCondition(gateIds.has(item?.gateId), `${item?.id} references an unknown gate`, errors)
    requireCondition(item?.class === 'static' || item?.class === 'runtime', `${item?.id} class must be static or runtime`, errors)
    requireString(item?.artifactPathPattern, `${item?.id}.artifactPathPattern`, errors)
    requireString(item?.collectionPolicy, `${item?.id}.collectionPolicy`, errors)
    if (item?.class === 'static') {
      requireCondition(item?.status === 'defined' && item?.runtimeRequired === false, `${item?.id} static evidence state is invalid`, errors)
      requireCondition(String(item?.artifactPathPattern).startsWith('config/'), `${item?.id} static evidence must be repository-addressable`, errors)
    } else {
      requireCondition(allowedRuntimeStatuses.has(item?.status) && item?.runtimeRequired === true, `${item?.id} runtime evidence must remain pending/blocked`, errors)
      requireCondition(item?.collectionPolicy === 'runtime-runner-only', `${item?.id} runtime evidence must use runtime-runner-only`, errors)
      requireCondition(String(item?.artifactPathPattern).startsWith('evidence/'), `${item?.id} runtime evidence must be external`, errors)
    }
  }
  for (const id of referencedEvidence) requireCondition(evidenceIds.includes(id), `check evidence ${id} is missing from index`, errors)
  for (const id of manifest.runtimeGate?.requiredEvidence ?? []) requireCondition(evidenceIds.includes(id), `runtimeGate evidence ${id} is missing from index`, errors)
  for (const gate of manifest.qualityGates ?? []) {
    const gateEvidence = new Set(evidence.filter((item) => item?.gateId === gate?.id).map((item) => item?.id))
    for (const id of gate?.evidenceIds ?? []) requireCondition(gateEvidence.has(id), `${gate?.id} evidence ${id} is not indexed`, errors)
  }
}

function validateReportSchema(reportSchema, errors) {
  requireCondition(reportSchema?.closed === true, 'report schema must be explicitly closed', errors)
  requireString(reportSchema?.id, 'reportSchema.id', errors)
  requireString(reportSchema?.version, 'reportSchema.version', errors)
  const schema = reportSchema?.jsonSchema
  requireCondition(isRecord(schema) && schema.type === 'object' && schema.additionalProperties === false, 'report schema root must be a closed object', errors)
  const required = new Set(schema?.required ?? [])
  for (const field of ['schemaVersion', 'reportId', 'batch', 'phase', 'releaseCandidate', 'observation', 'decision', 'decisionPolicy', 'gates', 'keyJourneys', 'evidence', 'upstreamGates', 'artifactBinding', 'permissionPrivacy', 'backup', 'incidents', 'userFeedback', 'knownRisks', 'maintenance', 'p1Disposition', 'rollback', 'auditTrail', 'reproducibility', 'reportHash']) requireCondition(required.has(field), `report schema missing required field ${field}`, errors)
  requireCondition(schema?.properties?.decision?.enum?.includes('NO-GO') && schema?.properties?.decision?.enum?.includes('BLOCKED') && schema?.properties?.decision?.enum?.includes('GO'), 'report decision enum must include NO-GO, BLOCKED and GO', errors)
  requireCondition(schema?.properties?.decisionPolicy?.properties?.b21MustBeGo?.const === true && schema?.properties?.decisionPolicy?.properties?.runtimeEvidenceRequired?.const === true && schema?.properties?.decisionPolicy?.properties?.reportMustBeReproducible?.const === true, 'report decision policy must require B21/runtime/reproducibility', errors)
  requireCondition(schema?.properties?.reportHash?.pattern === '^sha256:[a-f0-9]{64}$', 'report hash must use SHA-256', errors)
  function walk(value, location) {
    if (!isRecord(value)) return
    if (value.type === 'object') requireCondition(value.additionalProperties === false, `${location} object schema must be closed`, errors)
    if (isRecord(value.properties)) for (const [key, child] of Object.entries(value.properties)) walk(child, `${location}.properties.${key}`)
    if (isRecord(value.items)) walk(value.items, `${location}.items`)
  }
  walk(schema, 'reportSchema.jsonSchema')
}

function validateSyntheticFixtures(fixtures, errors) {
  requireCondition(fixtures?.fixturePolicy === 'synthetic-references-only-no-real-subjects-no-secrets-no-production-data-no-payment-no-deletion-no-traffic-switch', 'synthetic fixture policy is unsafe or missing', errors)
  const requiredPrefixes = [
    ['observation.shortWindowRef', fixtures?.observation?.shortWindowRef, 'window-ref://synthetic/'],
    ['observation.longWindowRef', fixtures?.observation?.longWindowRef, 'window-ref://synthetic/'],
    ['observation.traceRef', fixtures?.observation?.traceRef, 'trace-ref://synthetic/'],
    ['observation.metricRef', fixtures?.observation?.metricRef, 'metric-ref://synthetic/'],
    ['observation.logRef', fixtures?.observation?.logRef, 'log-ref://synthetic/'],
    ['support.ticketRef', fixtures?.support?.ticketRef, 'ticket-ref://synthetic/'],
    ['support.onCallRef', fixtures?.support?.onCallRef, 'oncall-ref://synthetic/'],
    ['support.incidentRef', fixtures?.support?.incidentRef, 'incident-ref://synthetic/'],
    ['report.reportRef', fixtures?.report?.reportRef, 'report-ref://synthetic/'],
    ['report.releaseVersionRef', fixtures?.report?.releaseVersionRef, 'version-ref://synthetic/'],
    ['report.sourceRevisionRef', fixtures?.report?.sourceRevisionRef, 'commit-ref://synthetic/'],
    ['report.environmentRef', fixtures?.report?.environmentRef, 'environment-ref://synthetic/'],
    ['ownersAndRisks.maintenanceOwnerRef', fixtures?.ownersAndRisks?.maintenanceOwnerRef, 'owner-ref://synthetic/'],
    ['ownersAndRisks.riskRef', fixtures?.ownersAndRisks?.riskRef, 'risk-ref://synthetic/'],
    ['ownersAndRisks.expiryRef', fixtures?.ownersAndRisks?.expiryRef, 'expiry-ref://synthetic/'],
  ]
  for (const [label, value, prefix] of requiredPrefixes) requireCondition(typeof value === 'string' && value.startsWith(prefix), `${label} must be a synthetic reference`, errors)
  requireCondition(String(fixtures?.report?.artifactDigest ?? '').startsWith('sha256:fixture-'), 'synthetic artifact digest must be a non-production fixture reference', errors)
  requireCondition(String(fixtures?.report?.reportHash ?? '').startsWith('sha256:fixture-'), 'synthetic report hash must be a non-production fixture reference', errors)
}

export function validateB22ObservationAcceptance(config = readJson(manifestRelativePath, []), options = {}) {
  const errors = []
  const runtimeRequested = options.runtimeRequested ?? runtimeRequestedByProcess
  const runtimeEnv = options.env ?? process.env
  if (!config) return { result: 'FAIL', batch: 'B22', errors: ['manifest could not be loaded'] }
  requireCondition(config.schemaVersion === 1, 'schemaVersion must be 1', errors)
  requireCondition(config.batch === 'B22' && config.phase === 'phase-1', 'manifest must remain B22 Phase 1', errors)
  requireCondition(config.mode === 'static-and-synthetic' && config.status === 'static-foundation', 'manifest must be static-foundation mode', errors)
  requireCondition(config.runtimeDecision === 'BLOCKED', 'runtimeDecision must remain BLOCKED', errors)
  requireCondition(config.runtimeGate?.runtimeStatusWhenMissing === 'blocked', 'runtime gate missing status must be blocked', errors)

  validateTaskContract(config, errors)
  validateRuntimeGate(config.runtimeGate, errors)
  validateExecutionAndSafety(config, errors)
  validateB21Prerequisite(config.b21Prerequisite, errors)
  validateObservationPolicy(config.observationPolicy, errors)
  validateObservability(config.observability, errors)
  validateReleaseAcceptance(config.releaseAcceptance, errors)
  validateReleaseGate(config.releaseGate, errors)
  const checks = validateChecks(config, errors)
  validateEvidenceIndex(config, checks, errors)
  validateReportSchema(config.reportSchema, errors)
  validateSyntheticFixtures(config.syntheticFixtures, errors)
  scanValues(config, '$.manifest', errors)

  if (runtimeRequested) {
    const missing = (config.runtimeGate?.requiredEnv ?? []).filter((name) => !runtimeEnv[name])
    if (missing.length > 0) errors.push(`runtime gate blocked; missing environment: ${missing.join(', ')}`)
    errors.push('real B21, production observation and Phase 1 acceptance report evidence is pending; an approved external runner must capture and review production artifacts before any B22 Gate can pass')
  }

  const staticCount = checks.filter((check) => check?.evidenceClass === 'static').length
  const runtimeCount = checks.filter((check) => check?.evidenceClass === 'runtime').length
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    batch: 'B22',
    taskCount: config.tasks?.length ?? 0,
    qualityGateCount: config.qualityGates?.length ?? 0,
    staticChecks: staticCount,
    runtimeChecks: runtimeCount,
    runtimePending: runtimeCount,
    runtimeEvidencePending: runtimeCount,
    runtimeBlocked: true,
    evidenceCount: config.evidenceIndex?.length ?? 0,
    runtimeGate: runtimeRequested ? 'blocked' : 'static-only',
    releaseDecision: config.releaseGate?.defaultDecision ?? 'NO-GO',
    errors,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(scriptPath)) {
  const result = validateB22ObservationAcceptance()
  console.log(JSON.stringify(result, null, 2))
  if (result.result !== 'PASS') process.exitCode = 1
}
