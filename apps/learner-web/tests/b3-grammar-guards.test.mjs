import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../../../', import.meta.url)
const read = (file) => fs.readFile(new URL(file, root), 'utf8')

test('learner-web B3 grammar ignores stale sentence responses after point changes', async () => {
  const store = await read('apps/learner-web/src/stores/b10.ts')
  assert.match(store, /let grammarSelectionRequest = 0/u)
  assert.match(store, /const requestId = \+\+grammarSelectionRequest/u)
  assert.match(store, /requestId !== grammarSelectionRequest \|\| selectedGrammarPointId\.value !== grammarPointId/u)
  assert.match(store, /grammarSentence\.value = null; grammarSentenceFallback\.value = false/u)
})

test('learner-web B3 grammar does not submit blank exercise answers', async () => {
  const page = await read('apps/learner-web/src/pages/B3GrammarPage.vue')
  assert.match(page, /const exerciseCanSubmit = computed/u)
  assert.match(page, /:disabled="!exerciseCanSubmit"/u)
  assert.match(page, /initial-answer="exerciseAnswer"/u)
})
