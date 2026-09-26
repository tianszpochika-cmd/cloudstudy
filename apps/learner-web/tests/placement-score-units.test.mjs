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
  const placement = await port.readPlacement({ contentLocale: 'en-US' })
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
  const placement = await port.readPlacement({ contentLocale: 'en-US' })
  assert.equal(placement.status, 'SKIPPED')
  assert.equal(placement.report, null)
  assert.equal(placement.skipBaseline?.requestedStartingLevel, 'B1')
})
