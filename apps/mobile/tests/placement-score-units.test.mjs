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
  const placement = await api.readPlacement()
  assert.equal(placement.report?.score, 0.5)
  const page = fs.readFileSync(path.join(appRoot, 'src/pages/assessment/assessment.vue'), 'utf8')
  assert.match(page, /Math\.round\(report\.value\.score \* 100\)/)
})

test('mobile adapter never assigns a score or measured level to a skipped baseline', async () => {
  const api = placementApi({ status: 'SKIPPED', sessionId: 'legacy-2', report: {
    reportId: 'report-2', sessionId: 'legacy-2', resultKind: 'SKIPPED', score: null, cefrLevel: null,
    requestedStartingLevel: { level: 'B1', authority: 'USER_SELECTED_NON_AUTHORITATIVE' },
  } })
  const placement = await api.readPlacement()
  assert.equal(placement.report?.score, null)
  assert.equal(placement.report?.cefrLevel, null)
  assert.equal(placement.report?.requestedStartingLevel, 'B1')
})
