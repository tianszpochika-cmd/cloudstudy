import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)))

const readJson = (relativePath) => JSON.parse(readFileSync(resolve(repoRoot, relativePath), 'utf8'))
const readText = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8')

export const fixture = readJson('tests/b1/fixtures/b1-baseline.fixture.json')
export const openApiFragment = readJson('tests/b1/contracts/dev-02-03-09.openapi.fragment.json')
export const eventFragment = readJson('tests/b1/contracts/dev-02-03-09.events.fragment.json')
export const contentContract = readJson('packages/contracts/fragments/b1-content.openapi.json')
export const supplyChainMigration = readText('database/mysql/migrations/V0008__create_content_supply_chain.sql')

export function assertB1Fixture() {
  assert.equal(fixture.metadata.synthetic, true)
  assert.equal(fixture.metadata.externalServices, false)
  assert.match(fixture.metadata.fixtureId, /^b1_baseline_fixture_/)
  assert.match(fixture.metadata.generatedAt, /^\d{4}-\d{2}-\d{2}T/)

  const actorIds = new Set(Object.values(fixture.actors).map((actor) => actor.userId))
  assert.ok(actorIds.size >= 3)
  for (const actor of Object.values(fixture.actors)) {
    assert.match(actor.tenantId, /^tenant_b1_/)
    assert.match(actor.userId, /^usr_b1_/)
    if (actor.email) assert.match(actor.email, /^[^@]+@example\.test$/)
    if (actor.phoneTail) assert.match(actor.phoneTail, /^\d{4}$/)
  }

  assert.equal(fixture.assessment.questions.length, 10)
  assert.equal(fixture.assessment.responses.length, fixture.assessment.questions.length)
  assert.ok(fixture.assessment.rulesVersion)
  assert.equal(fixture.assessment.scoringMode, 'deterministic-rules')
  assert.deepEqual(
    fixture.assessment.responses.map(({ questionId }) => questionId),
    fixture.assessment.questions.map(({ questionId }) => questionId),
  )
}

export function assertB1Contracts() {
  const acceptanceIds = new Set(fixture.acceptanceMatrix.map(({ id }) => id))
  const operationIds = new Set()
  for (const [path, methods] of Object.entries(openApiFragment.paths)) {
    assert.match(path, /^\/api\/v1\//)
    for (const [method, operation] of Object.entries(methods)) {
      assert.ok(['get', 'post', 'put', 'patch', 'delete'].includes(method))
      assert.ok(operation.operationId)
      assert.equal(operationIds.has(operation.operationId), false, `duplicate operationId: ${operation.operationId}`)
      operationIds.add(operation.operationId)
      for (const acceptanceId of operation['x-b1-acceptance'] ?? []) assert.ok(acceptanceIds.has(acceptanceId), acceptanceId)
      for (const response of Object.values(operation.responses ?? {})) {
        const ref = response?.content?.['application/json']?.schema?.$ref
        if (ref) assert.ok(openApiFragment.components.schemas[ref.split('/').pop()], `${path}: unresolved ${ref}`)
      }
    }
  }
  assert.ok(openApiFragment.paths['/api/v1/assessment/placement/submit-step'].post.parameters.some((p) => p.$ref?.endsWith('/B1IdempotencyKey')))
  assert.equal(openApiFragment.paths['/api/v1/assessment/placement/submit-step'].post['x-idempotency'].required, true)

  for (const [path, methods] of Object.entries(contentContract.paths)) {
    for (const operation of Object.values(methods)) {
      assert.ok(operation.operationId, `content operation missing operationId: ${path}`)
      assert.ok(operation.responses && Object.keys(operation.responses).length > 0)
    }
  }
}

export function assertB1Events() {
  assert.ok(eventFragment.events.length >= 4)
  const names = new Set()
  for (const event of eventFragment.events) {
    assert.match(event.eventName, /\.v1$/)
    assert.equal(names.has(event.eventName), false)
    names.add(event.eventName)
    assert.ok(event.aggregateType && event.aggregateIdField)
    assert.equal(event.compatibility.strategy, 'additive')
    assert.match(event.compatibility.breakingChange, /\.v2$/)
    if (event.eventName === 'auth.device.kicked.v1') assert.match(event.compatibility.consumerRule, /never emit access or refresh token material/i)
    if (event.eventName === 'privacy.export.completed.v1') assert.match(event.compatibility.consumerRule, /never raw export fields/i)
    assert.ok(eventFragment.payloadSchemas[event.payloadSchema.$ref.split('/').pop()])
  }
  const payloads = Object.values(eventFragment.payloadSchemas)
  for (const payload of payloads) {
    assert.equal(payload.additionalProperties, false)
    assert.ok(payload.required?.length)
  }
  const assessmentPayload = eventFragment.payloadSchemas.AssessmentItemSubmitted
  assert.ok(assessmentPayload.required.includes('idempotencyKeyHash'))
  assert.equal('answer' in assessmentPayload.properties, false)
}

export function assertB1Migration() {
  for (const table of ['content_sources', 'content_licenses', 'content_entities', 'content_versions', 'content_version_reviews', 'content_media_signatures', 'content_offline_manifests', 'content_release_audits']) {
    assert.match(supplyChainMigration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`))
  }
  for (const requiredFragment of [
    'chk_content_license_status',
    'chk_content_license_learning',
    'chk_content_version_publish_fields',
    'chk_content_version_reviewers_distinct',
    'chk_content_offline_manifest_item_rights',
    'uk_content_version_number',
  ]) assert.match(supplyChainMigration, new RegExp(requiredFragment))
  assert.doesNotMatch(supplyChainMigration, /\b(DROP|TRUNCATE|DELETE FROM)\b/i)
}

export function assertAssessmentDeterminism() {
  const questions = new Map(fixture.assessment.questions.map((question) => [question.questionId, question]))
  const score = fixture.assessment.responses.reduce((sum, response) => sum + (questions.get(response.questionId).correctAnswer === response.answer ? 10 : 0), 0)
  assert.equal(score, fixture.assessment.expected.score)
  const replayInput = JSON.stringify({ rulesVersion: fixture.assessment.rulesVersion, questions: fixture.assessment.questions, responses: fixture.assessment.responses })
  const digest = createHash('sha256').update(replayInput).digest('hex')
  assert.equal(createHash('sha256').update(replayInput).digest('hex'), digest)
  assert.equal(fixture.assessment.expected.startingPoint, 'B2_REINFORCEMENT')
}

export function assertContentRights() {
  const versions = fixture.content.versions
  const published = versions.find((version) => version.status === 'PUBLISHED')
  assert.ok(published)
  assert.equal(published.learnerVisible, true)
  assert.equal(published.rights.rightsStatus, 'AUTHORIZED')
  assert.ok(published.rights.licenseRef)
  for (const version of versions.filter((item) => item.status !== 'PUBLISHED')) assert.equal(version.learnerVisible, false)
  assert.ok(versions.some((version) => version.rights.rightsStatus === 'PENDING' && version.learnerVisible === false))
  const publish = contentContract.paths['/api/v1/content/{contentId}/versions/{versionId}/publish'].post
  assert.equal(publish['x-idempotency'].required, true)
  assert.ok(contentContract.components.schemas.B1ContentVersion.required.includes('licenseCode'))
  assert.ok(contentContract.components.schemas.B1ContentLicense.required.includes('licenseStatus'))
}

export function assertNoPlaintextSensitiveData() {
  const raw = readText('tests/b1/fixtures/b1-baseline.fixture.json')
  assert.doesNotMatch(raw, /-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----/)
  assert.doesNotMatch(raw, /\b(?:sk|pk|AKIA)[A-Za-z0-9_-]{16,}\b/)
  assert.doesNotMatch(raw, /(?:password|secret|client_secret|access_token|refresh_token)\s*[:=]\s*["'][^"']{8,}["']/i)
  assert.doesNotMatch(raw, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/)
  for (const actor of Object.values(fixture.actors)) if (actor.email) assert.match(actor.email, /@example\.test$/)
}

export function runB1StaticGates() {
  assertB1Fixture()
  assertB1Contracts()
  assertB1Events()
  assertB1Migration()
  assertAssessmentDeterminism()
  assertContentRights()
  assertNoPlaintextSensitiveData()
  return { gates: 7, fixture: fixture.metadata.fixtureId }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  console.log(`B1 static gates passed: ${runB1StaticGates().gates} gates; fixture ${fixture.metadata.fixtureId}.`)
}
