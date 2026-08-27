import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..', '..')
const read = (path) => readFile(join(root, path), 'utf8')

test('mobile C03 pages gate protected reads and expose home/today/content completion paths', async () => {
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
  assert.match(today, /complete\(task\.id\)/)
  assert.match(today, /store\.completeTask\(taskId\)/)
  assert.match(learn, /mobileLearnerContentApi\.readContent\(normalized/)
  assert.match(learn, /learnerContent\.completeTask\(taskId\.value\)/)
})

test('mobile preserves content projections when completion omits the catalog', async () => {
  const store = await read('apps/mobile/src/stores/learner-content.ts')
  assert.match(store, /function preserveContentProjectionAfterCompletion\(model: MobileHomeModel\)/)
  assert.match(store, /if \(!current \|\| model\.content\.length > 0\) return model/)
  assert.match(store, /content: current\.content, contentStatus: current\.contentStatus/)
  assert.match(store, /home\.value = preserveContentProjectionAfterCompletion\(remote\)/)
})
