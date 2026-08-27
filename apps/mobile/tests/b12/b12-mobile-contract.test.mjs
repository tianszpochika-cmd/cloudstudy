import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const appRoot = path.resolve(import.meta.dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8')

test('B12 mobile exposes server-owned rewards and social command seams', () => {
  const api = read('src/api/b12.ts')
  assert.match(api, /gamification\/me\/rewards/)
  assert.match(api, /social\/leaderboards\?kind=FOCUS_MINUTES/)
  assert.match(api, /social\/rooms.*reports/)
  assert.match(api, /notifications\/preferences/)
  assert.match(api, /Idempotency-Key/)
  for (const notificationType of ['ROOM_INTERACTIONS', 'FOCUS_REMINDERS', 'SYSTEM', 'DO_NOT_DISTURB']) assert.match(api, new RegExp(notificationType))
})

test('B12 mobile remains playable in static/performance mode and shows reward disclosure', () => {
  const rewards = read('src/components/b12/B12RewardsCard.vue')
  const world = read('src/pages/world/world.vue')
  assert.match(world, /B12RewardsCard/)
  assert.match(rewards, /freeNotice/)
  assert.match(rewards, /probabilitySnapshotHash/)
  assert.doesNotMatch(rewards, /Math\.random|抽奖概率由客户端/)
})

test('B12 mobile report interaction has no free-text or user-id input', () => {
  const component = read('src/components/b12/B12SocialExtensions.vue')
  assert.match(component, /B12_REPORT_REASONS/)
  assert.match(component, /function report\(/)
  assert.doesNotMatch(component, /<textarea|<input|v-model=".*userId/i)
})

test('B12 mobile notification parser prefers canonical server preference types over legacy aliases', () => {
  const component = read('src/components/b12/B12SocialExtensions.vue')
  assert.match(component, /PREFERENCE_KEY_BY_NOTIFICATION_TYPE/)
  assert.match(component, /CANONICAL_NOTIFICATION_TYPES/)
  assert.match(component, /canonicalSeen/)
  assert.match(component, /delete preferenceVersions\.value\[key\]/)
})
