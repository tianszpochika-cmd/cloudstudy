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
    throw new Error('mistake-book must stay dependency free')
  }, module, module.exports)
  return module.exports
}

for (const [name, path] of [
  ['web', 'apps/learner-web/src/domain/mistake-book.ts'],
  ['mobile', 'apps/mobile/src/domain/mistake-book.ts'],
]) {
  const api = load(path)
  test(`${name} separates unknown weakness from evidence and merges one target`, () => {
    assert.equal(api.weaknessView(0).status, 'WEAKNESS_UNKNOWN')
    assert.equal(api.weaknessView(0).copy, '尚不能判断')
    assert.equal(api.weaknessView(2).status, 'EVIDENCE')
    assert.equal(api.ILLEGAL_STAGE, '这个操作现在不能用')
    const merged = api.mergeDelayTargets([
      { mistakeId: 'm-1', stage: 'D1' },
      { mistakeId: 'm-1', stage: 'D7' },
    ])
    assert.equal(merged.length, 1)
    assert.equal(merged[0].stage, 'D1')
  })
}

test('weakness surfaces separate the empty state from the evidence list', () => {
  const web = readFileSync(resolve('apps/learner-web/src/pages/MasteryPage.vue'), 'utf8')
  const mobile = readFileSync(resolve('apps/mobile/src/pages/learn/learn.vue'), 'utf8')
  for (const source of [web, mobile]) {
    assert.match(source, /data-weakness-unknown/)
    assert.match(source, /data-weakness-evidence/)
    assert.match(source, /weaknessView/)
  }
})
