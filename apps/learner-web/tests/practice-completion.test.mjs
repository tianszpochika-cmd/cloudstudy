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
    throw new Error('practice-loop must stay dependency free')
  }, module, module.exports)
  return module.exports
}

for (const [name, path] of [
  ['web', 'apps/learner-web/src/domain/practice-loop.ts'],
  ['mobile', 'apps/mobile/src/domain/practice-loop.ts'],
]) {
  const api = load(path)
  test(`${name} does not show a practice reward`, () => {
    assert.equal(api.showPracticeReward(false), false)
    assert.equal(api.showPracticeReward(undefined), false)
    assert.equal(api.showPracticeReward(true), true)
  })
}

test('practice completion surfaces do not mention a reward', () => {
  for (const path of [
    'apps/learner-web/src/pages/B2PracticePage.vue',
    'apps/mobile/src/pages/b2-practice/b2-practice.vue',
  ]) {
    const source = readFileSync(resolve(path), 'utf8')
    assert.match(source, /data-reward-hidden/)
    assert.match(source, /showPracticeReward/)
    assert.equal(source.includes('奖励'), false)
  }
})
