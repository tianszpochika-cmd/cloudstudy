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

function policy(id) {
  return {
    policyVersionId: id, version: `p1-${id}`, status: 'ACTIVE', revision: 2,
    updatedAt: '2026-09-23T10:00:00Z',
    document: {
      name: 'Platform policy',
      roleBindings: [{ roleCode: 'admin', permissions: ['iam.policy.read'] }],
      rules: [{ effect: 'ALLOW', requiredPermissions: ['iam.policy.read'], actions: ['read'], resourceTypes: ['policy'], conditions: {} }],
    },
    separationOfDuties: { satisfied: true }, auditLinks: [],
  }
}

function envelope(items, nextCursor = null) {
  return { data: { items }, meta: { hasMore: nextCursor !== null, nextCursor } }
}

test('read adapter uses the contracted Gateway path and cursor, rejecting malformed pages', async () => {
  const requests = []
  let response = envelope([policy('first')], 'next/2')
  const api = load('src/api/b8-policy.ts', {
    './client': { adminClient: { request: async (path) => { requests.push(path); return response } } },
  })
  assert.deepEqual((await api.listB8PolicyVersions()).items.map((item) => item.policyVersionId), ['first'])
  await api.listB8PolicyVersions('next/2')
  assert.deepEqual(requests, [
    '/iam/policy-versions?pageSize=50',
    '/iam/policy-versions?pageSize=50&cursor=next%2F2',
  ])
  response = envelope([{ ...policy('bad'), document: { name: 'Bad', roleBindings: [{}], rules: [] } }])
  await assert.rejects(api.listB8PolicyVersions(), /POLICY_RESPONSE_INVALID/)
  response = { data: { items: [policy('bad')] }, meta: { hasMore: true, nextCursor: null } }
  await assert.rejects(api.listB8PolicyVersions(), /POLICY_RESPONSE_INVALID/)
})

function harness() {
  let session = { isAuthenticated: true, can: (permission) => permission === 'iam.policy.read' }
  let reader = async () => ({ items: [], nextCursor: null })
  let reads = 0
  class AdminApiError extends Error {
    constructor(status) { super(`HTTP ${status}`); this.status = status }
  }
  const module = load('src/stores/b8-policy.ts', {
    pinia: { defineStore: (_name, definition) => definition },
    '../api/client': { AdminApiError },
    '../api/b8-policy': { listB8PolicyVersions: (cursor) => { reads += 1; return reader(cursor) } },
    '../platform/b8-policy-i18n': { b8PolicyT: (key) => key },
    './admin': { useAdminStore: () => session },
  })
  const definition = module.useB8PolicyStore
  const store = { ...definition.state() }
  return {
    store,
    load: () => definition.actions.load.call(store),
    loadMore: () => definition.actions.loadMore.call(store),
    setSession: (next) => { session = next },
    setReader: (next) => { reader = next },
    reads: () => reads,
    AdminApiError,
  }
}

test('missing policy permission and owner 403 clear prior records', async () => {
  const h = harness()
  h.store.items = [policy('stale')]
  h.setSession({ isAuthenticated: true, can: () => false })
  await h.load()
  assert.equal(h.store.viewState, 'permission')
  assert.deepEqual(h.store.items, [])
  assert.equal(h.reads(), 0)

  h.setSession({ isAuthenticated: true, can: () => true })
  h.setReader(async () => { throw new h.AdminApiError(403) })
  await h.load()
  assert.equal(h.store.viewState, 'permission')
  assert.deepEqual(h.store.items, [])
})

test('empty, retry and cursor pages use server results without stale data', async () => {
  const h = harness()
  await h.load()
  assert.equal(h.store.viewState, 'empty')
  h.setReader(async (cursor) => cursor
    ? { items: [policy('second')], nextCursor: null }
    : { items: [policy('first')], nextCursor: 'next' })
  await h.load()
  assert.equal(h.store.viewState, 'ready')
  assert.equal(h.store.nextCursor, 'next')
  await h.loadMore()
  assert.deepEqual(h.store.items.map((item) => item.policyVersionId), ['first', 'second'])
  assert.equal(h.store.nextCursor, null)

  h.setReader(async () => { throw new Error('network') })
  await h.load()
  assert.equal(h.store.viewState, 'error')
  assert.deepEqual(h.store.items, [])
})

test('older in-flight list and pagination responses cannot restore stale rows', async () => {
  const h = harness()
  let resolveOld
  h.setReader(() => new Promise((resolve) => { resolveOld = resolve }))
  const first = h.load()
  h.setReader(async () => ({ items: [policy('fresh')], nextCursor: 'next' }))
  await h.load()
  resolveOld({ items: [policy('stale')], nextCursor: null })
  await first
  assert.deepEqual(h.store.items.map((item) => item.policyVersionId), ['fresh'])

  let resolvePage
  h.setReader(() => new Promise((resolve) => { resolvePage = resolve }))
  const page = h.loadMore()
  h.setReader(async () => ({ items: [policy('newer')], nextCursor: null }))
  await h.load()
  resolvePage({ items: [policy('late')], nextCursor: null })
  await page
  assert.deepEqual(h.store.items.map((item) => item.policyVersionId), ['newer'])
})

test('pagination revocation clears displayed policy records', async () => {
  const h = harness()
  h.setReader(async () => ({ items: [policy('first')], nextCursor: 'next' }))
  await h.load()
  h.setReader(async () => { throw new h.AdminApiError(401) })
  await h.loadMore()
  assert.equal(h.store.viewState, 'permission')
  assert.deepEqual(h.store.items, [])
})
