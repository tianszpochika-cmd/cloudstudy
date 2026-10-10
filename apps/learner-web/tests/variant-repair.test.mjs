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
  test(`${name} closes a repair without claiming mastery`, () => {
    assert.equal(api.closureLabel('MASTERED'), '本次补救已通过')
    assert.equal(api.closureLabel('MASTERED').includes('已掌握'), false)
    assert.equal(api.closureLabel('PENDING_RETRY', api.NO_VARIANT_COPY), api.NO_VARIANT_COPY)
    assert.equal(api.NO_VARIANT_COPY.includes('原题'), true)
  })
}

test('mistake surfaces use the closure label', () => {
  for (const path of [
    'apps/learner-web/src/pages/MistakesPage.vue',
    'apps/mobile/src/pages/b10-report/b10-report.vue',
  ]) {
    const source = readFileSync(resolve(path), 'utf8')
    assert.match(source, /data-closure/)
    assert.match(source, /closureLabel/)
    assert.equal(source.includes('已掌握'), false)
  }
})
