import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..', '..')
const read = (path) => readFile(join(root, path), 'utf8')

test('learner-web home renders the full state ladder without faking empty success', async () => {
  const page = await read('apps/learner-web/src/pages/HomePage.vue')
  assert.match(page, /store\.homeStatus === 'loading'/)
  assert.match(page, /store\.homeStatus === 'offline'[\s\S]*?state="offline"/)
  // Permission denials navigate to the global forbidden page (session.handleForbidden);
  // the page must not duplicate that branch and must never render data under it.
  assert.doesNotMatch(page, /homeStatus === 'forbidden'/)
  assert.match(page, /store\.lastError[\s\S]*?state="error"/)
  assert.match(page, /state="empty"/)
})

test('learner-web home shows one actionable error when the daily read returns 503', async () => {
  const page = await read('apps/learner-web/src/pages/HomePage.vue')
  const hero = page.split('<article v-if="!heroUnavailable" class="home-hero">')[1]?.split('</article>')[0] ?? ''
  assert.match(page, /<article v-if="!heroUnavailable" class="home-hero">/)
  assert.doesNotMatch(hero, /暂不可用|请稍后重试/)
  assert.match(page, /v-else-if="store\.lastError"[\s\S]*?state="error"[\s\S]*?action-label="重试"/)
})

test('learner-web today renders loading/offline/error/empty without faking empty success', async () => {
  const page = await read('apps/learner-web/src/pages/TodayPage.vue')
  assert.match(page, /store\.todayStatus === 'loading'/)
  assert.match(page, /store\.todayStatus === 'offline'[\s\S]*?state="offline"/)
  assert.doesNotMatch(page, /todayStatus === 'forbidden'/)
  assert.match(page, /state="error"[\s\S]*?loadToday\(\)/)
  assert.match(page, /state="empty"/)
})
