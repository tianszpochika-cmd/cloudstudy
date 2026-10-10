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
  test(`${name} puts the saved receipt before the words and the next question`, () => {
    const view = api.practiceFeedback({ scoreBucket: 'FULL', received: 1, total: 3 })
    assert.deepEqual(Object.keys(view), ['savedReceipt', 'feedbackText', 'nextQuestion'])
    assert.equal(view.savedReceipt, '已保存')
    assert.equal(view.feedbackText, '正确')
    assert.equal(view.nextQuestion, '下一题：第 2 题')
    const again = api.practiceFeedback({ scoreBucket: 'ZERO', received: 3, total: 3 })
    assert.equal(again.feedbackText, '需要再练')
    assert.equal(again.nextQuestion, '本次练习已完成')
    assert.equal(api.practiceFeedback(null), null)
  })
}

test('practice surfaces render the saved receipt before the words', () => {
  for (const path of [
    'apps/learner-web/src/pages/B3GrammarPage.vue',
    'apps/learner-web/src/pages/B3ReadingPage.vue',
    'apps/learner-web/src/pages/TodayPage.vue',
    'apps/mobile/src/pages/b2-practice/b2-practice.vue',
    'apps/mobile/src/components/b10/B10FeedbackCard.vue',
    'apps/mobile/src/pages/b3-reading/b3-reading.vue',
  ]) {
    const source = readFileSync(resolve(path), 'utf8')
    assert.match(source, /data-save-receipt/)
    assert.match(source, /data-feedback-text/)
    assert.match(source, /data-next-question/)
    const saved = source.indexOf('data-save-receipt')
    const words = source.indexOf('data-feedback-text')
    const next = source.indexOf('data-next-question')
    assert.ok(saved >= 0 && saved < words && words < next, path)
  }
})
