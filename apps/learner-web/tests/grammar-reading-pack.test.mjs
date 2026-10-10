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
    throw new Error('grammar-reading-pack must stay dependency free')
  }, module, module.exports)
  return module.exports
}

const web = load('apps/learner-web/src/domain/grammar-reading-pack.ts')
const mobile = load('apps/mobile/src/domain/grammar-reading-pack.ts')

for (const [name, api] of [['web', web], ['mobile', mobile]]) {
  test(`${name} shows the loaded pack count or the close copy`, () => {
    assert.equal(api.packNotice('GRAMMAR', 3), '本次语法练习 3 道')
    assert.equal(api.packNotice('GRAMMAR', 1), '本次语法练习 1 道')
    assert.equal(api.packNotice('READING', 2), '本次阅读练习 2 道')
    assert.equal(api.packNotice('READING', 0), null)
    assert.equal(api.packNotice('GRAMMAR', 4, 'CLOSED_MISSING'), '这组题还没备齐，本次练习已关闭。')
    assert.equal(api.mentionsClosedMissing({ detail: 'CLOSED_MISSING' }), true)
    assert.equal(api.mentionsClosedMissing({ message: '请求失败（HTTP 409）' }), false)
    assert.equal(api.packNotice('READING', 2, '这组题还没备齐，本次练习已关闭。'), '这组题还没备齐，本次练习已关闭。')
  })
}

test('grammar and reading pages show the pack notice', () => {
  for (const path of [
    'apps/learner-web/src/pages/B3GrammarPage.vue',
    'apps/learner-web/src/pages/B3ReadingPage.vue',
    'apps/mobile/src/pages/b3-grammar/b3-grammar.vue',
    'apps/mobile/src/pages/b3-reading/b3-reading.vue',
  ]) {
    const source = readFileSync(resolve(path), 'utf8')
    assert.match(source, /data-pack-notice/)
    assert.match(source, /packNotice\(/)
  }
})
