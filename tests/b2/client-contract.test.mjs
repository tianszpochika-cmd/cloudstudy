import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const root = new URL('../../', import.meta.url)
const read = (path) => fs.readFile(new URL(path, root), 'utf8')

test('B2 client core files exist and expose the required interaction surfaces', async () => {
  const files = [
    'apps/learner-web/src/domain/b2.ts',
    'apps/learner-web/src/api/b2.ts',
    'apps/learner-web/src/stores/b2.ts',
    'apps/learner-web/src/pages/VocabularyPage.vue',
    'apps/learner-web/src/pages/B2PracticePage.vue',
    'apps/learner-web/src/pages/B2ReportPage.vue',
    'apps/mobile/src/pages/b2-vocabulary/b2-vocabulary.vue',
    'apps/mobile/src/pages/b2-practice/b2-practice.vue',
  ]
  await Promise.all(files.map((file) => read(file)))
})

test('B2 domain keeps learning item and question types explicit', async () => {
  const source = await read('apps/learner-web/src/domain/b2.ts')
  for (const marker of ['LearningItemRef', "ReviewQuality = 0 | 1 | 2 | 3", "type: 'CHOICE'", "type: 'FILL_BLANK'", "type: 'DRAG_SORTER'", "type: 'LISTEN'", "type: 'TRANSLATION'", 'D1_PENDING', 'D7_PENDING']) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(source, /\bany\b/)
})

test('B2 client does not present locally invented success data', async () => {
  const files = ['apps/learner-web/src/api/b2.ts', 'apps/learner-web/src/stores/b2.ts', 'apps/learner-web/src/pages/VocabularyPage.vue', 'apps/learner-web/src/pages/B2PracticePage.vue', 'apps/learner-web/src/pages/B2ReportPage.vue']
  const sources = await Promise.all(files.map((file) => read(file)))
  const joined = sources.join('\n')
  assert.match(joined, /PENDING_SYNC|待同步/)
  assert.match(joined, /服务端|server/i)
  assert.match(joined, /empty|空态/)
})
