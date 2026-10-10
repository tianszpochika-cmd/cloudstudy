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
  test(`${name} keeps only a zero practice in the book`, () => {
    assert.equal(api.entersMistakeBook('ZERO'), true)
    assert.equal(api.entersMistakeBook('FULL'), false)
    assert.equal(api.entersMistakeBook('PARTIAL'), false)
    assert.equal(api.ZERO_ONLY_COPY, '错题本只保留整次答错的练习。')
  })
}

test('mistake surfaces say the book keeps only a missed practice', () => {
  for (const path of [
    'apps/learner-web/src/pages/MistakesPage.vue',
    'apps/mobile/src/pages/b10-report/b10-report.vue',
  ]) {
    const source = readFileSync(resolve(path), 'utf8')
    assert.match(source, /data-zero-only/)
    assert.match(source, /ZERO_ONLY_COPY/)
  }
})
