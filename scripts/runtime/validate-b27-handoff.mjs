import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const manifestPath = path.join(root, 'config/b27-handoff.json')
const runtimeRequestedByProcess = process.argv.includes('--require-runtime') || ['1', 'true', 'yes'].includes(String(process.env.B27_REQUIRE_RUNTIME ?? '').toLowerCase())
const expectedTaskIds = ['V2-B27-RC-005', 'V2-B27-HANDOFF-006']
const expectedStaticCheckIds = [
  'B27-HANDOFF-STATIC-001',
  'B27-HANDOFF-STATIC-002',
  'B27-HANDOFF-STATIC-003',
  'B27-HANDOFF-STATIC-004',
  'B27-HANDOFF-STATIC-005',
  'B27-HANDOFF-STATIC-006'
]
const expectedRuntimeCheckIds = [
  'B27-HANDOFF-RUNTIME-001',
  'B27-HANDOFF-RUNTIME-002',
  'B27-HANDOFF-RUNTIME-003',
  'B27-HANDOFF-RUNTIME-004',
  'B27-HANDOFF-RUNTIME-005',
  'B27-HANDOFF-RUNTIME-006',
  'B27-HANDOFF-RUNTIME-007',
  'B27-HANDOFF-RUNTIME-008',
  'B27-HANDOFF-RUNTIME-009',
  'B27-HANDOFF-RUNTIME-010'
]
const requiredSourceRefs = [
  'docs/07-operations/b26-validation.md',
  'config/b21-release-gate-evidence.json',
  'config/b22-production-rollout.json',
  'config/b22-observation-acceptance.json',
  'config/b22-data-reconciliation.json',
  'config/g4-release-rollback.json',
  'requirements/backlog/v2-B23plus-Phase1-真实运行与实机测试任务基线.md',
  'requirements/backlog/G0-G4-治理门禁任务基线.md'
]
const requiredRoles = ['product', 'architecture', 'security', 'data', 'operations']
const allowedRuntimeStatuses = new Set(['pending', 'blocked'])

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function loadManifest() {
  return readJson(manifestPath)
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function addError(errors, condition, message) {
  if (!condition) errors.push(message)
}

function requireString(errors, value, label) {
  addError(errors, typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`)
}

function requireArray(errors, value, label, minimum = 1) {
  addError(errors, Array.isArray(value) && value.length >= minimum, `${label} must contain at least ${minimum} item(s)`)
}

function requireUnique(errors, values, label) {
  const unique = new Set(values)
  addError(errors, unique.size === values.length, `${label} must be unique`)
}

function has(values, expected, label, errors) {
  addError(errors, Array.isArray(values) && values.includes(expected), `${label} must include ${expected}`)
}

function readSource(relativePath, errors) {
  const absolutePath = path.join(root, relativePath)
  if (!fs.existsSync(absolutePath)) {
    errors.push(`source file is missing: ${relativePath}`)
    return ''
  }
  return fs.readFileSync(absolutePath, 'utf8')
}

function scanUnsafeValues(value, label, errors) {
  if (typeof value === 'string') {
    const patterns = [
      /-----BEGIN [A-Z ]+-----/i,
      /Bearer\s+eyJ[A-Za-z0-9._~-]+/i,
      /\bsk-[A-Za-z0-9]/i,
      /\bghp_[A-Za-z0-9]/i,
      /AKIA[0-9A-Z]{16}/i,
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
      /(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/
    ]
    for (const pattern of patterns) addError(errors, !pattern.test(value), `${label} contains prohibited secret or personal-data pattern: ${pattern}`)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanUnsafeValues(item, `${label}[${index}]`, errors))
    return
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) scanUnsafeValues(child, `${label}.${key}`, errors)
  }
}

function validateHeader(manifest, errors) {
  addError(errors, manifest.batch === 'B27', 'batch must be B27')
  addError(errors, manifest.phase === 'phase-1', 'phase must be phase-1')
  addError(errors, manifest.mode === 'static-and-external-runtime', 'mode must be static-and-external-runtime')
  addError(errors, manifest.status === 'BLOCKED', 'status must remain BLOCKED')
  addError(errors, manifest.defaultDecision === 'NO-GO', 'default decision must be NO-GO')
  addError(errors, manifest.runtimeDecision === 'BLOCKED', 'runtime decision must be BLOCKED')
  addError(errors, manifest.productionAction === 'disabled', 'production action must remain disabled')
  if (!isRecord(manifest.designBasis)) errors.push('designBasis must be an object')
}

function validateDesignBasis(manifest, errors) {
  requireString(errors, manifest.designBasis?.businessSource, 'designBasis.businessSource')
  requireArray(errors, manifest.designBasis?.architectureRefs, 'designBasis.architectureRefs', 3)
  requireArray(errors, manifest.designBasis?.sourceRefs, 'designBasis.sourceRefs', requiredSourceRefs.length)
  for (const sourceRef of requiredSourceRefs) {
    has(manifest.designBasis?.sourceRefs, sourceRef, 'designBasis.sourceRefs', errors)
    readSource(sourceRef, errors)
  }
  requireArray(errors, manifest.designBasis?.principles, 'designBasis.principles', 4)
}

function validateTasks(manifest, errors) {
  requireArray(errors, manifest.tasks, 'tasks', expectedTaskIds.length)
  const ids = (manifest.tasks ?? []).map((task) => task?.id)
  addError(errors, JSON.stringify(ids) === JSON.stringify(expectedTaskIds), 'B27 task scope must contain RC-005 and HANDOFF-006 in order')
  requireUnique(errors, ids, 'task ids')
  for (const task of manifest.tasks ?? []) {
    requireString(errors, task?.id, 'task.id')
    addError(errors, task?.status === 'defined', `${task?.id} must be defined`)
    addError(errors, task?.runtimeRequired === true, `${task?.id} must be runtime-required`)
    addError(errors, task?.defaultDecision === 'NO-GO', `${task?.id} default decision must be NO-GO`)
    requireArray(errors, task?.scope, `${task?.id}.scope`, 3)
  }
}

function validateUpstreamGates(manifest, errors) {
  const gates = manifest.upstreamGates
  addError(errors, gates?.status === 'BLOCKED', 'upstream gates must remain BLOCKED')
  addError(errors, gates?.currentDecision === 'BLOCKED', 'upstream current decision must remain BLOCKED')
  addError(errors, gates?.requiredDecision === 'GO', 'upstream required decision must be GO')
  addError(errors, gates?.acceptanceEvidenceStatus === 'pending', 'upstream acceptance evidence must remain pending')
  addError(errors, gates?.missingEvidenceDecision === 'BLOCKED', 'missing upstream evidence must BLOCK')
  addError(errors, gates?.staticEvidenceCannotPromote === true && gates?.syntheticFixtureCannotPromote === true, 'static and synthetic evidence must not promote upstream gates')
  const realBatches = gates?.requiredRuntimeBatches?.realB23ToB26 ?? []
  const platformBatches = gates?.requiredRuntimeBatches?.platformB15ToB22 ?? []
  for (const batch of ['B23', 'B24', 'B25', 'B26']) has(realBatches, batch, 'realB23ToB26', errors)
  for (const batch of ['B15', 'B16', 'B17', 'B18', 'B19', 'B20', 'B21', 'B22']) has(platformBatches, batch, 'platformB15ToB22', errors)
  requireArray(errors, gates?.requiredEvidence, 'upstream required evidence', 5)
  addError(errors, gates?.openP0P1Decision === 'NO-GO', 'open upstream P0/P1 must be NO-GO')
  addError(errors, gates?.releaseTrafficMustRemainClosed === true, 'upstream traffic must remain closed')
}

function validateReleaseCandidate(manifest, errors) {
  const rc = manifest.releaseCandidate
  addError(errors, rc?.status === 'not-established', 'release candidate must remain not-established')
  addError(errors, rc?.statusDecision === 'NO-GO', 'release candidate decision must be NO-GO')
  requireString(errors, rc?.releaseId, 'releaseCandidate.releaseId')
  addError(errors, rc?.sourceRevision === null && rc?.environment === null && Array.isArray(rc?.artifactBindings) && rc.artifactBindings.length === 0, 'release candidate must not contain unverified runtime bindings')
  for (const field of ['requiresImmutableDigest', 'requiresSignature', 'requiresSBOM', 'requiresProvenance', 'requiresFourPlatformBinding', 'sameDigestAcrossPromotion']) addError(errors, rc?.[field] === true, `releaseCandidate.${field} must be true`)
  addError(errors, rc?.mutableTagAllowed === false, 'mutable release tags must be forbidden')
  const policy = manifest.immutableArtifactPolicy
  addError(errors, policy?.status === 'not-established', 'immutable artifact policy must remain not-established')
  for (const field of ['requireDigest', 'requireSignature', 'requireSBOM', 'requireProvenance']) addError(errors, policy?.[field] === true, `immutableArtifactPolicy.${field} must be true`)
  addError(errors, policy?.mutableTagAllowed === false, 'immutableArtifactPolicy.mutableTagAllowed must be false')
  addError(errors, Array.isArray(policy?.artifacts) && policy.artifacts.length === 0, 'static artifact policy must not claim captured artifacts')
  addError(errors, policy?.missingArtifactDecision === 'NO-GO', 'missing artifact evidence must be NO-GO')
}

function validateEvidenceIndex(manifest, errors, checkIds) {
  const index = manifest.evidenceIndex
  requireArray(errors, index, 'evidenceIndex', 17)
  const ids = (index ?? []).map((item) => item?.id)
  requireUnique(errors, ids, 'evidence ids')
  const referenced = new Set(checkIds)
  const runtimeEvidence = []
  for (const item of index ?? []) {
    requireString(errors, item?.id, 'evidence.id')
    addError(errors, item?.class === 'static' || item?.class === 'runtime', `${item?.id} evidence class must be static or runtime`)
    requireString(errors, item?.collectionPolicy, `${item?.id}.collectionPolicy`)
    requireString(errors, item?.artifactPathPattern, `${item?.id}.artifactPathPattern`)
    requireArray(errors, item?.bindings, `${item?.id}.bindings`, 2)
    if (item?.class === 'static') {
      addError(errors, item.status === 'defined' && item.runtimeRequired === false, `${item?.id} static evidence state is invalid`)
      addError(errors, item.collectionPolicy === 'repository-static-validator' && item.artifactPathPattern.startsWith('config/'), `${item?.id} static evidence collection policy is invalid`)
    } else if (item?.class === 'runtime') {
      runtimeEvidence.push(item)
      addError(errors, allowedRuntimeStatuses.has(item.status) && item.runtimeRequired === true, `${item?.id} runtime evidence must remain pending/blocked and runtime-required`)
      addError(errors, item.collectionPolicy === 'approved-external-runner-only' && item.artifactPathPattern.startsWith('evidence/'), `${item?.id} runtime evidence must be external and under evidence/`)
      for (const binding of ['runId', 'capturedAt']) has(item.bindings, binding, `${item?.id}.bindings`, errors)
    }
  }
  for (const id of referenced) addError(errors, ids.includes(id), `release check evidence is missing from index: ${id}`)
  for (const id of ids) addError(errors, referenced.has(id) || id.startsWith('B27-E-RUNTIME-'), `unbound evidence index id: ${id}`)
  addError(errors, runtimeEvidence.length >= 11, 'evidenceIndex must include runtime evidence for all B27 handoff dimensions')
}

function validateReleaseChecks(manifest, errors) {
  const checks = manifest.releaseChecks
  const staticChecks = checks?.staticChecks ?? []
  const runtimeChecks = checks?.runtimeChecks ?? []
  addError(errors, JSON.stringify(staticChecks.map((check) => check?.id)) === JSON.stringify(expectedStaticCheckIds), 'static check ids/order are incomplete')
  addError(errors, JSON.stringify(runtimeChecks.map((check) => check?.id)) === JSON.stringify(expectedRuntimeCheckIds), 'runtime check ids/order are incomplete')
  requireUnique(errors, [...staticChecks, ...runtimeChecks].map((check) => check?.id), 'release check ids')
  const checkEvidenceIds = []
  for (const check of staticChecks) {
    addError(errors, check?.status === 'defined' && check?.evidenceClass === 'static' && check?.runtimeRequired === false, `${check?.id} static state is invalid`)
    requireString(errors, check?.evidenceId, `${check?.id}.evidenceId`)
    checkEvidenceIds.push(check.evidenceId)
    requireArray(errors, check?.sourcePaths, `${check?.id}.sourcePaths`)
    requireArray(errors, check?.assertions, `${check?.id}.assertions`)
    const sourceText = (check?.sourcePaths ?? []).map((sourcePath) => readSource(sourcePath, errors)).join('\n')
    for (const assertion of check?.assertions ?? []) {
      if (typeof assertion?.contains === 'string') addError(errors, sourceText.includes(assertion.contains), `${check?.id} missing source marker ${assertion.contains}`)
      else if (typeof assertion?.regex === 'string') {
        try { addError(errors, new RegExp(assertion.regex, assertion.flags ?? '').test(sourceText), `${check?.id} source regex did not match`) } catch (error) { errors.push(`${check?.id} has invalid source regex: ${error.message}`) }
      } else errors.push(`${check?.id} assertion must contain contains or regex`)
    }
  }
  for (const check of runtimeChecks) {
    addError(errors, allowedRuntimeStatuses.has(check?.status) && check?.evidenceClass === 'runtime' && check?.runtimeRequired === true, `${check?.id} runtime state must remain pending/blocked and runtime-required`)
    requireString(errors, check?.evidenceId, `${check?.id}.evidenceId`)
    checkEvidenceIds.push(check.evidenceId)
    requireArray(errors, check?.evidenceRequired, `${check?.id}.evidenceRequired`, 2)
    requireArray(errors, check?.cannotBeSatisfiedBy, `${check?.id}.cannotBeSatisfiedBy`, 2)
    has(check?.cannotBeSatisfiedBy, 'static-manifest-only', `${check?.id}.cannotBeSatisfiedBy`, errors)
    has(check?.cannotBeSatisfiedBy, 'synthetic-fixture-only', `${check?.id}.cannotBeSatisfiedBy`, errors)
  }
  requireUnique(errors, checkEvidenceIds, 'release check evidence ids')
  return checkEvidenceIds
}

function validateKnownIssues(manifest, errors) {
  const issues = manifest.knownIssues
  requireArray(errors, issues, 'knownIssues', 3)
  const ids = (issues ?? []).map((issue) => issue?.id)
  requireUnique(errors, ids, 'known issue ids')
  for (const severity of ['P0', 'P1', 'P2']) has((issues ?? []).map((issue) => issue?.severity), severity, 'known issue severities', errors)
  for (const issue of issues ?? []) {
    requireString(errors, issue?.id, 'knownIssue.id')
    addError(errors, ['P0', 'P1', 'P2'].includes(issue?.severity), `${issue?.id} severity must be P0, P1 or P2`)
    addError(errors, ['open', 'accepted', 'closed'].includes(issue?.status), `${issue?.id} status is invalid`)
    addError(errors, typeof issue?.blocksRelease === 'boolean', `${issue?.id}.blocksRelease must be boolean`)
    requireString(errors, issue?.ownerRole, `${issue?.id}.ownerRole`)
    requireString(errors, issue?.evidenceRef, `${issue?.id}.evidenceRef`)
    addError(errors, issue?.severity === 'P0' || issue?.severity === 'P1' ? issue.blocksRelease === true : issue.blocksRelease === false, `${issue?.id} release-blocking policy is invalid`)
  }
}

function validateRoleGovernance(manifest, errors) {
  const governance = manifest.roleGovernance
  addError(errors, governance?.defaultDecision === 'NO-GO' && governance?.decisionStatus === 'not-present', 'role governance must default to pending NO-GO')
  addError(errors, governance?.allRequiredRolesMustDecide === true && governance?.independentDecisionRequired === true && governance?.samePersonCannotSatisfyMultipleRequiredRoles === true, 'role governance must require independent decisions')
  const roles = governance?.requiredRoles ?? []
  addError(errors, JSON.stringify(roles) === JSON.stringify(requiredRoles), 'required roles must be product, architecture, security, data and operations')
  const decisions = governance?.roleDecisions ?? []
  addError(errors, JSON.stringify(decisions.map((decision) => decision?.role)) === JSON.stringify(requiredRoles), 'role decisions must cover every required role in order')
  for (const decision of decisions) {
    addError(errors, decision?.decision === 'PENDING' && decision?.status === 'not-present', `${decision?.role} decision must remain pending/not-present`)
    requireString(errors, decision?.reviewerRef, `${decision?.role}.reviewerRef`)
    addError(errors, decision.reviewerRef.includes('pending'), `${decision?.role} reviewer must not be presented as a real approval`)
  }
}

function validateRunbooksAndMaintenance(manifest, errors) {
  const runbooks = manifest.runbooks
  requireArray(errors, runbooks, 'runbooks', 4)
  const kinds = (runbooks ?? []).map((runbook) => runbook?.kind)
  for (const kind of ['runtime-operations', 'emergency-response', 'rollback-recovery', 'test-handoff']) has(kinds, kind, 'runbook kinds', errors)
  const runbookIds = (runbooks ?? []).map((runbook) => runbook?.id)
  requireUnique(errors, runbookIds, 'runbook ids')
  for (const runbook of runbooks ?? []) {
    addError(errors, runbook?.status === 'not-established', `${runbook?.id} must remain not-established`)
    requireString(errors, runbook?.ownerRole, `${runbook?.id}.ownerRole`)
    requireString(errors, runbook?.backupOwnerRole, `${runbook?.id}.backupOwnerRole`)
    requireString(errors, runbook?.ownerRef, `${runbook?.id}.ownerRef`)
    requireString(errors, runbook?.evidenceRef, `${runbook?.id}.evidenceRef`)
    requireArray(errors, runbook?.requiredSections, `${runbook?.id}.requiredSections`, 4)
    addError(errors, runbook.ownerRef.includes('pending'), `${runbook?.id} owner must not be treated as assigned`)
  }
  const owner = manifest.maintenanceOwner
  addError(errors, owner?.status === 'not-established' && owner?.primaryRole === 'operations', 'maintenance owner must remain unestablished with operations as primary role')
  requireString(errors, owner?.ownerRef, 'maintenanceOwner.ownerRef')
  requireString(errors, owner?.acceptanceEvidenceRef, 'maintenanceOwner.acceptanceEvidenceRef')
  addError(errors, owner?.requiresIndependentAcceptance === true && owner?.ownerRef.includes('pending'), 'maintenance owner must require independent acceptance and remain pending')
  requireArray(errors, owner?.escalationRoles, 'maintenanceOwner.escalationRoles', 3)
}

function validateRollback(manifest, errors) {
  const rollback = manifest.rollback
  addError(errors, rollback?.status === 'not-established' && rollback?.decisionWhenEvidenceMissing === 'BLOCKED', 'rollback must remain not-established and blocked without evidence')
  addError(errors, rollback?.owner?.required === true && rollback.owner.status === 'not-assigned', 'rollback owner must be required and unassigned')
  requireString(errors, rollback?.owner?.ownerRef, 'rollback.owner.ownerRef')
  addError(errors, rollback?.automatic?.enabled === true && rollback.automatic.status === 'pending' && rollback.automatic.triggerPolicy === 'fail-closed', 'automatic rollback must be enabled by policy but remain pending and fail-closed')
  addError(errors, rollback?.manual?.enabled === true && rollback.manual.status === 'pending' && rollback.manual.requiresIndependentApproval === true && rollback.manual.minimumApprovers >= 2, 'manual rollback must require independent dual approval and remain pending')
  addError(errors, rollback?.restorePoint?.required === true && rollback.restorePoint.status === 'not-established' && rollback.restorePoint.reference === null, 'restore point must be required but not-established')
  requireArray(errors, rollback?.rollbackSequence, 'rollback.rollbackSequence', 8)
  for (const step of ['stop-expansion-and-freeze-writes', 'route-to-last-approved-immutable-digest', 'restore-owner-schema-to-approved-point', 'reconcile-row-count-and-canonical-digest', 'reconcile-outbox-event-and-consumer-offset', 'run-owner-service-saga-compensation', 'record-audited-manual-takeover-if-needed']) has(rollback.rollbackSequence, step, 'rollback.rollbackSequence', errors)
  const compensation = rollback.compensation
  addError(errors, compensation?.strategy === 'saga-compensation-through-owner-service' && compensation.twoPhaseCommitAllowed === false && compensation.directCrossServiceTableWriteAllowed === false && compensation.idempotencyRequired === true && compensation.auditRequired === true && compensation.manualRecoveryOwnerRequired === true, 'rollback compensation must be owner-local, idempotent, audited and free of two-phase commit/cross-service writes')
  addError(errors, rollback?.audit?.required === true && rollback.audit.appendOnly === true && rollback.audit.externalSinkRequired === true, 'rollback audit must be append-only and externally captured')
  requireArray(errors, rollback?.audit?.correlationFields, 'rollback.audit.correlationFields', 6)
}

function validateGoNoGo(manifest, errors) {
  const gate = manifest.goNoGo
  addError(errors, gate?.status === 'BLOCKED' && gate?.defaultDecision === 'NO-GO', 'Go/No-Go must default to BLOCKED/NO-GO')
  addError(errors, gate?.missingEvidenceDecision === 'NO-GO' && gate?.runtimeEvidencePendingDecision === 'BLOCKED' && gate?.openP0P1Decision === 'NO-GO' && gate?.roleDecisionMissing === 'BLOCKED', 'Go/No-Go fail-closed decisions are incomplete')
  addError(errors, gate?.productionTrafficAllowed === false && gate?.realPaymentEnabled === false, 'production traffic and real payment must remain disabled')
  addError(errors, gate?.requiredRoleCount === requiredRoles.length, 'Go/No-Go must require all five roles')
  requireArray(errors, gate?.goRequires, 'goNoGo.goRequires', 8)
  requireArray(errors, gate?.blockingConditions, 'goNoGo.blockingConditions', 8)
  for (const condition of ['any-required-runtime-evidence-missing', 'open-p0-or-p1', 'missing-rollback-owner-or-restore-point', 'role-decision-missing-conflicted-or-not-independent']) has(gate.blockingConditions, condition, 'goNoGo.blockingConditions', errors)
}

function validateRuntimeGate(manifest, errors, runtimeRequested, env) {
  const gate = manifest.runtimeGate
  addError(errors, gate?.staticOnlyByDefault === true && gate?.requireRuntimeEnv === 'B27_REQUIRE_RUNTIME', 'runtime gate must be static-only by default and use B27_REQUIRE_RUNTIME')
  addError(errors, gate?.runtimeEvidenceMustBeCapturedExternally === true && gate?.staticValidatorCannotPromoteRuntime === true && gate?.runtimeStatusWhenMissing === 'blocked', 'runtime evidence must be external, blocked when missing and non-promotable')
  requireArray(errors, gate?.requiredEnv, 'runtime required env', 7)
  requireUnique(errors, gate?.requiredEnv ?? [], 'runtime required env')
  for (const name of gate?.requiredEnv ?? []) addError(errors, /^B27_RUNTIME_[A-Z0-9_]+$/.test(name), `invalid B27 runtime environment variable ${name}`)
  requireArray(errors, gate?.requiredEvidence, 'runtime required evidence', 11)
  requireArray(errors, gate?.cannotBeSatisfiedBy, 'runtime fake-pass boundaries', 7)
  for (const boundary of ['static-manifest-only', 'synthetic-fixture-only', 'development-http-200', 'unauthenticated-browser-check', 'real-secret-in-repository']) has(gate.cannotBeSatisfiedBy, boundary, 'runtime fake-pass boundaries', errors)
  if (!runtimeRequested) return
  const missing = (gate.requiredEnv ?? []).filter((name) => !env?.[name])
  if (missing.length > 0) {
    errors.push(`runtime gate blocked; missing environment: ${missing.join(', ')}`)
    return
  }
  for (const name of gate.requiredEnv ?? []) addError(errors, !/synthetic|example\.invalid|fixture|replace_with|pending|todo|fake/i.test(String(env[name])), `${name} cannot use a synthetic or placeholder evidence reference`)
  addError(errors, manifest.upstreamGates?.status === 'accepted' && manifest.upstreamGates?.currentDecision === 'GO', 'runtime gate blocked; B23-B26/B15-B22 upstream gates are not accepted')
  addError(errors, manifest.status === 'READY' && manifest.defaultDecision === 'GO' && manifest.productionAction === 'enabled', 'runtime gate blocked; B27 handoff baseline is not accepted')
  addError(errors, (manifest.releaseChecks?.runtimeChecks ?? []).every((check) => check.status === 'captured'), 'runtime gate blocked; runtime checks remain pending or blocked')
  addError(errors, (manifest.evidenceIndex ?? []).filter((item) => item.class === 'runtime').every((item) => item.status === 'captured'), 'runtime gate blocked; runtime evidence index remains pending or blocked')
  addError(errors, manifest.roleGovernance?.roleDecisions?.every((decision) => decision.decision === 'GO' && decision.status === 'accepted'), 'runtime gate blocked; independent role decisions are not accepted')
}

function validateHandoff(manifest, errors, evidenceIds) {
  const handoff = manifest.handoff
  addError(errors, handoff?.status === 'not-ready' && handoff?.receiverAcceptanceRequired === true && handoff?.decision === 'BLOCKED', 'handoff must remain not-ready and BLOCKED')
  requireString(errors, handoff?.receiverRole, 'handoff.receiverRole')
  requireArray(errors, handoff?.scope, 'handoff.scope', 13)
  requireArray(errors, handoff?.requiredInputs, 'handoff.requiredInputs', 8)
  for (const input of handoff?.requiredInputs ?? []) has(evidenceIds, input, 'handoff.requiredInputs', errors)
  const schema = handoff?.closedReportSchema
  addError(errors, schema?.closed === true && schema.additionalProperties === false && schema.missingEvidenceDecision === 'NO-GO', 'handoff report schema must be closed and fail-closed')
  requireArray(errors, schema?.required, 'handoff report required fields', 12)
  for (const field of ['runId', 'releaseId', 'sourceRevision', 'environment', 'evidenceRefs', 'defectLedger', 'runbooks', 'maintenanceOwner', 'roleDecisions', 'rollback', 'decision', 'reportHash']) has(schema.required, field, 'handoff report required fields', errors)
  for (const decision of ['NO-GO', 'BLOCKED', 'GO']) has(schema?.decisionEnum, decision, 'handoff report decision enum', errors)
  addError(errors, handoff.acceptanceEvidenceRef === null, 'handoff acceptance must remain unrecorded until independent test acceptance')
}

function validateSyntheticPolicy(manifest, errors) {
  const policy = manifest.syntheticFixturePolicy
  addError(errors, policy?.productionDataAllowed === false && policy?.realCredentialsAllowed === false && policy?.rawPersonalDataAllowed === false && policy?.destructiveProductionActionAllowed === false, 'synthetic fixture policy must deny production data, credentials, PII and destructive actions')
  addError(errors, policy?.runtimeEvidenceMayBeRecordedInRepository === false && policy?.externalEvidenceMustBeRedacted === true, 'runtime evidence must remain external and redacted')
}

export function validateB27Handoff(manifest = loadManifest(), { runtimeRequested = runtimeRequestedByProcess, env = process.env } = {}) {
  const errors = []
  if (!isRecord(manifest)) return { result: 'FAIL', status: 'BLOCKED', releaseDecision: 'NO-GO', runtimeGate: runtimeRequested ? 'blocked' : 'static-only', errors: ['manifest must be a JSON object'] }
  scanUnsafeValues(manifest, 'manifest', errors)
  validateHeader(manifest, errors)
  validateDesignBasis(manifest, errors)
  validateTasks(manifest, errors)
  validateUpstreamGates(manifest, errors)
  validateReleaseCandidate(manifest, errors)
  const checkEvidenceIds = validateReleaseChecks(manifest, errors)
  validateEvidenceIndex(manifest, errors, checkEvidenceIds)
  validateKnownIssues(manifest, errors)
  validateRoleGovernance(manifest, errors)
  validateRunbooksAndMaintenance(manifest, errors)
  validateRollback(manifest, errors)
  validateGoNoGo(manifest, errors)
  validateRuntimeGate(manifest, errors, runtimeRequested, env)
  validateHandoff(manifest, errors, checkEvidenceIds)
  validateSyntheticPolicy(manifest, errors)
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    batch: manifest.batch,
    taskCount: manifest.tasks?.length ?? 0,
    staticChecks: manifest.releaseChecks?.staticChecks?.length ?? 0,
    runtimeChecks: manifest.releaseChecks?.runtimeChecks?.length ?? 0,
    evidenceCount: manifest.evidenceIndex?.length ?? 0,
    runtimeEvidencePending: (manifest.evidenceIndex ?? []).filter((item) => item.class === 'runtime' && allowedRuntimeStatuses.has(item.status)).length,
    status: manifest.status,
    releaseDecision: manifest.defaultDecision,
    runtimeGate: runtimeRequested ? 'blocked' : 'static-only',
    errors
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  let manifest
  try {
    manifest = loadManifest()
  } catch (error) {
    console.error(JSON.stringify({ result: 'FAIL', errors: [`cannot read ${manifestPath}: ${error.message}`] }, null, 2))
    process.exitCode = 1
  }
  if (manifest) {
    const summary = validateB27Handoff(manifest)
    console.log(JSON.stringify(summary, null, 2))
    if (summary.result !== 'PASS') process.exitCode = 1
  }
}
