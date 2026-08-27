import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifestRelativePath = 'config/g2-implementation-interaction.json'
const runtimeRequestedByProcess = process.argv.includes('--require-runtime') || process.env.G2_REQUIRE_RUNTIME === '1'
const expectedPlatforms = ['mobile', 'learner-web', 'admin-web', 'official-site']
const expectedStates = ['loading', 'empty', 'error', 'permission', 'recovery', 'offline', 'success', 'partial']
const adminStates = ['loading', 'empty', 'error', 'permission', 'recovery']
const expectedPerformanceLevels = ['Ultra', 'High', 'Medium', 'Performance']
const forbiddenMaterialPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/i,
  /\bsk-[A-Za-z0-9]{20,}\b/i,
  /Bearer\s+eyJ[A-Za-z0-9_-]+\./i,
  /[A-Za-z0-9._%+-]+@(gmail|qq|163|outlook)\.[A-Za-z]{2,}/i,
  /(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/,
]

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireCondition(condition, message, errors) {
  if (!condition) errors.push(message)
}

function requireString(value, label, errors) {
  requireCondition(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`, errors)
}

function requireArray(value, label, errors, minimum = 1) {
  requireCondition(Array.isArray(value) && value.length >= minimum, `${label} must contain at least ${minimum} item(s)`, errors)
}

function unique(values, label, errors) {
  const strings = values.filter((value) => typeof value === 'string')
  requireCondition(new Set(strings).size === strings.length, `${label} must be unique`, errors)
}

function scanMaterial(value, location, errors) {
  if (typeof value === 'string') {
    for (const pattern of forbiddenMaterialPatterns) requireCondition(!pattern.test(value), `${location} contains credential or PII material`, errors)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) scanMaterial(child, `${location}.${key}`, errors)
}

function isSafeRepositoryPath(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath) || relativePath.includes('..')) return false
  const resolved = path.resolve(root, relativePath)
  const relative = path.relative(root, resolved)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) && !/^(node_modules|dist|target|\.nuxt|\.output)([\\/]|$)/i.test(relative)
}

function readSource(relativePath, errors, sourceOverrides = {}) {
  requireCondition(isSafeRepositoryPath(relativePath), `unsafe source path ${relativePath}`, errors)
  if (!isSafeRepositoryPath(relativePath)) return ''
  if (Object.prototype.hasOwnProperty.call(sourceOverrides, relativePath)) return String(sourceOverrides[relativePath])
  const absolutePath = path.join(root, relativePath)
  if (!fs.existsSync(absolutePath)) {
    errors.push(`missing source path ${relativePath}`)
    return ''
  }
  return fs.readFileSync(absolutePath, 'utf8')
}

function sourceTextFor(item, errors, sourceOverrides) {
  return (item?.sourcePaths ?? []).map((sourcePath) => readSource(sourcePath, errors, sourceOverrides)).join('\n')
}

function validateSourceAssertions(check, errors, sourceOverrides) {
  const source = sourceTextFor(check, errors, sourceOverrides)
  for (const assertion of check?.assertions ?? []) {
    if (!isRecord(assertion)) {
      errors.push(`${check?.id} assertion must be an object`)
    } else if (typeof assertion.contains === 'string') {
      requireCondition(source.includes(assertion.contains), `${check?.id} missing source marker ${assertion.contains}`, errors)
    } else if (typeof assertion.regex === 'string') {
      try {
        requireCondition(new RegExp(assertion.regex, assertion.flags ?? '').test(source), `${check?.id} source regex did not match`, errors)
      } catch (error) {
        errors.push(`${check?.id} has invalid source regex: ${error.message}`)
      }
    } else {
      errors.push(`${check?.id} assertion must contain contains or regex`)
    }
  }
}

function validateBasics(manifest, errors) {
  requireCondition(manifest.schemaVersion === '1.0.0', 'schemaVersion must be 1.0.0', errors)
  requireCondition(manifest.gate === 'G2' && manifest.batch === 'G2', 'gate and batch must be G2', errors)
  requireCondition(manifest.taskId === 'V2-G2-IMPLEMENTATION-INTERACTION-001', 'taskId must be V2-G2-IMPLEMENTATION-INTERACTION-001', errors)
  requireCondition(manifest.phase === 'phase-1', 'G2 must be Phase 1', errors)
  requireCondition(manifest.status === 'PASS', 'G2 static status must be PASS', errors)
  requireCondition(manifest.defaultDecision === 'NO-GO', 'G2 defaultDecision must remain NO-GO', errors)
  requireCondition(manifest.productionAction === 'disabled', 'G2 production action must remain disabled', errors)
  requireCondition(manifest.runtimeEvidenceStatus === 'pending', 'G2 runtime evidence must remain pending', errors)
  requireCondition(manifest.scope?.phase?.includes('Phase 2 AI') === true, 'Phase 2 AI boundary must be explicit', errors)
  requireCondition(JSON.stringify(manifest.scope?.clientPlatforms) === JSON.stringify(expectedPlatforms), 'G2 scope must cover all four platforms in order', errors)
  requireCondition(JSON.stringify(manifest.scope?.requiredUiStates) === JSON.stringify(expectedStates), 'G2 scope states are incomplete or reordered', errors)
  requireCondition(JSON.stringify(manifest.scope?.requiredPerformanceLevels) === JSON.stringify(expectedPerformanceLevels), 'G2 scope performance levels are incomplete or reordered', errors)
  for (const ref of ['ARCH-API-001', 'ARCH-DATA-001', 'ARCH-EVT-001', 'ARCH-GW-001', 'ARCH-IAM-001', 'ARCH-PLAT-001', 'ARCH-SVC-001']) {
    requireCondition(manifest.designBasis?.architectureRefs?.includes(ref), `missing architecture ref ${ref}`, errors)
  }
}

function validateImplementationContract(contract, errors) {
  requireCondition(isRecord(contract), 'implementationContract is required', errors)
  const api = contract?.apiBoundary
  requireCondition(api?.external === '/api/v1' && api?.internal === '/internal/v1', 'API boundary versions are invalid', errors)
  for (const field of ['gatewayRequired', 'generatedTypesRequired']) requireCondition(api?.[field] === true, `API boundary ${field} must be true`, errors)
  requireCondition(api?.writeIdempotencyHeader === 'Idempotency-Key' && api?.offlineEventKey === 'clientEventId', 'idempotency/offline keys are invalid', errors)
  for (const field of ['eventId', 'traceId', 'schemaVersion', 'aggregateId', 'dedupeKey', 'payload']) requireCondition(contract?.eventEnvelopeRequired?.includes(field), `event envelope missing ${field}`, errors)
  for (const field of ['outboxRequired', 'atLeastOnceDelivery', 'consumerDeduplication', 'replayAndDlqRecovery', 'noKafkaRpc', 'noTwoPhaseCommit']) requireCondition(contract?.eventRules?.[field] === true, `event rule ${field} must be true`, errors)
  for (const field of ['serviceOwnedSchema', 'serviceOwnedMigrations', 'serviceOwnedWriteAccess', 'crossServiceSqlJoinForbidden', 'crossServiceWriteForbidden', 'redisIsNotSourceOfTruth', 'serverDerivesTenantAndOwner']) requireCondition(contract?.dataRules?.[field] === true, `data rule ${field} must be true`, errors)
  for (const field of ['defaultDeny', 'gatewayAndServicePepRequired', 'clientAuthorityHeadersForbidden', 'permissionDeniedIsExplicit']) requireCondition(contract?.permissionRules?.[field] === true, `permission rule ${field} must be true`, errors)
}

function validatePlatforms(platforms, errors) {
  requireArray(platforms, 'platformMatrix', errors, expectedPlatforms.length)
  const ids = (platforms ?? []).map((platform) => platform?.id)
  requireCondition(JSON.stringify(ids) === JSON.stringify(expectedPlatforms), 'platformMatrix must cover all four projects in order', errors)
  unique(ids, 'platformMatrix ids', errors)
  for (const platform of platforms ?? []) {
    requireString(platform?.projectPath, `${platform?.id}.projectPath`, errors)
    requireCondition(platform?.gatewayBasePath === '/api/v1', `${platform?.id} must use /api/v1`, errors)
    requireCondition(platform?.staticStatus === 'PASS' && platform?.runtimeStatus === 'pending', `${platform?.id} status boundary is invalid`, errors)
    requireArray(platform?.interactionSourcePaths, `${platform?.id}.interactionSourcePaths`, errors, 1)
    const requiredStates = platform?.id === 'admin-web' ? adminStates : expectedStates
    requireCondition(JSON.stringify(platform?.requiredStates) === JSON.stringify(requiredStates), `${platform?.id} states are incomplete or reordered`, errors)
  }
  const admin = platforms.find((platform) => platform?.id === 'admin-web')
  const official = platforms.find((platform) => platform?.id === 'official-site')
  requireArray(admin?.requiredPermissions, 'admin-web.requiredPermissions', errors, 1)
  requireCondition(official?.publicOnly === true, 'official-site must remain public-only', errors)
}

function validateInteractionStates(contract, errors) {
  requireCondition(JSON.stringify(contract?.states) === JSON.stringify(expectedStates), 'interaction states are incomplete or reordered', errors)
  for (const field of ['nonColorSignals', 'permissionSemantics', 'recoverySemantics', 'emptySemantics', 'partialSemantics']) requireArray(contract?.[field], `interactionStateContract.${field}`, errors, 1)
  requireCondition(contract?.nonColorSignals?.some((value) => /text/i.test(value)), 'non-color state signal must include visible text', errors)
  requireCondition(contract?.permissionSemantics?.some((value) => /401|403/.test(value)), 'permission semantics must distinguish 401/403', errors)
}

function validateRetryDegradation(policy, errors) {
  requireCondition(policy?.writeRequests?.idempotencyHeader === 'Idempotency-Key' && policy?.writeRequests?.offlineClientEventId === 'clientEventId', 'retry write keys are invalid', errors)
  requireCondition(policy?.writeRequests?.duplicateSideEffectsForbidden === true, 'duplicate side effects must be forbidden', errors)
  for (const field of ['retryableErrorMustBeExplicit', 'recoveryActionMustBeVisible', 'replayMustBeBoundToRequestOrCheckpoint']) requireCondition(policy?.retry?.[field] === true, `retry rule ${field} must be true`, errors)
  for (const field of ['stateMustBeVisible', 'queueOrCheckpointMustBeBounded', 'reconnectRecoveryRequired']) requireCondition(policy?.offline?.[field] === true, `offline rule ${field} must be true`, errors)
  for (const field of ['preservePrimaryLearningPath', 'noAutomaticQualityUpgrade', 'noSyntheticDataOnFailure']) requireCondition(policy?.degradation?.[field] === true, `degradation rule ${field} must be true`, errors)
  requireCondition(policy?.degradation?.performanceFallbackMode === 'static', 'performance fallback must be static', errors)
}

function validateLocaleTheme(policy, errors) {
  requireCondition(policy?.uiLocaleAndContentLocaleAreIndependent === true, 'UI locale and contentLocale must be independent', errors)
  requireCondition(policy?.defaultUiLocale === 'zh-CN' && policy?.defaultContentLocale === 'en-US', 'default locales are invalid', errors)
  requireCondition(policy?.fallbackRequired === true && policy?.themePersistenceRequired === true, 'i18n fallback and theme persistence are required', errors)
  for (const formatter of ['formatNumber', 'formatDate', 'formatPlural']) requireCondition(policy?.formatters?.includes(formatter), `missing formatter ${formatter}`, errors)
  requireCondition(JSON.stringify(policy?.themeModes) === JSON.stringify(['light', 'dark', 'system', 'high-contrast']), 'theme modes are incomplete or reordered', errors)
  for (const field of ['ssrNoFlashRequired', 'uniAppAdapterRequired', 'elementPlusAdapterRequired']) requireCondition(policy?.[field] === true, `theme adapter rule ${field} must be true`, errors)
}

function validatePerformance(policy, errors) {
  const levels = (policy?.levels ?? []).map((level) => level?.id)
  requireCondition(JSON.stringify(levels) === JSON.stringify(expectedPerformanceLevels), 'performance levels must be Ultra/High/Medium/Performance', errors)
  requireCondition(policy?.levels?.at(-1)?.fallbackMode === 'static', 'Performance level must use static fallback', errors)
  for (const field of ['reducedMotionMustDisableComplexEffects', 'performanceModeMustKeepPrimaryContent']) requireCondition(policy?.[field] === true, `performance rule ${field} must be true`, errors)
  requireCondition(policy?.lowCapabilityFallback === '2D_FALLBACK', 'low capability fallback must be 2D_FALLBACK', errors)
}

function validateOwners(contract, errors) {
  requireCondition(contract?.apiOwnerAndDataOwnerMustBeExplicit === true, 'API/data owner must be explicit', errors)
  requireArray(contract?.services, 'ownershipContract.services', errors, 12)
  const services = (contract?.services ?? []).map((item) => item?.service)
  unique(services, 'ownership service ids', errors)
  for (const item of contract?.services ?? []) {
    requireCondition(item?.service === item?.apiOwner && item?.service === item?.dataOwner, `${item?.service} API/data owner mismatch`, errors)
    requireArray(item?.facts, `${item?.service}.facts`, errors, 1)
  }
  for (const required of ['content-service', 'assessment-service', 'learning-service']) requireCondition(services.includes(required), `missing unique fact owner ${required}`, errors)
}

function validatePhasePolicy(policy, errors) {
  requireCondition(policy?.phase1AdultLearning === 'enabled', 'Phase 1 adult learning must be enabled', errors)
  for (const field of ['generationAI', 'realtimeAI', 'phase3K12']) requireCondition(policy?.[field] === 'disabled', `${field} must remain disabled`, errors)
  for (const field of ['directModelProviderAccess', 'clientModelProviderAccess']) requireCondition(policy?.[field] === 'forbidden', `${field} must remain forbidden`, errors)
}

function validateEvidencePolicy(policy, errors) {
  for (const field of ['staticSourceMarkersAreImplementationClaimsOnly', 'staticValidatorCannotPromoteRuntime', 'syntheticFixturesAreNotRuntimeEvidence', 'developmentHttp200IsNotRuntimeEvidence', 'defaultValuesAreNotRuntimeEvidence', 'unboundScreenshotsAreNotRuntimeEvidence', 'runtimeEvidenceMustBeCapturedExternally', 'runtimeEvidenceMustBindSourceEnvironmentAndTrace']) requireCondition(policy?.[field] === true, `evidence policy ${field} must be true`, errors)
  requireCondition(policy?.realRuntimeScreenshotsApiReplayAndProductionLikeRuns === 'pending', 'real runtime evidence must remain pending', errors)
}

function validateChecks(manifest, errors, sourceOverrides) {
  const staticChecks = manifest.staticChecks ?? []
  const runtimeChecks = manifest.runtimeChecks ?? []
  requireArray(staticChecks, 'staticChecks', errors, 10)
  requireArray(runtimeChecks, 'runtimeChecks', errors, 8)
  unique([...staticChecks, ...runtimeChecks].map((item) => item?.id), 'G2 check ids', errors)
  for (const check of staticChecks) {
    requireCondition(check?.status === 'PASS' && check?.evidenceClass === 'static' && check?.runtimeRequired === false && check?.staticClaimOnly === true, `${check?.id} static state is invalid`, errors)
    requireString(check?.evidenceId, `${check?.id}.evidenceId`, errors)
    requireArray(check?.sourcePaths, `${check?.id}.sourcePaths`, errors, 1)
    requireArray(check?.assertions, `${check?.id}.assertions`, errors, 1)
    validateSourceAssertions(check, errors, sourceOverrides)
  }
  for (const check of runtimeChecks) {
    requireCondition(['pending', 'blocked'].includes(check?.status) && check?.evidenceClass === 'runtime' && check?.runtimeRequired === true, `${check?.id} runtime state is invalid`, errors)
    requireString(check?.evidenceId, `${check?.id}.evidenceId`, errors)
    for (const field of ['targets', 'scenarios', 'evidenceRequired', 'cannotBeSatisfiedBy']) requireArray(check?.[field], `${check?.id}.${field}`, errors, 1)
  }
}

function validateRuntimeGate(gate, errors) {
  requireCondition(gate?.status === 'blocked' && gate?.staticOnlyByDefault === true, 'runtime gate must remain blocked and static-only', errors)
  requireCondition(gate?.runtimeEvidenceMustBeCapturedExternally === true && gate?.staticValidatorCannotPromoteRuntime === true, 'runtime evidence must be external and non-promotable', errors)
  requireCondition(gate?.runtimeStatusWhenMissing === 'blocked' && gate?.runtimeStatusWhenEvidencePending === 'blocked', 'runtime gate missing/pending state must be blocked', errors)
  requireCondition(gate?.requireRuntimeEnv === 'G2_REQUIRE_RUNTIME', 'runtime gate must use G2_REQUIRE_RUNTIME', errors)
  requireArray(gate?.requiredEnv, 'runtimeGate.requiredEnv', errors, 8)
  unique(gate?.requiredEnv ?? [], 'runtimeGate.requiredEnv', errors)
  for (const name of gate?.requiredEnv ?? []) requireCondition(/^G2_RUNTIME_[A-Z0-9_]+$/.test(name), `invalid G2 runtime environment name ${name}`, errors)
  requireArray(gate?.requiredEvidence, 'runtimeGate.requiredEvidence', errors, 8)
  for (const boundary of ['static-source-marker', 'static-manifest-only', 'synthetic-fixture-only', 'development-http-200', 'unbound-screenshot']) requireCondition(gate?.cannotBeSatisfiedBy?.includes(boundary), `runtime fake-pass boundary missing ${boundary}`, errors)
}

function validateEvidenceIndex(index, staticChecks, runtimeChecks, errors) {
  requireArray(index, 'evidenceIndex', errors, 18)
  unique((index ?? []).map((item) => item?.id), 'evidence ids', errors)
  const staticIds = new Set(staticChecks.map((check) => check?.evidenceId))
  const runtimeIds = new Set(runtimeChecks.map((check) => check?.evidenceId))
  for (const item of index ?? []) {
    requireString(item?.id, 'evidence.id', errors)
    requireCondition(['static', 'runtime'].includes(item?.class), `${item?.id} evidence class invalid`, errors)
    requireCondition(item?.collectionPolicy === (item?.class === 'static' ? 'repository-static-validator' : 'runtime-runner-only'), `${item?.id} collection policy invalid`, errors)
    if (item?.class === 'static') {
      requireCondition(item?.status === 'PASS' && item?.runtimeRequired === false, `${item?.id} static evidence state invalid`, errors)
      staticIds.delete(item.id)
    } else {
      requireCondition(['pending', 'blocked'].includes(item?.status) && item?.runtimeRequired === true, `${item?.id} runtime evidence state invalid`, errors)
      runtimeIds.delete(item.id)
    }
  }
  for (const id of staticIds) errors.push(`static evidence is not indexed: ${id}`)
  for (const id of runtimeIds) errors.push(`runtime evidence is not indexed: ${id}`)
}

function validateRuntimeRequest(manifest, env, errors) {
  const requiredEnv = manifest.runtimeGate?.requiredEnv ?? []
  const missing = requiredEnv.filter((name) => !env?.[name])
  if (missing.length > 0) {
    errors.push(`runtime gate blocked; missing environment: ${missing.join(', ')}`)
    return
  }
  for (const name of requiredEnv) requireCondition(!/(synthetic|fixture|fake|placeholder|example\.invalid|replace_with|pending|http-200|production)/i.test(String(env[name])), `${name} cannot be used as external runtime evidence reference`, errors)
  requireCondition(manifest.status === 'RUNTIME_ACCEPTED', 'runtime gate must remain blocked until external acceptance changes status', errors)
  requireCondition(manifest.defaultDecision === 'GO', 'runtime gate requires an explicit GO decision', errors)
  requireCondition(manifest.runtimeEvidenceStatus === 'captured', 'runtime evidence remains pending or blocked', errors)
  requireCondition((manifest.runtimeChecks ?? []).every((check) => check.status === 'captured'), 'runtime evidence remains pending or blocked', errors)
}

export function validateG2ImplementationInteraction(manifest, { runtimeRequested = runtimeRequestedByProcess, env = process.env, sourceOverrides = {} } = {}) {
  const errors = []
  if (!isRecord(manifest)) return { result: 'FAIL', gate: 'G2', status: 'INVALID', defaultDecision: 'NO-GO', runtimeEvidenceStatus: 'pending', runtimeGate: runtimeRequested ? 'blocked' : 'static-only', errors: ['manifest must be a JSON object'] }
  scanMaterial(manifest, 'manifest', errors)
  validateBasics(manifest, errors)
  validateImplementationContract(manifest.implementationContract, errors)
  validatePlatforms(manifest.platformMatrix, errors)
  validateInteractionStates(manifest.interactionStateContract, errors)
  validateRetryDegradation(manifest.retryAndDegradation, errors)
  validateLocaleTheme(manifest.i18nThemeContract, errors)
  validatePerformance(manifest.performanceContract, errors)
  validateOwners(manifest.ownershipContract, errors)
  validatePhasePolicy(manifest.phasePolicy, errors)
  validateEvidencePolicy(manifest.evidencePolicy, errors)
  validateChecks(manifest, errors, sourceOverrides)
  validateRuntimeGate(manifest.runtimeGate, errors)
  validateEvidenceIndex(manifest.evidenceIndex, manifest.staticChecks ?? [], manifest.runtimeChecks ?? [], errors)
  if (runtimeRequested) validateRuntimeRequest(manifest, env, errors)
  const runtimeEvidencePending = (manifest.evidenceIndex ?? []).filter((item) => item.class === 'runtime' && ['pending', 'blocked'].includes(item.status)).length
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    gate: manifest.gate,
    status: manifest.status,
    defaultDecision: manifest.defaultDecision,
    runtimeEvidenceStatus: manifest.runtimeEvidenceStatus,
    runtimeGate: runtimeRequested ? (errors.length === 0 ? 'accepted' : 'blocked') : 'static-only',
    staticChecks: (manifest.staticChecks ?? []).length,
    runtimeChecks: (manifest.runtimeChecks ?? []).length,
    runtimeEvidencePending,
    runtimeBlocked: runtimeEvidencePending > 0 || runtimeRequested,
    errors,
  }
}

function loadManifest() {
  return JSON.parse(fs.readFileSync(path.join(root, manifestRelativePath), 'utf8'))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const summary = validateG2ImplementationInteraction(loadManifest())
    console.log(JSON.stringify(summary, null, 2))
    if (summary.result !== 'PASS') process.exitCode = 1
  } catch (error) {
    console.error(JSON.stringify({ result: 'FAIL', errors: [error.message] }, null, 2))
    process.exitCode = 1
  }
}
