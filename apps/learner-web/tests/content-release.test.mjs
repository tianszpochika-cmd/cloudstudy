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
    throw new Error('content-release must stay dependency free')
  }, module, module.exports)
  return module.exports
}

const clients = ['apps/learner-web/src/domain/content-release.ts', 'apps/mobile/src/domain/content-release.ts', 'apps/admin-web/src/domain/content-release.ts'].map(load)

test('simple mode is the default and does not invent a second signature', () => {
  for (const api of clients) {
    assert.equal(api.defaultMode(), 'SIMPLE')
    assert.match(api.modeCopy('SIMPLE'), /没有第二审签名/)
    assert.match(api.modeCopy('DUAL'), /两个不同的人/)
  }
})

test('submission gaps, catalog states, and media boundary stay explicit', () => {
  for (const api of clients) {
    assert.equal(api.gapCopy('copyright'), '版权还没有绑定到这个版本')
    assert.equal(api.gapCopy('reviewReport'), '审核报告还没有绑定到这个版本和当前模式')
    assert.equal(api.gapCopy('media'), '必要媒体的对象字节还没有接上')
    assert.match(api.catalogCopy('PUBLISHING'), /还看不到/)
    assert.match(api.catalogCopy('SYNC_FAILED'), /不会把未同步/)
    assert.equal(api.mediaBoundary(false, true).publishable, false)
    assert.match(api.b3ReplayCopy(), /不能再执行一遍/)
  }
})

test('dashboard and permission pages do not invent numbers or write actions', () => {
  for (const api of clients) {
    assert.equal(api.dashboardMetric('ZERO', null).value, 0)
    assert.equal(api.dashboardMetric('EMPTY', 12).value, null)
    assert.equal(api.dashboardMetric('COMPUTING', 12).value, null)
    assert.equal(api.dashboardMetric('FAILED', 12).text, '读取失败')
    assert.deepEqual(api.permissionPage().writeActions, [])
    assert.match(api.loginFailureCopy(), /不会说明账号是否存在/)
    assert.equal(api.loginReturn('/dashboard', ['/dashboard']), '/dashboard')
    assert.equal(api.loginReturn('/missing', ['/permissions']), '/permissions')
    assert.equal(api.learnerAuthoringActions().length, 0)
    assert.match(api.shelfNote([{ summary: '你正在学习的是已锁定的第 1 版。新版本不会替换这一版。' }]), /已锁定/)
    assert.equal(api.shelfNote([{ summary: '目录已同步，可以学习。' }]), '')
  }
})
