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

const web = load('apps/learner-web/src/domain/practice-loop.ts')
const mobile = load('apps/mobile/src/domain/practice-loop.ts')

for (const [name, api] of [['web', web], ['mobile', mobile]]) {
  test(`${name} keeps the open rule version and ignores a second click`, () => {
    assert.equal(api.pinnedRuleVersion('grammar.pack', 3), 'grammar.pack:v3')
    assert.equal(api.ILLEGAL_ACTION, '这个操作现在不能用')
    assert.equal(api.acceptSubmission(false), true)
    assert.equal(api.acceptSubmission(true), false)
  })
}

test('practice submit controls stay on one in-flight answer', () => {
  for (const path of [
    'apps/learner-web/src/pages/B2PracticePage.vue',
    'apps/mobile/src/pages/b2-practice/b2-practice.vue',
  ]) {
    const source = readFileSync(resolve(path), 'utf8')
    assert.match(source, /acceptSubmission/)
    assert.match(source, /data-single-submit/)
  }
  const card = readFileSync(resolve('apps/mobile/src/components/b10/B10ExerciseCard.vue'), 'utf8')
  assert.match(card, /if \(props\.disabled\) return/)
})
