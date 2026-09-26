import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..', '..')
const read = (path) => readFile(join(root, path), 'utf8')

test('learner-web C03 pages read home/today/content and require learning evidence for completion', async () => {
  const [home, today, learn] = await Promise.all([
    read('apps/learner-web/src/pages/HomePage.vue'),
    read('apps/learner-web/src/pages/TodayPage.vue'),
    read('apps/learner-web/src/pages/LearnPage.vue'),
  ])
  assert.match(home, /store\.loadHome\(\)/)
  assert.match(home, /home\.value\?\.content/)
  // Task cards open the lesson; only the lesson completion action writes progress.
  assert.match(home, /name: 'learn-session'/)
  assert.match(home, /taskId: task\.id/)
  assert.doesNotMatch(home, /store\.completeTask\(/)
  assert.match(today, /store\.loadToday\(\)/)
  assert.match(today, /name: 'learn-session'/)
  assert.match(today, /taskId/)
  assert.match(learn, /learnerContentPort\.readContent\(contentCode\)/)
  assert.match(learn, /updateContinueContext/)
  assert.doesNotMatch(learn, /learnerContent\.completeTask\(taskId\)/)
  assert.doesNotMatch(learn, /完成本步/)
})

test('learner-web preserves content projections when completion omits the catalog', async () => {
  const store = await read('apps/learner-web/src/stores/learner-content.ts')
  assert.match(store, /function preserveContentProjectionAfterCompletion\(model: LearnerHomeReadModel\)/)
  assert.match(store, /if \(!current \|\| model\.content\.length > 0\) return model/)
  assert.match(store, /content: current\.content, contentStatus: current\.contentStatus/)
  assert.equal((store.match(/preserveContentProjectionAfterCompletion\(remote\)/g) ?? []).length, 2)
})

test('learner-web C03 entry pages keep the fixed sidebar navigation reachable', async () => {
  const styles = await read('apps/learner-web/src/assets/styles/experience.css')
  assert.match(styles, /\.experience-shell \.app-shell__sidebar\s*\{[^}]*overflow:\s*auto/s)
  assert.match(styles, /\.experience-shell \.nav-list\s*\{[^}]*flex:\s*1;[^}]*overflow-y:\s*auto/s)
  assert.match(styles, /\.experience-shell \.sidebar-footer\s*\{[^}]*flex-shrink:\s*0/s)
})
