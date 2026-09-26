import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => readFile(resolve(appRoot, relative), 'utf8')

test('learner commerce only offers published public plans', async () => {
  const [api, page] = await Promise.all([read('src/api/b13.ts'), read('src/pages/B5CommercePage.vue')])
  assert.match(api, /publicCatalog: '\/public\/commerce\/catalog'/)
  assert.doesNotMatch(api, /'\/commerce\/skus'/)
  assert.match(page, /listRecords\(catalog\.value, 'plans'\)/)
  assert.match(page, /plan\.availability !== 'PUBLISHED'/)
  assert.match(page, /v-if="plan\.availability === 'PUBLISHED'"/)
  assert.match(page, /暂无可购买的学习方案/)
  assert.doesNotMatch(page, /sku\.entitlementCode|sku\.status/)
})
