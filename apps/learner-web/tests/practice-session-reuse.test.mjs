import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('web practice open keeps one idempotency key per session type', () => {
  const source = readFileSync(resolve('apps/learner-web/src/api/b2.ts'), 'utf8')
  assert.match(source, /const stableKey = `b2-practice-session-\$\{sessionType\}`/)
  assert.match(source, /clientSessionRef: stableKey/)
  assert.match(source, /withB2Headers\(\{\}, stableKey\)/)
  assert.match(source, /contentVersionId: 25001/)
})

test('h5 reopens a stored in-progress practice session before creating another', () => {
  const source = readFileSync(resolve('apps/mobile/src/stores/b10-learning.ts'), 'utf8')
  assert.match(source, /practice\.value\?\.sessionId && \['IN_PROGRESS', 'INTERRUPTED', 'CREATED'\]\.includes\(practice\.value\.status\)/)
  assert.match(source, /readAssessmentSession\(context\(\), practice\.value\.sessionId\)/)
})
