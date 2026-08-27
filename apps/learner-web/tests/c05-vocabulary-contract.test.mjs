import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => readFile(resolve(appRoot, relative), 'utf8')

test('C05 learner vocabulary keeps content errors distinct from a legitimate empty SRS batch', async () => {
  const api = await read('src/api/b10.ts')
  const page = await read('src/pages/VocabularyPage.vue')
  assert.match(api, /await getVocabularyFront\(itemId\)/)
  assert.doesNotMatch(api, /getVocabularyFront\(itemId\)\.catch\(\(\) => \(\{\}\)\)/)
  assert.match(page, /status === 'empty'/)
  assert.match(page, /class="card-error" role="alert"/)
  assert.match(page, /status !== 'ready' \|\| store\.queueCount/)
})
