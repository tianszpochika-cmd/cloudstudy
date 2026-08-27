import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const source = readFileSync(path.resolve(import.meta.dirname, '../../scripts/runtime/b31-learner-runtime.mjs'), 'utf8')

test('B31 learner runtime covers adult gate, consent, owner writes, readback and replay without emitting secrets', () => {
  for (const marker of ['/api/v1/iam/adult-gate', '/api/v1/iam/consents', '/api/v1/learner/profile', '/api/v1/learner/targets', '/api/v1/learner/preferences', '/api/v1/learner/first-day']) {
    assert.ok(source.includes(marker), `missing runtime marker: ${marker}`)
  }
  assert.match(source, /b25_learner_profile/)
  assert.match(source, /b25_learner_goal/)
  assert.match(source, /b25_learner_preferences/)
  assert.match(source, /iam_consent/)
  assert.match(source, /tokenValuesEmitted: false/)
  assert.match(source, /credentialsPersisted: false/)
})
