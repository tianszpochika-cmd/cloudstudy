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
  test(`${name} resumes the last received question and stops when content is offline`, () => {
    const fresh = api.resumeView({ received: 0 })
    assert.equal(fresh.index, 1)
    assert.equal(fresh.copy, '上次学到第 1 题，继续')
    assert.equal(fresh.stopped, false)
    const saved = api.resumeView({ resumeIndex: 2, resumeCopy: '上次学到第 2 题，继续' })
    assert.equal(saved.index, 2)
    assert.equal(saved.copy, '上次学到第 2 题，继续')
    const offline = api.resumeView({ contentOffline: true, received: 2 })
    assert.equal(offline.stopped, true)
    assert.equal(offline.index, 0)
    assert.equal(offline.copy, api.OFFLINE_EXIT)
    assert.equal(offline.copy.includes('内容已下线'), true)
  })
}

test('practice surfaces show the resume line and the offline exit', () => {
  for (const path of [
    'apps/learner-web/src/pages/B2PracticePage.vue',
    'apps/mobile/src/pages/b2-practice/b2-practice.vue',
  ]) {
    const source = readFileSync(resolve(path), 'utf8')
    assert.match(source, /data-resume/)
    assert.match(source, /data-offline-exit/)
    assert.match(source, /resumeView/)
  }
})
