import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..', '..')
const manifestPath = path.join(root, 'config/b20-privacy-content-gates.json')
const validatorPath = path.join(root, 'scripts/runtime/validate-b20-privacy-content-gates.mjs')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

function checks() {
  return manifest.gates.flatMap((gate) => [
    ...(gate.staticChecks ?? []),
    ...(gate.runtimeChecks ?? []),
  ])
}

function runtimeChecks() {
  return checks().filter((check) => check.evidenceClass === 'runtime')
}

function staticChecks() {
  return checks().filter((check) => check.evidenceClass === 'static')
}

test('B20 privacy/content manifest is Phase 1, scoped to the two assigned tasks, and closed by default', () => {
  assert.equal(manifest.batch, 'B20')
  assert.equal(manifest.phase, 'phase-1')
  assert.equal(manifest.mode, 'static-and-synthetic')
  assert.deepEqual(manifest.tasks.map((task) => task.id), ['V2-B20-PRI-002', 'V2-B20-CNT-003'])
  assert.equal(manifest.releaseDecision.goAllowed, false)
  assert.equal(manifest.runtimeGate.staticOnlyByDefault, true)
  assert.equal(manifest.runtimeGate.staticValidatorCannotPromoteRuntime, true)
})

test('privacy contract covers notice versioning, consent withdrawal, subject requests, retention, redaction and replay', () => {
  const privacy = manifest.privacy
  assert.equal(privacy.notice.versioned, true)
  assert.deepEqual(privacy.consent.requiredTypes, ['TERMS_OF_SERVICE', 'PRIVACY_NOTICE'])
  assert.equal(privacy.consent.grant.requiresCurrentPolicyVersion, true)
  assert.equal(privacy.consent.revoke.createsImmutableFact, true)
  assert.equal(privacy.consent.revoke.doesNotEraseAuditHistory, true)
  assert.equal(privacy.subjectRequests.export.scope, 'self')
  assert.equal(privacy.subjectRequests.export.idempotencyRequired, true)
  assert.equal(privacy.subjectRequests.erasure.legalHoldBlocksDestructiveStep, true)
  assert.equal(privacy.retention.deletionJobMustBeIdempotent, true)
  assert.equal(privacy.redaction.adminProjectionMustBeRedacted, true)
  for (const field of ['password', 'accessToken', 'refreshToken', 'rawAudio']) assert.ok(privacy.redaction.forbiddenOutputFields.includes(field))
  assert.equal(privacy.auditReplay.appendOnly, true)
  assert.equal(privacy.auditReplay.hashChained, true)
  assert.equal(privacy.auditReplay.rawIdentityStored, false)
  assert.equal(privacy.authorization.defaultDecision, 'deny')
  assert.equal(privacy.authorization.clientRoleHeadersIgnored, true)
  for (const field of ['subjectId', 'tenantId', 'ownerId', 'role', 'permissions']) assert.ok(privacy.authorization.forbiddenClientAuthorityFields.includes(field))
})

test('content contract covers rights, draft isolation, two-person review, publication, withdrawal, rollback and official projection', () => {
  const content = manifest.content
  for (const field of ['sourceCode', 'licenseCode', 'status', 'allowsLearning', 'permittedChannels', 'authorizationEvidenceRef']) {
    assert.ok(content.rights.requiredFields.includes(field))
  }
  assert.equal(content.rights.missingRightsAction, 'deny-publish-and-projection')
  assert.deepEqual(content.workflow.dualReview.stages, ['FIRST_REVIEW', 'FINAL_REVIEW'])
  assert.equal(content.workflow.dualReview.reviewersMustBeDistinct, true)
  assert.equal(content.workflow.dualReview.publisherCannotApproveOwnReview, true)
  assert.equal(content.workflow.draftIsolation.publicReadable, false)
  assert.equal(content.workflow.rollback.invalidatesProjection, true)
  assert.equal(content.workflow.unpublish.withdrawalPropagatesToOfficialSite, true)
  assert.equal(content.publicProjection.consumerApp, 'apps/official-site')
  assert.equal(content.publicProjection.sourceOfTruth, 'content-service')
  assert.equal(content.publicProjection.readOnly, true)
  assert.equal(content.publicProjection.noDirectFactWrite, true)
  for (const field of ['answer', 'answerRules', 'correctAnswer', 'reviewNotes', 'copyrightEvidence']) assert.ok(content.publicProjection.forbiddenFields.includes(field))
})

test('fixtures are synthetic references only and contain no real PII, raw media or credentials', () => {
  const fixtures = manifest.syntheticFixtures
  assert.equal(fixtures.fixturePolicy, 'synthetic-references-only-no-real-subjects-no-raw-media-no-secrets')
  assert.ok(fixtures.subjects.every((subject) => subject.subjectRef.startsWith('subject-ref://synthetic/')))
  assert.ok(fixtures.content.every((content) => content.contentRef.startsWith('content-ref://synthetic/')))
  assert.ok(fixtures.content.every((content) => content.mediaRef.startsWith('media-ref://synthetic/')))
  const serialized = JSON.stringify(fixtures)
  assert.doesNotMatch(serialized, /Bearer\s+|\bsk-[A-Za-z0-9]|-----BEGIN |@[^\s]+\.[^\s]+/i)
  assert.doesNotMatch(serialized, /(?:^|\D)(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|\D)/)
})

test('static checks have source/evidence contracts and runtime checks remain pending', () => {
  assert.ok(staticChecks().length >= 7)
  assert.ok(runtimeChecks().length >= 7)
  const evidence = new Map(manifest.evidenceIndex.map((item) => [item.id, item]))
  for (const check of staticChecks()) {
    assert.equal(check.status, 'defined')
    assert.equal(check.runtimeRequired, false)
    assert.ok(check.sourcePaths.length > 0)
    assert.ok(check.assertions.length > 0)
    assert.equal(evidence.get(check.evidenceId).status, 'defined')
  }
  for (const check of runtimeChecks()) {
    assert.equal(check.status, 'pending')
    assert.equal(check.runtimeRequired, true)
    assert.ok(check.tools.length > 0)
    assert.ok(check.evidenceRequired.length > 0)
    assert.ok(check.cannotBeSatisfiedBy.length > 0)
    assert.equal(evidence.get(check.evidenceId).status, 'pending')
  }
})

test('validator passes static contract and refuses to promote runtime evidence', () => {
  const staticResult = spawnSync(process.execPath, [validatorPath], { cwd: root, encoding: 'utf8' })
  assert.equal(staticResult.status, 0, staticResult.stdout + staticResult.stderr)
  assert.match(staticResult.stdout, /"result": "PASS"/)
  assert.match(staticResult.stdout, /"runtimePending": \d+/)

  const environment = { ...process.env, B20_REQUIRE_RUNTIME: '1' }
  for (const name of manifest.runtimeGate.requiredEnv) delete environment[name]
  const runtimeResult = spawnSync(process.execPath, [validatorPath, '--require-runtime'], {
    cwd: root,
    encoding: 'utf8',
    env: environment,
  })
  assert.notEqual(runtimeResult.status, 0)
  assert.match(runtimeResult.stderr, /runtime gate blocked; missing environment/)
})
