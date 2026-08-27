import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const read = (file) => readFile(new URL(file, root), 'utf8')

test('B3 learner writing resolves history labels from the loaded prompt when the API omits promptTitle', async () => {
  const source = await read('src/pages/B3WritingPage.vue')
  assert.match(source, /function historyPromptLabel\(promptId: number, promptTitle: string \| null\): string/u)
  assert.match(source, /store\.writingPrompts\.find\(\(item\) => item\.promptId === promptId\)\?\.title/u)
  assert.match(source, /historyPromptLabel\(item\.promptId, item\.promptTitle\)/u)
})

test('B3 learner writing binds server content and feedback without a client-side charset rewrite', async () => {
  const source = await read('src/pages/B3WritingPage.vue')
  assert.match(source, /prompt\.title/u)
  assert.match(source, /prompt\.taskText/u)
  assert.match(source, /template\.title/u)
  assert.match(source, /material\.bodyText/u)
  assert.match(source, /store\.writingFeedback\.message/u)
  assert.match(source, /historyPromptLabel\(item\.promptId, item\.promptTitle\)/u)
  assert.doesNotMatch(source, /TextDecoder|decodeURIComponent/u)
})
