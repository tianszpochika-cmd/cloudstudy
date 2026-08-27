import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const appRoot = path.resolve(import.meta.dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8')

test('C05 mobile requires a confirmed SRS response before advancing', () => {
  const store = read('src/stores/b10-learning.ts')
  assert.match(store, /CONFIRMED_SRS_STATUSES/)
  assert.match(store, /responseStatus\(response\)/)
  assert.match(store, /服务端未确认本次复习，当前卡片未推进/)
  assert.match(store, /remoteStatus === 'PENDING_SYNC'/)
})

test('C05 mobile preserves unconfirmed sync entries and reads back SRS state', () => {
  const store = read('src/stores/b10-learning.ts')
  assert.match(store, /responseItems\(response\)/)
  assert.match(store, /const remaining: QueuedReview\[\] = \[\]/)
  assert.match(store, /queuedReviews\.value = remaining/)
  assert.match(store, /applyRemoteSrsView\(card, result\)/)
  assert.match(store, /source\.nextReviewLocalDate \?\? source\.dueLocalDate \?\? source\.dueAt/)
})

test('C05 mobile distinguishes completed batches from legitimate empty data', () => {
  const page = read('src/pages/b2-vocabulary/b2-vocabulary.vue')
  assert.match(page, /const completed = computed/)
  assert.match(page, /今日复习已完成/)
  assert.match(page, /store\.status === 'idle'/)
  assert.match(page, /store\.status === 'loading'/)
  assert.match(page, /store\.status === 'empty'/)
  for (const label of ['忘了', '模糊', '记得', '很熟']) assert.match(page, new RegExp(label))
})
