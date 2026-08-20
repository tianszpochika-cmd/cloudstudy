import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../../', import.meta.url)
const read = (file) => fs.readFile(new URL(file, root), 'utf8')

test('B3 client baseline exposes multimodal routes and domain state', async () => {
  const files = [
    'apps/learner-web/src/domain/b3.ts', 'apps/learner-web/src/api/b3.ts', 'apps/learner-web/src/stores/b3.ts',
    'apps/learner-web/src/pages/B3GrammarPage.vue', 'apps/learner-web/src/pages/B3ListeningPage.vue',
    'apps/learner-web/src/pages/B3ReadingPage.vue', 'apps/learner-web/src/pages/B3SpeakingPage.vue', 'apps/learner-web/src/pages/B3WritingPage.vue',
    'apps/mobile/src/pages/b3-grammar/b3-grammar.vue', 'apps/mobile/src/pages/b3-listening/b3-listening.vue',
    'apps/mobile/src/pages/b3-reading/b3-reading.vue', 'apps/mobile/src/pages/b3-speaking/b3-speaking.vue', 'apps/mobile/src/pages/b3-writing/b3-writing.vue',
  ]
  await Promise.all(files.map(read))
})

test('B3 client keeps Phase 1 AI and offline boundaries visible', async () => {
  const files = ['apps/learner-web/src/domain/b3.ts', 'apps/learner-web/src/api/b3.ts', 'apps/learner-web/src/stores/b3.ts', 'apps/learner-web/src/pages/B3SpeakingPage.vue']
  const source = (await Promise.all(files.map(read))).join('\n')
  assert.match(source, /aiScoringAvailable|无 AI|AI 评分/iu)
  assert.match(source, /offline|离线|PENDING_SYNC|冲突/iu)
  assert.doesNotMatch(source, /\bany\b/u)
})

test('B3 speaking clients expose server-authored shadowing and roleplay turns', async () => {
  const files = [
    'apps/learner-web/src/api/b3.ts',
    'apps/learner-web/src/pages/B3SpeakingPage.vue',
    'apps/mobile/src/api/b3.ts',
    'apps/mobile/src/pages/b3-speaking/b3-speaking.vue',
  ]
  const source = (await Promise.all(files.map(read))).join('\n')
  assert.match(source, /createShadowingSession|影子跟读/iu)
  assert.match(source, /createRoleplaySession|submitRoleplayTurn|角色扮演/iu)
  assert.match(source, /recordingRequired|需要.*录音/iu)
})
