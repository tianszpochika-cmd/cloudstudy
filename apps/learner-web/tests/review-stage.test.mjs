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
    throw new Error('review-stage must stay dependency free')
  }, module, module.exports)
  return module.exports
}

for (const [name, path] of [
  ['web', 'apps/learner-web/src/domain/review-stage.ts'],
  ['mobile', 'apps/mobile/src/domain/review-stage.ts'],
]) {
  const api = load(path)
  test(`${name} hides the untrusted code and keeps the stage on a repeated key`, () => {
    assert.equal(api.reviewFailureCopy('409 UNTRUSTED_REVIEW_EVIDENCE'), '这个操作现在不能用')
    assert.equal(api.reviewFailureCopy('复习状态发生变化'), '')
    assert.equal(api.stageAfter('D1', 'D7', true), 'D1')
    assert.equal(api.stageAfter('D1', 'D7', false), 'D7')
  })
}

test('review surfaces map the refusal and do not print the internal code', () => {
  const web = readFileSync(resolve('apps/learner-web/src/pages/LearningLoopPage.vue'), 'utf8')
  const mobile = readFileSync(resolve('apps/mobile/src/pages/learn/learn.vue'), 'utf8')
  const facing = readFileSync(resolve('apps/learner-web/src/platform/user-facing-error.ts'), 'utf8')
  for (const source of [web, mobile, facing]) {
    assert.match(source, /reviewFailureCopy|UNTRUSTED_REVIEW_EVIDENCE/)
    assert.match(source, /这个操作现在不能用|reviewFailureCopy/)
  }
  assert.doesNotMatch(web, />UNTRUSTED_REVIEW_EVIDENCE</)
  assert.doesNotMatch(mobile, />UNTRUSTED_REVIEW_EVIDENCE</)
})
