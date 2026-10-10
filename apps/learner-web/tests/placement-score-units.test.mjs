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

function placementPort(response) {
  const module = { exports: {} }
  const require = (name) => {
    if (name === './client') return { ApiError: class extends Error {}, apiClient: { request: async () => ({ data: response }) } }
    if (name === '../domain/learner-content') return { LearnerContentReadModelError: class extends Error {} }
    if (name === '../domain/b1') return { assessmentQuestions: [], createDefaultAssessment: () => ({}), createDefaultOnboarding: () => ({}), dailyQuotaOptions: [], targetGoals: [] }
    throw new Error(`unexpected module: ${name}`)
  }
  new Function('require', 'module', 'exports', compiled)(require, module, module.exports)
  return module.exports.learnerContentPort
}

test('web adapter converts a legacy owner ratio once to a 0..100 display score', async () => {
  const port = placementPort({ status: 'COMPLETED', sessionId: 'legacy-1', report: {
    reportId: 'report-1', sessionId: 'legacy-1', resultKind: 'ASSESSED', score: 0.5, cefrLevel: 'A2',
  } })
  const placement = await port.readPlacement({ contentLocale: 'en-US', sessionId: 'legacy-1' })
  assert.equal(placement.report?.score, 50)
  const assessmentPage = fs.readFileSync(path.join(appRoot, 'src/pages/AssessmentPage.vue'), 'utf8')
  const practicePage = fs.readFileSync(path.join(appRoot, 'src/pages/B2PracticePage.vue'), 'utf8')
  assert.match(assessmentPage, /Math\.round\(report\.score\)/)
  assert.match(practicePage, /Math\.round\(report\.value\?\.score \?\? 0\)/)
})

test('web adapter keeps a skipped baseline separate from measured reports', async () => {
  const port = placementPort({ status: 'SKIPPED', sessionId: 'legacy-2', report: {
    reportId: 'report-2', sessionId: 'legacy-2', resultKind: 'SKIPPED', score: null, cefrLevel: null,
    requestedStartingLevel: { level: 'B1', authority: 'USER_SELECTED_NON_AUTHORITATIVE' },
  } })
  const placement = await port.readPlacement({ contentLocale: 'en-US', sessionId: 'legacy-2' })
  assert.equal(placement.status, 'SKIPPED')
  assert.equal(placement.report, null)
  assert.equal(placement.skipBaseline?.requestedStartingLevel, 'B1')
})

test('web open uses the placement session route and keeps answer fields off the question', async () => {
  const calls = []
  const items = Array.from({ length: 10 }, (_, index) => ({
    itemId: index + 1,
    itemCode: `p1.item.${index + 1}`,
    itemType: index < 3 ? 'VOCABULARY' : index < 6 ? 'GRAMMAR' : index < 8 ? 'READING' : 'LISTENING',
    stem: `Stem ${index + 1}`,
    displayOrder: index + 1,
    options: [{ optionId: 'a', label: 'Alpha' }, { optionId: 'b', label: 'Beta' }],
    answerRule: { correctOption: 'a' },
    correctAnswer: 'a',
    explanation: 'hidden',
  }))
  const module = { exports: {} }
  const require = (name) => {
    if (name === './client') return {
      ApiError: class extends Error {},
      apiClient: { request: async (path, options) => { calls.push({ path, options }); return { data: {
        sessionId: 'asess_open0001', status: 'CREATED', manifest: { totalItemCount: 10 }, currentItem: items[0], items,
      } } } },
    }
    if (name === '../domain/learner-content') return { LearnerContentReadModelError: class extends Error {} }
    if (name === '../domain/b1') return { assessmentQuestions: [], createDefaultAssessment: () => ({}), createDefaultOnboarding: () => ({}), dailyQuotaOptions: [], targetGoals: [] }
    throw new Error(`unexpected module: ${name}`)
  }
  new Function('require', 'module', 'exports', compiled)(require, module, module.exports)
  const port = module.exports.learnerContentPort
  const idle = await port.readPlacement({ contentLocale: 'en-US', sessionId: null })
  assert.equal(idle.status, 'EMPTY')
  assert.equal(calls.length, 0)
  const opened = await port.startPlacement({ contentLocale: 'en-US', clientEventId: 'placement-open-key-0001' })
  assert.equal(calls[0].path, '/assessment/placement/sessions')
  assert.equal(calls[0].options.method, 'POST')
  assert.deepEqual(calls[0].options.body, {})
  assert.equal(calls[0].options.headers['Idempotency-Key'], 'placement-open-key-0001')
  assert.equal(opened.sessionId, 'asess_open0001')
  assert.equal(opened.currentQuestion.stemText, 'Stem 1')
  assert.equal(opened.currentQuestion.options[0].key, 'a')
  assert.equal(opened.currentQuestion.options[0].text, 'Alpha')
  assert.equal(opened.currentQuestion.totalSteps, 10)
  assert.equal(opened.currentQuestion.correctKey, null)
  const serialized = JSON.stringify(opened.currentQuestion)
  assert.equal(serialized.includes('answerRule'), false)
  assert.equal(serialized.includes('correctAnswer'), false)
  assert.equal(serialized.includes('explanation'), false)
  assert.equal(serialized.includes('answer_rule'), false)
  const apiSource = fs.readFileSync(path.join(appRoot, 'src/api/learner-content.ts'), 'utf8')
  const b1Source = fs.readFileSync(path.join(appRoot, 'src/api/b1.ts'), 'utf8')
  assert.equal(apiSource.includes('/assessment/placement/start'), false)
  assert.equal(b1Source.includes('/assessment/placement/start'), false)
  assert.equal(b1Source.includes('/assessment/placement/sessions'), true)
})

test('web receipt keeps FULL or ZERO and a generated report without the answer', async () => {
  const graded = placementPort({
    sessionId: 'asess_scored', status: 'IN_PROGRESS', stateVersion: 2, acceptedSequence: 1, nextSequence: 2,
    outcome: 'FULL', explanation: 'Selected option equals the stored answer rule.', correctOption: 'a',
    nextItem: { itemId: 2, stem: 'Stem 2', displayOrder: 2, options: [{ optionId: 'a', label: 'Alpha' }, { optionId: 'b', label: 'Beta' }] },
  })
  const open = await graded.readPlacement({ contentLocale: 'en-US', sessionId: 'asess_scored' })
  assert.equal(open.responseOutcome, 'FULL')
  assert.equal(open.formalReport, null)
  assert.equal(open.report, null)
  const gradedJson = JSON.stringify(open)
  assert.equal(gradedJson.includes('correctOption'), false)
  assert.equal(gradedJson.includes('Selected option'), false)
  assert.equal(JSON.stringify(open.currentQuestion).includes('correctOption'), false)

  const finished = placementPort({
    sessionId: 'asess_done', status: 'COMPLETED', stateVersion: 11, acceptedSequence: 10, nextSequence: 11,
    completedResult: { reportId: 'rpt_abc', digest: 'abc', itemCount: 10, fullCount: 7, zeroCount: 3, snapshotId: 'snap_1', snapshotHash: 'hash', outcomes: [{ sequence: 1, outcome: 'FULL' }] },
  })
  const placement = await finished.readPlacement({ contentLocale: 'en-US', sessionId: 'asess_done' })
  assert.equal(placement.status, 'COMPLETED')
  assert.equal(placement.report, null)
  assert.equal(placement.responseOutcome, null)
  assert.equal(placement.formalReport.reportId, 'rpt_abc')
  assert.equal(placement.formalReport.fullCount, 7)
  assert.equal(placement.formalReport.itemCount, 10)
  assert.equal(placement.formalReport.outcomes, undefined)
  assert.equal(JSON.stringify(placement.formalReport).includes('correctOption'), false)

  const unscored = placementPort({ sessionId: 'asess_open', status: 'IN_PROGRESS', stateVersion: 2, acceptedSequence: 1, nextSequence: 2, nextItem: { itemId: 2, stem: 'Stem 2', displayOrder: 2, options: [{ optionId: 'a', label: 'Alpha' }] } })
  const pending = await unscored.readPlacement({ contentLocale: 'en-US', sessionId: 'asess_open' })
  assert.equal(pending.responseOutcome, null)
  assert.equal(pending.report, null)
  assert.equal(pending.formalReport, null)
})
