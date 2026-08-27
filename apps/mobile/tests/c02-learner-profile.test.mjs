import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('C02 Mobile onboarding uses learner-service options and valid quota choices', () => {
  const api = read('src/api/learner-content.ts')
  const store = read('src/stores/learner-content.ts')
  const page = read('src/pages/onboarding/onboarding.vue')
  assert.match(api, /learner\/onboarding\/options/)
  assert.match(api, /birthYear\?: number/)
  assert.match(store, /const quotas = ref<number\[\]>/)
  assert.match(page, /v-for="item in store\.quotas"/)
  assert.doesNotMatch(page, /\[5, 15, 30, 45, 60\]/)
})

test('C02 Mobile profile and settings use remote account/preferences state', () => {
  const api = read('src/api/learner-content.ts')
  const store = read('src/stores/learner-content.ts')
  const profile = read('src/pages/profile/profile.vue')
  const settings = read('src/pages/settings/settings.vue')
  assert.match(api, /async readAccount\(\)/)
  assert.match(api, /async savePreferences\(/)
  assert.match(store, /async function loadAccount\(/)
  assert.match(profile, /store\.loadAccount\(\)/)
  assert.match(settings, /store\.loadAccount\(\)/)
  assert.doesNotMatch(settings, /useB1Store/)
})
