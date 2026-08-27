import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const readJson = (relativePath) => JSON.parse(read(relativePath))

const b6TaskIds = [
  'DEV-12-003', 'DEV-12-004', 'DEV-12-006', 'DEV-12-008', 'DEV-12-009', 'DEV-12-010',
  ...Array.from({ length: 7 }, (_, index) => `DEV-13-${String(index + 1).padStart(3, '0')}`),
]

test('B6 backlog is the expected 13-task code-development slice', () => {
  const backlog = read('requirements/backlog/开发实施总纲与功能链条任务分解.md')
  for (const taskId of b6TaskIds) assert.match(backlog, new RegExp(`^\\| ${taskId} \\|.*\\| B6 \\|`, 'm'), `missing B6 task ${taskId}`)
  assert.equal(b6TaskIds.length, 13)
})

test('B6 contract covers quality, reliability and release gate APIs', () => {
  const openapi = readJson('packages/contracts/openapi/v1/openapi.json')
  for (const route of [
    '/api/v1/quality/e2e-runs',
    '/api/v1/quality/security-scans',
    '/api/v1/quality/reliability-runs',
    '/api/v1/data-reliability/drills',
    '/api/v1/release/gates/evaluate',
  ]) assert.ok(openapi.paths[route], `missing B6 route ${route}`)
  for (const retired of ['/api/v1/platform/release-matrix', '/api/v1/platform/builds', '/api/v1/observability/dashboard']) {
    assert.equal(openapi.paths[retired], undefined, `retired B6 route still present: ${retired}`)
  }
  assert.equal(openapi.paths['/api/v1/release/gates/evaluate'].post['x-idempotency'].strategy, 'b6-release-gate-evaluate')
})

test('B6 events and migration retain evidence, alert and release facts', () => {
  const catalog = readJson('packages/contracts/events/v1/catalog.json')
  const eventNames = new Set(catalog.events.map((event) => event.eventName))
  for (const eventName of ['platform.build.registered.v1', 'platform.compatibility.checked.v1', 'quality.e2e.completed.v1', 'quality.security.scan_completed.v1', 'quality.reliability.completed.v1', 'observability.alert.raised.v1', 'data.backup.drill_completed.v1', 'release.gate.evaluated.v1']) assert.ok(eventNames.has(eventName), `missing B6 event ${eventName}`)
  const migration = read('database/mysql/migrations/V0015__create_platform_quality_release_b6.sql')
  for (const table of ['plt_build_artifact', 'plt_platform_check', 'plt_performance_budget', 'plt_accessibility_check', 'qly_e2e_run', 'qly_security_scan', 'qly_reliability_run', 'obs_alert', 'rel_backup_drill', 'rel_release_gate']) assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`))
})

test('B6 frontend and fail-closed release boundary exist', () => {
  const matrix = readJson('config/b6-platform-matrix.json')
  assert.equal(matrix.releaseGate.failClosed, true)
  assert.deepEqual(matrix.performance.levels, ['Ultra', 'High', 'Medium', 'Performance'])
  for (const file of ['apps/learner-web/src/pages/B6PlatformPage.vue', 'apps/learner-web/public/manifest.webmanifest', 'apps/learner-web/public/sw.js', 'apps/mobile/src/pages/b6-platform/b6-platform.vue', 'apps/admin-web/src/views/AdminB6ReleaseView.vue', 'tests/e2e/b6/b6-core-paths.test.mjs']) assert.ok(fs.existsSync(path.join(root, file)), `missing B6 file ${file}`)
  const performance = read('packages/performance/src/index.ts')
  assert.match(performance, /observe\(signal: PerformanceSignal\)/)
  assert.match(performance, /auto.*degrade|shouldDegrade/)
})
