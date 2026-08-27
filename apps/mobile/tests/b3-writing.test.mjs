import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const read = (file) => readFile(new URL(file, root), 'utf8')

test('B3 mobile writing does not render taskText twice when sourceText falls back to it', async () => {
  const source = await read('src/pages/b3-writing/b3-writing.vue')
  assert.match(source, /const sourceText = computed\(\(\) => \{/u)
  assert.match(source, /if \(!prompt\?\.sourceText \|\| prompt\.sourceText === prompt\.taskText\) return null/u)
  assert.match(source, /<text v-if="sourceText" class="b10-writing-card__source">\{\{ sourceText \}\}<\/text>/u)
  assert.doesNotMatch(source, /v-if="selectedPrompt\?\.sourceText"[^>]*>\{\{ selectedPrompt\.sourceText \}\}/u)
})

test('B3 mobile writing keeps the authenticated recovery and draft-preservation seams', async () => {
  const source = await read('src/pages/b3-writing/b3-writing.vue')
  assert.match(source, /await session\.restore\(\)/u)
  assert.match(source, /persistDraft\(\)/u)
  assert.match(source, /写作提交失败，草稿仍保留/u)
  assert.match(source, /yx\.b10\.mobile\.writing\.draft\.v1/u)
})
