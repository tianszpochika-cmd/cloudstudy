import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')

function loadTypeScript(relativePath, dependencies) {
  const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', output)((id) => {
    assert.ok(id in dependencies, `unexpected dependency: ${id}`)
    return dependencies[id]
  }, module, module.exports)
  return module.exports
}

const page = (ids, nextCursor = null) => ({
  items: ids.map((reportId) => ({ reportId })), nextCursor,
})
const envelope = (ids, nextCursor = null) => ({
  data: { items: ids.map((reportId) => ({ reportId })) },
  meta: { hasMore: nextCursor !== null, nextCursor },
})

function createStoreHarness() {
  let session = { isAuthenticated: true, principal: { subject: 'reviewer-1' }, can: (permission) => permission === 'admin.moderation.read' }
  let loader = async () => page([])
  const requests = []
  class AdminApiError extends Error {
    constructor(status) { super(`HTTP ${status}`); this.status = status }
  }
  const dependencies = {
    pinia: { defineStore: (_name, definition) => definition },
    '../api/client': { AdminApiError },
    '../api/b12': { listB12ModerationReports: (status, cursor) => { requests.push({ status, cursor }); return loader(status, cursor) } },
    '../domain/b12': { parseModerationReport: (report) => typeof report.reportId === 'string' ? report : null },
    '../platform/b12-i18n': { b12T: (key) => ({ permission: '无权查看举报记录。', error: '举报记录暂不可用。', moreError: '后续举报未加载，当前列表不完整。' })[key] },
    './admin': { useAdminStore: () => session },
  }
  const definition = loadTypeScript('src/stores/b12.ts', dependencies).useB12AdminStore
  const store = { ...definition.state() }
  for (const [name, action] of Object.entries(definition.actions)) store[name] = action.bind(store)
  return {
    store, AdminApiError, requests,
    setLoader: (next) => { loader = next },
    setSession: (next) => { session = next },
  }
}

test('B12 request returns an opaque server cursor only in the next request', async () => {
  const paths = []
  const cursor = 'opaque+/= %@汉字'
  const api = loadTypeScript('src/api/b12.ts', {
    './client': { adminClient: { request: async (path) => { paths.push(path); return envelope(['report-1'], cursor) } } },
    '../platform/client-id': { createClientId: () => 'unused' },
  })
  const first = await api.listB12ModerationReports()
  assert.equal(first.nextCursor, cursor)
  await api.listB12ModerationReports('OPEN', first.nextCursor)
  assert.deepEqual(paths, [
    '/admin/moderation/reports?status=OPEN',
    `/admin/moderation/reports?status=OPEN&cursor=${encodeURIComponent(cursor)}`,
  ])
  assert.equal(api.parseB12ModerationReportPage(envelope([], null)).nextCursor, null)
  assert.throws(() => api.parseB12ModerationReportPage({ data: { items: [] } }), /B12_REPORT_PAGE_INVALID/)
  assert.throws(() => api.parseB12ModerationReportPage({ data: { items: [{}] }, meta: { hasMore: true } }), /B12_REPORT_PAGE_INVALID/)
  assert.throws(() => api.parseB12ModerationReportPage({ data: { items: [{}] }, meta: { hasMore: false, nextCursor: cursor } }), /B12_REPORT_PAGE_INVALID/)
  assert.throws(() => api.parseB12ModerationReportPage({ data: { items: [] }, meta: { hasMore: true, nextCursor: cursor } }), /B12_REPORT_PAGE_INVALID/)
})

test('load more follows server cursors and appends distinct reports until complete', async () => {
  const h = createStoreHarness()
  h.setLoader(async (_status, cursor) => cursor === undefined
    ? page(['r1', 'r2'], 'server-page-2')
    : page(['r2', 'r3'], null))
  await h.store.load()
  assert.equal(h.store.viewState, 'ready')
  assert.equal(h.store.nextCursor, 'server-page-2')
  await h.store.loadMore()
  assert.deepEqual(h.requests, [
    { status: 'OPEN', cursor: undefined },
    { status: 'OPEN', cursor: 'server-page-2' },
  ])
  assert.deepEqual(h.store.reports.map((report) => report.reportId), ['r1', 'r2', 'r3'])
  assert.equal(h.store.nextCursor, null)
  await h.store.loadMore()
  assert.equal(h.requests.length, 2)
})

test('switching report status clears old pages and starts a new cursor chain', async () => {
  const h = createStoreHarness()
  let resolveOldPage
  h.setLoader(async (status, cursor) => {
    if (status === 'OPEN' && cursor === undefined) return page(['open-report'], 'open-next')
    if (status === 'OPEN') return new Promise((resolve) => { resolveOldPage = resolve })
    return page(['resolved-report'], 'resolved-next')
  })
  await h.store.load()
  const oldPage = h.store.loadMore()
  const newPage = h.store.setStatus('RESOLVED')
  assert.equal(h.store.status, 'RESOLVED')
  assert.equal(h.store.viewState, 'loading')
  assert.deepEqual(h.store.reports, [])
  assert.equal(h.store.nextCursor, null)
  await newPage
  resolveOldPage(page(['late-open-report']))
  await oldPage
  assert.deepEqual(h.store.reports.map((report) => report.reportId), ['resolved-report'])
  assert.equal(h.store.nextCursor, 'resolved-next')
  assert.deepEqual(h.requests, [
    { status: 'OPEN', cursor: undefined },
    { status: 'OPEN', cursor: 'open-next' },
    { status: 'RESOLVED', cursor: undefined },
  ])
})

test('next page failure retains visible rows, cursor and retry, without claiming completion', async () => {
  const h = createStoreHarness()
  h.setLoader(async (_status, cursor) => {
    if (cursor === undefined) return page(['r1'], 'server-page-2')
    throw new h.AdminApiError(503)
  })
  await h.store.load()
  await h.store.loadMore()
  assert.deepEqual(h.store.reports.map((report) => report.reportId), ['r1'])
  assert.equal(h.store.nextCursor, 'server-page-2')
  assert.equal(h.store.viewState, 'ready')
  assert.match(h.store.moreError, /不完整/)
  h.setLoader(async () => page(['r2']))
  await h.store.loadMore()
  assert.deepEqual(h.store.reports.map((report) => report.reportId), ['r1', 'r2'])
  assert.equal(h.store.nextCursor, null)
  assert.equal(h.store.moreError, null)
})

test('refresh clears old pages and ignores a late next-page response', async () => {
  const h = createStoreHarness()
  h.setLoader(async () => page(['old'], 'old-cursor'))
  await h.store.load()
  let resolveOldPage
  h.setLoader(() => new Promise((resolve) => { resolveOldPage = resolve }))
  const pending = h.store.loadMore()
  assert.equal(h.store.loadingMore, true)
  h.setLoader(async () => page(['fresh'], 'fresh-cursor'))
  await h.store.load()
  assert.deepEqual(h.store.reports.map((report) => report.reportId), ['fresh'])
  assert.equal(h.store.nextCursor, 'fresh-cursor')
  resolveOldPage(page(['late']))
  await pending
  assert.deepEqual(h.store.reports.map((report) => report.reportId), ['fresh'])
  assert.equal(h.store.nextCursor, 'fresh-cursor')
  assert.equal(h.store.loadingMore, false)
})

test('permission changes and backend 403 clear every old page and cursor', async () => {
  const h = createStoreHarness()
  h.setLoader(async (_status, cursor) => cursor === undefined ? page(['r1'], 'next') : page(['r2']))
  await h.store.load()
  h.setSession({ isAuthenticated: true, can: () => false })
  await h.store.load()
  assert.equal(h.store.viewState, 'permission')
  assert.deepEqual(h.store.reports, [])
  assert.equal(h.store.nextCursor, null)
  assert.equal(h.requests.length, 1)

  h.setSession({ isAuthenticated: true, can: () => true })
  await h.store.load()
  h.setLoader(async () => { throw new h.AdminApiError(403) })
  await h.store.loadMore()
  assert.equal(h.store.viewState, 'permission')
  assert.deepEqual(h.store.reports, [])
  assert.equal(h.store.nextCursor, null)
  assert.equal(h.store.moreError, null)
})

test('failed refresh clears stale reports; authenticated empty response stays empty', async () => {
  const h = createStoreHarness()
  h.setLoader(async () => page(['r1'], 'next'))
  await h.store.load()
  h.setLoader(async () => { throw new h.AdminApiError(503) })
  await h.store.load()
  assert.equal(h.store.viewState, 'error')
  assert.deepEqual(h.store.reports, [])
  assert.equal(h.store.nextCursor, null)
  h.setLoader(async () => page([]))
  await h.store.load()
  assert.equal(h.store.viewState, 'empty')
  assert.equal(h.store.lastError, null)
})

test('repeated server cursor leaves the current list visibly incomplete', async () => {
  const h = createStoreHarness()
  h.setLoader(async () => page(['r1'], 'same-cursor'))
  await h.store.load()
  h.setLoader(async () => page(['r2'], 'same-cursor'))
  await h.store.loadMore()
  assert.deepEqual(h.store.reports.map((report) => report.reportId), ['r1'])
  assert.equal(h.store.nextCursor, 'same-cursor')
  assert.match(h.store.moreError, /不完整/)
})

test('view reloads on account and permission changes and exposes partial-page retry', () => {
  const view = fs.readFileSync(path.join(appRoot, 'src/views/AdminB12GovernanceView.vue'), 'utf8')
  assert.match(view, /watch\([\s\S]*session\.principal\?\.subject[\s\S]*session\.permissions\.join[\s\S]*store\.load\(\)/)
  assert.match(view, /v-if="store\.moreError"/)
  assert.match(view, /v-if="store\.nextCursor"[\s\S]*@click="store\.loadMore"/)
  assert.match(view, /@change="\(value: string\) => store\.setStatus\(value\)"/)
})
