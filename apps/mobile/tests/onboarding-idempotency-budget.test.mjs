import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const store = fs.readFileSync(path.join(import.meta.dirname, '../src/stores/learner-content.ts'), 'utf8')
const uuid = '12345678-1234-4123-8123-123456789abc'

function dedupe(operation, key) {
  return `platform:${uuid}:${operation}:${key}`
}

test('h5 onboarding idempotency keys fit the learner outbox dedupe limit', () => {
  const prefixes = ['h5-goal', 'h5-setup']
  for (const prefix of prefixes) assert.match(store, new RegExp(`eventId\\('${prefix}'\\)`))
  for (const prefix of prefixes) {
    const clientEventId = `${prefix}-${uuid}`
    for (const [operation, suffix] of [['onboarding.goal', '-target'], ['preference.update', '-preferences']]) {
      const key = `${clientEventId}${suffix}`
      const stored = dedupe(operation, key)
      assert.equal(stored.length <= 128, true, `${stored.length} ${stored}`)
      assert.match(key, /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/)
    }
  }
})
