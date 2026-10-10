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
    throw new Error('review-history must stay dependency free')
  }, module, module.exports)
  return module.exports
}

for (const [name, path] of [
  ['web', 'apps/learner-web/src/domain/review-history.ts'],
  ['mobile', 'apps/mobile/src/domain/review-history.ts'],
]) {
  const api = load(path)
  test(`${name} splits the empty queue and hides other history`, () => {
    assert.equal(api.reviewEmpty(false, true, false).copy, '还没有复习记录')
    assert.equal(api.reviewEmpty(false, true, true).copy, '暂无到期复习')
    assert.equal(api.reviewEmpty(true, true, true).copy, '复习列表暂时没有读出来')
    const kept = api.visibleHistory([
      { disposition: 'COMPLETED' },
      { disposition: 'NEW' },
      { disposition: 'DEFERRED' },
    ])
    assert.deepEqual(kept.map((row) => row.disposition), ['COMPLETED', 'DEFERRED'])
  })
}

test('review pages show the empty copy and only visible history', () => {
  const web = readFileSync(resolve('apps/learner-web/src/pages/LearningLoopPage.vue'), 'utf8')
  const mobile = readFileSync(resolve('apps/mobile/src/pages/learn/learn.vue'), 'utf8')
  for (const source of [web, mobile]) {
    assert.match(source, /data-review-empty/)
    assert.match(source, /data-review-history/)
    assert.match(source, /reviewEmpty/)
  }
})
