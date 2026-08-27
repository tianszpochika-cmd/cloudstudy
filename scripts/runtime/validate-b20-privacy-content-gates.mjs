import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const root = path.resolve(path.dirname(scriptPath), '..', '..')
const manifestRelativePath = 'config/b20-privacy-content-gates.json'
const manifestPath = path.join(root, manifestRelativePath)
const runtimeRequested = process.argv.includes('--require-runtime') || process.env.B20_REQUIRE_RUNTIME === '1'
const errors = []

function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath)
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
  } catch (error) {
    errors.push(`cannot read JSON ${relativePath}: ${error.message}`)
    return null
  }
}

function readText(relativePath) {
  const absolutePath = path.join(root, relativePath)
  if (!fs.existsSync(absolutePath)) {
    errors.push(`missing source path ${relativePath}`)
    return ''
  }
  return fs.readFileSync(absolutePath, 'utf8')
}

function requireCondition(condition, message) {
  if (!condition) errors.push(message)
}

function flattenChecks(manifest) {
  return (manifest.gates ?? []).flatMap((gate) => [
    ...(gate.staticChecks ?? []).map((check) => ({ ...check, gateId: gate.id })),
    ...(gate.runtimeChecks ?? []).map((check) => ({ ...check, gateId: gate.id })),
  ])
}

function scanFixtureValues(value, location = '$') {
  if (typeof value === 'string') {
    const forbidden = [
      /Bearer\s+[A-Za-z0-9._~-]+/i,
      /\bsk-[A-Za-z0-9]/i,
      /-----BEGIN [A-Z ]+-----/i,
      /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./,
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
      /(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/,
    ]
    for (const pattern of forbidden) requireCondition(!pattern.test(value), `${location} looks like real PII or a secret`)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) scanFixtureValues(child, `${location}.${key}`)
}

function validateSourceAssertions(check) {
  requireCondition(Array.isArray(check.sourcePaths) && check.sourcePaths.length > 0, `${check.id}: sourcePaths are required`)
  requireCondition(Array.isArray(check.assertions) && check.assertions.length > 0, `${check.id}: assertions are required`)
  const sourceText = (check.sourcePaths ?? []).map((sourcePath) => readText(sourcePath)).join('\n')
  for (const assertion of check.assertions ?? []) {
    if (typeof assertion.contains === 'string') {
      requireCondition(sourceText.includes(assertion.contains), `${check.id}: missing marker ${assertion.contains}`)
    } else if (typeof assertion.regex === 'string') {
      let pattern
      try {
        pattern = new RegExp(assertion.regex, assertion.flags ?? '')
      } catch (error) {
        errors.push(`${check.id}: invalid assertion regex ${assertion.regex}: ${error.message}`)
        continue
      }
      requireCondition(pattern.test(sourceText), `${check.id}: regex did not match ${assertion.regex}`)
    } else {
      errors.push(`${check.id}: assertion must contain contains or regex`)
    }
  }
}

function validateManifest(manifest) {
  requireCondition(manifest?.version === '1.0.0', 'manifest version must be 1.0.0')
  requireCondition(manifest?.batch === 'B20', 'manifest batch must be B20')
  requireCondition(manifest?.phase === 'phase-1', 'manifest must remain Phase 1')
  requireCondition(manifest?.mode === 'static-and-synthetic', 'manifest mode must be static-and-synthetic')
  requireCondition(manifest?.scope === 'privacy-content-only', 'manifest scope must be privacy-content-only')
  requireCondition(manifest?.releaseDecision?.goAllowed === false, 'release decision must remain closed')
  requireCondition(['blocked', 'not-ready'].includes(manifest?.releaseDecision?.status), 'release decision cannot be go')

  const taskIds = (manifest.tasks ?? []).map((task) => task.id)
  requireCondition(JSON.stringify(taskIds) === JSON.stringify(['V2-B20-PRI-002', 'V2-B20-CNT-003']), 'assigned task IDs are incomplete or out of order')

  const runtimeGate = manifest.runtimeGate
  requireCondition(runtimeGate?.staticOnlyByDefault === true, 'runtime gate must be static-only by default')
  requireCondition(runtimeGate?.requireRuntimeEnv === 'B20_REQUIRE_RUNTIME', 'runtime request env must be B20_REQUIRE_RUNTIME')
  requireCondition(runtimeGate?.staticValidatorCannotPromoteRuntime === true, 'static validator must not promote runtime evidence')
  requireCondition(Array.isArray(runtimeGate?.requiredEnv) && runtimeGate.requiredEnv.length >= 4, 'runtime requiredEnv is incomplete')
  requireCondition(new Set(runtimeGate?.requiredEnv ?? []).size === (runtimeGate?.requiredEnv ?? []).length, 'runtime requiredEnv contains duplicates')
  for (const envName of runtimeGate?.requiredEnv ?? []) {
    requireCondition(/^B20_RUNTIME_[A-Z0-9_]+$/.test(envName), `invalid runtime env ${envName}`)
  }
  requireCondition(Array.isArray(runtimeGate?.requiredEvidence) && runtimeGate.requiredEvidence.length >= 4, 'runtime evidence list is incomplete')

  const privacy = manifest.privacy
  requireCondition(privacy?.notice?.required === true && privacy.notice.versioned === true, 'privacy notice must be required and versioned')
  for (const field of ['noticeId', 'policyVersion', 'effectiveAt', 'locale']) {
    requireCondition(privacy.notice.requiredFields.includes(field), `privacy notice missing ${field}`)
  }
  requireCondition(privacy?.consent?.grant?.explicit === true, 'consent grant must be explicit')
  requireCondition(privacy.consent.grant.requiresCurrentPolicyVersion === true, 'consent must bind current policy version')
  requireCondition(privacy.consent.grant.subjectDerivedServerSide === true, 'consent subject must be server-derived')
  requireCondition(privacy.consent.revoke?.supported === true, 'consent revoke must be supported')
  requireCondition(privacy.consent.revoke.createsImmutableFact === true, 'consent revoke must create immutable fact')
  requireCondition(privacy.consent.revoke.doesNotEraseAuditHistory === true, 'consent revoke must preserve audit history')
  requireCondition(privacy.consent.unknownPolicyVersionDecision === 'deny', 'unknown consent policy version must deny')

  requireCondition(privacy.subjectRequests.export.scope === 'self', 'export scope must be self')
  requireCondition(privacy.subjectRequests.export.authorization === 'server-side-pep', 'export must use server-side PEP')
  requireCondition(privacy.subjectRequests.erasure.scope === 'self', 'erasure scope must be self')
  requireCondition(privacy.subjectRequests.erasure.legalHoldBlocksDestructiveStep === true, 'legal hold must block destructive erasure')
  requireCondition(privacy.subjectRequests.erasure.auditFactPreserved === true, 'erasure must preserve minimal audit fact')
  requireCondition(privacy.retention.deletionJobMustBeIdempotent === true, 'retention deletion must be idempotent')
  requireCondition(privacy.retention.deletionScopeMustBeSubjectBound === true, 'retention deletion must be subject-bound')
  requireCondition(privacy.redaction.adminProjectionMustBeRedacted === true, 'admin projection must be redacted')
  requireCondition(privacy.redaction.auditMustUseSafeFieldsOnly === true, 'audit must use safe fields only')
  for (const field of ['password', 'accessToken', 'refreshToken', 'authorizationCode', 'paymentCredential', 'rawAudio']) {
    requireCondition(privacy.redaction.forbiddenOutputFields.includes(field), `redaction must forbid ${field}`)
  }
  requireCondition(privacy.auditReplay.appendOnly === true && privacy.auditReplay.hashChained === true, 'audit must be append-only and hash-chained')
  requireCondition(privacy.auditReplay.integrityCheckRequired === true && privacy.auditReplay.replayable === true, 'audit replay integrity contract is incomplete')
  requireCondition(privacy.auditReplay.rawIdentityStored === false, 'raw identity must not be stored in audit replay evidence')
  requireCondition(privacy.authorization.defaultDecision === 'deny', 'privacy authorization default must deny')
  requireCondition(privacy.authorization.serverSidePepRequired === true, 'privacy authorization must require server-side PEP')
  requireCondition(privacy.authorization.clientRoleHeadersIgnored === true, 'client role headers must be ignored')
  for (const field of ['subjectId', 'tenantId', 'ownerId', 'role', 'permissions']) {
    requireCondition(privacy.authorization.forbiddenClientAuthorityFields.includes(field), `client authority field ${field} must be forbidden`)
  }

  const content = manifest.content
  for (const field of ['sourceCode', 'licenseCode', 'status', 'allowsLearning', 'permittedChannels', 'authorizationEvidenceRef']) {
    requireCondition(content.rights.requiredFields.includes(field), `content rights missing ${field}`)
  }
  requireCondition(content.rights.missingRightsAction === 'deny-publish-and-projection', 'missing rights must deny publish and projection')
  requireCondition(content.rights.cacheCannotOverrideRights === true, 'cache must not override rights')
  for (const state of ['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED']) {
    requireCondition(content.workflow.states.includes(state), `content state missing ${state}`)
  }
  for (const transition of content.workflow.requiredTransitions) {
    requireCondition(content.workflow.states.includes(transition.from) && content.workflow.states.includes(transition.to), `invalid content transition ${transition.from}->${transition.to}`)
  }
  requireCondition(content.workflow.dualReview.required === true, 'content dual review must be required')
  requireCondition(content.workflow.dualReview.reviewersMustBeDistinct === true, 'content reviewers must be distinct')
  requireCondition(content.workflow.dualReview.publisherCannotApproveOwnReview === true, 'publisher self-approval must be denied')
  requireCondition(content.workflow.draftIsolation.publicReadable === false && content.workflow.draftIsolation.learnerReadable === false, 'draft must be isolated')
  requireCondition(content.workflow.rollback.supported === true && content.workflow.rollback.invalidatesProjection === true, 'rollback must invalidate projection')
  requireCondition(content.workflow.unpublish.supported === true && content.workflow.unpublish.invalidatesCache === true, 'unpublish must invalidate cache')
  requireCondition(content.publicProjection.consumerApp === 'apps/official-site', 'official-site must be the public projection consumer')
  requireCondition(content.publicProjection.sourceOfTruth === 'content-service', 'content-service must own public content facts')
  requireCondition(content.publicProjection.readOnly === true && content.publicProjection.noDirectFactWrite === true, 'official projection must be read-only')
  for (const field of ['answer', 'answerRules', 'correctAnswer', 'scoringRule', 'reviewNotes', 'copyrightEvidence']) {
    requireCondition(content.publicProjection.forbiddenFields.includes(field), `public projection must forbid ${field}`)
  }
  requireCondition(content.adminBoundary.commandsGoToContentService === true && content.adminBoundary.adminCannotWriteFactTable === true, 'admin must command content-service and not write facts')

  const fixtures = manifest.syntheticFixtures
  requireCondition(Array.isArray(fixtures?.subjects) && fixtures.subjects.length >= 2, 'synthetic subject fixtures are incomplete')
  requireCondition(Array.isArray(fixtures?.content) && fixtures.content.length >= 2, 'synthetic content fixtures are incomplete')
  requireCondition(fixtures.fixturePolicy === 'synthetic-references-only-no-real-subjects-no-raw-media-no-secrets', 'fixture policy is unsafe or missing')
  for (const subject of fixtures.subjects ?? []) {
    requireCondition(/^subject-ref:\/\/synthetic\/[a-z0-9-]+$/.test(subject.subjectRef), `invalid synthetic subject ref ${subject.id}`)
    requireCondition(/^tenant-ref:\/\/synthetic\/[a-z0-9-]+$/.test(subject.tenantRef), `invalid synthetic tenant ref ${subject.id}`)
  }
  for (const item of fixtures.content ?? []) {
    requireCondition(/^content-ref:\/\/synthetic\/[a-z0-9-]+$/.test(item.contentRef), `invalid synthetic content ref ${item.id}`)
    requireCondition(/^media-ref:\/\/synthetic\/[a-z0-9-]+$/.test(item.mediaRef), `invalid synthetic media ref ${item.id}`)
    requireCondition(/^evidence-ref:\/\/synthetic\/[a-z0-9-]+$/.test(item.authorizationEvidenceRef), `invalid synthetic rights ref ${item.id}`)
  }
  scanFixtureValues(fixtures, '$.syntheticFixtures')

  const checks = flattenChecks(manifest)
  requireCondition(checks.length >= 12, 'privacy/content gate checks are incomplete')
  const evidenceById = new Map((manifest.evidenceIndex ?? []).map((item) => [item.id, item]))
  requireCondition(evidenceById.size === (manifest.evidenceIndex ?? []).length, 'evidence IDs must be unique')
  for (const check of checks) {
    requireCondition(typeof check.id === 'string' && typeof check.evidenceId === 'string', 'each check needs id and evidenceId')
    const evidence = evidenceById.get(check.evidenceId)
    requireCondition(Boolean(evidence), `${check.id}: missing evidence index ${check.evidenceId}`)
    if (check.evidenceClass === 'static') {
      requireCondition(check.status === 'defined', `${check.id}: static check must be defined`)
      requireCondition(check.runtimeRequired === false, `${check.id}: static check cannot require runtime`)
      requireCondition(evidence?.class === 'static' && evidence.status === 'defined' && evidence.runtimeRequired === false, `${check.id}: static evidence state is invalid`)
      validateSourceAssertions(check)
    } else if (check.evidenceClass === 'runtime') {
      requireCondition(check.status === 'pending', `${check.id}: runtime check must remain pending`)
      requireCondition(check.runtimeRequired === true, `${check.id}: runtime check must require runtime`)
      requireCondition(Array.isArray(check.tools) && check.tools.length > 0, `${check.id}: runtime tools are required`)
      requireCondition(Array.isArray(check.evidenceRequired) && check.evidenceRequired.length > 0, `${check.id}: runtime evidence is required`)
      requireCondition(Array.isArray(check.cannotBeSatisfiedBy) && check.cannotBeSatisfiedBy.length > 0, `${check.id}: no-fake-pass boundaries are required`)
      requireCondition(evidence?.class === 'runtime' && evidence.status === 'pending' && evidence.runtimeRequired === true, `${check.id}: runtime evidence must remain pending`)
    } else {
      errors.push(`${check.id}: evidenceClass must be static or runtime`)
    }
  }

  if (runtimeRequested) {
    const missing = (runtimeGate?.requiredEnv ?? []).filter((name) => !process.env[name])
    if (missing.length > 0) {
      errors.push(`runtime gate blocked; missing environment: ${missing.join(', ')}`)
    } else {
      errors.push('runtime evidence is still pending; an approved external runner must capture and review artifacts before any Gate can pass')
    }
  }
}

const manifest = readJson(manifestRelativePath)
if (manifest) validateManifest(manifest)

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR ${error}`)
  process.exitCode = 1
} else {
  const checks = flattenChecks(manifest)
  const staticCount = checks.filter((check) => check.evidenceClass === 'static').length
  const runtimeCount = checks.filter((check) => check.evidenceClass === 'runtime').length
  console.log(JSON.stringify({
    result: 'PASS',
    batch: 'B20',
    scope: 'privacy-content',
    staticChecks: staticCount,
    runtimePending: runtimeCount,
    releaseDecision: manifest.releaseDecision.status,
    runtimeGate: runtimeRequested ? 'blocked' : 'static-only',
  }, null, 2))
}
