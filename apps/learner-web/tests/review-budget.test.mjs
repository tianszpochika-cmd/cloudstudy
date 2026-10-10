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
    throw new Error('plan-today must stay dependency free')
  }, module, module.exports)
  return module.exports
}

for (const [name, path] of [
  ['web', 'apps/learner-web/src/domain/plan-today.ts'],
  ['mobile', 'apps/mobile/src/domain/plan-today.ts'],
]) {
  const api = load(path)
  test(`${name} keeps every due item and postpones the overflow`, () => {
    assert.deepEqual(api.arrangeBudget(4, 10), ['DUE', 'DUE', 'DEFERRED', 'DEFERRED'])
    assert.equal(api.ALGORITHM_VERSION, 'SM2_Q03_V1')
    assert.equal(api.arrangementLabel('DEFERRED'), '今天排不下，已顺延，这不是欠账。')
    assert.equal(api.arrangementLabel('DUE'), '到期复习')
    const parsed = api.parsePlanTodayQueue({
      data: {
        targetMinutes: 5,
        emptyReason: 'READY',
        algorithmVersion: 'SM2_Q03_V1',
        items: [{ itemId: 'a' }, { itemId: 'b' }],
      },
    })
    assert.equal(parsed.emptyReason, 'READY')
    assert.equal(parsed.arrangements.length, 2)
    assert.equal(parsed.arrangements[1].arrangement, 'DEFERRED')
    assert.equal(parsed.algorithmVersion, 'SM2_Q03_V1')
  })
}

test('today pages show the algorithm and each arrangement', () => {
  const web = readFileSync(resolve('apps/learner-web/src/pages/TodayPage.vue'), 'utf8')
  const mobile = readFileSync(resolve('apps/mobile/src/pages/today/today.vue'), 'utf8')
  for (const source of [web, mobile]) {
    assert.match(source, /data-algorithm/)
    assert.match(source, /data-arrangement/)
    assert.match(source, /arrangementLabel/)
    assert.doesNotMatch(source, /欠账堆积/)
  }
})
