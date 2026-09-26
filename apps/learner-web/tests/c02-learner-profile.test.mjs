import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('C02 Web onboarding reads learner-owned options and verifies the remote write', () => {
  const api = read('src/api/learner-content.ts')
  const page = read('src/pages/OnboardingPage.vue')
  // The contract declares /api/v1/onboarding/options and the onboarding-domain rule belongs to
  // learner-service, so the path carries no /learner segment. The previous assertion pinned
  // /learner/onboarding/options, which no canonical projection serves: the call was answered 404 and
  // the browser reported it as a CORS failure because that response had no CORS headers.
  assert.match(api, /onboardingOptions: ['"]\/onboarding\/options['"]/)
  assert.match(api, /requestOptional<unknown>\(query\(READ_MODEL_PATHS\.onboardingOptions/)
  assert.match(api, /status: ['"]ACTIVE['"]/) 
  assert.match(api, /return learnerContentPort\.readOnboarding\(['"]en-US['"]\)/)
  assert.match(page, /await store\.loadOnboarding\(\)/)
})

test('C02 Web settings writes only the contracted daily target and verifies readback', () => {
  const api = read('src/api/b1.ts')
  const settings = read('src/pages/SettingsPage.vue')
  const experience = read('../../packages/i18n/src/learner-experience.ts')
  assert.match(api, /goalCode: current\.goalCode/)
  assert.match(api, /targetLevel: current\.targetLevel/)
  assert.match(api, /const verified = await fetchProfile\(\)/)
  assert.doesNotMatch(settings, /v-model="nickname"|v-model="accent"/)
  assert.match(settings, /et\('settingsNicknameUnavailable'\)/)
  assert.match(experience, /settingsNicknameUnavailable: '昵称与发音偏好暂不可修改。'/)
  assert.match(settings, /et\('settingsGoalSaved'\)/)
  assert.match(experience, /settingsGoalSaved: '每日目标已保存。'/)
})
