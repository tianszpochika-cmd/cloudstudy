import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..', '..', '..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'tests/e2e/b6/b6-scenarios.json'), 'utf8'))
const baseUrl = process.env.B6_E2E_BASE_URL?.replace(/\/$/, '')

test('B6 E2E manifest covers the four required client paths', () => {
  assert.equal(manifest.version, 'b6-e2e-v1')
  assert.deepEqual(manifest.scenarios.map((scenario) => scenario.code), ['ONBOARDING_FIRST_DAY', 'LEARNING_FEEDBACK_REVIEW', 'CONTENT_VISIBILITY', 'ENTITLEMENT_COMMERCE'])
  assert.ok(manifest.scenarios.every((scenario) => scenario.requiredPlatforms.includes('WEB') && scenario.requiredPlatforms.includes('H5')))
})

for (const scenario of manifest.scenarios) {
  test(`B6 browser smoke: ${scenario.code}`, { skip: !baseUrl }, async () => {
    const response = await fetch(`${baseUrl}${scenario.path}`)
    assert.equal(response.ok, true, `${scenario.code} returned HTTP ${response.status}`)
  })
}
