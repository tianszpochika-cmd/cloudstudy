import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..', '..')
const read = (path) => readFile(join(root, path), 'utf8')

test('mobile C03 pages gate protected reads without crediting a read-only course as completed', async () => {
  const [home, today, learn] = await Promise.all([
    read('apps/mobile/src/pages/home/home.vue'),
    read('apps/mobile/src/pages/today/today.vue'),
    read('apps/mobile/src/pages/learn/learn.vue'),
  ])
  assert.match(home, /ensureMobilePageAccess\('\/pages\/home\/home'\)/)
  assert.match(home, /store\.loadHome\(\)/)
  assert.match(home, /contentCode/)
  assert.match(today, /ensureMobilePageAccess\('\/pages\/today\/today'\)/)
  assert.match(today, /store\.loadHome\(\)/)
  assert.match(today, /viewTask\(task\)/)
  assert.doesNotMatch(today, /store\.completeTask\(/)
  assert.match(learn, /mobileLearnerContentApi\.readContent\(normalized/)
  assert.doesNotMatch(learn, /learnerContent\.completeTask\(/)
})

test('mobile preserves content projections when completion omits the catalog', async () => {
  const store = await read('apps/mobile/src/stores/learner-content.ts')
  assert.match(store, /function preserveContentProjectionAfterCompletion\(model: MobileHomeModel\)/)
  assert.match(store, /if \(!current \|\| model\.content\.length > 0\) return model/)
  assert.match(store, /content: current\.content, contentStatus: current\.contentStatus/)
  assert.match(store, /home\.value = preserveContentProjectionAfterCompletion\(remote\)/)
})

test('mobile Today distinguishes an unavailable catalog from an empty task list and offers retry', async () => {
  const today = await read('apps/mobile/src/pages/today/today.vue')
  assert.match(today, /store\.homeStatus === 'unavailable'[\s\S]*?role="status"/)
  assert.match(today, /课程列表暂不可用/)
  assert.match(today, /@click="store\.loadHome\(\)"/)
  assert.match(today, /v-if="store\.home && !store\.home\.tasks\.length" class="empty">今天还没有安排任务。/)
  assert.match(today, /v-for="task in store\.home\?\.tasks"/)
  assert.doesNotMatch(today, /contentStatus === 'UNAVAILABLE'.*课程暂时不可用/)
})
