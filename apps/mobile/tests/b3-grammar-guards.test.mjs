import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../../../', import.meta.url)
const read = (file) => fs.readFile(new URL(file, root), 'utf8')

test('mobile B3 grammar ignores stale graph and session responses after point changes', async () => {
  const page = await read('apps/mobile/src/pages/b3-grammar/b3-grammar.vue')
  assert.match(page, /let grammarSelectionRequest = 0/u)
  assert.match(page, /const requestId = \+\+grammarSelectionRequest/u)
  assert.ok((page.match(/requestId !== grammarSelectionRequest/g) ?? []).length >= 3)
  assert.match(page, /const nextGraph = await b10LearningApi\.getSentenceGraph/u)
  assert.match(page, /const nextSession = await b10LearningApi\.createGrammarSession/u)
})

test('mobile grammar lists exercises when the point tree is empty', async () => {
  const page = await read('apps/mobile/src/pages/b3-grammar/b3-grammar.vue')
  assert.match(page, /grammar-unbound/u)
  assert.match(page, /createGrammarSession\(context\.value, 0, null/u)
  assert.match(page, /loose\.exercises\.length \? 'ready' : 'empty'/u)
})

test('mobile grammar answers open a real assessment session from the practice ref', async () => {
  const api = await read('apps/mobile/src/api/b10.ts')
  assert.match(api, /h5-grammar-\$\{questionItemId\}/u)
  assert.match(api, /B10_GATEWAY_PATHS\.assessment\.sessions/u)
  assert.match(api, /itemIds: \[questionItemId\]/u)
  assert.doesNotMatch(api, /submitB3GrammarAttempt/u)
})

test('mobile B3 grammar keeps the authenticated entry guard and performance fallback', async () => {
  const page = await read('apps/mobile/src/pages/b3-grammar/b3-grammar.vue')
  assert.match(page, /await session\.restore\(\)/u)
  assert.match(page, /if \(!session\.isAuthenticated\)/u)
  assert.match(page, /performanceLevel\.value === 'Performance' \|\| graph\.value\?\.graphStatus === 'DEGRADED'/u)
})
