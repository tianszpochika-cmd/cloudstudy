import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const source = readFileSync(path.resolve(import.meta.dirname, '../../scripts/runtime/b35-authz-runtime.mjs'), 'utf8')

test('B35 authz companion covers valid-session 403, owner isolation and forged authority headers', () => {
  for (const marker of ['cross-user profile isolation', 'cross-user target isolation', 'valid learner token receives admin 403', 'x-owner-id', 'aliceProfile', 'bobGoal']) {
    assert.ok(source.includes(marker), `missing B35 authz marker: ${marker}`)
  }
  assert.match(source, /tokenValuesEmitted: false/)
  assert.match(source, /credentialsPersisted: false/)
})
