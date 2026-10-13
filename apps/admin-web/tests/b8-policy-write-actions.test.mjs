import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = path.resolve(import.meta.dirname, '..')

function load(relativePath, dependencies) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', output)((id) => {
    assert.ok(id in dependencies, `unexpected import: ${id}`)
    return dependencies[id]
  }, module, module.exports)
  return module.exports
}

test('permission page exposes write actions with Chinese copy', () => {
  const mod = load('src/domain/content-release.ts', {})
  const page = mod.permissionPage()
  assert.equal(page.readOnly, false)
  assert.deepEqual(page.writeActions, ['submit', 'approve', 'activate'])
  assert.match(page.copy, /iam\.policy/)
  assert.match(page.writeCopy, /作者不能审批/)
})

test('policy write adapters post to contracted mutation paths', async () => {
  const calls = []
  const api = load('src/api/b8-policy.ts', {
    './client': {
      adminClient: {
        request: async (path, options) => {
          calls.push({ path, method: options?.method, body: options?.body })
          return { ok: true }
        },
      },
    },
  })
  await api.submitB8PolicyVersion('pv-1', 3, '送审说明')
  await api.approveB8PolicyVersion('pv-1', 3, '审批说明')
  await api.activateB8PolicyVersion('pv-1', 4, '激活说明')
  assert.deepEqual(calls.map((c) => [c.method, c.path]), [
    ['POST', '/iam/policy-versions/pv-1/submit'],
    ['POST', '/iam/policy-versions/pv-1/approvals'],
    ['POST', '/iam/policy-versions/pv-1/activate'],
  ])
  assert.equal(calls[0].body.submissionReason, '送审说明')
  assert.equal(calls[0].body.expectedRevision, 3)
})

test('permissions view wires write actions and Chinese disabled reasons', () => {
  const view = fs.readFileSync(path.join(root, 'src/views/AdminPermissionsView.vue'), 'utf8')
  assert.match(view, /data-permission-write-actions/)
  assert.match(view, /iam\.policy\.submit/)
  assert.match(view, /iam\.policy\.approve/)
  assert.match(view, /iam\.policy\.activate/)
  assert.match(view, /当前会话没有 iam\.policy\.submit 权限/)
  assert.match(view, /submitB8PolicyVersion/)
})

test('support view surfaces unavailable Chinese reason for hash-only tickets', () => {
  const view = fs.readFileSync(path.join(root, 'src/views/AdminSupportView.vue'), 'utf8')
  assert.match(view, /unavailableReason/)
  assert.match(view, /历史工单缺少可核验附件/)
  assert.match(view, /transitionSupportTicket/)
})

test('governance domain reflects open disposition copy', () => {
  const mod = load('src/domain/it7-closure.ts', {})
  assert.match(mod.governanceNotice({ casesState: 'HAS_CASES', dispositionOpen: true }), /处置写链已打开/)
  assert.match(mod.governanceNotice({ casesState: 'HAS_CASES', dispositionOpen: false }), /处置写链没有打开/)
  assert.equal(mod.legacyDispositionRefusal({ dispositionOpen: true }), '')
  assert.match(mod.legacyDispositionRefusal({ dispositionOpen: false }), /处置写链没有打开/)
})

test('ticket actions require support.ticket.manage; governance writes require write permission', () => {
  const support = fs.readFileSync(path.join(root, 'src/views/AdminSupportView.vue'), 'utf8')
  assert.match(support, /if \(!session\.can\("support\.ticket\.manage"\)\) return \[\]/)
  assert.doesNotMatch(support, /admin\.support\.read"\)\) return \[\]/)
  const gov = fs.readFileSync(path.join(root, 'src/views/AdminB12GovernanceView.vue'), 'utf8')
  assert.match(gov, /admin\.risk\.write/)
  assert.match(gov, /没有治理写权限/)
})
