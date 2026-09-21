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

test('learner-web today renders loading/offline/error/empty without faking empty success', async () => {
  const page = await read('apps/learner-web/src/pages/TodayPage.vue')
  assert.match(page, /store\.todayStatus === 'loading'/)
  assert.match(page, /store\.todayStatus === 'offline'[\s\S]*?state="offline"/)
  assert.doesNotMatch(page, /todayStatus === 'forbidden'/)
  assert.match(page, /state="error"[\s\S]*?loadToday\(\)/)
  assert.match(page, /state="empty"/)
})
