import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..', '..')
const read = (path) => readFile(join(root, path), 'utf8')

test('mobile placement mutations use Gateway paths and idempotency keys', async () => {
  const api = await read('apps/mobile/src/api/learner-content.ts')
  const store = await read('apps/mobile/src/stores/learner-content.ts')
  assert.match(api, /'\/assessment\/placement\/sessions'/)
  assert.match(api, /\/assessment\/placement\/sessions\/\$\{encodeURIComponent\(input\.sessionId\)\}\/responses/)
  assert.match(api, /'Idempotency-Key': idempotencyKey/)
  assert.match(store, /mobileLearnerContentApi\.submitPlacementAnswer/)
  assert.match(store, /placementStatus\.value === 'loading'/)
})

test('mobile assessment and report pages keep loading and error states visible', async () => {
  const assessment = await read('apps/mobile/src/pages/assessment/assessment.vue')
  const practice = await read('apps/mobile/src/pages/b2-practice/b2-practice.vue')
  const report = await read('apps/mobile/src/pages/b10-report/b10-report.vue')
  assert.match(assessment, /store\.placementStatus === 'loading'/)
  assert.match(assessment, /重新读取/)
  assert.match(assessment, /共 10 道题。用来了解你现在的英语起点，方便安排后面的学习。/)
  assert.match(assessment, /报告已生成/)
  assert.match(assessment, /@click="retest">重测/)
  assert.doesNotMatch(assessment, /重测尚未接通/)
  assert.match(assessment, /水平尚未验证/)
  assert.doesNotMatch(assessment, /历史两题练习结果|正确选项|3 分钟|已存本机|可离线答完/)
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
