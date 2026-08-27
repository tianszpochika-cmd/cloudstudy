import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifestRelativePath = 'config/g0-scope-governance.json'
const runtimeRequestedByProcess = process.argv.includes('--require-runtime') || process.env.G0_REQUIRE_RUNTIME === '1'
const forbiddenText = [
  /Bearer\s+[A-Za-z0-9._~-]+/i,
  /\bsk-[A-Za-z0-9]/i,
  /-----BEGIN [A-Z ]+-----/i,
  /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/,
  /https?:\/\//i,
  /(?:^|\b)(?:jdbc|mysql|redis|kafka):\/\//i,
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

function scanValue(value, location, errors) {
  if (typeof value === 'string') {
    for (const pattern of forbiddenText) requireCondition(!pattern.test(value), `${location} contains a credential, PII, or URL pattern`, errors)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) scanValue(child, `${location}.${key}`, errors)
}

function safeRelativePath(relativePath, label, errors) {
  requireCondition(typeof relativePath === 'string' && !path.isAbsolute(relativePath) && !relativePath.includes('..'), `${label} must be a safe repository-relative path`, errors)
  return typeof relativePath === 'string' && !path.isAbsolute(relativePath) && !relativePath.includes('..')
}

function readSource(relativePath, label, errors) {
  if (!safeRelativePath(relativePath, label, errors)) return ''
  const absolutePath = path.join(root, relativePath)
  if (!fs.existsSync(absolutePath)) {
    errors.push(`${label} source path does not exist: ${relativePath}`)
    return ''
  }
  const source = fs.readFileSync(absolutePath, 'utf8')
  for (const pattern of forbiddenText.slice(0, 6)) requireCondition(!pattern.test(source), `${relativePath} contains a credential or PII pattern`, errors)
  return source
}

function validateBasis(manifest, errors) {
  requireCondition(manifest.schemaVersion === 1, 'schemaVersion must be 1', errors)
  requireCondition(manifest.gate === 'G0' && manifest.taskId === 'G0-SCOPE-001', 'manifest must be G0-SCOPE-001', errors)
  requireCondition(manifest.phase === 'phase-1', 'G0 phase must be phase-1', errors)
  requireCondition(manifest.status === 'static-foundation' && manifest.staticDecision === 'PASS', 'G0 static status must be static-foundation/PASS', errors)
  requireCondition(manifest.defaultDecision === 'BLOCKED', 'G0 default decision must remain BLOCKED', errors)
  const semantics = manifest.staticValidatorSemantics
  requireCondition(semantics?.businessCompletion === false, 'static PASS cannot mean business completion', errors)
  requireCondition(semantics?.runtimeEvidenceStatus === 'pending' && semantics?.runtimeMissingDecision === 'BLOCKED', 'runtime evidence must remain pending/blocked', errors)
  requireCondition(semantics?.staticValidatorCannotPromoteRuntime === true && semantics?.syntheticEvidenceCannotPromoteRuntime === true, 'static validator promotion protection is incomplete', errors)
}

function validateScope(scope, errors) {
  const phase1 = scope?.phase1
  requireCondition(phase1?.status === 'frozen', 'Phase 1 scope must be frozen', errors)
  requireCondition(phase1?.audience === 'adults-18-plus-and-university-students', 'Phase 1 audience must be adults and university students', errors)
  requireCondition(phase1?.learningMode === 'rule-based-learning', 'Phase 1 must use rule-based learning', errors)
  requireArray(phase1?.closedLoop, 'Phase 1 closed loop', errors, 5)
  requireCondition(JSON.stringify(phase1?.clientHosts) === JSON.stringify(['apps/mobile', 'apps/learner-web', 'apps/admin-web', 'apps/official-site']), 'Phase 1 four-client boundary is incomplete or reordered', errors)
  for (const capability of ['generative-ai', 'realtime-ai-voice', 'k12-minors', 'guardian-institution-mode']) requireCondition(phase1?.excludedCapabilities?.includes(capability), `Phase 1 exclusion missing ${capability}`, errors)

  const enums = scope?.frozenEnums
  const expectedEnums = {
    phase: ['phase-1', 'phase-2', 'phase-3'],
    decision: ['GO', 'NO-GO', 'BLOCKED'],
    masteryState: ['NEW', 'LEARNING', 'MASTERED', 'CONSOLIDATED'],
    mistakeVerificationState: ['PENDING_RETRY', 'DELAY_VERIFY_D1', 'DELAY_VERIFY_D7', 'MASTERED', 'REOPENED'],
    dailyLearningMinutes: [5, 15, 30, 45],
    phonemeManifest: ['EN_48_PHASE1'],
    paymentDefault: ['disabled'],
  }
  for (const [key, expected] of Object.entries(expectedEnums)) requireCondition(JSON.stringify(enums?.[key]) === JSON.stringify(expected), `frozen enum ${key} is not canonical`, errors)
  for (const [key, values] of Object.entries(enums ?? {})) unique(values, `frozen enum ${key}`, errors)

  const locks = scope?.phaseLocks ?? []
  requireCondition(JSON.stringify(locks.map((lock) => lock?.phase)) === JSON.stringify(['phase-2', 'phase-3']), 'Phase 2/3 locks are incomplete or reordered', errors)
  for (const lock of locks) {
    requireCondition(lock?.status === 'locked' && lock?.defaultEnabled === false && lock?.defaultRoute === 'deny', `${lock?.phase} must be locked and deny by default`, errors)
    requireString(lock?.requiresGate, `${lock?.phase}.requiresGate`, errors)
    requireArray(lock?.cannotBeSatisfiedBy, `${lock?.phase}.cannotBeSatisfiedBy`, errors, 3)
    requireArray(lock?.referenceMarkers, `${lock?.phase}.referenceMarkers`, errors, 2)
  }

  const authority = scope?.clientAuthority
  for (const fact of ['role', 'permission', 'tenantId', 'ownerId', 'phase', 'contentRights', 'ageVerified']) requireCondition(authority?.forbiddenFacts?.includes(fact), `client authority fact ${fact} must be forbidden`, errors)
  requireCondition(authority?.sourceOfTruth === 'verified-principal-server-derived-tenant-and-versioned-policy', 'client authority source of truth is unsafe', errors)
  requireCondition(authority?.rejectionStatus === 403 && authority?.rejectionCode === 'UNTRUSTED_SECURITY_FACT' && authority?.defaultDecision === 'deny', 'client authority rejection must fail closed', errors)
}

function validateReferences(references, errors) {
  const groups = [
    ['featureRefs', /^FEAT-[A-Z0-9-]+$/],
    ['prdRefs', /^PRD-ATOM-[0-9]+$/],
    ['designRefs', /^V2-980-[0-9]{4}$/],
    ['adrRefs', /^ADR-[0-9]{4}$/],
    ['architectureRefs', /^ARCH-[A-Z0-9-]+$/],
  ]
  const allIds = []
  for (const [key, pattern] of groups) {
    const refs = references?.[key] ?? []
    requireArray(refs, `references.${key}`, errors, 1)
    for (const ref of refs) {
      requireCondition(pattern.test(ref?.id ?? ''), `${key} contains invalid id ${ref?.id}`, errors)
      requireString(ref?.path, `${key}.${ref?.id}.path`, errors)
      requireString(ref?.marker, `${key}.${ref?.id}.marker`, errors)
      const source = readSource(ref?.path, `${key}.${ref?.id}.path`, errors)
      requireCondition(source.includes(ref?.marker ?? ''), `${key}.${ref?.id} marker is missing from source`, errors)
      allIds.push(ref?.id)
    }
  }
  unique(allIds, 'governance reference ids', errors)
}

function validateConflictPolicy(policy, errors) {
  requireCondition(JSON.stringify(policy?.precedence) === JSON.stringify([
    'v2-980plus-signed-design-and-traceability',
    'accepted-adr-and-v2-architecture-matrix',
    'accepted-dod-and-backlog-governance',
    'legacy-b0-b6-only-as-migration-input',
  ]), 'G0 conflict precedence is not canonical', errors)
  requireCondition(policy?.onConflict === 'BLOCKED' && policy?.legacyCannotOverrideV2 === true && policy?.phaseConflictCannotPromote === true, 'G0 conflict handling must block and preserve v2 precedence', errors)
  for (const action of ['record-conflict', 'identify-impacted-scope', 'create-or-reference-superseding-adr', 'update-contract-and-evidence-index-before-code']) requireCondition(policy?.requiredActions?.includes(action), `conflict action missing ${action}`, errors)
  const evidence = policy?.evidencePathPolicy
  requireCondition(JSON.stringify(evidence?.staticRoots) === JSON.stringify(['config/', 'packages/contracts/', 'scripts/', 'tests/']), 'static evidence roots are not canonical', errors)
  requireCondition(evidence?.runtimeRoot === 'evidence/' && evidence?.runtimeCollectionPolicy === 'approved-external-runner-only', 'runtime evidence path policy is unsafe', errors)
  for (const item of ['secrets', 'pii', 'production-url', 'client-submitted-authority-facts']) requireCondition(evidence?.prohibited?.includes(item), `evidence prohibition missing ${item}`, errors)
}

function validateStaticChecks(checks, errors) {
  requireArray(checks, 'G0 static checks', errors, 5)
  const ids = checks.map((check) => check?.id)
  unique(ids, 'G0 static check ids', errors)
  for (const check of checks) {
    requireString(check?.id, 'G0 check id', errors)
    requireCondition(check?.status === 'defined' && check?.evidenceClass === 'static' && check?.runtimeRequired === false, `${check?.id} must be a static defined check`, errors)
    requireArray(check?.sourcePaths, `${check?.id}.sourcePaths`, errors)
    requireArray(check?.assertions, `${check?.id}.assertions`, errors)
    const sources = (check?.sourcePaths ?? []).map((sourcePath) => readSource(sourcePath, `${check?.id}.sourcePath`, errors)).join('\n')
    for (const assertion of check?.assertions ?? []) {
      if (typeof assertion?.contains === 'string') requireCondition(sources.includes(assertion.contains), `${check?.id} missing source marker ${assertion.contains}`, errors)
      else if (typeof assertion?.regex === 'string') {
        try { requireCondition(new RegExp(assertion.regex, assertion.flags ?? '').test(sources), `${check?.id} source regex did not match`, errors) } catch (error) { errors.push(`${check?.id} has invalid regex: ${error.message}`) }
      } else errors.push(`${check?.id} assertion must contain contains or regex`)
    }
  }
}

function validateEvidence(manifest, errors) {
  const index = manifest.evidenceIndex ?? []
  requireArray(index, 'G0 evidence index', errors, 6)
  const ids = index.map((item) => item?.id)
  unique(ids, 'G0 evidence ids', errors)
  for (const item of index) {
    requireString(item?.id, 'evidence.id', errors)
    requireCondition(item?.class === 'static' || item?.class === 'runtime', `${item?.id} evidence class is invalid`, errors)
    requireString(item?.artifactPathPattern, `${item?.id}.artifactPathPattern`, errors)
    requireString(item?.collectionPolicy, `${item?.id}.collectionPolicy`, errors)
    if (item?.class === 'static') {
      requireCondition(item?.status === 'defined' && item?.runtimeRequired === false && item?.artifactPathPattern.startsWith('config/'), `${item?.id} static evidence is invalid`, errors)
    } else {
      requireCondition(['pending', 'blocked'].includes(item?.status) && item?.runtimeRequired === true && item?.artifactPathPattern.startsWith('evidence/'), `${item?.id} runtime evidence must remain pending/blocked and external`, errors)
      requireCondition(item?.collectionPolicy === 'approved-external-runner-only', `${item?.id} runtime evidence collection policy is unsafe`, errors)
    }
  }
  for (const id of manifest.runtimeGate?.requiredEvidence ?? []) requireCondition(ids.includes(id), `runtime evidence ${id} is not indexed`, errors)
  const report = manifest.reportSchema
  requireCondition(report?.closed === true && report?.missingEvidenceDecision === 'BLOCKED', 'G0 report schema must be closed and BLOCKED on missing evidence', errors)
  requireArray(report?.required, 'G0 report required fields', errors, 8)
}

function validateRuntime(manifest, env, errors) {
  const required = manifest.runtimeGate?.requiredEnv ?? []
  requireArray(required, 'G0 runtime required env', errors, 3)
  unique(required, 'G0 runtime required env', errors)
  for (const name of required) requireCondition(/^G0_RUNTIME_[A-Z0-9_]+$/.test(name), `invalid G0 runtime env ${name}`, errors)
  const missing = required.filter((name) => !env?.[name])
  if (missing.length > 0) errors.push(`runtime gate blocked; missing environment: ${missing.join(', ')}`)
  for (const name of required) if (env?.[name]) requireCondition(!/synthetic|fixture|example\.invalid|replace_with|pending/i.test(String(env[name])), `${name} cannot use a synthetic or placeholder evidence reference`, errors)
  errors.push('runtime gate blocked; real scope signoff and conflict/phase evidence require an approved external runner and cannot be promoted by this static validator')
}

export function validateG0ScopeGovernance(manifest, { runtimeRequested = runtimeRequestedByProcess, env = process.env } = {}) {
  const errors = []
  if (!isRecord(manifest)) return { result: 'FAIL', gate: 'G0', runtimeGate: runtimeRequested ? 'blocked' : 'static-only', errors: ['manifest must be a JSON object'] }
  scanValue(manifest, '$.manifest', errors)
  validateBasis(manifest, errors)
  validateScope(manifest.scope, errors)
  validateReferences(manifest.references, errors)
  validateConflictPolicy(manifest.conflictPolicy, errors)
  validateStaticChecks(manifest.checks, errors)
  validateEvidence(manifest, errors)
  requireCondition(manifest.runtimeGate?.status === 'blocked' && manifest.runtimeGate?.runtimeStatusWhenMissing === 'blocked', 'G0 runtime gate must remain blocked', errors)
  requireCondition(manifest.runtimeGate?.staticValidatorCannotPromoteRuntime === true, 'G0 runtime gate must prevent static promotion', errors)
  if (runtimeRequested) validateRuntime(manifest, env, errors)
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    gate: 'G0',
    phase: manifest.phase,
    defaultDecision: manifest.defaultDecision,
    runtimeGate: runtimeRequested ? 'blocked' : 'static-only',
    staticChecks: manifest.checks?.length ?? 0,
    runtimeChecks: manifest.runtimeGate?.requiredEvidence?.length ?? 0,
    runtimeEvidencePending: manifest.runtimeGate?.requiredEvidence?.length ?? 0,
    errors,
  }
}

function loadManifest() {
  return JSON.parse(fs.readFileSync(path.join(root, manifestRelativePath), 'utf8'))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = validateG0ScopeGovernance(loadManifest())
    console.log(JSON.stringify(result, null, 2))
    if (result.result !== 'PASS') process.exitCode = 1
  } catch (error) {
    console.error(JSON.stringify({ result: 'FAIL', gate: 'G0', errors: [error.message] }, null, 2))
    process.exitCode = 1
  }
}
