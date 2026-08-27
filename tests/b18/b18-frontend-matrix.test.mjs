import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..')
const matrix = JSON.parse(await readFile(join(root, 'config/b18-frontend-test-matrix.json'), 'utf8'))

test('B18 synthetic account matrix contains no credentials or client authority facts', () => {
  assert.equal(matrix.applications.length, 4)
  assert.equal(matrix.accounts.length, 4)
  assert.deepEqual(matrix.applications.map((app) => app.id), ['learner-web', 'mobile', 'admin-web', 'official-site'])
  assert.equal(matrix.applications.find((app) => app.id === 'official-site').auth, 'public-only')
  assert.doesNotMatch(JSON.stringify(matrix.accounts), /password|secret|token|credential|authorization/i)
  assert.doesNotMatch(JSON.stringify(matrix), /ai-orchestrator|realtime-voice|guardian-service|institution-service/i)
})
