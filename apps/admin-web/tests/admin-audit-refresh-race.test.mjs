import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { compileScript, parse } from 'vue/compiler-sfc'
import * as Vue from 'vue'

function deferred() {
  let resolve, reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

function auditView(responses) {
  const source = readFileSync(resolve(import.meta.dirname, '../src/views/AdminAuditView.vue'), 'utf8')
  const { descriptor } = parse(source)
  const script = compileScript(descriptor, { id: 'uat-admin-audit-refresh' }).content
  const code = ts.transpileModule(script, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const session = Vue.reactive({
    accessToken: 'token-a', principal: { subject: 'auditor-a' },
    permissions: ['admin.audit.read'], isAuthenticated: true,
    can(permission) { return this.permissions.includes(permission) },
  })
  const calls = []
  const dependencies = {
    vue: { ...Vue, onMounted: () => {}, onUnmounted: () => {} },
    '../platform/list-view': { useListView: (rows) => ({
      query: Vue.ref(''), page: Vue.ref(1), pageSize: Vue.ref(20),
      filtered: Vue.computed(() => rows.value), visible: Vue.computed(() => rows.value),
    }) },
    '../platform/experience': { ui: (key) => key },
    '../components/AdminPageIntro.vue': {},
    '../api/b5': { searchAuditLogs: (cursor, pageSize) => {
      calls.push({ cursor, pageSize })
      return responses.shift().promise
    } },
    '../domain/b5': { toAudit: (row) => row },
    '../platform/v2-foundation': { adminI18n: { locale: 'zh-CN' } },
    '../stores/admin': { useAdminStore: () => session },
  }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)((id) => {
    assert.ok(id in dependencies, `unexpected dependency: ${id}`)
    return dependencies[id]
  }, module, module.exports)
  return { view: module.exports.default.setup({}, { expose() {} }), session, calls }
}

function page(items, nextCursor = null) { return { items, nextCursor } }
function item(auditId) { return { auditId, redacted: true } }

test('older audit refresh and error cannot replace a newer result', async () => {
  const older = deferred(), newer = deferred(), staleError = deferred(), latest = deferred()
  const { view } = auditView([older, newer, staleError, latest])
  const first = view.load()
  const second = view.load()
  newer.resolve(page([item('new')]))
  await second
  older.resolve(page([item('old')]))
  await first
  assert.deepEqual(view.rows.value.map((row) => row.auditId), ['new'])

  const third = view.load()
  const fourth = view.load()
  latest.resolve(page([item('latest')]))
  await fourth
  staleError.reject(new Error('old outage'))
  await third
  assert.deepEqual(view.rows.value.map((row) => row.auditId), ['latest'])
  assert.equal(view.errorMessage.value, '')
  assert.equal(view.loading.value, false)
})

test('loads 20 plus another page without duplicates and recovers after a page error', async () => {
  const first = deferred(), failed = deferred(), retry = deferred()
  const { view, calls } = auditView([first, failed, retry])
  const loading = view.load()
  first.resolve(page(Array.from({ length: 20 }, (_, index) => item(`audit-${index + 1}`)), 'cursor-20'))
  await loading
  assert.equal(view.rows.value.length, 20)
  assert.equal(view.nextCursor.value, 'cursor-20')

  const failure = view.loadMore()
  failed.reject(new Error('暂时不可用'))
  await failure
  assert.equal(view.rows.value.length, 20)
  assert.equal(view.nextCursor.value, 'cursor-20')
  assert.ok(view.moreError.value)

  const recovering = view.loadMore()
  retry.resolve(page([item('audit-20'), ...Array.from({ length: 6 }, (_, index) => item(`audit-${index + 21}`))]))
  await recovering
  assert.equal(view.rows.value.length, 26)
  assert.equal(new Set(view.rows.value.map((row) => row.auditId)).size, 26)
  assert.equal(view.nextCursor.value, null)
  assert.equal(view.moreError.value, '')
  assert.deepEqual(calls.map((call) => call.cursor), [undefined, 'cursor-20', 'cursor-20'])
  assert.ok(calls.every((call) => call.pageSize === 20))
})

test('refresh and filter changes discard a late page; account changes discard old results', async () => {
  const first = deferred(), oldPage = deferred(), refreshed = deferred(), filteredPage = deferred(), accountPage = deferred()
  const { view, session } = auditView([first, oldPage, refreshed, filteredPage, accountPage])
  const loading = view.load()
  first.resolve(page([item('a-1')], 'cursor-a'))
  await loading

  const loadingMore = view.loadMore()
  const refreshing = view.load()
  refreshed.resolve(page([item('a-new')], 'cursor-new'))
  await refreshing
  oldPage.resolve(page([item('a-old')]))
  await loadingMore
  assert.deepEqual(view.rows.value.map((row) => row.auditId), ['a-new'])

  const filterLoading = view.loadMore()
  view.query.value = 'another filter'
  filteredPage.resolve(page([item('a-filter-old')]))
  await filterLoading
  assert.deepEqual(view.rows.value.map((row) => row.auditId), ['a-new'])
  assert.equal(view.nextCursor.value, 'cursor-new')

  session.principal = { subject: 'auditor-b' }
  accountPage.resolve(page([item('b-1')]))
  await Vue.nextTick()
  assert.deepEqual(view.rows.value.map((row) => row.auditId), ['b-1'])
})
