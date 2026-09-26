import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(resolve(import.meta.dirname, '../src/domain/b5.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const module = { exports: {} }
new Function('module', 'exports', compiled)(module, module.exports)
const { toAudit } = module.exports

test('audit rows without verified redaction do not expose references', () => {
  const row = {
    auditId: 'audit-1', operation: 'SENSITIVE_ACTION', resourceRef: 'subject-secret',
    commandId: 'command-secret', traceId: 'trace-secret', occurredAt: '2026-09-23T00:00:00Z',
  }
  for (const redacted of [undefined, false, 'true']) {
    const view = toAudit({ ...row, redacted })
    assert.equal(view.redacted, redacted === false ? false : null)
    assert.equal(view.actionCode, '')
    assert.equal(view.resourceRef, '')
    assert.equal(view.commandId, '')
    assert.equal(view.traceId, '')
    assert.equal(view.auditId, 'audit-1')
  }
  const verified = toAudit({ ...row, redacted: true })
  assert.equal(verified.redacted, true)
  assert.equal(verified.actionCode, 'SENSITIVE_ACTION')
  assert.equal(verified.resourceRef, 'subject-secret')
})
