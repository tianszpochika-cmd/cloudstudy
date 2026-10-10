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
    throw new Error('closed-practice must stay dependency free')
  }, module, module.exports)
  return module.exports
}

const web = load('apps/learner-web/src/domain/closed-practice.ts')
const mobile = load('apps/mobile/src/domain/closed-practice.ts')

for (const [name, api] of [['web', web], ['mobile', mobile]]) {
  test(`${name} hides a play control without audio and names closed skills`, () => {
    assert.equal(api.vocabPlayable(null), false)
    assert.equal(api.vocabPlayable('  '), false)
    assert.equal(api.vocabPlayable('https://cdn.example/a.mp3'), true)
    assert.equal(api.closedPracticeCopy('listening'), '听力功能暂未开放，可以先做其他练习')
    assert.equal(api.closedPracticeCopy('speaking'), '跟读功能暂未开放，可以先做其他练习')
    assert.equal(api.closedPracticeCopy('writing'), '写作功能暂未开放，可以先做其他练习')
  })
}

test('main navigation drops closed skills and old pages explain how to leave', () => {
  const shell = readFileSync(resolve('apps/learner-web/src/layouts/AppShell.vue'), 'utf8')
  const home = readFileSync(resolve('apps/learner-web/src/pages/HomePage.vue'), 'utf8')
  const grid = readFileSync(resolve('apps/mobile/src/components/MobileFeatureGrid.vue'), 'utf8')
  const learn = readFileSync(resolve('apps/mobile/src/pages/learn/learn.vue'), 'utf8')
  for (const source of [shell, home]) {
    assert.doesNotMatch(source, /b3-listening/)
    assert.doesNotMatch(source, /b3-speaking/)
    assert.doesNotMatch(source, /b3-writing/)
  }
  assert.doesNotMatch(grid, /b11-listening/)
  assert.doesNotMatch(grid, /b11-speaking/)
  assert.doesNotMatch(grid, /b3-writing/)
  assert.doesNotMatch(learn, /b11-listening/)
  assert.doesNotMatch(learn, /b11-speaking/)
  for (const path of [
    'apps/learner-web/src/pages/B3ListeningPage.vue',
    'apps/learner-web/src/pages/B3SpeakingPage.vue',
    'apps/learner-web/src/pages/B3WritingPage.vue',
    'apps/mobile/src/pages/b3-listening/b3-listening.vue',
    'apps/mobile/src/pages/b3-speaking/b3-speaking.vue',
    'apps/mobile/src/pages/b3-writing/b3-writing.vue',
    'apps/mobile/src/pages/b11-listening/b11-listening.vue',
    'apps/mobile/src/pages/b11-speaking/b11-speaking.vue',
  ]) {
    const source = readFileSync(resolve(path), 'utf8')
    assert.match(source, /data-closed-practice/)
    assert.match(source, /data-closed-back/)
    assert.match(source, /暂未开放/)
  }
  const listening = readFileSync(resolve('apps/learner-web/src/pages/B3ListeningPage.vue'), 'utf8')
  assert.match(listening, /class="waveform"/)
  for (const path of [
    'apps/learner-web/src/pages/VocabularyPage.vue',
    'apps/mobile/src/pages/b2-vocabulary/b2-vocabulary.vue',
  ]) {
    const source = readFileSync(resolve(path), 'utf8')
    assert.match(source, /vocabPlayable/)
    assert.match(source, /data-vocab-play/)
    assert.match(source, /data-vocab-silent/)
  }
})
