import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => readFile(resolve(appRoot, relative), 'utf8')

test('C05 Web SRS only advances after a confirmed server result', async () => {
  const store = await read('src/stores/b10.ts')
  const page = await read('src/pages/VocabularyPage.vue')
  assert.match(store, /isConfirmedReviewStatus/)
  assert.match(store, /result\.status === 'PENDING_SYNC'/)
  assert.match(store, /当前卡片未推进/)
  assert.match(store, /moveToNextCard\(true\)/)
  assert.match(page, /下次复习：\{\{ card\.srs\.nextReviewLocalDate \}\}/)
})

test('C05 Web refreshes the SRS batch after confirmed offline review sync', async () => {
  const store = await read('src/stores/b10.ts')
  assert.match(store, /reviewSyncConfirmed/)
  assert.match(store, /if \(reviewSyncConfirmed && !offlineQueue\.value\.length\) await loadVocabulary\(\)/)
  assert.match(store, /sort\(\(left, right\) => left\.clientSeq - right\.clientSeq\)/)
})

test('C05 Web keeps legitimate empty data distinct from offline/error states', async () => {
  const page = await read('src/pages/VocabularyPage.vue')
  const statePanel = await read('src/components/b10/B10StatePanel.vue')
  assert.match(page, /status === 'empty'/)
  assert.match(page, /store\.vocabularyMessage/)
  assert.match(statePanel, /'offline', 'error', 'forbidden', 'stale'/)
  assert.match(statePanel, /state-panel--\$\{status\}/)
})
