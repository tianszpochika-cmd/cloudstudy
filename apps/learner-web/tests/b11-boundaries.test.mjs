import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

test('B11 learner API keeps Gateway/idempotency/content-version seams', () => {
  const source = read('src/api/b11.ts')
  for (const marker of ['/media/assets/', '/multimodal/recordings', '/sync/changes', '/notification/preferences', 'Idempotency-Key', 'clientEventId', 'contentVersionId']) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(source, /aiScoringEnabled:\s*false/)
  assert.doesNotMatch(source, /rawAudio|audioBytes|base64Audio/)
})

test('B11 store reuses B3 offline/media/recording adapters and does not put raw recordings in reactive state', () => {
  const source = read('src/stores/b11.ts')
  assert.match(source, /queueProgress/)
  assert.match(source, /pending/)
  assert.match(source, /getMediaManifest/)
  assert.match(`${source}\n${read('src/api/b11.ts')}`, /contentHash/)
  assert.match(source, /aiScoringEnabled|aiScoringAvailable/)
  assert.doesNotMatch(source, /ref<Blob|ref<ArrayBuffer|rawRecording|rawAudio/)
})

test('B11 pages cover permission, playback, offline/revoked/expired and rule-only UX', () => {
  const listening = read('src/pages/B11ListeningPage.vue')
  const reading = read('src/pages/B11ReadingPage.vue')
  const speaking = read('src/pages/B11SpeakingPage.vue')
  for (const marker of ['revoked', 'expired', 'A-B', 'Language Clips', 'downloadB3Asset', 'subtitleMode', 'queueProgress']) assert.match(listening, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  for (const marker of ['saveCurrentReadingProgress', 'contentVersionId', 'offline', 'readingQuestions', 'readingActiveBlock']) assert.match(`${reading}\n${read('src/stores/b10.ts')}`, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  for (const marker of ['getUserMedia', 'MediaRecorder', 'permissionState', 'encryptB3Recording', 'decryptB3Recording', 'retake', 'submitSelfRating', 'aiScoringAvailable=false']) assert.match(speaking, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(speaking, /不生成 AI 分数|No AI score/)
})

test('B11 routes migrate existing learning entry points without creating another app', () => {
  const source = read('src/router/index.ts')
  assert.match(source, /B11ListeningPage\.vue/)
  assert.match(source, /B11ReadingPage\.vue/)
  assert.match(source, /B11SpeakingPage\.vue/)
  for (const marker of ['/courses/listening', '/practice/listening', '/courses/reading', '/practice/reading', '/phonetics', '/practice/shadowing']) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})
