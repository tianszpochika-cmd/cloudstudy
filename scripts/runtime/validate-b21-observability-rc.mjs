import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const root = path.resolve(path.dirname(scriptPath), '..', '..')
const manifestRelativePath = 'config/b21-observability-rc.json'
const manifestPath = path.join(root, manifestRelativePath)
const expectedTasks = ['V2-B21-OBS-003', 'V2-B21-RC-004']
const expectedGates = [
  'B21-OBS-003-SLO',
  'B21-OBS-003-ALERTING',
  'B21-OBS-003-INCIDENT',
  'B21-RC-004-IMMUTABLE',
  'B21-RC-004-REGRESSION',
  'B21-RC-004-GATE',
]
const allowedRuntimeStatuses = new Set(['pending', 'blocked'])
const forbiddenMaterialPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bghp_[A-Za-z0-9]{36}\b/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /Bearer\s+eyJ[A-Za-z0-9_-]+\./i,
  /[A-Za-z0-9._%+-]+@(gmail|qq|163|outlook)\.com/i,
  /(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/,
]

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readJson(relativePath, errors) {
  const absolutePath = path.join(root, relativePath)
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
  } catch (error) {
    errors.push(`cannot read JSON ${relativePath}: ${error.message}`)
    return null
  }
}

function isSafeRepositoryPath(relativePath) {
  if (typeof relativePath !== 'string' || relativePath.length === 0 || relativePath.includes('..') || path.isAbsolute(relativePath)) return false
  const resolved = path.resolve(root, relativePath)
  const repositoryRelative = path.relative(root, resolved)
  return !repositoryRelative.startsWith('..') && !path.isAbsolute(repositoryRelative) && !/^(node_modules|dist|target|\.nuxt|\.output)([\\/]|$)/i.test(repositoryRelative)
}

function readSource(relativePath, errors) {
  if (!isSafeRepositoryPath(relativePath)) {
    errors.push(`source path must be a safe relative repository path: ${relativePath}`)
    return ''
  }
  const absolutePath = path.join(root, relativePath)
  if (!fs.existsSync(absolutePath)) {
    errors.push(`missing source path: ${relativePath}`)
    return ''
  }
  return fs.readFileSync(absolutePath, 'utf8')
}

function fail(errors, message) {
  errors.push(message)
}

function requireString(value, label, errors) {
  if (typeof value !== 'string' || value.trim() === '') fail(errors, `${label} must be a non-empty string`)
}

function requireArray(value, label, errors, minimum = 1) {
  if (!Array.isArray(value) || value.length < minimum) fail(errors, `${label} must contain at least ${minimum} item(s)`)
}

function requireBoolean(value, label, errors) {
  if (typeof value !== 'boolean') fail(errors, `${label} must be boolean`)
}

function unique(values, label, errors) {
  const seen = new Set()
  for (const value of values) {
    if (seen.has(value)) fail(errors, `${label} contains duplicate: ${value}`)
    seen.add(value)
  }
}

function scanNoForbiddenMaterial(value, label, errors) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value)
  for (const pattern of forbiddenMaterialPatterns) {
    if (pattern.test(serialized)) fail(errors, `${label} contains forbidden secret/PII material matching ${pattern}`)
  }
}

function validateTasks(config, errors) {
  requireArray(config.tasks, 'tasks', errors, expectedTasks.length)
  const taskIds = (config.tasks ?? []).map((task) => task?.id)
  if (JSON.stringify(taskIds) !== JSON.stringify(expectedTasks)) fail(errors, `tasks must be exactly ${expectedTasks.join(', ')}`)
  unique(taskIds, 'task ids', errors)
  for (const task of config.tasks ?? []) {
    requireString(task?.id, 'task.id', errors)
    requireString(task?.name, `${task?.id}.name`, errors)
    if (task?.status !== 'defined') fail(errors, `${task?.id} must remain status=defined`)
    if (task?.runtimeRequired !== true) fail(errors, `${task?.id} must declare runtimeRequired=true`)
    if (task?.defaultDecision !== 'deny') fail(errors, `${task?.id} must default to deny`)
    requireArray(task?.acceptanceRefs, `${task?.id}.acceptanceRefs`, errors, 2)
  }
}

function validateRuntimeGate(config, errors) {
  const gate = config.runtimeGate
  if (!isRecord(gate)) {
    fail(errors, 'runtimeGate is required')
    return
  }
  if (gate.staticOnlyByDefault !== true || gate.staticValidatorCannotPromoteRuntime !== true || gate.externalEvidenceOnly !== true) fail(errors, 'runtimeGate must be static-only by default and external-evidence-only')
  requireString(gate.requireRuntimeEnv, 'runtimeGate.requireRuntimeEnv', errors)
  requireArray(gate.requiredEnv, 'runtimeGate.requiredEnv', errors, 5)
  for (const name of gate.requiredEnv ?? []) if (!/^B21_RUNTIME_[A-Z0-9_]+$/.test(name)) fail(errors, `invalid B21 runtime environment name: ${name}`)
  requireArray(gate.requiredEvidence, 'runtimeGate.requiredEvidence', errors, expectedGates.length)
  if (gate.runtimeStatusWhenMissing !== 'blocked') fail(errors, 'runtimeGate.runtimeStatusWhenMissing must be blocked')
}

function validateStaticCheck(check, gateId, evidenceIds, errors) {
  if (!isRecord(check)) {
    fail(errors, `${gateId} contains a non-object static check`)
    return
  }
  requireString(check.id, 'staticCheck.id', errors)
  requireString(check.kind, `${check.id}.kind`, errors)
  if (check.status !== 'defined') fail(errors, `${check.id} must remain status=defined`)
  if (check.evidenceClass !== 'static') fail(errors, `${check.id} must use evidenceClass=static`)
  if (check.runtimeRequired !== false) fail(errors, `${check.id} must use runtimeRequired=false`)
  requireString(check.evidenceId, `${check.id}.evidenceId`, errors)
  evidenceIds.add(check.evidenceId)
  requireArray(check.sourcePaths, `${check.id}.sourcePaths`, errors)
  requireArray(check.assertions, `${check.id}.assertions`, errors)
  requireArray(check.policyAssertions, `${check.id}.policyAssertions`, errors)

  const sourceText = []
  for (const sourcePath of check.sourcePaths ?? []) sourceText.push(readSource(sourcePath, errors))
  const combinedSource = sourceText.join('\n')
  for (const assertion of check.assertions ?? []) {
    if (!isRecord(assertion) || typeof assertion.contains !== 'string' || assertion.contains.length === 0) {
      fail(errors, `${check.id} has an invalid contains assertion`)
      continue
    }
    if (!combinedSource.includes(assertion.contains)) fail(errors, `${check.id} source assertion missing: ${assertion.contains}`)
  }
}

function validateRuntimeCheck(check, gateId, evidenceIds, errors) {
  if (!isRecord(check)) {
    fail(errors, `${gateId} contains a non-object runtime check`)
    return
  }
  requireString(check.id, 'runtimeCheck.id', errors)
  requireString(check.kind, `${check.id}.kind`, errors)
  if (!allowedRuntimeStatuses.has(check.status)) fail(errors, `${check.id} must remain pending/blocked`)
  if (check.evidenceClass !== 'runtime') fail(errors, `${check.id} must use evidenceClass=runtime`)
  if (check.runtimeRequired !== true) fail(errors, `${check.id} must use runtimeRequired=true`)
  requireString(check.evidenceId, `${check.id}.evidenceId`, errors)
  evidenceIds.add(check.evidenceId)
  for (const field of ['tools', 'targets', 'scenarios', 'evidenceRequired', 'cannotBeSatisfiedBy']) requireArray(check[field], `${check.id}.${field}`, errors)
  requireString(check.expected, `${check.id}.expected`, errors)
  const serialized = JSON.stringify(check).toLowerCase()
  if (/\b(pass|passed|captured|verified)\b/.test(serialized)) fail(errors, `${check.id} contains an unverified runtime result marker`)
}

function validateQualityGates(config, errors) {
  requireArray(config.qualityGates, 'qualityGates', errors, expectedGates.length)
  const gates = config.qualityGates ?? []
  const gateIds = gates.map((gate) => gate?.id)
  if (JSON.stringify(gateIds) !== JSON.stringify(expectedGates)) fail(errors, `qualityGates must be exactly ${expectedGates.join(', ')}`)
  unique(gateIds, 'quality gate ids', errors)
  const allCheckIds = []
  const checkEvidenceByGate = new Map()
  for (const gate of gates) {
    requireString(gate?.id, 'qualityGate.id', errors)
    if (!expectedGates.includes(gate?.id)) fail(errors, `${gate?.id} is not an assigned B21 gate`)
    if (!expectedTasks.includes(gate?.task)) fail(errors, `${gate?.id} references an unknown task: ${gate?.task}`)
    if (gate?.decision !== 'BLOCKED') fail(errors, `${gate?.id} must remain BLOCKED`)
    requireString(gate?.category, `${gate?.id}.category`, errors)
    requireString(gate?.objective, `${gate?.id}.objective`, errors)
    requireArray(gate?.evidenceIds, `${gate?.id}.evidenceIds`, errors, 2)
    requireArray(gate?.staticChecks, `${gate?.id}.staticChecks`, errors)
    requireArray(gate?.runtimeChecks, `${gate?.id}.runtimeChecks`, errors)
    const evidenceIds = new Set()
    for (const check of gate?.staticChecks ?? []) {
      allCheckIds.push(check?.id)
      validateStaticCheck(check, gate.id, evidenceIds, errors)
    }
    for (const check of gate?.runtimeChecks ?? []) {
      allCheckIds.push(check?.id)
      validateRuntimeCheck(check, gate.id, evidenceIds, errors)
    }
    if (evidenceIds.size === 0) fail(errors, `${gate?.id} must define check evidence`)
    for (const evidenceId of gate?.evidenceIds ?? []) if (!evidenceIds.has(evidenceId)) fail(errors, `${gate.id} lists evidence not owned by its checks: ${evidenceId}`)
    for (const evidenceId of evidenceIds) if (!gate.evidenceIds.includes(evidenceId)) fail(errors, `${gate.id} does not list check evidence: ${evidenceId}`)
    checkEvidenceByGate.set(gate.id, evidenceIds)
  }
  unique(allCheckIds, 'quality check ids', errors)
  return { checkEvidenceByGate }
}

function validateEvidenceIndex(config, checkEvidenceByGate, errors) {
  requireArray(config.evidenceIndex, 'evidenceIndex', errors, expectedGates.length * 2)
  const evidence = config.evidenceIndex ?? []
  const evidenceIds = evidence.map((item) => item?.id)
  unique(evidenceIds, 'evidence ids', errors)
  const gateIds = new Set(expectedGates)
  const referenced = new Set([...checkEvidenceByGate.values()].flatMap((ids) => [...ids]))
  for (const item of evidence) {
    requireString(item?.id, 'evidence.id', errors)
    if (!gateIds.has(item?.gateId)) fail(errors, `${item?.id} references unknown gate: ${item?.gateId}`)
    if (!['static', 'runtime'].includes(item?.class)) fail(errors, `${item?.id} class must be static or runtime`)
    if (item?.class === 'static') {
      if (item.status !== 'defined' || item.runtimeRequired !== false) fail(errors, `${item?.id} static evidence must be defined with runtimeRequired=false`)
      if (!String(item.artifactPathPattern ?? '').startsWith('config/b21')) fail(errors, `${item?.id} static artifact must be repository-addressable under config/b21`)
      if (item.collectionPolicy !== 'repository-static-validator') fail(errors, `${item?.id} static collection policy is invalid`)
    } else {
      if (!allowedRuntimeStatuses.has(item.status) || item.runtimeRequired !== true) fail(errors, `${item?.id} runtime evidence must remain pending/blocked with runtimeRequired=true`)
      if (!String(item.artifactPathPattern ?? '').startsWith('evidence/b21/')) fail(errors, `${item?.id} runtime artifact must be external evidence/b21`)
      if (item.collectionPolicy !== 'runtime-runner-only') fail(errors, `${item?.id} runtime collection policy is invalid`)
    }
    requireString(item?.artifactPathPattern, `${item?.id}.artifactPathPattern`, errors)
    requireString(item?.collectionPolicy, `${item?.id}.collectionPolicy`, errors)
  }
  for (const evidenceId of referenced) if (!evidenceIds.includes(evidenceId)) fail(errors, `missing evidence index item: ${evidenceId}`)
  for (const evidenceId of config.runtimeGate?.requiredEvidence ?? []) if (!evidenceIds.includes(evidenceId)) fail(errors, `runtimeGate required evidence missing: ${evidenceId}`)
  for (const gate of config.qualityGates ?? []) {
    const indexIds = new Set(evidence.filter((item) => item.gateId === gate.id).map((item) => item.id))
    for (const evidenceId of gate.evidenceIds ?? []) if (!indexIds.has(evidenceId)) fail(errors, `${gate.id} evidence is not indexed for its gate: ${evidenceId}`)
  }
}

function validateObservability(observability, errors) {
  if (!isRecord(observability)) {
    fail(errors, 'observability is required')
    return
  }
  if (observability.runtimeStatus !== 'pending') fail(errors, 'observability.runtimeStatus must remain pending')
  const signal = observability.signalStandard
  if (!isRecord(signal) || signal.provider !== 'OpenTelemetry' || signal.runtimeStatus !== 'pending') fail(errors, 'OpenTelemetry signal standard must remain pending')
  requireArray(signal?.signals, 'signalStandard.signals', errors, 3)
  for (const expected of ['traces', 'metrics', 'logs']) if (!signal?.signals?.includes(expected)) fail(errors, `signal missing ${expected}`)
  requireArray(signal?.requiredResourceAttributes, 'signalStandard.requiredResourceAttributes', errors, 3)
  for (const field of ['service.name', 'deployment.environment', 'service.version']) if (!signal?.requiredResourceAttributes?.includes(field)) fail(errors, `signal resource attribute missing ${field}`)
  requireArray(signal?.correlationFields, 'signalStandard.correlationFields', errors, 4)
  for (const field of ['requestId', 'traceId', 'eventId', 'decisionId']) if (!signal?.correlationFields?.includes(field)) fail(errors, `signal correlation field missing ${field}`)
  if (signal.sensitiveDataPolicy !== 'redact-or-do-not-record' || signal.exporterEndpointSource !== 'runtime-env-only') fail(errors, 'observability sensitive/exporter policy is invalid')

  requireArray(observability.slos, 'observability.slos', errors, 3)
  for (const slo of observability.slos ?? []) {
    requireString(slo?.id, 'slo.id', errors)
    requireString(slo?.service, `${slo?.id}.service`, errors)
    requireString(slo?.indicator, `${slo?.id}.indicator`, errors)
    if (typeof slo?.targetPercent !== 'number' || slo.targetPercent <= 0 || slo.targetPercent >= 100) fail(errors, `${slo?.id} targetPercent is invalid`)
    if (slo?.status !== 'target-not-measured') fail(errors, `${slo?.id} must remain target-not-measured`)
  }
  const budget = observability.errorBudget
  if (!isRecord(budget) || budget.status !== 'target-not-measured' || budget.runtimeStatus !== 'pending') fail(errors, 'error budget must remain target-not-measured/pending')
  requireArray(budget?.burnRateWindows, 'errorBudget.burnRateWindows', errors, 3)
  if (budget?.exhaustionDecision !== 'freeze-release-and-page') fail(errors, 'error budget exhaustion must freeze release and page')

  const alerting = observability.alertRouting
  if (!isRecord(alerting) || alerting.runtimeStatus !== 'pending') fail(errors, 'alertRouting must remain pending')
  requireArray(alerting?.severityLevels, 'alertRouting.severityLevels', errors, 3)
  for (const level of ['P0', 'P1', 'P2']) if (!alerting?.severityLevels?.includes(level)) fail(errors, `alert severity missing ${level}`)
  requireArray(alerting?.routes, 'alertRouting.routes', errors, 3)
  for (const route of alerting.routes ?? []) {
    requireString(route?.id, 'alertRoute.id', errors)
    if (!alerting.severityLevels.includes(route?.severity)) fail(errors, `${route?.id} references unknown severity`)
    requireString(route?.receiver, `${route?.id}.receiver`, errors)
    requireArray(route?.escalationMinutes, `${route?.id}.escalationMinutes`, errors, 1)
    if (route?.auditEvent !== 'alert.route.dispatched.v1') fail(errors, `${route?.id} must emit an auditable route event`)
  }
  const silence = alerting.silence
  if (!isRecord(silence) || silence.allowed !== true || silence.status !== 'not-executed' || silence.requiresReason !== true || silence.requiresOwner !== true || silence.requiresExpiry !== true || silence.expiryMustPage !== true) fail(errors, 'alert silence must be bounded, audited and not yet executed')
  if (silence.auditEvent !== 'alert.silence.created.v1' || silence.auditFailureDecision !== 'deny-silence-and-page') fail(errors, 'alert silence audit/failure policy is invalid')

  const onCall = observability.onCall
  if (!isRecord(onCall) || onCall.runtimeStatus !== 'pending' || onCall.handoffRequiresAudit !== true || onCall.escalationRequiresAcknowledgement !== true) fail(errors, 'on-call responsibility policy is incomplete')
  if (onCall.noOwnerDecision !== 'page-platform-and-block-release') fail(errors, 'unowned alert must page and block release')
  requireString(onCall.ownerRegistry, 'onCall.ownerRegistry', errors)
  requireString(onCall.primaryTeam, 'onCall.primaryTeam', errors)
  requireString(onCall.secondaryTeam, 'onCall.secondaryTeam', errors)

  requireArray(observability.dashboards, 'observability.dashboards', errors, 3)
  for (const dashboard of observability.dashboards ?? []) {
    requireString(dashboard?.id, 'dashboard.id', errors)
    requireString(dashboard?.owner, `${dashboard?.id}.owner`, errors)
    if (dashboard?.status !== 'defined') fail(errors, `${dashboard?.id} must remain defined`)
    requireArray(dashboard?.dataSources, `${dashboard?.id}.dataSources`, errors, 2)
    requireArray(dashboard?.requiredPanels, `${dashboard?.id}.requiredPanels`, errors, 4)
  }

  requireArray(observability.incidentDrills, 'observability.incidentDrills', errors, 3)
  for (const drill of observability.incidentDrills ?? []) {
    requireString(drill?.id, 'incidentDrill.id', errors)
    if (drill?.status !== 'pending') fail(errors, `${drill?.id} must remain pending`)
    requireArray(drill?.requiredSignals, `${drill?.id}.requiredSignals`, errors, 3)
    requireArray(drill?.requiredCorrelation, `${drill?.id}.requiredCorrelation`, errors, 3)
    requireString(drill?.requiredOwner, `${drill?.id}.requiredOwner`, errors)
    requireString(drill?.runbookSection, `${drill?.id}.runbookSection`, errors)
  }
}

function validateReleaseCandidate(candidate, errors) {
  if (!isRecord(candidate)) {
    fail(errors, 'releaseCandidate is required')
    return
  }
  if (candidate.runtimeStatus !== 'pending') fail(errors, 'releaseCandidate.runtimeStatus must remain pending')
  const artifact = candidate.immutableArtifactPolicy
  if (!isRecord(artifact) || artifact.status !== 'defined' || artifact.referenceMode !== 'oci-digest-only' || artifact.mutableTagAllowed !== false || artifact.sourceCommitRequired !== true || artifact.lockfileDigestRequired !== true || artifact.deploymentManifestDigestRequired !== true || artifact.sbomRequired !== true || artifact.provenanceRequired !== true || artifact.noSecretsOrPii !== true) fail(errors, 'immutable artifact policy is incomplete')
  const signature = artifact?.signature
  if (!isRecord(signature) || signature.required !== true || signature.scheme !== 'cosign' || signature.keySource !== 'external-approved-kms-or-vault' || signature.verificationBeforeDeploy !== true || signature.tamperDecision !== 'BLOCKED' || signature.status !== 'pending') fail(errors, 'RC signature policy must be external, pre-deploy and pending')
  const consistency = artifact?.consistency
  if (!isRecord(consistency) || consistency.algorithm !== 'sha256' || consistency.status !== 'pending' || consistency.mismatchDecision !== 'BLOCKED') fail(errors, 'artifact consistency policy is incomplete or prematurely resolved')
  requireArray(consistency?.requiredBindings, 'artifact.consistency.requiredBindings', errors, 6)
  for (const binding of ['sourceCommit', 'lockfileDigest', 'imageDigest', 'manifestDigest', 'sbomDigest', 'signatureDigest']) if (!consistency?.requiredBindings?.includes(binding)) fail(errors, `artifact consistency missing ${binding}`)

  const regression = candidate.regressionPolicy
  if (!isRecord(regression) || regression.status !== 'defined' || regression.selectionSource !== 'config/b19-quality-gates.json' || regression.browserDeviceMatrixSource !== 'config/b19-browser-device-matrix.json' || regression.performancePolicySource !== 'config/b19-quality-gates.json' || regression.securityPolicySource !== 'config/b20-security-gates.json' || regression.runtimeStatus !== 'pending') fail(errors, 'regression selection policy is incomplete')
  for (const field of ['minimumSuites', 'alwaysInclude', 'requiredDomains', 'changedAreaRules']) requireArray(regression?.[field], `regressionPolicy.${field}`, errors, 2)
  for (const suite of ['phase1-smoke', 'quality-static']) if (!regression?.minimumSuites?.includes(suite) || !regression?.alwaysInclude?.includes(suite)) fail(errors, `regression minimum suite missing ${suite}`)
  for (const domain of ['contracts', 'e2e', 'browser-device', 'performance', 'security']) if (!regression?.requiredDomains?.includes(domain)) fail(errors, `regression domain missing ${domain}`)
  for (const rule of regression?.changedAreaRules ?? []) {
    requireArray(rule?.whenAnyChangedArea, `${rule?.id}.whenAnyChangedArea`, errors, 1)
    requireArray(rule?.includeSuites, `${rule?.id}.includeSuites`, errors, 2)
  }

  const zeroBlockers = candidate.zeroBlockingDefects
  if (!isRecord(zeroBlockers) || zeroBlockers.status !== 'not-established' || zeroBlockers.noOpenRuntimeBlockers !== true || zeroBlockers.decisionWhenAnyBlocker !== 'NO-GO') fail(errors, 'zero-blocker policy must remain not-established and fail closed')
  for (const severity of ['P0', 'P1']) if (!zeroBlockers?.blockingSeverities?.includes(severity)) fail(errors, `zero-blocker severity missing ${severity}`)
  requireArray(zeroBlockers?.requiredRuntimeEvidence, 'zeroBlockingDefects.requiredRuntimeEvidence', errors, 5)

  const rollback = candidate.rollbackPoint
  if (!isRecord(rollback) || rollback.status !== 'not-established' || rollback.requiresVersionedArtifact !== true || rollback.requiresPreChangeSnapshot !== true || rollback.requiresRestorePoint !== true || rollback.requiresOwner !== true || rollback.requiresDrillEvidence !== true || rollback.requiresPostRollbackReconciliation !== true || rollback.owner !== null || rollback.artifactRef !== null || rollback.restorePointRef !== null) fail(errors, 'rollback point must remain unestablished until runtime drill evidence exists')
}

function validateB20Prerequisite(errors) {
  const security = readJson('config/b20-security-gates.json', errors)
  const privacyContent = readJson('config/b20-privacy-content-gates.json', errors)
  const commerceDr = readJson('config/b20-commerce-dr-evidence.json', errors)
  if (!security || !privacyContent || !commerceDr) return
  if (security.execution?.status !== 'runtimeBlocked' || security.execution?.runtimeBlocked !== true || security.execution?.runtimeEvidence !== null) fail(errors, 'B20 security prerequisite is not explicitly runtimeBlocked')
  if (privacyContent.releaseDecision?.status !== 'blocked' || privacyContent.releaseDecision?.goAllowed !== false) fail(errors, 'B20 privacy/content prerequisite must be blocked with goAllowed=false')
  if (commerceDr.runtimeDecision !== 'BLOCKED' || commerceDr.releaseGate?.status !== 'BLOCKED') fail(errors, 'B20 commerce/DR prerequisite must remain BLOCKED')
}

function validateReleaseGate(releaseGate, errors) {
  if (!isRecord(releaseGate) || releaseGate.status !== 'BLOCKED' || releaseGate.defaultDecision !== 'NO-GO') fail(errors, 'releaseGate must default to BLOCKED/NO-GO')
  if (releaseGate.requiresAllAssignedTasks !== true) fail(errors, 'releaseGate must require all assigned tasks')
  const prerequisite = releaseGate.b20Prerequisite
  if (!isRecord(prerequisite) || prerequisite.required !== true || prerequisite.requiredBatch !== 'B20' || prerequisite.decisionRequiredForGo !== 'PASS' || prerequisite.currentDecision !== 'BLOCKED' || prerequisite.whenNotPass !== 'NO-GO' || prerequisite.staticValidatorCannotOverride !== true) fail(errors, 'B20 prerequisite must force RC NO-GO until B20 is PASS')
  for (const task of ['V2-B20-SEC-001', 'V2-B20-PRI-002', 'V2-B20-CNT-003', 'V2-B20-COM-004', 'V2-B20-DR-005', 'V2-B20-TEST-006']) if (!prerequisite.requiredTasks?.includes(task)) fail(errors, `B20 prerequisite missing ${task}`)
  for (const condition of ['b20-gate-not-pass', 'any-required-evidence-missing', 'runtime-evidence-pending-or-blocked', 'unsigned-or-mutable-artifact', 'artifact-consistency-mismatch', 'slo-or-error-budget-not-measured', 'alert-route-or-silence-audit-missing', 'open-p0-or-p1', 'rollback-point-or-drill-missing', 'single-reviewer-or-conflicted-reviewer']) if (!releaseGate.blockingConditions?.includes(condition)) fail(errors, `RC blocker missing ${condition}`)
  const zeroBlockers = releaseGate.zeroBlockingDefects
  if (!isRecord(zeroBlockers) || zeroBlockers.required !== true || zeroBlockers.openP0 !== 0 || zeroBlockers.openP1 !== 0 || zeroBlockers.runtimeBlockers !== 0 || zeroBlockers.status !== 'not-established') fail(errors, 'release zero-blocker Gate must remain unresolved and zero-tolerance')
  const review = releaseGate.dualReview
  if (!isRecord(review) || review.required !== true || review.independentReviewers !== true || review.minimumReviewers < 2 || review.samePersonCannotSatisfyBoth !== true || review.reviewRecordStatus !== 'not-present') fail(errors, 'RC dual review must require two independent reviewers and remain unfulfilled')
  const rollback = releaseGate.rollback
  if (!isRecord(rollback) || rollback.required !== true || rollback.status !== 'not-established' || rollback.requiresVersionedArtifact !== true || rollback.requiresRestorePoint !== true || rollback.requiresOwner !== true || rollback.requiresDrillEvidence !== true || rollback.requiresPostRollbackReconciliation !== true) fail(errors, 'RC release rollback Gate must remain unestablished')
}

function validateReportSchema(reportSchema, errors) {
  if (!isRecord(reportSchema)) {
    fail(errors, 'reportSchema is required')
    return
  }
  requireString(reportSchema.id, 'reportSchema.id', errors)
  requireString(reportSchema.version, 'reportSchema.version', errors)
  const schema = reportSchema.jsonSchema
  if (!isRecord(schema) || schema.type !== 'object' || schema.additionalProperties !== false) fail(errors, 'report schema must be a closed object')
  for (const field of ['schemaVersion', 'reportId', 'batch', 'rcDigest', 'decision', 'gates', 'evidence', 'regression', 'review', 'rollback']) if (!schema?.required?.includes(field)) fail(errors, `report schema missing required field ${field}`)
  for (const field of ['rcDigest', 'decision', 'gates', 'evidence', 'regression', 'review', 'rollback']) if (!schema?.properties?.[field]) fail(errors, `report schema missing property ${field}`)
  if (!schema?.properties?.decision?.enum?.includes('NO-GO') || !schema?.properties?.decision?.enum?.includes('BLOCKED')) fail(errors, 'report decision must support NO-GO and BLOCKED')
}

function validateSyntheticFixtures(fixtures, errors) {
  if (!isRecord(fixtures) || fixtures.fixturePolicy !== 'synthetic-references-only-no-real-subjects-no-secrets-no-production-data') fail(errors, 'synthetic fixture policy is invalid')
  scanNoForbiddenMaterial(fixtures, 'syntheticFixtures', errors)
  const trace = fixtures?.trace
  for (const field of ['traceId', 'requestId', 'eventId', 'decisionId']) if (!String(trace?.[field] ?? '').startsWith(`${field.replace('Id', '')}-ref://synthetic/`) && !String(trace?.[field] ?? '').includes('ref://synthetic/')) fail(errors, `synthetic trace field must be a synthetic reference: ${field}`)
  const rc = fixtures?.rc
  for (const field of ['sourceCommit', 'signatureRef', 'rollbackPoint']) if (!String(rc?.[field] ?? '').includes('synthetic')) fail(errors, `synthetic RC field must be synthetic: ${field}`)
  for (const field of ['lockfileDigest', 'imageDigest', 'manifestDigest', 'sbomDigest']) if (!String(rc?.[field] ?? '').startsWith('sha256:fixture-')) fail(errors, `synthetic digest must use fixture prefix: ${field}`)
}

export function validateB21ObservabilityRc(config = readJson(manifestRelativePath, []), options = {}) {
  const errors = []
  if (!config) return { result: 'FAIL', errors }
  const runtimeRequested = options.runtimeRequested ?? (process.argv.includes('--require-runtime') || process.env.B21_REQUIRE_RUNTIME === '1')

  scanNoForbiddenMaterial(config, 'manifest', errors)
  if (config.schemaVersion !== 1) fail(errors, 'schemaVersion must be 1')
  if (config.batch !== 'B21') fail(errors, 'batch must be B21')
  if (config.phase !== 'phase-1') fail(errors, 'manifest must remain Phase 1')
  if (config.mode !== 'static-and-synthetic') fail(errors, 'manifest mode must be static-and-synthetic')
  if (config.status !== 'static-foundation') fail(errors, 'manifest status must be static-foundation')

  const execution = config.execution
  if (!isRecord(execution) || execution.mode !== 'static-fixture-only' || execution.status !== 'runtimeBlocked' || execution.runtimeBlocked !== true || execution.allowUnverifiedPass !== false || execution.runtimeEvidence !== null) fail(errors, 'execution must remain static-only, runtimeBlocked and without runtime evidence')
  requireArray(execution?.blockedReasons, 'execution.blockedReasons', errors, 3)

  validateTasks(config, errors)
  validateRuntimeGate(config, errors)
  validateObservability(config.observability, errors)
  validateReleaseCandidate(config.releaseCandidate, errors)
  const { checkEvidenceByGate } = validateQualityGates(config, errors)
  validateEvidenceIndex(config, checkEvidenceByGate, errors)
  validateB20Prerequisite(errors)
  validateReleaseGate(config.releaseGate, errors)
  validateReportSchema(config.reportSchema, errors)
  validateSyntheticFixtures(config.syntheticFixtures, errors)

  if (runtimeRequested) {
    const missing = (config.runtimeGate?.requiredEnv ?? []).filter((name) => !process.env[name])
    if (missing.length > 0) fail(errors, `runtime gate blocked; missing environment: ${missing.join(', ')}`)
    fail(errors, 'runtime gate remains blocked; external observability, staging, RC and regression evidence is pending')
  }

  const staticChecks = (config.qualityGates ?? []).flatMap((gate) => gate?.staticChecks ?? [])
  const runtimeChecks = (config.qualityGates ?? []).flatMap((gate) => gate?.runtimeChecks ?? [])
  const runtimeEvidencePending = (config.evidenceIndex ?? []).filter((item) => item?.class === 'runtime' && allowedRuntimeStatuses.has(item?.status)).length
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    batch: config.batch,
    taskCount: config.tasks?.length ?? 0,
    qualityGateCount: config.qualityGates?.length ?? 0,
    staticChecks: staticChecks.length,
    runtimeChecks: runtimeChecks.length,
    runtimeEvidencePending,
    runtimeBlocked: config.execution?.runtimeBlocked === true,
    releaseDecision: config.releaseGate?.defaultDecision ?? 'NO-GO',
    errors,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(scriptPath)) {
  const result = validateB21ObservabilityRc()
  console.log(JSON.stringify(result, null, 2))
  if (result.result !== 'PASS') process.exitCode = 1
}
