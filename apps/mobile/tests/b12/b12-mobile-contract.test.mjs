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
  assert.match(api, /M1016NotificationPreferenceCommand/)
  assert.match(api, /pageSize=100/)
  assert.match(api, /readAllNotificationPreferencePages/)
  const preferences = read('src/domain/notification-preferences.ts')
  assert.match(preferences, /page\.meta\.hasMore/)
  assert.match(preferences, /page\.meta\.nextCursor/)
  assert.doesNotMatch(api, /FOCUS_REMINDERS|DO_NOT_DISTURB|ROOM_INTERACTIONS/)
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

test('mobile notification settings use canonical categories and keep quiet hours separate', () => {
  const component = read('src/components/b12/B12SocialExtensions.vue')
  const settings = read('src/pages/settings/settings.vue')
  const domain = read('src/domain/notification-preferences.ts')
  assert.match(component, /pages\/settings\/settings/)
  assert.doesNotMatch(component, /DO_NOT_DISTURB|FOCUS_REMINDERS|ROOM_INTERACTIONS/)
  assert.match(settings, /NOTIFICATION_CATEGORIES\.map/)
  assert.match(settings, /row\?\.enabled === true/)
  assert.match(settings, /notificationDndEnabled/)
  assert.match(settings, /saveNotificationDnd/)
  assert.match(domain, /startLocalTime: '00:00', endLocalTime: '00:00'/)
  assert.match(domain, /consentVersion: current\?\.consentVersion \?\? 1/)
})
