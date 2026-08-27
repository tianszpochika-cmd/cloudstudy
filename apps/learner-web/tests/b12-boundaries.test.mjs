import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const appRoot = path.resolve(import.meta.dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8')

test('B12 learner API uses server-owned chest, leaderboard and preset report endpoints', () => {
  const api = read('src/api/b12.ts')
  assert.match(api, /gamification\/me\/rewards/)
  assert.match(api, /social\/leaderboards\?kind=FOCUS_MINUTES/)
  assert.match(api, /social\/rooms.*reports/)
  assert.match(api, /notifications\/preferences/)
  assert.match(api, /Idempotency-Key/)
  for (const notificationType of ['ROOM_INTERACTIONS', 'FOCUS_REMINDERS', 'SYSTEM', 'DO_NOT_DISTURB']) assert.match(api, new RegExp(notificationType))
})

test('B12 learner rewards disclose free non-cash rules and server probability', () => {
  const component = read('src/components/b12/B12RewardsCard.vue')
  assert.match(component, /freeNotice/)
  assert.match(component, /chestProbability/)
  assert.match(component, /probabilitySnapshotHash/)
  assert.doesNotMatch(component, /Math\.random|抽奖概率由客户端/) 
})

test('B12 learner report UI only uses preset reasons and server returned member references', () => {
  const component = read('src/components/b12/B12SocialExtensions.vue')
  assert.match(component, /B12_REPORT_REASONS/)
  assert.match(component, /reportUser\(/)
  assert.doesNotMatch(component, /<textarea|v-model=".*userId|placeholder=.*userId/i)
})

test('B12 learner notification parser prefers canonical server preference types over legacy aliases', () => {
  const component = read('src/components/b12/B12SocialExtensions.vue')
  assert.match(component, /PREFERENCE_KEY_BY_NOTIFICATION_TYPE/)
  assert.match(component, /CANONICAL_NOTIFICATION_TYPES/)
  assert.match(component, /canonicalSeen/)
  assert.match(component, /delete preferenceVersions\.value\[key\]/)
})
