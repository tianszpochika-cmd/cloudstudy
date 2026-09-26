import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(resolve(import.meta.dirname, '../src/api/b13.ts'), 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const calls = []
let response
const module = { exports: {} }
new Function('require', 'module', 'exports', code)((id) => {
  assert.equal(id, './client')
  return { adminClient: { request: async (path) => { calls.push(path); return response } } }
}, module, module.exports)
const { listB13Audit, parseB13AuditPage } = module.exports

function page(items, nextCursor = null) {
  return {
    data: { items, redacted: true },
    meta: { hasMore: nextCursor !== null, nextCursor, pageSize: 20 },
  }
}

test('audit request forwards an opaque cursor and accepts the canonical page envelope', async () => {
  response = page([{ auditId: 'audit-1', redacted: true }], 'next_cursor-123')
  const result = await listB13Audit('prior_cursor-123', 20)
  assert.deepEqual(result.items.map((item) => item.auditId), ['audit-1'])
  assert.equal(result.nextCursor, 'next_cursor-123')
  assert.equal(calls.at(-1), '/admin/ops/audit?pageSize=20&cursor=prior_cursor-123')
})

test('audit parser fails closed on missing redaction or inconsistent cursor metadata', () => {
  const safe = { auditId: 'audit-1', redacted: true }
  assert.throws(() => parseB13AuditPage({ ...page([safe]), data: { items: [safe], redacted: false } }))
  assert.throws(() => parseB13AuditPage(page([{ ...safe, redacted: false }])))
  assert.throws(() => parseB13AuditPage(page([safe], '')))
  assert.throws(() => parseB13AuditPage({ ...page([safe]), meta: { hasMore: false, nextCursor: 'stale', pageSize: 20 } }))
  assert.throws(() => parseB13AuditPage({ ...page([safe]), meta: { hasMore: false, nextCursor: null, pageSize: 101 } }))
})
