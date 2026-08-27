import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', '..')
const config = JSON.parse(await readFile(path.join(root, 'config/b19-quality-gates.json'), 'utf8'))

function checks() { return config.qualityGates.flatMap((gate) => [...(gate.staticChecks ?? []), ...(gate.runtimeChecks ?? [])]) }
function runtimeChecks() { return checks().filter((check) => check.evidenceClass === 'runtime') }
function staticChecks() { return checks().filter((check) => check.evidenceClass === 'static') }

test('B19 quality config covers the two assigned tasks and every required quality area', () => {
  assert.equal(config.batch, 'B19')
  assert.equal(config.phase, 'phase-1')
  assert.deepEqual(config.tasks.map((task) => task.id), ['V2-B19-QA-005', 'V2-B19-TEST-006'])
  const gateIds = new Set(config.qualityGates.map((gate) => gate.id))
  for (const id of [
    'B19-QA-005-NETWORK', 'B19-QA-005-PERFORMANCE', 'B19-QA-005-PERFORMANCE-LEVELS',
    'B19-QA-005-ACCESSIBILITY', 'B19-QA-005-I18N-THEME', 'B19-QA-005-STATE-FALLBACK',
    'B19-TEST-006-DEFECTS', 'B19-TEST-006-REGRESSION', 'B19-TEST-006-EVIDENCE', 'B19-TEST-006-REPORT',
  ]) assert.ok(gateIds.has(id), `missing gate ${id}`)
})

test('real tools, devices, network profiles and screen readers remain pending/runtimeRequired', () => {
  const runtime = runtimeChecks()
  assert.ok(runtime.length >= 9)
  for (const check of runtime) {
    assert.equal(check.status, 'pending', `${check.id} must not claim runtime pass`)
    assert.equal(check.runtimeRequired, true, `${check.id} must require runtime`) 
    assert.equal(check.evidenceClass, 'runtime')
    assert.ok(check.tools.length > 0)
    assert.ok(check.targets.length > 0)
    assert.ok(check.evidenceRequired.length > 0)
    assert.ok(check.cannotBeSatisfiedBy.length > 0)
  }
  const tools = runtime.flatMap((check) => check.tools).join(' ')
  for (const marker of ['Lighthouse', 'Playwright', 'NVDA', 'VoiceOver', 'TalkBack', 'Chrome DevTools', 'device']) assert.match(tools, new RegExp(marker, 'i'))
})

test('static checks inspect i18n, design tokens, performance and state contracts without becoming runtime evidence', () => {
  assert.ok(staticChecks().length >= 10)
  for (const check of staticChecks()) {
    assert.equal(check.status, 'defined')
    assert.equal(check.runtimeRequired, false)
    assert.equal(check.evidenceClass, 'static')
    assert.ok(check.sourcePaths?.length || check.kind === 'policy-contract')
    assert.ok(check.assertions?.length > 0)
  }
  const configText = JSON.stringify(config)
  for (const marker of ['networkQuality', 'offlinePrefetch', 'lcpP75Ms', 'interactionResponseP75Ms', 'high-contrast', 'contentLocale', 'empty-fallback', 'memory-cache']) assert.match(configText, new RegExp(marker))
})

test('defect policy blocks open P0/P1 and requires disposition for P2', () => {
  const policy = config.defectPolicy
  assert.deepEqual(policy.severityLevels.map((level) => level.code), ['P0', 'P1', 'P2'])
  assert.equal(policy.severityLevels.find((level) => level.code === 'P0').openAllowed, 0)
  assert.equal(policy.severityLevels.find((level) => level.code === 'P1').openAllowed, 0)
  assert.equal(policy.releaseDecision.p0OpenMustEqual, 0)
  assert.equal(policy.releaseDecision.p1OpenMustEqual, 0)
  assert.equal(policy.releaseDecision.p2RequiresDisposition, true)
  assert.deepEqual(policy.p2Dispositions, ['fix-before-release', 'risk-accepted', 'deferred-with-plan'])
})

test('regression selection always has Phase 1 smoke/static minimums and changed-area rules', () => {
  const selection = config.regressionSelection
  assert.deepEqual(selection.minimumSuites, ['phase1-smoke', 'quality-static'])
  assert.ok(selection.suites.some((suite) => suite.id === 'full-phase1-regression'))
  assert.ok(selection.rules.some((rule) => rule.whenAnyChangedArea.includes('any')))
  for (const rule of selection.rules) assert.ok(rule.includeSuites.length > 0)
})

test('evidence index and automatic report schema are closed and runtime-aware', () => {
  const evidenceIds = new Set(config.evidenceIndex.map((item) => item.id))
  for (const check of checks()) assert.ok(evidenceIds.has(check.evidenceId), `missing evidence ${check.evidenceId}`)
  for (const item of config.evidenceIndex.filter((item) => item.class === 'runtime')) {
    assert.equal(item.status, 'pending')
    assert.equal(item.runtimeRequired, true)
    assert.equal(item.collectionPolicy, 'runtime-runner-only')
  }
  const schema = config.reportSchema.jsonSchema
  assert.equal(schema.type, 'object')
  assert.equal(schema.additionalProperties, false)
  for (const field of ['decision', 'gates', 'defects', 'regressions', 'evidence']) assert.ok(schema.properties[field])
  for (const field of ['schemaVersion', 'reportId', 'batch', 'run', 'decision', 'gates', 'defects', 'regressions', 'evidence']) assert.ok(schema.required.includes(field))
})

test('B19 validator passes the static contract without changing runtime status', () => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/runtime/validate-b19-quality-gates.mjs')], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.match(result.stdout, /"result": "PASS"/)
  assert.match(result.stdout, /"runtimeEvidencePending": \d+/)
})
