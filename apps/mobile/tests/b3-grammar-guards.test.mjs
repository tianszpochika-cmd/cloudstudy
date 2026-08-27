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

test('mobile B3 grammar keeps the authenticated entry guard and performance fallback', async () => {
  const page = await read('apps/mobile/src/pages/b3-grammar/b3-grammar.vue')
  assert.match(page, /await session\.restore\(\)/u)
  assert.match(page, /if \(!session\.isAuthenticated\)/u)
  assert.match(page, /performanceLevel\.value === 'Performance' \|\| graph\.value\?\.graphStatus === 'DEGRADED'/u)
})
