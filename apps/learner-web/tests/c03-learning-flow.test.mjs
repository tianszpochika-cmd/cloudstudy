import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..', '..')
const read = (path) => readFile(join(root, path), 'utf8')

test('learner-web C03 pages read real home/today/content projections and complete tasks', async () => {
  const [home, today, learn] = await Promise.all([
    read('apps/learner-web/src/pages/HomePage.vue'),
    read('apps/learner-web/src/pages/TodayPage.vue'),
    read('apps/learner-web/src/pages/LearnPage.vue'),
  ])
  assert.match(home, /store\.loadHome\(\)/)
  assert.match(home, /home\.value\?\.content/)
  assert.match(home, /store\.completeTask\(taskId\)/)
  assert.match(today, /store\.loadToday\(\)/)
  assert.match(today, /name: 'learn-session'/)
  assert.match(today, /taskId/)
  assert.match(learn, /learnerContentPort\.readContent\(contentCode\)/)
  assert.match(learn, /updateContinueContext/)
  assert.match(learn, /learnerContent\.completeTask\(taskId\)/)
})

test('learner-web preserves content projections when completion omits the catalog', async () => {
  const store = await read('apps/learner-web/src/stores/learner-content.ts')
  assert.match(store, /function preserveContentProjectionAfterCompletion\(model: LearnerHomeReadModel\)/)
  assert.match(store, /if \(!current \|\| model\.content\.length > 0\) return model/)
  assert.match(store, /content: current\.content, contentStatus: current\.contentStatus/)
  assert.equal((store.match(/preserveContentProjectionAfterCompletion\(remote\)/g) ?? []).length, 2)
})

test('learner-web C03 entry pages keep the fixed sidebar navigation reachable', async () => {
  const pages = await Promise.all([
    read('apps/learner-web/src/pages/HomePage.vue'),
    read('apps/learner-web/src/pages/TodayPage.vue'),
    read('apps/learner-web/src/pages/LearnPage.vue'),
  ])
  for (const page of pages) {
    assert.match(page, /:global\(\.app-shell__sidebar\)\s*\{[^}]*overflow-y\s*:\s*auto/s)
    assert.match(page, /:global\(\.nav-list\)\s*\{[^}]*flex\s*:\s*1 1 auto[^}]*overflow-y\s*:\s*auto/s)
    assert.match(page, /:global\(\.sidebar-footer\)\s*\{[^}]*flex\s*:\s*0 0 auto/s)
  }
})
