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

test('C02 Web profile writes preserve the canonical target row', () => {
  const api = read('src/api/b1.ts')
  const settings = read('src/pages/SettingsPage.vue')
  assert.match(api, /const rawTargetGoal = \(isRecord\(targetSource\) \? readString\(targetSource\.goalCode\)/)
  assert.match(api, /targetLevel: targetGoal === ['"]ZERO_BASIS['"] \? ['"]A1['"]/)
  assert.match(settings, /资料已保存到服务端/)
  assert.match(settings, /偏好已保存到服务端/)
})
