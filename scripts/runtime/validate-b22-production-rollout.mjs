import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifestRelativePath = 'config/b22-production-rollout.json'
const runtimeRequestedByProcess = process.argv.includes('--require-runtime') || process.env.B22_REQUIRE_RUNTIME === '1'
const expectedPlatforms = ['mobile', 'learner-web', 'admin-web', 'official-site']
const expectedWeights = [1, 5, 25, 50, 100]
const forbiddenText = [
  /Bearer\s+[A-Za-z0-9._~-]+/i,
  /\bsk-[A-Za-z0-9]/i,
  /-----BEGIN [A-Z ]+-----/i,
  /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/,
]

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function loadManifest() {
  return JSON.parse(fs.readFileSync(path.join(root, manifestRelativePath), 'utf8'))
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
  const strings = values.filter((value) => typeof value === 'string')
  requireCondition(new Set(strings).size === strings.length, `${label} must be unique`, errors)
}

function scanValue(value, location, errors) {
  if (typeof value === 'string') {
    for (const pattern of forbiddenText) requireCondition(!pattern.test(value), `${location} contains a credential or PII pattern`, errors)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) scanValue(child, `${location}.${key}`, errors)
}

function readSource(relativePath, errors) {
  requireCondition(typeof relativePath === 'string' && !path.isAbsolute(relativePath) && !relativePath.includes('..'), `invalid source path ${relativePath}`, errors)
  if (typeof relativePath !== 'string' || path.isAbsolute(relativePath) || relativePath.includes('..')) return ''
  const absolutePath = path.join(root, relativePath)
  if (!fs.existsSync(absolutePath)) {
    errors.push(`missing source path ${relativePath}`)
    return ''
  }
  const text = fs.readFileSync(absolutePath, 'utf8')
  for (const pattern of forbiddenText) requireCondition(!pattern.test(text), `${relativePath} contains a credential or PII pattern`, errors)
  return text
}

function validateBasis(manifest, errors) {
  requireCondition(manifest.batch === 'B22', 'batch must be B22', errors)
  requireCondition(manifest.taskId === 'V2-B22-REL-001', 'task scope must be V2-B22-REL-001', errors)
  requireCondition(manifest.phase === 'phase-1', 'phase must be phase-1', errors)
  requireCondition(manifest.status === 'BLOCKED', 'B22 must remain BLOCKED until runtime acceptance', errors)
  requireCondition(manifest.defaultDecision === 'NO-GO', 'B22 default decision must be NO-GO', errors)
  requireCondition(manifest.productionAction === 'disabled', 'production action must be disabled in the static baseline', errors)
  const refs = manifest.designBasis?.architectureRefs ?? []
  for (const ref of ['ARCH-REL-001', 'ARCH-DEP-001', 'ARCH-OBS-001']) requireCondition(refs.includes(ref), `missing architecture reference ${ref}`, errors)
  requireCondition(manifest.designBasis?.upstreamBatch === 'B21', 'B21 must be the upstream batch', errors)
}

function validateB21Prerequisite(prerequisite, errors) {
  requireCondition(prerequisite?.required === true, 'B21 acceptance must be required', errors)
  requireCondition(prerequisite?.status === 'blocked' && prerequisite.currentDecision === 'BLOCKED', 'B21 prerequisite must remain BLOCKED', errors)
  requireCondition(prerequisite?.requiredDecision === 'GO', 'B21 prerequisite must require GO', errors)
  requireCondition(prerequisite?.acceptanceEvidenceStatus === 'pending', 'B21 acceptance evidence must remain pending', errors)
  requireCondition(prerequisite?.missingEvidenceDecision === 'BLOCKED' && prerequisite?.openP0P1Decision === 'BLOCKED', 'B21 missing evidence and open P0/P1 must block', errors)
  requireCondition(prerequisite?.staticEvidenceCannotPromote === true && prerequisite?.syntheticFixtureCannotPromote === true, 'B21 static/synthetic evidence must not promote', errors)
  requireArray(prerequisite?.requiredEvidence, 'B21 required evidence', errors, 5)
}

function validateArtifacts(policy, errors) {
  for (const field of ['requireDigest', 'requireSignature', 'requireSBOM', 'requireProvenance']) requireCondition(policy?.[field] === true, `immutable artifact policy ${field} must be true`, errors)
  requireCondition(policy?.mutableTagAllowed === false, 'mutable tags must be disabled', errors)
  requireCondition(policy?.sameDigestAcrossPromotion === true, 'promotion must use the same digest', errors)
  requireArray(policy?.artifacts, 'immutable artifacts', errors, 5)
  const ids = (policy?.artifacts ?? []).map((item) => item?.id)
  requireCondition(JSON.stringify(ids) === JSON.stringify(['api-gateway', ...expectedPlatforms]), 'gateway and all four platform artifacts must be bound in order', errors)
  unique(ids, 'artifact ids', errors)
  for (const artifact of policy?.artifacts ?? []) {
    requireString(artifact?.image, `${artifact?.id}.image`, errors)
    requireCondition(/^registry\.example\.invalid\/englishflow\/[a-z0-9-]+@sha256:[0-9a-f]{64}$/.test(artifact?.image ?? ''), `${artifact?.id} must use an immutable digest image`, errors)
    requireCondition(/^sha256:[0-9a-f]{64}$/.test(artifact?.digest ?? ''), `${artifact?.id}.digest must be SHA-256`, errors)
    requireCondition(!/(?:latest\b|(?:^|\/)\w[\w-]*:(?!sha256:)[^@\s/]+$)/i.test(artifact?.image ?? ''), `${artifact?.id} contains a mutable artifact reference`, errors)
    requireCondition(artifact?.signatureStatus === 'pending' && artifact?.sbomStatus === 'pending', `${artifact?.id} runtime signature/SBOM must remain pending`, errors)
    requireString(artifact?.signatureRef, `${artifact?.id}.signatureRef`, errors)
    requireString(artifact?.sbomRef, `${artifact?.id}.sbomRef`, errors)
  }
}

function validatePlatformBinding(binding, errors) {
  requireCondition(binding?.status === 'not-established' && binding?.decision === 'NO-GO', 'four-platform binding must remain not-established/NO-GO', errors)
  requireCondition(binding?.sameReleaseIdRequired === true && binding?.sameSourceRevisionRequired === true && binding?.environmentBindingRequired === true, 'four-platform binding policy is incomplete', errors)
  const platforms = binding?.platforms ?? []
  requireCondition(JSON.stringify(platforms.map((item) => item?.platformId)) === JSON.stringify(expectedPlatforms), 'four-platform ids are incomplete or reordered', errors)
  for (const platform of platforms) {
    requireString(platform?.projectPath, `${platform?.platformId}.projectPath`, errors)
    requireString(platform?.versionRef, `${platform?.platformId}.versionRef`, errors)
    requireCondition(/^sha256:[0-9a-f]{64}$/.test(platform?.artifactDigest ?? ''), `${platform?.platformId} artifact digest is invalid`, errors)
    requireCondition(platform?.status === 'pending', `${platform?.platformId} runtime binding must remain pending`, errors)
    requireCondition(typeof platform?.featureFlag === 'string' && platform.featureFlag.endsWith('-release-enabled'), `${platform?.platformId} feature flag is invalid`, errors)
  }
}

function validateFlags(flags, errors) {
  requireCondition(flags?.status === 'disabled' && flags?.failClosed === true, 'feature flags must be disabled and fail-closed', errors)
  requireCondition(flags?.releaseDecision === 'NO-GO' && flags?.b21Acceptance === 'pending', 'feature flag release decision must be NO-GO pending B21', errors)
  const expected = ['canary-enabled', 'controlled-expansion-enabled', ...expectedPlatforms.map((item) => `${item}-release-enabled`)]
  const items = flags?.flags ?? []
  requireCondition(JSON.stringify(items.map((item) => item?.name)) === JSON.stringify(expected), 'feature flag set is incomplete or reordered', errors)
  for (const flag of items) {
    requireCondition(flag?.defaultValue === false && flag?.status === 'disabled' && flag?.requiresAudit === true, `${flag?.name} must default disabled and audited`, errors)
  }
}

function validateCanary(plan, errors) {
  requireCondition(plan?.status === 'blocked', 'canary plan must remain blocked', errors)
  requireCondition(plan?.automaticPromotion === false && plan?.manualApprovalRequired === true && plan?.controlledExpansionDefault === false, 'canary promotion must be manual and closed by default', errors)
  requireCondition(plan?.minimumIndependentApprovals >= 2, 'canary promotion must require independent approvals', errors)
  const stages = plan?.stages ?? []
  requireCondition(JSON.stringify(stages.map((stage) => stage?.trafficPercent)) === JSON.stringify(expectedWeights), 'canary stages must be 1/5/25/50/100 percent', errors)
  for (const stage of stages) requireCondition(stage?.enabled === false && stage?.status === 'blocked' && stage?.decision === 'NO-GO', `${stage?.id} must not be enabled`, errors)
}

function validateChecks(checks, errors) {
  const staticChecks = checks?.staticChecks ?? []
  const runtimeChecks = checks?.runtimeChecks ?? []
  requireArray(staticChecks, 'static pre-release checks', errors, 8)
  requireArray(runtimeChecks, 'runtime pre-release checks', errors, 9)
  unique([...staticChecks, ...runtimeChecks].map((item) => item?.id), 'pre-release check ids', errors)
  for (const check of staticChecks) {
    requireCondition(check?.status === 'defined' && check?.evidenceClass === 'static' && check?.runtimeRequired === false, `${check?.id} static state is invalid`, errors)
    requireArray(check?.sourcePaths, `${check?.id}.sourcePaths`, errors)
    requireArray(check?.assertions, `${check?.id}.assertions`, errors)
    const sourceText = (check?.sourcePaths ?? []).map((sourcePath) => readSource(sourcePath, errors)).join('\n')
    for (const assertion of check?.assertions ?? []) {
      if (typeof assertion?.contains === 'string') requireCondition(sourceText.includes(assertion.contains), `${check?.id} missing source marker ${assertion.contains}`, errors)
      else if (typeof assertion?.regex === 'string') {
        try { requireCondition(new RegExp(assertion.regex, assertion.flags ?? '').test(sourceText), `${check?.id} source regex did not match`, errors) } catch (error) { errors.push(`${check?.id} has invalid source regex: ${error.message}`) }
      } else errors.push(`${check?.id} assertion must contain contains or regex`)
    }
  }
  for (const check of runtimeChecks) {
    requireCondition(['pending', 'blocked'].includes(check?.status) && check?.evidenceClass === 'runtime' && check?.runtimeRequired === true, `${check?.id} runtime state must remain pending/blocked`, errors)
    requireArray(check?.evidenceRequired, `${check?.id}.evidenceRequired`, errors, 2)
    requireArray(check?.cannotBeSatisfiedBy, `${check?.id}.cannotBeSatisfiedBy`, errors, 1)
  }
}

function validateStopConditions(conditions, errors) {
  const ids = (conditions ?? []).map((item) => item?.id)
  const expected = ['p0-or-p1-alert', 'data-integrity-mismatch', 'security-or-privacy-regression', 'error-budget-exhausted', 'alert-routing-or-trace-gap', 'missing-restore-point', 'missing-independent-approval']
  requireCondition(JSON.stringify(ids) === JSON.stringify(expected), 'stop expansion conditions are incomplete or reordered', errors)
  for (const condition of conditions ?? []) requireCondition(/freeze|block/i.test(condition?.action ?? ''), `${condition?.id} must freeze or block expansion`, errors)
}

function validateRollback(rollback, errors) {
  requireCondition(rollback?.automatic?.enabled === true && rollback?.manual?.enabled === true, 'automatic and manual rollback must both be defined', errors)
  requireCondition(rollback?.automatic?.status === 'pending' && rollback?.manual?.status === 'pending', 'rollback runtime status must remain pending', errors)
  requireCondition(rollback?.manual?.requiresNamedOwner === true && rollback?.manual?.requiresIndependentApproval === true && rollback.manual.minimumApprovers >= 2, 'manual rollback governance is incomplete', errors)
  requireCondition(rollback?.restorePoint?.required === true && rollback?.restorePoint?.status === 'not-established' && rollback.restorePoint.createdBeforeTrafficChange === true, 'restore point must be required and not-established', errors)
  requireCondition(rollback?.audit?.required === true && rollback?.audit?.appendOnly === true && rollback.audit.externalSinkRequired === true, 'rollback audit must be append-only and external', errors)
}

function validateRuntimeGate(gate, errors) {
  requireCondition(gate?.staticOnlyByDefault === true && gate?.requireRuntimeEnv === 'B22_REQUIRE_RUNTIME', 'runtime gate must be static-only and use B22_REQUIRE_RUNTIME', errors)
  requireCondition(gate?.runtimeEvidenceMustBeCapturedExternally === true && gate?.staticValidatorCannotPromoteRuntime === true, 'runtime evidence must be external and not promotable by static validator', errors)
  requireCondition(gate?.runtimeStatusWhenMissing === 'blocked', 'missing runtime evidence must block', errors)
  requireArray(gate?.requiredEnv, 'runtime required env', errors, 7)
  unique(gate?.requiredEnv ?? [], 'runtime required env', errors)
  for (const name of gate?.requiredEnv ?? []) requireCondition(/^B22_RUNTIME_[A-Z0-9_]+$/.test(name), `invalid B22 runtime environment variable ${name}`, errors)
  requireArray(gate?.requiredEvidence, 'runtime required evidence', errors, 8)
  for (const boundary of ['static-manifest-only', 'synthetic-fixture-only', 'development-http-200', 'unapproved-traffic-change']) requireCondition(gate?.cannotBeSatisfiedBy?.includes(boundary), `runtime fake-pass boundary missing ${boundary}`, errors)
}

function validateReportSchema(schema, errors) {
  requireCondition(schema?.closed === true && schema?.missingEvidenceDecision === 'NO-GO', 'report schema must be closed and NO-GO on missing evidence', errors)
  requireArray(schema?.required, 'report schema required fields', errors, 10)
}

function validateRuntimeRequest(manifest, env, errors) {
  const requiredEnv = manifest.runtimeGate?.requiredEnv ?? []
  const missing = requiredEnv.filter((name) => !env?.[name])
  if (missing.length > 0) {
    errors.push(`runtime gate blocked; missing environment: ${missing.join(', ')}`)
    return
  }
  for (const name of requiredEnv) requireCondition(!/synthetic|example\.invalid|fixture|replace_with|pending/i.test(String(env[name])), `${name} cannot use a synthetic or placeholder evidence reference`, errors)
  requireCondition(manifest.b21Prerequisite?.status === 'accepted' && manifest.b21Prerequisite?.currentDecision === 'GO', 'runtime gate blocked; B21 Go/No-Go has not been accepted', errors)
  requireCondition(manifest.status === 'READY' && manifest.defaultDecision === 'GO', 'runtime gate blocked; B22 release baseline is not accepted', errors)
  requireCondition((manifest.preReleaseChecks?.runtimeChecks ?? []).every((check) => check.status === 'captured'), 'runtime gate blocked; runtime evidence remains pending or blocked', errors)
  requireCondition((manifest.canaryPlan?.stages ?? []).every((stage) => stage.enabled === true && stage.decision === 'GO'), 'runtime gate blocked; canary stages are not approved', errors)
}

export function validateB22ProductionRollout(manifest, { runtimeRequested = runtimeRequestedByProcess, env = process.env } = {}) {
  const errors = []
  if (!isRecord(manifest)) errors.push('manifest must be a JSON object')
  if (!isRecord(manifest)) return { result: 'FAIL', releaseDecision: 'NO-GO', runtimeGate: runtimeRequested ? 'blocked' : 'static-only', errors }
  scanValue(manifest, 'manifest', errors)
  validateBasis(manifest, errors)
  validateB21Prerequisite(manifest.b21Prerequisite, errors)
  validateArtifacts(manifest.immutableArtifactPolicy, errors)
  validatePlatformBinding(manifest.fourPlatformBinding, errors)
  validateFlags(manifest.featureFlags, errors)
  validateCanary(manifest.canaryPlan, errors)
  validateChecks(manifest.preReleaseChecks, errors)
  validateStopConditions(manifest.stopExpansionConditions, errors)
  validateRollback(manifest.rollback, errors)
  validateRuntimeGate(manifest.runtimeGate, errors)
  validateReportSchema(manifest.reportSchema, errors)
  requireCondition(manifest.evidenceIndex?.some((item) => item.class === 'runtime' && item.status === 'pending' && item.collectionPolicy === 'runtime-runner-only'), 'evidence index must contain pending runtime-only evidence', errors)
  if (runtimeRequested) validateRuntimeRequest(manifest, env, errors)
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    releaseDecision: manifest.defaultDecision,
    status: manifest.status,
    runtimeGate: runtimeRequested ? (errors.length === 0 ? 'accepted' : 'blocked') : 'static-only',
    staticChecks: manifest.preReleaseChecks?.staticChecks?.length ?? 0,
    runtimeChecks: manifest.preReleaseChecks?.runtimeChecks?.length ?? 0,
    errors,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let manifest
  try { manifest = loadManifest() } catch (error) {
    console.error(JSON.stringify({ result: 'FAIL', errors: [`cannot read ${manifestRelativePath}: ${error.message}`] }, null, 2))
    process.exitCode = 1
  }
  if (manifest) {
    const summary = validateB22ProductionRollout(manifest)
    console.log(JSON.stringify(summary, null, 2))
    if (summary.result !== 'PASS') process.exitCode = 1
  }
}
