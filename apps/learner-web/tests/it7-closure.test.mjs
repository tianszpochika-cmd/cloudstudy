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
    throw new Error('it7 closure copy must stay dependency free')
  }, module, module.exports)
  return module.exports
}

const web = load('apps/learner-web/src/domain/it7-closure.ts')
const mobile = load('apps/mobile/src/domain/it7-closure.ts')
const admin = load('apps/admin-web/src/domain/it7-closure.ts')

const board = {
  ticketCopy: '受控正文尚未批准。',
  supportNumber: 'IT7-abc',
  auditVisible: false,
  auditSharedWithLearner: false,
  privacy: {
    allComplete: false,
    dataDeleted: false,
    longTermCapture: false,
    retentionDays: null,
    workerGap: true,
    deletionCopy: '受理不等于数据已经删除。',
    audioCopy: '不会采集长期原始录音。',
    sessionCopy: '普通退出后可以重新登录。删除申请受理后不会提示登录继续学习。',
  },
}

for (const [name, api] of [['web', web], ['mobile', mobile]]) {
  test(`${name} keeps the closure copy honest`, () => {
    assert.equal(api.ticketNotice(board).includes('尚未批准'), true)
    assert.equal(api.supportNotice(board), '支持编号 IT7-abc')
    assert.equal(api.showsAuditToLearner(board), false)
    const lines = api.privacyNotices(board).join('\n')
    assert.equal(lines.includes('全部完成的处理结果') || lines.includes('还没有全部完成'), true)
    assert.equal(lines.includes('不会采集长期原始录音'), true)
    assert.equal(lines.includes('不会提示登录继续学习'), true)
    assert.equal(lines.includes('受理不等于数据已经删除'), true)
  })
}

test('admin closure copy separates empty, frozen writes and audit', () => {
  assert.equal(admin.governanceNotice({ casesState: 'NO_CASES' }).includes('没有权限'), false)
  assert.equal(admin.governanceNotice({ casesState: 'FORBIDDEN' }).includes('没有查看'), true)
  assert.equal(admin.governanceNotice({ casesState: 'HAS_CASES' }).includes('处置写链没有打开'), true)
  assert.equal(admin.legacyDispositionRefusal({ dispositionOpen: false }).includes('处置写链没有打开'), true)
  assert.equal(admin.legacyDispositionRefusal({ dispositionOpen: true }), '')
  assert.equal(admin.legacyDispositionRefusal(null).includes('已关闭'), true)
  assert.equal(admin.routeNotice({ independentRiskRoute: false }).includes('/risk'), true)
  const audit = admin.auditNotice({
    auditSharedWithLearner: false,
    exportAllowed: false,
    observation: { productionReady: false, anySchemaRollback: false },
  })
  assert.equal(audit.includes('不能标成已可生产发布'), true)
  assert.equal(audit.includes('不能承诺任意数据库变更'), true)
  assert.equal(audit.includes('不提供给学习端'), true)
})

test('learner and admin pages render the closure desk', () => {
  const files = [
    'apps/learner-web/src/pages/SupportPage.vue',
    'apps/learner-web/src/pages/SettingsPage.vue',
    'apps/mobile/src/pages/support/support.vue',
    'apps/mobile/src/pages/settings/settings.vue',
    'apps/admin-web/src/views/AdminB12GovernanceView.vue',
    'apps/admin-web/src/views/AdminAuditView.vue',
    'apps/admin-web/src/router/index.ts',
  ]
  const joined = files.map((path) => readFileSync(resolve(path), 'utf8')).join('\n')
  assert.equal(joined.includes('it7-closure'), true)
  assert.equal(joined.includes('path: "/risk"'), true)
  assert.equal(joined.includes('收口只读'), true)
  const governance = readFileSync(resolve('apps/admin-web/src/views/AdminB12GovernanceView.vue'), 'utf8')
  assert.equal(governance.includes('legacyDispositionRefusal'), true)
  assert.equal(governance.includes('dispositionWritesOpen && risk.canWrite()'), true)
  assert.equal(governance.includes('v-if="dispositionWritesOpen" label="处置"'), true)
  assert.equal(joined.includes('内部审计不提供给学习端'), true)
})
