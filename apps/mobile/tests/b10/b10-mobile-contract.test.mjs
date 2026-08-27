import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const appRoot = path.resolve(import.meta.dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8')

test('B10 mobile uses Gateway-relative seams for content, learning and assessment', () => {
  const source = read('src/api/b10.ts')
  assert.match(source, /content:\s*\{/)
  assert.match(source, /learning:\s*\{/)
  assert.match(source, /assessment:\s*\{/)
  assert.match(source, /mobileApiClient\.request/)
  assert.doesNotMatch(source, /https?:\/\/(?!127\.0\.0\.1:18070)/)
  assert.match(source, /Accept-Language/)
  assert.match(source, /contentLocale/)
})

test('B10 mobile mutations carry stable idempotency ids and never send answer keys', () => {
  const api = read('src/api/b10.ts')
  const store = read('src/stores/b10-learning.ts')
  assert.match(api, /Idempotency-Key/)
  assert.match(api, /clientSubmissionId/)
  assert.match(api, /clientEventId/)
  assert.doesNotMatch(api, /correctAnswer|answerKey|standardAnswer/)
  assert.match(store, /reviewStatus === 'ACCEPTED'/)
  assert.match(store, /reviewStatus === 'QUEUED'/)
  assert.match(store, /queuedReviews/) 
})

test('B10 mobile SRS review carries the B25 top-level item id', () => {
  const api = read('src/api/b10.ts')
  const store = read('src/stores/b10-learning.ts')
  assert.match(api, /data:\s*\{\s*itemId:\s*card\.itemId/)
  assert.match(api, /rawQuality:\s*quality/)
  assert.match(store, /return \{ itemId: card\.itemId, snapshotId:/)
  assert.match(api, /itemId: number \| string/)
})

test('B10 mobile covers recovery states, content-version staleness and performance downgrade', () => {
  const domain = read('src/domain/b10.ts')
  const status = read('src/components/b10/B10StatusPanel.vue')
  const exercise = read('src/components/b10/B10ExerciseCard.vue')
  const pages = ['src/pages/b2-vocabulary/b2-vocabulary.vue', 'src/pages/b2-practice/b2-practice.vue', 'src/pages/b3-reading/b3-reading.vue', 'src/pages/b3-grammar/b3-grammar.vue', 'src/pages/b3-writing/b3-writing.vue', 'src/pages/b10-report/b10-report.vue'].map(read).join('\n')
  for (const state of ['offline', 'forbidden', 'stale', 'empty', 'loading']) assert.match(domain + status + pages, new RegExp(state))
  assert.match(domain, /contentVersionStale/)
  assert.match(status, /Performance/)
  assert.match(exercise, /上移|moveToken/)
  assert.match(exercise, /下移|moveToken/)
  assert.match(pages, /b10-theme--/)
  assert.match(pages, /contentLocale/)
})

test('B10 mobile routes expose the report page without a miniapp project', () => {
  const pages = read('src/pages.json')
  assert.match(pages, /pages\/b10-report\/b10-report/)
  assert.doesNotMatch(pages, /miniapp|mini-app|apps\/miniapp-wechat/)
})

test('H5 placement reads encode locale and optional session id as query parameters', () => {
  const source = read('src/api/learner-content.ts')
  assert.match(source, /type QueryParams = string \| Record<string, string \| null \| undefined>/)
  assert.match(source, /query\('\/assessment\/placement\/start', \{ contentLocale, \.\.\.\(sessionId \? \{ sessionId \} : \{\}\) \}\)/)
})
