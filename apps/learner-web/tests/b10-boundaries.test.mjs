import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => readFile(resolve(appRoot, relative), 'utf8')

test('B10 learner-web has learning/assessment/content Gateway seams with idempotent writes', async () => {
  const source = await read('src/api/b10.ts')
  assert.match(source, /B10_GATEWAY_ROUTES/)
  assert.match(source, /vocabularyBatch: '\/learning\/srs\/batches'/)
  assert.match(source, /sessions: '\/assessment\/sessions'/)
  assert.match(source, /readingArticles: '\/reading\/articles'/)
  assert.match(source, /Idempotency-Key/)
  assert.match(source, /X-UI-Locale/)
  assert.match(source, /X-Content-Locale/)
  assert.doesNotMatch(source, /https?:\/\//)
})

test('B10 learner-web never models answer keys/rules in the client projection', async () => {
  const domain = await read('src/domain/b10.ts')
  const api = await read('src/api/b10.ts')
  assert.doesNotMatch(domain, /correctAnswer|answerKey|answerRule|rubricRuleBody/)
  assert.doesNotMatch(api, /correctAnswer|answerKey|answerRule|rubricRuleBody/)
  assert.match(api, /feedbackCode/)
  assert.match(api, /ruleVersion/)
})

test('B10 pages use the shared B10 store and expose recovery/performance seams', async () => {
  const pages = await Promise.all([
    read('src/pages/VocabularyPage.vue'),
    read('src/pages/B2PracticePage.vue'),
    read('src/pages/B2ReportPage.vue'),
    read('src/pages/B3ReadingPage.vue'),
    read('src/pages/B3GrammarPage.vue'),
    read('src/pages/B3WritingPage.vue'),
  ])
  for (const source of pages) {
    assert.match(source, /useB10Store/)
    assert.match(source, /B10StatePanel/)
    assert.match(source, /data-performance/)
  }
})

test('B10 store contains ordered offline recovery and local draft/checkpoint persistence', async () => {
  const source = await read('src/stores/b10.ts')
  assert.match(source, /offlineQueue/)
  assert.match(source, /sort\(\(left, right\) => left\.clientSeq - right\.clientSeq\)/)
  assert.match(source, /savePracticeCheckpoint/)
  assert.match(source, /writingDraft/)
  assert.match(source, /setFailure/)
  assert.match(source, /failureKind\(error\)/)
})
