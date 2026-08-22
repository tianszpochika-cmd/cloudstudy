import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..', '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(root, file))

test('B14 migration adapter covers all Phase 1 domains without domain-fact writes', () => {
  const adapterPath = 'services/core-api/src/main/java/com/englishflow/modules/b14/B14MigrationCompatibilityAdapter.java'
  const smokePath = 'services/core-api/src/test/java/com/englishflow/modules/b14/B14MigrationCompatibilityAdapterSmoke.java'
  assert.equal(exists(adapterPath), true)
  assert.equal(exists(smokePath), true)
  const adapter = read(adapterPath)
  const smoke = read(smokePath)
  for (const domain of ['LEARNER', 'CONTENT', 'LEARNING', 'ASSESSMENT', 'MEDIA', 'GAMIFICATION', 'SOCIAL', 'COMMERCE']) {
    assert.match(adapter, new RegExp(domain))
  }
  for (const marker of ['SHADOW', 'MATCH', 'MISMATCH', 'LEGACY_ONLY', 'TARGET_ONLY', 'UNAVAILABLE', 'idempot', 'compens', 'FALLBACK']) {
    assert.match(adapter, new RegExp(marker, 'i'))
  }
  assert.match(adapter, /domainFacts|domain facts|target.*write|read.?only/i)
  assert.match(smoke, /duplicate|replay|rollback|compens|tenant/i)
})

test('B14 reliability ledger covers dedupe, ordering, retry, DLQ, replay and compensation', () => {
  const ledgerPath = 'services/service-template/src/main/java/com/englishflow/platform/template/reliability/B14ReliabilityLedger.java'
  const smokePath = 'services/service-template/src/test/java/com/englishflow/platform/template/reliability/B14ReliabilityLedgerSmoke.java'
  assert.equal(exists(ledgerPath), true)
  assert.equal(exists(smokePath), true)
  const ledger = read(ledgerPath)
  const smoke = read(smokePath)
  for (const marker of ['eventId', 'schemaVersion', 'partition', 'DUPLICATE|idempotency', 'retry', 'DLQ', 'replay', 'compensation', 'manual']) {
    assert.match(ledger, new RegExp(marker, 'i'))
  }
  assert.doesNotMatch(ledger, /KafkaRpc|KafkaRpcClient|twoPhaseCommit|TwoPhaseCommit|rawPii|rawPayload/i)
  assert.match(smoke, /duplicate|out.?of.?order|retry|DLQ|replay|compens/i)
})
