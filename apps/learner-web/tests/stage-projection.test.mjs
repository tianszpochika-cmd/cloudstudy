import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

function load(path) {
  const source = readFileSync(resolve(path), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(() => {
    throw new Error('stage-projection must stay dependency free')
  }, module, module.exports)
  return module.exports
}

for (const [name, path] of [
  ['web', 'apps/learner-web/src/domain/stage-projection.ts'],
  ['mobile', 'apps/mobile/src/domain/stage-projection.ts'],
]) {
  const api = load(path)
  test(`${name} keeps the newer stage and allows unique attempts to differ in count`, () => {
    assert.equal(api.STAGE_PROJECTION, 'IT4-STAGE-1')
    assert.equal(api.acceptStage('D7', 2, 'D1', 1), 'D7')
    assert.equal(api.acceptStage('D7', 2, 'MASTERED', 3), 'MASTERED')
    assert.equal(api.sameStageReadback({ stage: 'D1', projectionVersion: 'IT4-STAGE-1' }, { stage: 'D1', projectionVersion: 'IT4-STAGE-1' }), true)
    assert.equal(api.reconciled(['attempt-1', 'attempt-2'], 1, 4), true)
    assert.equal(api.reconciled(['attempt-1', 'attempt-1'], 1, 4), false)
  })
}

test('both clients show the server stage projection', () => {
  const web = readFileSync(resolve('apps/learner-web/src/pages/LearningLoopPage.vue'), 'utf8')
  const mobile = readFileSync(resolve('apps/mobile/src/pages/learn/learn.vue'), 'utf8')
  for (const source of [web, mobile]) {
    assert.match(source, /data-stage-projection/)
    assert.match(source, /data-stage/)
    assert.match(source, /STAGE_PROJECTION/)
  }
})
