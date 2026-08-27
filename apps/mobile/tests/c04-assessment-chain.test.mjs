import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..', '..')
const read = (path) => readFile(join(root, path), 'utf8')

test('mobile placement mutations use Gateway paths and idempotency keys', async () => {
  const api = await read('apps/mobile/src/api/learner-content.ts')
  const store = await read('apps/mobile/src/stores/learner-content.ts')
  assert.match(api, /'\/assessment\/placement\/start'/)
  assert.match(api, /'\/assessment\/placement\/submit-step'/)
  assert.match(api, /'Idempotency-Key': input\.clientEventId/)
  assert.match(store, /mobileLearnerContentApi\.submitPlacementAnswer/)
  assert.match(store, /placementStatus\.value === 'loading'/)
})

test('mobile assessment and report pages keep loading and error states visible', async () => {
  const assessment = await read('apps/mobile/src/pages/assessment/assessment.vue')
  const practice = await read('apps/mobile/src/pages/b2-practice/b2-practice.vue')
  const report = await read('apps/mobile/src/pages/b10-report/b10-report.vue')
  assert.match(assessment, /store\.placementStatus === 'loading'/)
  assert.match(assessment, /重新读取/)
  assert.match(practice, /store\.practiceStatus === 'loading'/)
  assert.match(practice, /status\.retry/)
  assert.match(practice, /store\.submitAnswer/)
  assert.match(practice, /规则命中/)
  assert.match(practice, /lastResult\.scoringStatus/)
  assert.match(report, /store\.loadMistakes\(\)/)
  assert.match(report, /store\.loadReport\(reportPeriod\.value\)/)
  assert.match(report, /reportPeriod === 'weekly'/)
  assert.match(report, /store\.reportStatus !== 'ready'/)
  assert.match(report, /mistake\.masteryStatus/)
  assert.match(report, /store\.report\.evidence/)
})
