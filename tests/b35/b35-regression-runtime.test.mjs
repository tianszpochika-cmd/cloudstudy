import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const source = readFileSync(path.join(root, 'scripts/runtime/b35-regression-runtime.mjs'), 'utf8')

test('B35 regression runner covers fail-closed authority and infrastructure evidence', () => {
  assert.match(source, /forged-authority/)
  assert.match(source, /malformed-bearer/)
  assert.match(source, /yuxuexing-local-redis-1/)
  assert.match(source, /kafkaTopicCount/)
  assert.match(source, /tokenValuesEmitted: false/)
})

test('B35 persistence runner verifies owner facts after a full Java service restart', () => {
  const persistence = readFileSync(path.join(root, 'scripts/runtime/b35-persistence-runtime.mjs'), 'utf8')
  assert.match(persistence, /iam_external_identity/)
  assert.match(persistence, /b25_learning_srs_state/)
  assert.match(persistence, /b25_assessment_report/)
  assert.match(persistence, /credentialsPersisted: false/)
})
