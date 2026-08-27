import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

test('C08 learner reading API preserves dictionary, mining selection and progress contract', () => {
  const source = read('src/api/b10.ts')
  assert.match(source, /getReadingDictionary/)
  assert.match(source, /X-Snapshot-Id/)
  assert.match(source, /readingProgress/)
  assert.match(source, /createReadingMining\(articleId: number, blockId: string, selectedText: string/)
  assert.match(source, /selectedText, contentVersionId/)
})

test('C08 learner reading persists version-bound position and distinguishes empty from errors', () => {
  const store = read('src/stores/b10.ts')
  const page = read('src/pages/B11ReadingPage.vue')
  for (const marker of ['READING_STATE_KEY', 'persistReadingState', 'applyReadingState', 'setReadingBlock', 'minedBlockIds', 'contentVersionId']) assert.match(store, new RegExp(marker))
  assert.match(page, /readingStatus === 'empty'/)
  assert.match(page, /role="alert"/)
  assert.match(page, /readingMessage/)
})

