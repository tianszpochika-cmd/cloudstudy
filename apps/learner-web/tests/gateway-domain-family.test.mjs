import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

for (const app of ['learner-web', 'mobile', 'admin-web']) {
  const file = path.resolve(import.meta.dirname, '../..', app, 'src/platform/gateway.ts')
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  const mod = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
  const families = 'clyunedev.com,clyune.com'
  const baked = 'https://api.clyunedev.com/api/v1'

  test(`${app}: API host follows the page's allow-listed domain family`, () => {
    assert.equal(mod.alignApiHostToPage(baked, families, 'learn.clyune.com'), 'https://api.clyune.com/api/v1')
    assert.equal(mod.alignApiHostToPage(baked, families, 'clyune.com'), 'https://api.clyune.com/api/v1')
    assert.equal(mod.alignApiHostToPage(baked, families, 'mobile.clyunedev.com'), baked)
  })

  test(`${app}: unknown hosts and missing allow-list keep the baked URL`, () => {
    assert.equal(mod.alignApiHostToPage(baked, families, 'evil.example.com'), baked)
    assert.equal(mod.alignApiHostToPage(baked, families, 'clyune.com.evil.io'), baked)
    assert.equal(mod.alignApiHostToPage(baked, undefined, 'learn.clyune.com'), baked)
    assert.equal(mod.alignApiHostToPage('https://127.0.0.1:18087/api/v1', families, 'learn.clyune.com'), 'https://127.0.0.1:18087/api/v1')
  })
}
