import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const appRoot = path.resolve(import.meta.dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(appRoot, relativePath), 'utf8')

test('B11 mobile routes expose canonical listening, reading and speaking pages', () => {
  const pages = read('src/pages.json')
  assert.match(pages, /pages\/b11-listening\/b11-listening/)
  assert.match(pages, /pages\/b11-reading\/b11-reading/)
  assert.match(pages, /pages\/b11-speaking\/b11-speaking/)
  assert.doesNotMatch(pages, /miniapp-wechat|apps\/miniapp-wechat/)
})

test('B11 mobile media and learning mutations are Gateway-relative and idempotent', () => {
  const api = read('src/api/b11.ts')
  assert.match(api, /B11_GATEWAY_PATHS/)
  assert.match(api, /Idempotency-Key/)
  assert.match(api, /clientEventId/)
  assert.match(api, /contentVersion/)
  assert.match(api, new RegExp('/media/assets'))
  assert.match(api, new RegExp('/sync/changes'))
  assert.doesNotMatch(api, /https?:\/\/(?!127\.0\.0\.1:18070)/)
})

test('B11 offline recovery deduplicates client events and keeps version conflicts explainable', () => {
  const offline = read('src/platform/b11-offline.ts')
  const store = read('src/stores/b11-learning.ts')
  assert.match(offline, /clientEventId/)
  assert.match(offline, /duplicate/)
  assert.match(offline, /cursor/)
  assert.match(offline, /conflict/i)
  assert.match(offline, /STORAGE_FULL/)
  assert.match(store, /syncOffline/)
  assert.match(store, /未静默覆盖/)
})

test('B11 listening covers playback controls, captions, Language Clips, dictation and no-media fallback', () => {
  const page = read('src/pages/b11-listening/b11-listening.vue')
  const store = read('src/stores/b11-learning.ts')
  assert.match(page, /playbackRate/)
  assert.match(page, /setA|A 点/)
  assert.match(page, /setB|B 点/)
  assert.match(page, /Language Clips|languageClips/)
  assert.match(page, /字幕|tokens/)
  assert.match(page, /noMedia/)
  assert.match(store, /saveMediaProgress/)
  assert.match(store, /READING_QUESTION/)
})

test('B11 speaking keeps microphone, hash lifecycle, local recovery and Phase 1 AI boundary explicit', () => {
  const page = read('src/pages/b11-speaking/b11-speaking.vue')
  const recording = read('src/platform/b11-recording.ts')
  const api = read('src/api/b11.ts')
  assert.match(page, /requestMicrophonePermission/)
  assert.match(page, /protectRecording/)
  assert.match(page, /retake/)
  assert.match(page, /LOCAL_ONLY/)
  assert.match(recording, /SHA-256/)
  assert.match(api, /aiScoringAvailable: false/)
  assert.doesNotMatch(page + recording + api, /SpeechRecognition|webkitSpeechRecognition/)
  assert.doesNotMatch(page + recording, /audioBytes|recordingBytes|audioBase64/)
})

test('speaking pages expose demo-media fallback and no-microphone learning path', () => {
  const b11 = read('src/pages/b11-speaking/b11-speaking.vue')
  const b3 = read('src/pages/b3-speaking/b3-speaking.vue')
  for (const marker of ['loadB11ListeningMaterials', 'DEMO AUDIO', 'demoAudioMessage', '2D 口型', '示范音频当前没有可播放授权地址']) assert.match(b11 + b3, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(b11, /recordingCopy|permissionStatus/)
  assert.match(b3, /录音权限需用户操作|没有可用录音管理器/)
})

test('B11 performance and interaction downgrade supports four levels and manual motion disable', () => {
  const component = read('src/components/b11/B11StatusPanel.vue')
  const store = read('src/stores/b11-learning.ts')
  const listening = read('src/pages/b11-listening/b11-listening.vue')
  const speaking = read('src/pages/b11-speaking/b11-speaking.vue')
  for (const level of ['Ultra', 'High', 'Medium', 'Performance']) assert.match(component, new RegExp(level))
  assert.match(store, /motionDisabled/)
  assert.match(store, /enableWaveform/)
  assert.match(store, /fallbackMode/)
  assert.match(listening, /static timeline|2D \/ static/)
  assert.match(speaking, /2D mouth fallback/)
})
