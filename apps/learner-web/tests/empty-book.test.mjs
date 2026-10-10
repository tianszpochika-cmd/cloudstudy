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
  test(`${name} separates an empty book and keeps one remediation`, () => {
    assert.equal(api.emptyBook(0, 0).status, 'NOT_PRACTICED')
    assert.equal(api.emptyBook(0, 0).copy, '还没有开始练习')
    assert.equal(api.emptyBook(2, 0).copy, '这次练习都答对了')
    assert.equal(api.emptyBook(0, 0, true).copy, '错题本暂时没有读出来')
    assert.equal(api.emptyBook(1, 1).projectionVersion, 'IT4-MISTAKE-1')
    assert.equal(api.sameRemediation('41', 41), true)
    assert.equal(api.sameRemediation('41', '42'), false)
  })
}

test('both mistake surfaces share the projection and the empty copy', () => {
  const web = readFileSync(resolve('apps/learner-web/src/pages/MistakesPage.vue'), 'utf8')
  const mobile = readFileSync(resolve('apps/mobile/src/pages/b10-report/b10-report.vue'), 'utf8')
  for (const source of [web, mobile]) {
    assert.match(source, /data-empty-book/)
    assert.match(source, /data-projection-version/)
    assert.match(source, /data-remediation/)
    assert.match(source, /emptyBook/)
    assert.match(source, /IT4-MISTAKE-1|PROJECTION_VERSION/)
  }
})
