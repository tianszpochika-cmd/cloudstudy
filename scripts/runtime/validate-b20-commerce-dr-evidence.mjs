import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
export const repoRoot = path.resolve(scriptDir, '..', '..')
export const configPath = path.join(repoRoot, 'config', 'b20-commerce-dr-evidence.json')
const runtimeRequested = process.argv.includes('--require-runtime') || process.env.B20_REQUIRE_RUNTIME === '1'

const errors = []
const allowedRuntimeStatuses = new Set(['pending', 'blocked'])
const expectedTasks = ['V2-B20-COM-004', 'V2-B20-DR-005', 'V2-B20-TEST-006']
const expectedGates = [
  'B20-COM-004-ENTITLEMENT',
  'B20-COM-004-PAYMENT',
  'B20-COM-004-REFUND-RECONCILIATION',
  'B20-DR-005-BACKUP',
  'B20-DR-005-RECOVERY',
  'B20-DR-005-OBSERVABILITY',
  'B20-TEST-006-RELEASE-EVIDENCE',
]
const expectedStores = ['mysql', 'redis', 'kafka', 'object-storage']
const forbiddenFixtureKey = /^(?:password|secret|clientSecret|accessToken|refreshToken|authorization|apiKey|privateKey|paymentCredential|paymentToken|signedPayload|webhookBody|jws|rawAudio|rawAnswer|answerText|phone|mobile|email|realName)$/i
const forbiddenCredentialValue = /^(?:Bearer\s|Basic\s|sk-[A-Za-z0-9]|eyJ[A-Za-z0-9_-]+\.|-----BEGIN\s|AKIA[A-Z0-9]{8,})/i

function fail(message) {
  errors.push(message)
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') fail(`${label} must be a non-empty string`)
}

function requireArray(value, label, minimum = 1) {
  if (!Array.isArray(value) || value.length < minimum) fail(`${label} must contain at least ${minimum} item(s)`)
}

function requireBoolean(value, label) {
  if (typeof value !== 'boolean') fail(`${label} must be boolean`)
}

function unique(values, label) {
  const seen = new Set()
  for (const value of values) {
    if (seen.has(value)) fail(`${label} contains duplicate: ${value}`)
    seen.add(value)
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    fail(`cannot read or parse ${path.relative(repoRoot, filePath)}: ${error.message}`)
    return null
  }
}

function walk(value, visitor, location = '$') {
  visitor(value, location)
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) walk(child, visitor, `${location}.${key}`)
}

function validateNoSecretsOrPersonalData(config) {
  walk(config, (value, location) => {
    if (isRecord(value)) {
      for (const [key, child] of Object.entries(value)) {
        if (forbiddenFixtureKey.test(key)) fail(`${location}.${key} must not contain credentials or personal data`)
        if (typeof child === 'string' && forbiddenCredentialValue.test(child)) fail(`${location}.${key} looks like a credential`)
      }
    } else if (typeof value === 'string' && forbiddenCredentialValue.test(value)) {
      fail(`${location} looks like a credential`)
    }
  })
}

function safeSourcePath(relativePath) {
  if (typeof relativePath !== 'string' || relativePath.includes('..') || path.isAbsolute(relativePath)) {
    fail(`source path must be a relative repository path: ${relativePath}`)
    return null
  }
  const resolved = path.resolve(repoRoot, relativePath)
  const relative = path.relative(repoRoot, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    fail(`source path escapes repository: ${relativePath}`)
    return null
  }
  if (/^(?:node_modules|dist|\.nuxt|\.output)(?:[\\/]|$)/i.test(relative)) {
    fail(`generated/dependency source is not allowed: ${relativePath}`)
    return null
  }
  if (!fs.existsSync(resolved)) {
    fail(`source path does not exist: ${relativePath}`)
    return null
  }
  return resolved
}

function validateStaticCheck(check, gateId, evidenceIds) {
  if (!isRecord(check)) {
    fail(`${gateId} has a non-object static check`)
    return
  }
  requireString(check.id, `${gateId}.staticCheck.id`)
  requireString(check.kind, `${check.id}.kind`)
  if (check.status !== 'defined') fail(`${check.id} static status must be defined, never a runtime result`)
  if (check.evidenceClass !== 'static') fail(`${check.id} must use evidenceClass=static`)
  if (check.runtimeRequired !== false) fail(`${check.id} must use runtimeRequired=false`)
  requireString(check.evidenceId, `${check.id}.evidenceId`)
  evidenceIds.add(check.evidenceId)
  requireArray(check.assertions, `${check.id}.assertions`)

  const sourcePaths = check.sourcePaths ?? []
  if (!Array.isArray(sourcePaths)) {
    fail(`${check.id}.sourcePaths must be an array`)
    return
  }
  const sourceText = []
  for (const source of sourcePaths) {
    const resolved = safeSourcePath(source)
    if (resolved) sourceText.push(fs.readFileSync(resolved, 'utf8'))
  }
  for (const assertion of check.assertions ?? []) {
    if (!isRecord(assertion)) {
      fail(`${check.id} has a non-object assertion`)
      continue
    }
    if (typeof assertion.contains === 'string') {
      if (sourcePaths.length === 0) fail(`${check.id} contains assertion requires sourcePaths`)
      else if (!sourceText.join('\n').includes(assertion.contains)) fail(`${check.id} source assertion missing: ${assertion.contains}`)
    } else if (typeof assertion.policy !== 'string' || assertion.policy.trim() === '') {
      fail(`${check.id} assertion must define contains or policy`)
    }
  }
}

function validateRuntimeCheck(check, gateId, evidenceIds) {
  if (!isRecord(check)) {
    fail(`${gateId} has a non-object runtime check`)
    return
  }
  requireString(check.id, `${gateId}.runtimeCheck.id`)
  requireString(check.kind, `${check.id}.kind`)
  if (!allowedRuntimeStatuses.has(check.status)) fail(`${check.id} must remain pending/blocked until real execution; got ${check.status}`)
  if (check.evidenceClass !== 'runtime') fail(`${check.id} must use evidenceClass=runtime`)
  if (check.runtimeRequired !== true) fail(`${check.id} must use runtimeRequired=true`)
  requireString(check.evidenceId, `${check.id}.evidenceId`)
  evidenceIds.add(check.evidenceId)
  if (check.supportingEvidenceIds !== undefined) {
    requireArray(check.supportingEvidenceIds, `${check.id}.supportingEvidenceIds`)
    for (const evidenceId of check.supportingEvidenceIds) {
      requireString(evidenceId, `${check.id}.supportingEvidenceId`)
      evidenceIds.add(evidenceId)
    }
  }
  for (const field of ['tools', 'targets', 'scenarios', 'evidenceRequired', 'cannotBeSatisfiedBy']) requireArray(check[field], `${check.id}.${field}`)
  requireString(check.expected, `${check.id}.expected`)
  if (check.sourcePaths !== undefined) fail(`${check.id} runtime check must not claim repository source as runtime evidence`)
}

function validateTasks(config) {
  requireArray(config.tasks, 'tasks', expectedTasks.length)
  const taskIds = (config.tasks ?? []).map((task) => task?.id)
  unique(taskIds, 'task ids')
  if (JSON.stringify(taskIds) !== JSON.stringify(expectedTasks)) fail(`tasks must be exactly ${expectedTasks.join(', ')}`)
  for (const task of config.tasks ?? []) {
    requireString(task?.id, 'task.id')
    if (task?.status !== 'defined') fail(`${task?.id} task status must be defined; execution status belongs to the evidence report`)
    if (task?.runtimeRequired !== true) fail(`${task?.id} must declare runtimeRequired=true`)
    if (task?.defaultDecision !== 'deny') fail(`${task?.id} must default to deny`)
    requireArray(task?.scope, `${task?.id}.scope`, 2)
  }
}

function validateRuntimeGate(gate) {
  if (!isRecord(gate)) {
    fail('runtimeGate is required')
    return
  }
  if (gate.staticOnlyByDefault !== true) fail('runtimeGate.staticOnlyByDefault must be true')
  if (gate.requireRuntimeEnv !== 'B20_REQUIRE_RUNTIME') fail('runtime gate request env must be B20_REQUIRE_RUNTIME')
  requireArray(gate.requiredEnv, 'runtimeGate.requiredEnv', 4)
  unique(gate.requiredEnv ?? [], 'runtime env names')
  for (const name of gate.requiredEnv ?? []) if (!/^B20_RUNTIME_[A-Z0-9_]+$/.test(name)) fail(`invalid runtime env name: ${name}`)
  requireArray(gate.requiredEvidence, 'runtimeGate.requiredEvidence', 4)
  unique(gate.requiredEvidence ?? [], 'runtime evidence names')
  if (gate.runtimeStatusWhenMissing !== 'blocked') fail('runtime gate must report blocked when prerequisites are missing')
  if (gate.runtimeEvidenceMustBeCapturedExternally !== true) fail('runtime evidence must be captured externally')
}

function validateRuntimeRequest(gate) {
  if (!runtimeRequested) return
  const missing = (gate?.requiredEnv ?? []).filter((name) => !process.env[name])
  if (missing.length > 0) {
    fail(`runtime gate blocked; missing environment: ${missing.join(', ')}`)
  } else {
    fail('runtime evidence is still pending; an approved external runner must capture and review artifacts before any Gate can pass')
  }
}

function validateCommerce(commerce) {
  if (!isRecord(commerce)) {
    fail('commerce is required')
    return
  }
  const featureGate = commerce.featureGate
  if (!isRecord(featureGate)) {
    fail('commerce.featureGate is required')
  } else {
    if (featureGate.paymentsEnabledByDefault !== false) fail('payments must be disabled by default')
    if (featureGate.liveProviderEnabled !== false) fail('live provider must remain disabled')
    if (featureGate.providerMode !== 'sandbox-only') fail('payment provider mode must be sandbox-only')
    if (!Array.isArray(featureGate.sandboxProviders) || featureGate.sandboxProviders.length === 0) fail('sandbox provider allowlist is required')
    if (!Array.isArray(featureGate.liveProviders) || featureGate.liveProviders.length !== 0) fail('live provider allowlist must be empty')
    if (featureGate.liveProvidersMustRemainEmpty !== true) fail('live provider allowlist must be immutable-empty at Phase 1')
    if (featureGate.missingQualificationDecision !== 'deny') fail('missing payment qualification must deny')
    if (featureGate.liveEnvironmentOverrideAllowed !== false) fail('live environment override must be denied')
    requireString(featureGate.environmentOverride, 'commerce.featureGate.environmentOverride')
  }

  const fixture = commerce.syntheticFixtures
  if (!isRecord(fixture) || fixture.enabled !== true || fixture.syntheticOnly !== true) fail('commerce fixtures must be synthetic-only')
  for (const field of ['tenant', 'subject', 'orderId', 'skuId', 'providerEventId', 'refundId', 'activationBatch', 'activationCodeRef']) requireString(fixture?.[field], `commerce.syntheticFixtures.${field}`)
  if (fixture?.tenant !== 'platform') fail('synthetic commerce tenant must be platform')
  if (!Number.isInteger(fixture?.amountMinor) || fixture.amountMinor <= 0) fail('synthetic amountMinor must be a positive integer')
  if (fixture?.currency !== 'CNY') fail('synthetic currency must remain CNY')

  const controls = commerce.controls
  if (!isRecord(controls)) {
    fail('commerce.controls is required')
    return
  }
  const entitlement = controls.entitlements
  if (!isRecord(entitlement) || entitlement.factOwner !== 'commerce-service' || entitlement.subjectDerivedFrom !== 'verified-principal' || entitlement.tenantDerivedFrom !== 'verified-principal') fail('entitlement facts must be commerce-owned and principal-derived')
  if (entitlement.sourceReferenceIdempotency !== true || entitlement.noClientGrantAuthority !== true || entitlement.revocationMustBeAudited !== true) fail('entitlement safety controls are incomplete')

  const activation = controls.activationCodes
  if (!isRecord(activation) || activation.storage !== 'sha256-digest-only' || activation.plaintextExposure !== 'issue-response-only') fail('activation codes must be digest-only except issue response')
  for (const field of ['oneTimeRedemption', 'redemptionRequiresIdempotencyKey', 'redemptionBindsTenantAndSubject', 'rawCodePersistence']) requireBoolean(activation?.[field], `activationCodes.${field}`)
  if (activation.rawCodePersistence !== false || activation.reuseDecision !== 'reject-and-audit') fail('activation code reuse/persistence policy is unsafe')

  const payment = controls.paymentSandbox
  if (!isRecord(payment) || payment.provider !== 'sandbox-hmac' || payment.liveProvider !== false || payment.liveTrafficAllowed !== false) fail('payment sandbox must not enable live traffic')
  if (payment.credentialSource !== 'runtime-secret-store-only' || payment.clientNeverReceivesProviderCredential !== true) fail('payment credential boundary is incomplete')
  if (payment.unqualifiedChannelDecision !== 'deny' || payment.failedPaymentDecision !== 'retryable-no-entitlement') fail('payment failure/qualification policy is incomplete')

  const callback = controls.callbackVerification
  if (!isRecord(callback) || callback.signatureAlgorithm !== 'HMAC-SHA256' || callback.rejectUnverified !== true || callback.rejectForgedProvider !== true || callback.rawPayloadPersistence !== false) fail('callback verification must fail closed and avoid raw payload persistence')
  if (JSON.stringify(callback.verificationOrder) !== JSON.stringify(['provider-allowlist', 'canonical-payload-binding', 'signature-verification', 'provider-event-dedupe', 'order-amount-currency-binding', 'pending-attempt-state', 'fact-write-and-outbox'])) fail('callback verification order is incomplete or unsafe')
  if (callback.sameEventSameDigestDecision !== 'idempotent-no-second-effect' || callback.sameEventDifferentDigestDecision !== 'reject-and-audit') fail('callback replay policy is incomplete')

  const amount = controls.amountBinding
  if (!isRecord(amount) || amount.bindTo !== 'server-order-price-snapshot' || amount.clientAmountAuthority !== false || amount.currencyAuthority !== 'server-order-price-snapshot') fail('payment amount must bind to the server price snapshot')
  requireArray(amount.requiredFields, 'amountBinding.requiredFields', 4)
  for (const field of ['orderId', 'amountMinor', 'currency', 'providerEventId']) if (!amount.requiredFields.includes(field)) fail(`amount binding missing ${field}`)
  if (amount.mismatchDecision !== 'reject-and-audit' || amount.negativeAmountDecision !== 'reject-and-audit') fail('amount mismatch policy must reject and audit')

  const replay = controls.replayProtection
  if (!isRecord(replay) || replay.callbackReceiptUnique !== true || replay.idempotencyFingerprintRequired !== true || replay.noSecondEntitlementGrant !== true || replay.noSecondRefundEffect !== true) fail('replay protection is incomplete')
  if (JSON.stringify(replay.providerEventIdentity) !== JSON.stringify(['tenant', 'provider', 'providerEventId'])) fail('provider event identity must include tenant, provider and event id')
  if (replay.mismatchedPayloadDecision !== 'reject-and-audit' || replay.samePayloadReplayDecision !== 'return-existing-result') fail('replay decisions are unsafe')

  const refund = controls.refunds
  if (!isRecord(refund) || refund.amountCeiling !== 'paid-minus-refunded' || refund.idempotencyRequired !== true || refund.providerSignatureRequired !== true || refund.refundCallbackAmountBound !== true) fail('refund amount/signature/idempotency controls are incomplete')
  if (refund.failedRefundDecision !== 'retryable-no-entitlement-grant' || refund.refundFactAudited !== true || refund.refundDoesNotRewriteOrderPriceSnapshot !== true) fail('refund failure/audit policy is incomplete')

  const reconciliation = controls.reconciliation
  if (!isRecord(reconciliation) || reconciliation.factOwner !== 'commerce-service' || reconciliation.immutableDomainFacts !== true || reconciliation.replayIsIdempotent !== true || reconciliation.requiresAuditTrail !== true || reconciliation.requiresPostRecoveryRun !== true) fail('reconciliation ownership/idempotency/audit policy is incomplete')
  for (const state of ['MATCHED', 'MISMATCHED', 'REPAIR_REQUIRED']) if (!reconciliation.states?.includes(state)) fail(`reconciliation state missing ${state}`)
}

function validateDisasterRecovery(disasterRecovery) {
  if (!isRecord(disasterRecovery)) {
    fail('disasterRecovery is required')
    return
  }
  requireArray(disasterRecovery.systems, 'disasterRecovery.systems', expectedStores.length)
  const systems = disasterRecovery.systems ?? []
  const systemIds = systems.map((system) => system?.id)
  unique(systemIds, 'disaster recovery system ids')
  if (JSON.stringify(systemIds) !== JSON.stringify(expectedStores)) fail(`disaster recovery systems must be exactly ${expectedStores.join(', ')}`)
  for (const system of systems) {
    requireString(system?.id, 'disasterRecovery.system.id')
    requireString(system?.backupMode, `${system?.id}.backupMode`)
    requireBoolean(system?.pitr, `${system?.id}.pitr`)
    requireString(system?.restoreTarget, `${system?.id}.restoreTarget`)
    requireString(system?.owner, `${system?.id}.owner`)
    requireString(system?.evidenceId, `${system?.id}.evidenceId`)
  }

  const targets = disasterRecovery.targets
  if (!isRecord(targets) || targets.status !== 'target-not-measured' || targets.measurementRequired !== true) fail('RPO/RTO targets must remain unmeasured until runtime drills')
  for (const store of expectedStores) {
    if (!Number.isInteger(targets?.rpoMinutes?.[store]) || targets.rpoMinutes[store] <= 0) fail(`${store} RPO target is invalid`)
    if (!Number.isInteger(targets?.rtoMinutes?.[store]) || targets.rtoMinutes[store] <= 0) fail(`${store} RTO target is invalid`)
  }
  requireArray(targets?.passRequires, 'disasterRecovery.targets.passRequires', 3)
  for (const field of ['measured-restoration-window', 'captured-data-loss-window', 'integrity-check', 'owner-signoff']) if (!targets.passRequires.includes(field)) fail(`RPO/RTO pass criteria missing ${field}`)

  requireArray(disasterRecovery.recoveryDrills, 'disasterRecovery.recoveryDrills', expectedStores.length)
  const drillSystems = new Set()
  for (const drill of disasterRecovery.recoveryDrills ?? []) {
    requireString(drill?.id, 'recoveryDrill.id')
    requireString(drill?.system, `${drill?.id}.system`)
    drillSystems.add(drill?.system)
    if (!expectedStores.includes(drill?.system)) fail(`${drill?.id} references unknown system ${drill?.system}`)
    requireString(drill?.failure, `${drill?.id}.failure`)
    requireString(drill?.expected, `${drill?.id}.expected`)
    if (!allowedRuntimeStatuses.has(drill?.status)) fail(`${drill?.id} must remain pending/blocked`)
    requireString(drill?.evidenceId, `${drill?.id}.evidenceId`)
  }
  for (const store of expectedStores) if (!drillSystems.has(store)) fail(`recovery drill missing ${store}`)

  const injection = disasterRecovery.faultInjection
  if (!isRecord(injection) || injection.productionEnabled !== false || injection.requiresChangeWindow !== true) fail('fault injection must be disabled in production and require a change window')
  requireArray(injection?.scenarios, 'faultInjection.scenarios', 5)
  requireArray(injection?.expectedSafety, 'faultInjection.expectedSafety', 4)
  for (const safety of ['bounded-retry', 'visible-degradation', 'no-duplicate-entitlement', 'no-duplicate-refund', 'manual-recovery-record']) if (!injection.expectedSafety.includes(safety)) fail(`fault injection safety missing ${safety}`)

  const observability = disasterRecovery.observability
  if (!isRecord(observability) || observability.sloRequired !== true || observability.alertRequired !== true || observability.auditRequired !== true || observability.silenceMustBeAudited !== true) fail('SLO/alert/audit observability contract is incomplete')
  for (const field of ['sloDimensions', 'alertSignals', 'traceCorrelationFields']) requireArray(observability?.[field], `disasterRecovery.observability.${field}`, 3)
  for (const field of ['traceId', 'requestId', 'eventId', 'aggregateId', 'idempotencyKey']) if (!observability.traceCorrelationFields.includes(field)) fail(`observability trace correlation missing ${field}`)

  const runbook = disasterRecovery.runbook
  if (!isRecord(runbook) || runbook.id !== 'B20-RUNBOOK-001' || runbook.path !== 'docs/07-operations/incident-runbook.md') fail('B20 runbook reference is invalid')
  requireArray(runbook?.requiredSections, 'runbook.requiredSections', 6)
  for (const section of ['triage', 'containment', 'manual-takeover', 'restore', 'replay', 'reconciliation', 'rollback']) if (!runbook.requiredSections.includes(section)) fail(`runbook section missing ${section}`)
  const takeover = runbook.manualTakeover
  if (!isRecord(takeover) || takeover.allowed !== true || takeover.requiresTicket !== true || takeover.requiresTwoPersonReview !== true || takeover.writesDomainFactsDirectly !== false || takeover.requiresAuditRecord !== true) fail('manual takeover must be ticketed, two-person, audited and cannot write domain facts directly')
  const rollback = runbook.rollback
  if (!isRecord(rollback) || rollback.required !== true || rollback.mustBeVersioned !== true || rollback.mustBeTested !== true || rollback.conclusionStatus !== 'not-established') fail('runbook rollback conclusion must remain unestablished until drilled')

  const reconciliation = disasterRecovery.postRecoveryReconciliation
  if (!isRecord(reconciliation) || reconciliation.required !== true || reconciliation.mustCompareFactsBeforeProjection !== true || reconciliation.mismatchDecision !== 'hold-and-manual-recovery' || reconciliation.successStatus !== 'MATCHED_AFTER_RECOVERY' || reconciliation.evidenceRequired !== true) fail('post-recovery reconciliation is incomplete or fail-open')
  requireArray(reconciliation?.domains, 'postRecoveryReconciliation.domains', 5)
}

function validateQualityGates(config) {
  requireArray(config.qualityGates, 'qualityGates', expectedGates.length)
  const gates = config.qualityGates ?? []
  const gateIds = gates.map((gate) => gate?.id)
  unique(gateIds, 'quality gate ids')
  for (const gateId of expectedGates) if (!gateIds.includes(gateId)) fail(`missing quality gate: ${gateId}`)
  const checkIds = []
  const checkEvidenceByGate = new Map()
  for (const gate of gates) {
    requireString(gate?.id, 'qualityGate.id')
    if (!expectedTasks.includes(gate?.task)) fail(`${gate?.id} references unknown task: ${gate?.task}`)
    if (gate?.decision !== 'BLOCKED') fail(`${gate?.id} must remain BLOCKED until runtime evidence is captured`)
    requireString(gate?.category, `${gate?.id}.category`)
    requireArray(gate?.evidenceIds, `${gate?.id}.evidenceIds`)
    const evidenceIds = new Set()
    for (const check of gate?.staticChecks ?? []) {
      checkIds.push(check?.id)
      validateStaticCheck(check, gate.id, evidenceIds)
    }
    for (const check of gate?.runtimeChecks ?? []) {
      checkIds.push(check?.id)
      validateRuntimeCheck(check, gate.id, evidenceIds)
    }
    if (evidenceIds.size === 0) fail(`${gate?.id} must define static or runtime checks`)
    for (const evidenceId of gate?.evidenceIds ?? []) if (!evidenceIds.has(evidenceId)) fail(`${gate.id} evidenceIds missing from checks: ${evidenceId}`)
    for (const evidenceId of evidenceIds) if (!gate.evidenceIds.includes(evidenceId)) fail(`${gate.id} does not list check evidence: ${evidenceId}`)
    checkEvidenceByGate.set(gate.id, evidenceIds)
  }
  unique(checkIds, 'quality check ids')
  return { gates, checkEvidenceByGate }
}

function validateEvidenceIndex(config, checkEvidenceByGate) {
  requireArray(config.evidenceIndex, 'evidenceIndex', 1)
  const evidence = config.evidenceIndex ?? []
  const evidenceIds = evidence.map((item) => item?.id)
  unique(evidenceIds, 'evidence ids')
  const gateIds = new Set(config.qualityGates.map((gate) => gate.id))
  const referenced = new Set([...checkEvidenceByGate.values()].flatMap((ids) => [...ids]))
  for (const item of evidence) {
    requireString(item?.id, 'evidence.id')
    if (!gateIds.has(item?.gateId)) fail(`${item?.id} references unknown gate: ${item?.gateId}`)
    if (!['static', 'runtime'].includes(item?.class)) fail(`${item?.id} class must be static or runtime`)
    if (item?.class === 'static') {
      if (item.status !== 'defined' || item.runtimeRequired !== false) fail(`${item?.id} static evidence must be defined with runtimeRequired=false`)
      if (!String(item.artifactPathPattern ?? '').startsWith('config/')) fail(`${item?.id} static artifact must be repository-addressable`)
    } else {
      if (!allowedRuntimeStatuses.has(item.status) || item.runtimeRequired !== true) fail(`${item?.id} runtime evidence must remain pending/blocked with runtimeRequired=true`)
      if (item.collectionPolicy !== 'runtime-runner-only') fail(`${item?.id} runtime evidence must use runtime-runner-only collection`)
      if (!String(item.artifactPathPattern ?? '').startsWith('evidence/')) fail(`${item?.id} runtime artifact must be external evidence/ path`)
    }
    requireString(item?.artifactPathPattern, `${item?.id}.artifactPathPattern`)
    requireString(item?.collectionPolicy, `${item?.id}.collectionPolicy`)
  }
  for (const evidenceId of referenced) if (!evidenceIds.includes(evidenceId)) fail(`missing evidence index item: ${evidenceId}`)
  for (const taskEvidence of config.runtimeGate.requiredEvidence ?? []) if (!evidenceIds.includes(taskEvidence)) fail(`runtimeGate required evidence missing from index: ${taskEvidence}`)
  for (const gate of config.qualityGates) {
    const indexIds = new Set(evidence.filter((item) => item.gateId === gate.id).map((item) => item.id))
    for (const evidenceId of gate.evidenceIds) if (!indexIds.has(evidenceId)) fail(`${gate.id} evidence ${evidenceId} is not indexed for its gate`)
  }
}

function validateReleaseGate(config) {
  const gate = config.releaseGate
  if (!isRecord(gate) || gate.status !== 'BLOCKED' || gate.defaultDecision !== 'deny') fail('release gate must default to BLOCKED/deny')
  if (gate.requiresAllAssignedTasks !== true) fail('release gate must require all assigned tasks')
  for (const task of ['V2-B20-SEC-001', 'V2-B20-PRI-002', 'V2-B20-CNT-003', 'V2-B20-COM-004', 'V2-B20-DR-005']) if (!gate.requiredUpstreamTasks?.includes(task)) fail(`release gate missing upstream task ${task}`)
  for (const condition of ['any-required-evidence-missing', 'runtime-evidence-pending-or-blocked', 'artifact-hash-missing-or-invalid', 'live-provider-or-unqualified-payment', 'restore-or-reconciliation-unmeasured', 'single-reviewer-or-conflicted-reviewer', 'open-p0-or-p1', 'rollback-conclusion-missing']) if (!gate.blockingConditions?.includes(condition)) fail(`release blocker missing ${condition}`)

  const review = gate.dualReview
  if (!isRecord(review) || review.required !== true || review.independentReviewers !== true || review.minimumReviewers < 2 || review.samePersonCannotSatisfyBoth !== true || review.reviewRecordStatus !== 'not-present') fail('dual review policy must require two independent reviewers and remain unfulfilled')
  for (const role of ['commerce-owner', 'reliability-owner']) if (!review.requiredRoles?.includes(role)) fail(`dual review role missing ${role}`)

  const risk = gate.riskAcceptance
  if (!isRecord(risk) || risk.allowed !== true || risk.defaultStatus !== 'not-present' || risk.requiresExpiration !== true || risk.cannotAcceptP0 !== true || risk.cannotOpenLivePayment !== true) fail('risk acceptance must be explicit, expiring, non-P0 and unable to open live payment')
  for (const field of ['riskId', 'scope', 'residualRisk', 'mitigation', 'owner', 'expiresAt', 'approverA', 'approverB', 'rollbackPlan']) if (!risk.requiredFields?.includes(field)) fail(`risk acceptance field missing ${field}`)

  const rollback = gate.rollback
  if (!isRecord(rollback) || rollback.required !== true || rollback.defaultStatus !== 'not-established' || rollback.requiresVersionedArtifact !== true || rollback.requiresRestorePoint !== true || rollback.requiresOwner !== true || rollback.requiresDrillEvidence !== true || rollback.conclusionStatus !== 'not-established') fail('rollback conclusion must remain unestablished until drilled')
}

function validateReportSchema(reportSchema) {
  if (!isRecord(reportSchema)) {
    fail('reportSchema is required')
    return
  }
  requireString(reportSchema.id, 'reportSchema.id')
  requireString(reportSchema.version, 'reportSchema.version')
  const schema = reportSchema.jsonSchema
  if (!isRecord(schema) || schema.type !== 'object' || schema.additionalProperties !== false) fail('report schema must be a closed object')
  const required = new Set(schema?.required ?? [])
  for (const field of ['schemaVersion', 'reportId', 'batch', 'decision', 'gates', 'evidence', 'review', 'riskAcceptance', 'rollback']) if (!required.has(field)) fail(`report schema missing required field ${field}`)
  const decision = schema?.properties?.decision
  if (!decision?.enum?.includes('BLOCKED') || !decision?.enum?.includes('NO-GO')) fail('report decision must represent blocked/no-go states')
  for (const field of ['gates', 'evidence', 'review', 'riskAcceptance', 'rollback']) if (!schema?.properties?.[field]) fail(`report schema missing property ${field}`)
}

export function validateB20CommerceDrEvidence(config = readJson(configPath)) {
  errors.length = 0
  if (!config) return { result: 'FAIL', errors: [...errors] }
  if (config.schemaVersion !== 1) fail('schemaVersion must be 1')
  if (config.batch !== 'B20') fail('batch must be B20')
  if (config.phase !== 'phase-1') fail('manifest must remain Phase 1')
  if (config.mode !== 'static-and-synthetic') fail('manifest mode must be static-and-synthetic')
  if (config.status !== 'static-foundation') fail('manifest status must be static-foundation')
  if (config.runtimeDecision !== 'BLOCKED') fail('runtimeDecision must remain BLOCKED until external evidence exists')

  validateTasks(config)
  validateRuntimeGate(config.runtimeGate)
  validateRuntimeRequest(config.runtimeGate)
  validateCommerce(config.commerce)
  validateDisasterRecovery(config.disasterRecovery)
  const { checkEvidenceByGate } = validateQualityGates(config)
  validateEvidenceIndex(config, checkEvidenceByGate)
  validateReleaseGate(config)
  validateReportSchema(config.reportSchema)
  validateNoSecretsOrPersonalData(config)

  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    batch: config.batch,
    taskCount: config.tasks?.length ?? 0,
    qualityGateCount: config.qualityGates?.length ?? 0,
    evidenceCount: config.evidenceIndex?.length ?? 0,
    runtimeEvidencePending: (config.evidenceIndex ?? []).filter((item) => item.class === 'runtime' && allowedRuntimeStatuses.has(item.status)).length,
    runtimeGate: runtimeRequested ? 'blocked' : 'static-only',
    errors: [...errors],
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const result = validateB20CommerceDrEvidence()
  console.log(JSON.stringify(result, null, 2))
  if (result.result !== 'PASS') process.exitCode = 1
}
