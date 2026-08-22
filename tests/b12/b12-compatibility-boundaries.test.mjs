import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..', '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const adapter = read('services/core-api/src/main/java/com/englishflow/modules/b12/B12CompatibilityAdapter.java')
const smoke = read('services/core-api/src/test/java/com/englishflow/modules/b12/B12CompatibilityAdapterSmoke.java')

test('B12 compatibility adapter is read-only, replay-safe and reversible', () => {
  assert.match(adapter, /shadowRead\(/)
  assert.match(adapter, /replayTrustedEvent\(/)
  assert.match(adapter, /switchRoute\(/)
  assert.match(adapter, /rollback\(/)
  assert.match(adapter, /readOnly/)
  assert.match(adapter, /domainFactsUntouched/)
  assert.match(adapter, /FORBIDDEN_CLIENT_FACTS/)
  assert.doesNotMatch(adapter, /JdbcTemplate|INSERT\s+INTO|UPDATE\s+[^\n]+SET|DELETE\s+FROM/i)
  assert.doesNotMatch(adapter, /gam_xp_ledger|gam_currency_ledger|soc_room_member|inf_notification_message/i)
  assert.match(smoke, /ReplayState\.DUPLICATE/)
  assert.match(smoke, /RouteMode\.FALLBACK/)
})
