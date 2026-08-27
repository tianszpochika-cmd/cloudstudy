import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const appRoot = path.resolve(import.meta.dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8')

test('B12 admin route and API require server permissions and idempotent commands', () => {
  const router = read('src/router/index.ts')
  const api = read('src/api/b12.ts')
  assert.match(router, /admin\.moderation\.read/)
  assert.match(api, /Idempotency-Key/)
  assert.match(api, /action/)
  assert.doesNotMatch(api, /userId|tenantId|ownerId|x-role|x-tenant|x-owner/i)
})

test('B12 admin view keeps moderation and recovery actions enum-only', () => {
  const view = read('src/views/AdminB12GovernanceView.vue')
  const domain = read('src/domain/b12.ts')
  assert.match(view, /admin\.moderation\.command/)
  assert.match(view, /admin\.recovery\.command/)
  assert.match(domain, /B12_MODERATION_COMMANDS/)
  assert.match(domain, /B12_RECOVERY_COMMANDS/)
  assert.doesNotMatch(view, /<textarea|v-model=.*userId|v-model=.*tenantId/i)
})
