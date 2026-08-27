import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const appRoot = path.resolve(import.meta.dirname, '..')
const read = (relative) => fs.readFileSync(path.join(appRoot, relative), 'utf8')

test('C08 mobile B3 reading keeps selected text and error recovery explicit', () => {
  const page = read('src/pages/b3-reading/b3-reading.vue')
  const api = read('src/api/b10.ts')
  assert.match(page, /status === 'empty'/)
  assert.match(page, /role="alert"/)
  assert.match(page, /mine\(block\.blockId, block\.text\)/)
  assert.match(api, /mineReadingExpression[\s\S]*selectedText, contentVersionId/)
})

test('C08 mobile B11 reading keeps empty and recoverable error states separate', () => {
  const page = read('src/pages/b11-reading/b11-reading.vue')
  const store = read('src/stores/b11-learning.ts')
  assert.match(page, /readingStatus === 'empty'/)
  assert.match(page, /role="alert"/)
  assert.match(page, /saveReadingPosition/)
  assert.match(page, /readingBlockIndex/)
  assert.match(store, /readingBlockIndex/)
  assert.match(store, /readingProgress/)
})

