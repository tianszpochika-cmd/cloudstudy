import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const root = path.resolve(path.dirname(scriptPath), '..', '..')
const manifestRelativePath = 'config/b21-release-gate-evidence.json'
const manifestPath = path.join(root, manifestRelativePath)
const runtimeRequestedByProcess = process.argv.includes('--require-runtime') || process.env.B21_REQUIRE_RUNTIME === '1'
const expectedTasks = ['V2-B21-GATE-005', 'V2-B21-TEST-006']
const expectedRoles = ['product', 'architecture', 'security', 'data', 'operations']
const expectedGateIds = ['B21-GATE-005-GOVERNANCE', 'B21-TEST-006-RC-EVIDENCE']
const allowedRuntimeStatuses = new Set(['pending', 'blocked'])

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readJson(relativePath, errors) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))
  } catch (error) {
    errors.push(`cannot read JSON ${relativePath}: ${error.message}`)
    return null
  }
}

function readText(relativePath, errors) {
  const absolutePath = path.join(root, relativePath)
  if (!fs.existsSync(absolutePath)) {
    errors.push(`missing source path ${relativePath}`)
    return ''
  }
  return fs.readFileSync(absolutePath, 'utf8')
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

function flattenChecks(manifest) {
  return (manifest.qualityGates ?? []).flatMap((gate) => [
    ...(gate.staticChecks ?? []).map((check) => ({ ...check, gateId: gate.id })),
    ...(gate.runtimeChecks ?? []).map((check) => ({ ...check, gateId: gate.id })),
  ])
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

function validateTaskContract(manifest, errors) {
  const taskIds = (manifest.tasks ?? []).map((task) => task?.id)
  requireCondition(JSON.stringify(taskIds) === JSON.stringify(expectedTasks), 'B21 task scope must contain exactly GATE-005 and TEST-006 in order', errors)
  unique(taskIds, 'task ids', errors)
  for (const task of manifest.tasks ?? []) {
    requireString(task?.id, 'task.id', errors)
    requireCondition(task.status === 'defined', `${task.id} must remain defined for runtime acceptance`, errors)
    requireCondition(task.runtimeRequired === true, `${task.id} must require runtime evidence`, errors)
    requireCondition(task.defaultDecision === 'NO-GO', `${task.id} must default to NO-GO`, errors)
    requireArray(task.scope, `${task.id}.scope`, errors, 3)
  }
}

function validateRuntimeGate(runtimeGate, errors) {
  requireCondition(runtimeGate?.staticOnlyByDefault === true, 'runtime gate must be static-only by default', errors)
  requireCondition(runtimeGate?.requireRuntimeEnv === 'B21_REQUIRE_RUNTIME', 'runtime request env must be B21_REQUIRE_RUNTIME', errors)
  requireCondition(runtimeGate?.runtimeEvidenceMustBeCapturedExternally === true, 'runtime evidence must be external', errors)
  requireCondition(runtimeGate?.staticValidatorCannotPromoteRuntime === true, 'static validator cannot promote runtime', errors)
  requireArray(runtimeGate?.requiredEnv, 'runtimeGate.requiredEnv', errors, 4)
  unique(runtimeGate?.requiredEnv ?? [], 'runtime required env', errors)
  for (const name of runtimeGate?.requiredEnv ?? []) requireCondition(/^B21_RUNTIME_[A-Z0-9_]+$/.test(name), `invalid B21 runtime env ${name}`, errors)
  requireArray(runtimeGate?.requiredEvidence, 'runtimeGate.requiredEvidence', errors, 5)
  requireCondition(runtimeGate?.runtimeStatusWhenMissing === 'blocked', 'missing runtime evidence must block', errors)
  for (const boundary of ['static-manifest-only', 'synthetic-fixture-only', 'unsigned-artifact', 'unreproducible-report']) {
    requireCondition(runtimeGate?.cannotBeSatisfiedBy?.includes(boundary), `runtime fake-pass boundary missing ${boundary}`, errors)
  }
}

function validateB20Prerequisite(prerequisite, errors) {
  requireCondition(prerequisite?.status === 'blocked', 'B20 prerequisite must remain blocked until external acceptance', errors)
  requireCondition(prerequisite?.acceptanceRequired === true, 'B20 acceptance must be required', errors)
  requireCondition(prerequisite?.acceptanceEvidenceStatus === 'pending', 'B20 acceptance evidence must remain pending', errors)
  requireCondition(prerequisite?.missingEvidenceBlocks === true, 'missing B20 evidence must block B21', errors)
  requireCondition(prerequisite?.openP0P1Blocks === true, 'open B20 P0/P1 must block B21', errors)
  requireCondition(prerequisite?.livePaymentMustRemainClosed === true, 'live payment must remain closed', errors)
  const expected = ['V2-B20-SEC-001', 'V2-B20-PRI-002', 'V2-B20-CNT-003', 'V2-B20-COM-004', 'V2-B20-DR-005', 'V2-B20-TEST-006']
  requireCondition(JSON.stringify(prerequisite?.requiredTaskIds) === JSON.stringify(expected), 'B20 prerequisite task list is incomplete or reordered', errors)
  requireArray(prerequisite?.requiredEvidence, 'B20 prerequisite evidence', errors, expected.length)
}

function validateRoleGovernance(governance, errors) {
  requireCondition(JSON.stringify(governance?.requiredRoles) === JSON.stringify(expectedRoles), 'required Go/No-Go roles are incomplete or reordered', errors)
  requireCondition(governance?.allRequiredRolesMustDecide === true, 'all required roles must decide', errors)
  requireCondition(governance?.independentDecisionRequired === true, 'role decisions must be independent', errors)
  requireCondition(governance?.samePersonCannotSatisfyMultipleRequiredRoles === true, 'one person cannot satisfy multiple role decisions', errors)
  requireCondition(governance?.missingDecisionBlocks === true, 'missing role decision must block', errors)
  requireCondition(governance?.defaultDecision === 'NO-GO', 'role governance default must be NO-GO', errors)
  const decisions = governance?.roleDecisions ?? []
  requireCondition(JSON.stringify(decisions.map((item) => item?.role)) === JSON.stringify(expectedRoles), 'role decision matrix is incomplete or reordered', errors)
  for (const item of decisions) {
    requireCondition(item?.decision === 'PENDING', `${item?.role} decision must remain pending`, errors)
    requireCondition(item?.status === 'not-present', `${item?.role} signoff must remain not-present`, errors)
    requireCondition(/^reviewer-ref:\/\/synthetic\//.test(item?.reviewerRef ?? ''), `${item?.role} reviewer must be synthetic-only`, errors)
  }
}

function validateReleaseGate(gate, errors) {
  requireCondition(gate?.status === 'BLOCKED', 'release gate must remain BLOCKED', errors)
  requireCondition(gate?.defaultDecision === 'NO-GO', 'release gate default decision must be NO-GO', errors)
  requireCondition(gate?.allowedDecisions?.includes('NO-GO') && gate?.allowedDecisions?.includes('GO'), 'release gate must model both NO-GO and GO', errors)
  for (const field of ['requiresAllAssignedTasks', 'requiresAllRequiredRoles', 'requiresB20Acceptance', 'requiresCompleteEvidence']) requireCondition(gate?.[field] === true, `release gate must require ${field}`, errors)
  requireArray(gate?.requiredTaskIds, 'releaseGate.requiredTaskIds', errors, 6)
  requireArray(gate?.requiredUpstreamTasks, 'releaseGate.requiredUpstreamTasks', errors, 10)
  const blockingConditions = gate?.blockingConditions ?? []
  for (const condition of [
    'b20-gate-not-accepted',
    'any-required-evidence-missing',
    'runtime-evidence-pending-or-blocked',
    'artifact-hash-missing-or-invalid',
    'version-environment-binding-missing',
    'report-not-reproducible',
    'role-decision-missing-or-conflicted',
    'risk-acceptance-expired-or-invalid',
    'change-window-missing-or-expired',
    'dual-approval-missing-or-conflicted',
    'rollback-owner-missing',
    'rollback-drill-missing',
    'open-p0-or-p1',
  ]) requireCondition(blockingConditions.includes(condition), `release blocker missing ${condition}`, errors)

  const approval = gate.dualApproval
  requireCondition(approval?.required === true && approval.minimumApprovers >= 2 && approval.independentApprovers === true, 'dual approval must require two independent approvers', errors)
  requireCondition(approval?.samePersonCannotSatisfyBoth === true && approval.status === 'not-present' && approval.signatureEvidenceStatus === 'pending', 'dual approval must remain unfulfilled', errors)
  const risk = gate.riskAcceptance
  requireCondition(risk?.allowed === true && risk.defaultStatus === 'not-present' && risk.requiresExpiration === true, 'risk acceptance must be explicit and expiring', errors)
  requireCondition(risk?.cannotAcceptP0 === true && risk.cannotAcceptDataLoss === true && risk.cannotOpenLivePayment === true && risk.expiredDecision === 'BLOCKED', 'risk acceptance safety policy is incomplete', errors)
  requireArray(risk?.requiredFields, 'risk acceptance required fields', errors, 9)

  const changeWindow = gate.changeWindow
  requireCondition(changeWindow?.required === true && changeWindow.status === 'not-established', 'change window must be required and not established', errors)
  requireCondition(changeWindow?.ticketRequired === true && changeWindow.timezoneRequired === true && changeWindow.mustBeFutureAtApproval === true, 'change window controls are incomplete', errors)
  requireCondition(changeWindow?.productionTrafficChangeAllowedInPhase === false && changeWindow.missingOrExpiredDecision === 'BLOCKED', 'change window must not authorize production traffic in Phase 1', errors)

  const rollback = gate.rollback
  requireCondition(rollback?.required === true && rollback.ownerRequired === true && rollback.ownerStatus === 'not-assigned', 'rollback owner must be required and unassigned until runtime', errors)
  requireCondition(rollback?.versionedArtifactRequired === true && rollback.restorePointRequired === true && rollback.drillRequired === true && rollback.drillStatus === 'pending' && rollback.conclusionStatus === 'not-established', 'rollback drill policy is incomplete', errors)
  const binding = gate.artifactBinding
  requireCondition(binding?.required === true && binding.algorithm === 'SHA-256' && binding.status === 'pending', 'artifact binding must remain pending', errors)
  for (const field of ['sourceRevisionRequired', 'environmentRequired', 'immutableDigestRequired', 'signatureRequired']) requireCondition(binding?.[field] === true, `artifact binding missing ${field}`, errors)
  requireCondition(binding?.missingHashDecision === 'NO-GO', 'missing artifact hash must produce NO-GO', errors)
  const reproducibility = gate.reportReproducibility
  requireCondition(reproducibility?.required === true && reproducibility.status === 'pending' && reproducibility.missingReproductionDecision === 'NO-GO', 'report reproducibility must remain pending and block', errors)
  for (const field of ['generatorVersionRequired', 'manifestDigestRequired', 'sourceRevisionRequired', 'toolVersionsRequired', 'deterministicInputRefsRequired', 'reportHashRequired']) requireCondition(reproducibility?.[field] === true, `report reproducibility missing ${field}`, errors)
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
  const checks = flattenChecks(manifest)
  requireCondition(checks.length >= 13, 'B21 gate checks are incomplete', errors)
  const checkIds = checks.map((check) => check?.id)
  unique(checkIds, 'quality check ids', errors)
  const evidenceByCheck = new Map()
  for (const check of checks) {
    requireString(check?.id, 'quality check.id', errors)
    requireString(check?.evidenceId, `${check?.id}.evidenceId`, errors)
    if (check.evidenceClass === 'static') {
      requireCondition(check.status === 'defined' && check.runtimeRequired === false, `${check.id} static state is invalid`, errors)
      validateStaticAssertion(check, errors)
    } else if (check.evidenceClass === 'runtime') {
      requireCondition(allowedRuntimeStatuses.has(check.status) && check.runtimeRequired === true, `${check.id} runtime state must remain pending/blocked`, errors)
      requireArray(check.tools, `${check.id}.tools`, errors)
      requireArray(check.evidenceRequired, `${check.id}.evidenceRequired`, errors)
      requireArray(check.cannotBeSatisfiedBy, `${check.id}.cannotBeSatisfiedBy`, errors)
    } else errors.push(`${check.id} evidenceClass must be static or runtime`)
    evidenceByCheck.set(check.id, check.evidenceId)
  }
  return { checks, evidenceByCheck }
}

function validateEvidenceIndex(manifest, checks, errors) {
  const evidence = manifest.evidenceIndex ?? []
  requireArray(evidence, 'evidenceIndex', errors, 10)
  const evidenceIds = evidence.map((item) => item?.id)
  unique(evidenceIds, 'evidence ids', errors)
  const gateIds = new Set((manifest.qualityGates ?? []).map((gate) => gate.id))
  const referencedEvidence = new Set(checks.map((check) => check.evidenceId))
  for (const item of evidence) {
    requireString(item?.id, 'evidence.id', errors)
    requireCondition(gateIds.has(item?.gateId), `${item?.id} references an unknown gate`, errors)
    requireCondition(['static', 'runtime'].includes(item?.class), `${item?.id} class must be static or runtime`, errors)
    requireString(item?.artifactPathPattern, `${item?.id}.artifactPathPattern`, errors)
    requireString(item?.collectionPolicy, `${item?.id}.collectionPolicy`, errors)
    if (item?.class === 'static') {
      requireCondition(item.status === 'defined' && item.runtimeRequired === false, `${item.id} static evidence state is invalid`, errors)
      requireCondition(String(item.artifactPathPattern).startsWith('config/'), `${item.id} static artifact must be repository-addressable`, errors)
    } else {
      requireCondition(allowedRuntimeStatuses.has(item.status) && item.runtimeRequired === true, `${item.id} runtime evidence must remain pending/blocked`, errors)
      requireCondition(item.collectionPolicy === 'runtime-runner-only', `${item.id} runtime evidence must use runtime-runner-only collection`, errors)
      requireCondition(String(item.artifactPathPattern).startsWith('evidence/'), `${item.id} runtime artifact must be external evidence/`, errors)
    }
  }
  for (const id of referencedEvidence) requireCondition(evidenceIds.includes(id), `check evidence ${id} is missing from index`, errors)
  for (const id of manifest.runtimeGate?.requiredEvidence ?? []) requireCondition(evidenceIds.includes(id), `runtimeGate evidence ${id} is missing from index`, errors)
  for (const gate of manifest.qualityGates ?? []) {
    const gateEvidence = new Set(evidence.filter((item) => item.gateId === gate.id).map((item) => item.id))
    for (const id of gate.evidenceIds ?? []) requireCondition(gateEvidence.has(id), `${gate.id} evidence ${id} is not indexed for its gate`, errors)
  }
}

function validateReportSchema(reportSchema, errors) {
  requireCondition(reportSchema?.closed === true, 'report schema must be explicitly closed', errors)
  requireString(reportSchema?.id, 'reportSchema.id', errors)
  requireString(reportSchema?.version, 'reportSchema.version', errors)
  const schema = reportSchema?.jsonSchema
  requireCondition(isRecord(schema) && schema.type === 'object' && schema.additionalProperties === false, 'report schema root must be a closed object', errors)
  const required = new Set(schema?.required ?? [])
  for (const field of ['schemaVersion', 'reportId', 'batch', 'phase', 'releaseCandidate', 'decision', 'decisionPolicy', 'roles', 'upstreamGates', 'evidence', 'knownRisks', 'riskAcceptance', 'changeWindow', 'rollback', 'artifactBindings', 'reproducibility', 'reportHash']) requireCondition(required.has(field), `report schema missing required field ${field}`, errors)
  requireCondition(schema?.properties?.decision?.enum?.includes('NO-GO') && schema?.properties?.decision?.enum?.includes('GO'), 'report decision must represent NO-GO and GO', errors)
  requireCondition(schema?.properties?.decisionPolicy?.properties?.missingEvidenceDecision?.const === 'NO-GO', 'report missing-evidence policy must be NO-GO', errors)
  requireCondition(schema?.properties?.decisionPolicy?.properties?.goRequiresAllEvidence?.const === true && schema?.properties?.decisionPolicy?.properties?.goRequiresAllRoles?.const === true, 'report GO policy must require complete evidence and roles', errors)
  for (const field of ['releaseCandidate', 'decisionPolicy', 'roles', 'upstreamGates', 'evidence', 'knownRisks', 'riskAcceptance', 'changeWindow', 'rollback', 'artifactBindings', 'reproducibility']) requireCondition(isRecord(schema?.properties?.[field]), `report schema missing property ${field}`, errors)

  function walk(value, location) {
    if (!isRecord(value)) return
    if (value.type === 'object') requireCondition(value.additionalProperties === false || isRecord(value.additionalProperties), `${location} object schema must be closed`, errors)
    if (isRecord(value.properties)) for (const [key, child] of Object.entries(value.properties)) walk(child, `${location}.properties.${key}`)
    if (isRecord(value.items)) walk(value.items, `${location}.items`)
  }
  walk(schema, 'reportSchema.jsonSchema')
}

function validateSyntheticFixtures(fixtures, errors) {
  requireCondition(fixtures?.fixturePolicy === 'synthetic-references-only-no-real-signatures-no-pii-no-production-data', 'synthetic fixture policy is unsafe or missing', errors)
  const candidate = fixtures?.releaseCandidate
  for (const [field, prefix] of [['versionRef', 'version-ref://synthetic/'], ['sourceRevisionRef', 'commit-ref://synthetic/'], ['environmentRef', 'environment-ref://synthetic/'], ['artifactDigestRef', 'digest-ref://synthetic/'], ['artifactSignatureRef', 'signature-ref://synthetic/']]) requireCondition(String(candidate?.[field] ?? '').startsWith(prefix), `synthetic release candidate ${field} must be a reference`, errors)
  requireArray(fixtures?.roleReviewers, 'synthetic role reviewers', errors, expectedRoles.length)
  for (const reviewer of fixtures?.roleReviewers ?? []) requireCondition(/^reviewer-ref:\/\/synthetic\//.test(reviewer), 'synthetic reviewer reference is invalid', errors)
  requireCondition(/^change-window-ref:\/\/synthetic\//.test(fixtures?.changeWindowRef ?? ''), 'synthetic change window reference is invalid', errors)
  requireCondition(/^owner-ref:\/\/synthetic\//.test(fixtures?.rollbackOwnerRef ?? ''), 'synthetic rollback owner reference is invalid', errors)
  requireArray(fixtures?.evidenceRefs, 'synthetic evidence references', errors, 3)
  scanValues(fixtures, '$.syntheticFixtures', errors)
}

export function validateB21ReleaseGateEvidence(config = readJson(manifestRelativePath, []), options = {}) {
  const errors = []
  const runtimeRequested = options.runtimeRequested ?? runtimeRequestedByProcess
  const runtimeEnv = options.env ?? process.env
  if (!config) return { result: 'FAIL', batch: 'B21', errors: ['manifest could not be loaded'] }
  requireCondition(config.schemaVersion === 1, 'schemaVersion must be 1', errors)
  requireCondition(config.batch === 'B21', 'batch must be B21', errors)
  requireCondition(config.phase === 'phase-1', 'manifest must remain Phase 1', errors)
  requireCondition(config.mode === 'static-and-synthetic', 'manifest mode must be static-and-synthetic', errors)
  requireCondition(config.status === 'static-foundation', 'manifest status must be static-foundation', errors)
  requireCondition(config.runtimeDecision === 'BLOCKED', 'runtimeDecision must remain BLOCKED', errors)

  validateTaskContract(config, errors)
  validateRuntimeGate(config.runtimeGate, errors)
  validateB20Prerequisite(config.b20Prerequisite, errors)
  validateRoleGovernance(config.roleGovernance, errors)
  validateReleaseGate(config.releaseGate, errors)
  const { checks } = validateChecks(config, errors)
  validateEvidenceIndex(config, checks, errors)
  validateReportSchema(config.reportSchema, errors)
  validateSyntheticFixtures(config.syntheticFixtures, errors)

  if (runtimeRequested) {
    const missing = (config.runtimeGate?.requiredEnv ?? []).filter((name) => !runtimeEnv[name])
    if (missing.length > 0) errors.push(`runtime gate blocked; missing environment: ${missing.join(', ')}`)
    else errors.push('runtime evidence remains pending; an approved external runner must capture and review artifacts before any Gate can pass')
  }

  const staticCount = checks.filter((check) => check.evidenceClass === 'static').length
  const runtimeCount = checks.filter((check) => check.evidenceClass === 'runtime').length
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    batch: 'B21',
    taskCount: config.tasks?.length ?? 0,
    qualityGateCount: config.qualityGates?.length ?? 0,
    staticChecks: staticCount,
    runtimePending: runtimeCount,
    runtimeGate: runtimeRequested ? 'blocked' : 'static-only',
    releaseDecision: config.releaseGate?.defaultDecision ?? 'NO-GO',
    errors,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(scriptPath)) {
  const result = validateB21ReleaseGateEvidence()
  console.log(JSON.stringify(result, null, 2))
  if (result.result !== 'PASS') process.exitCode = 1
}
