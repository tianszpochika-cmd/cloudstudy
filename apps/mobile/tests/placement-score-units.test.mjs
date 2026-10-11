import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const source = fs.readFileSync(path.join(appRoot, 'src/api/learner-content.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function placementApi(response) {
  const module = { exports: {} }
  const require = (name) => {
    if (name === './client') return { mobileApiClient: { request: async () => ({ data: response }) }, MobileApiError: class extends Error {} }
    if (name === '../stores/session') return { useSessionStore: () => ({ refreshSilently: async () => true }) }
    if (name === '../stores/pinia') return { pinia: {} }
    throw new Error(`unexpected module: ${name}`)
  }
  new Function('require', 'module', 'exports', compiled)(require, module, module.exports)
  return module.exports.mobileLearnerContentApi
}

test('mobile adapter retains the legacy owner ratio and converts it once in the view', async () => {
  const api = placementApi({ status: 'COMPLETED', sessionId: 'legacy-1', report: {
    reportId: 'report-1', sessionId: 'legacy-1', resultKind: 'ASSESSED', score: 0.5, cefrLevel: 'A2',
  } })
  const placement = await api.readPlacement('en-US', 'legacy-1')
  assert.equal(placement.report?.score, 0.5)
  const page = fs.readFileSync(path.join(appRoot, 'src/pages/assessment/assessment.vue'), 'utf8')
  assert.match(page, /placementScorePercent\(report\.value\?\.score\)/)
})

test('mobile adapter never assigns a score or measured level to a skipped baseline', async () => {
  const api = placementApi({ status: 'SKIPPED', sessionId: 'legacy-2', report: {
    reportId: 'report-2', sessionId: 'legacy-2', resultKind: 'SKIPPED', score: null, cefrLevel: null,
    requestedStartingLevel: { level: 'B1', authority: 'USER_SELECTED_NON_AUTHORITATIVE' },
  } })
  const placement = await api.readPlacement('en-US', 'legacy-2')
  assert.equal(placement.report?.score, null)
  assert.equal(placement.report?.cefrLevel, null)
  assert.equal(placement.report?.requestedStartingLevel, 'B1')
})

test('mobile open uses the placement session route and keeps answer fields off the question', async () => {
  const calls = []
  const items = Array.from({ length: 10 }, (_, index) => ({
    itemId: index + 1,
    stem: `Stem ${index + 1}`,
    displayOrder: index + 1,
    itemType: 'VOCABULARY',
    options: [{ optionId: 'a', label: 'Alpha' }, { optionId: 'b', label: 'Beta' }],
    answer_rule: { correctOption: 'a' },
    correctAnswer: 'a',
    explanation: 'hidden',
  }))
  const module = { exports: {} }
  const require = (name) => {
    if (name === './client') return {
      MobileApiError: class extends Error {},
      mobileApiClient: { request: async (path, options) => { calls.push({ path, options }); return { data: {
        sessionId: 'asess_open0001', status: 'CREATED', manifest: { totalItemCount: 10 }, currentItem: items[0], items,
      } } } },
    }
    if (name === '../stores/session') return { useSessionStore: () => ({ refreshSilently: async () => true }) }
    if (name === '../stores/pinia') return { pinia: {} }
    throw new Error(`unexpected module: ${name}`)
  }
  new Function('require', 'module', 'exports', compiled)(require, module, module.exports)
  const api = module.exports.mobileLearnerContentApi
  const idle = await api.readPlacement('en-US', null)
  assert.equal(idle.status, 'EMPTY')
  assert.equal(calls.length, 0)
  const opened = await api.startPlacement('en-US', 'mobile-placement-open-0001')
  assert.equal(calls[0].path, '/assessment/placement/sessions')
  assert.equal(calls[0].options.method, 'POST')
  assert.deepEqual(calls[0].options.data, {})
  assert.equal(calls[0].options.header['Idempotency-Key'], 'mobile-placement-open-0001')
  assert.equal(opened.currentQuestion.stemText, 'Stem 1')
  assert.equal(opened.currentQuestion.totalSteps, 10)
  assert.equal(opened.currentQuestion.options[0].text, 'Alpha')
  const serialized = JSON.stringify(opened.currentQuestion)
  assert.equal(serialized.includes('answer_rule'), false)
  assert.equal(serialized.includes('correctAnswer'), false)
  assert.equal(serialized.includes('explanation'), false)
  assert.equal(source.includes('/assessment/placement/start'), false)
})

test('mobile receipt keeps FULL or ZERO and a generated report without the answer', async () => {
  const graded = placementApi({
    sessionId: 'asess_scored', status: 'IN_PROGRESS', stateVersion: 2, acceptedSequence: 1, nextSequence: 2,
    outcome: 'ZERO', explanation: 'Selected option does not equal the stored answer rule.', correctOption: 'a',
    nextItem: { itemId: 2, stem: 'Stem 2', displayOrder: 2, options: [{ optionId: 'a', label: 'Alpha' }, { optionId: 'b', label: 'Beta' }] },
  })
  const open = await graded.readPlacement('en-US', 'asess_scored')
  assert.equal(open.responseOutcome, 'ZERO')
  assert.equal(open.report, null)
  const gradedJson = JSON.stringify(open)
  assert.equal(gradedJson.includes('correctOption'), false)
  assert.equal(gradedJson.includes('Selected option'), false)

  const finished = placementApi({
    sessionId: 'asess_done', status: 'COMPLETED', stateVersion: 11, acceptedSequence: 10, nextSequence: 11,
    completedResult: { reportId: 'rpt_abc', digest: 'abc', itemCount: 10, fullCount: 7, zeroCount: 3, outcomes: [{ sequence: 1, outcome: 'ZERO' }] },
  })
  const placement = await finished.readPlacement('en-US', 'asess_done')
  assert.equal(placement.report.reportId, 'rpt_abc')
  assert.equal(placement.report.score, null)
  assert.equal(placement.report.cefrLevel, null)
  assert.equal(placement.report.resultKind, 'ASSESSED')
  assert.equal(placement.report.fullCount, 7)
  assert.equal(placement.report.itemCount, 10)
  assert.equal(placement.responseOutcome, null)
  assert.equal(JSON.stringify(placement.report).includes('correctOption'), false)
  assert.equal(JSON.stringify(placement.report).includes('outcomes'), false)

  const unscored = placementApi({ sessionId: 'asess_open', status: 'IN_PROGRESS', stateVersion: 2, acceptedSequence: 1, nextSequence: 2, nextItem: { itemId: 2, stem: 'Stem 2', displayOrder: 2, options: [{ optionId: 'a', label: 'Alpha' }] } })
  const pending = await unscored.readPlacement('en-US', 'asess_open')
  assert.equal(pending.responseOutcome, null)
  assert.equal(pending.report, null)
})
