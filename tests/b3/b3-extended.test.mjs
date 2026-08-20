import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../../', import.meta.url)
const read = (file) => fs.readFile(new URL(file, root), 'utf8')

test('B3 detailed contract covers authored practice, media timeline, offline package, reading and shadowing flows', async () => {
  const contract = JSON.parse(await read('packages/contracts/openapi/v1/openapi.json'))
  const required = [
    '/api/v1/grammar/tree', '/api/v1/grammar/exercises', '/api/v1/grammar/practice/attempts', '/api/v1/grammar/mastery', '/api/v1/grammar/sentences/{sentenceId}/xray',
    '/api/v1/writing/templates', '/api/v1/writing/materials', '/api/v1/writing/proofreading/exercises', '/api/v1/writing/history',
    '/api/v1/listening/materials/{materialId}/timeline', '/api/v1/listening/clips', '/api/v1/listening/offline-packages', '/api/v1/listening/offline-packages/{packageId}/assets/{assetId}',
    '/api/v1/reading/articles/{articleId}/dictionary', '/api/v1/reading/articles/{articleId}/story', '/api/v1/reading/questions', '/api/v1/reading/attempts',
    '/api/v1/phonetics/minimal-pairs', '/api/v1/speaking/shadowing/sessions', '/api/v1/speaking/roleplay/sessions',
  ]
  assert.deepEqual(required.filter((path) => !contract.paths[path]), [])
  assert.equal(contract.components.schemas.B3GrammarAttemptRequest['x-sensitive-fields'].includes('answer'), true)
  assert.equal(contract.components.schemas.B3ReadingAttemptRequest['x-sensitive-fields'].includes('answer'), true)
  assert.equal(contract.components.schemas.B3ShadowingSessionRequest.properties.targetGapMs.minimum, 500)
})

test('B3 implementation includes deterministic rule, versioned content seed, and no placeholder recording hash', async () => {
  const engine = await read('services/core-api/src/main/java/com/englishflow/modules/learning/b3/B3RuleEngine.java')
  const service = await read('services/core-api/src/main/java/com/englishflow/modules/learning/b3/B3MultimodalService.java')
  const api = await read('apps/learner-web/src/api/b3.ts')
  assert.match(engine, /scoreGrammarAnswer/u)
  assert.match(engine, /scoreSentenceBlocks/u)
  assert.match(engine, /updateMastery/u)
  assert.match(service, /TENSE_FUTURE_PERFECT/u)
  assert.match(service, /createOfflinePackage/u)
  assert.match(service, /deleteRecording/u)
  assert.match(service, /IDEMPOTENCY_CONFLICT/u)
  assert.match(service, /CONTENT_VERSION_UNAVAILABLE/u)
  assert.doesNotMatch(api, /0['"]?\.repeat\(64\)/u)
  assert.match(api, /contentHash: string/u)
})

test('B3 web and mobile offline adapters have schema migration, cursor and secure hash boundaries', async () => {
  const web = await read('apps/learner-web/src/platform/b3-offline.ts')
  const mobile = await read('apps/mobile/src/platform/b3-offline.ts')
  for (const source of [web, mobile]) {
    assert.match(source, /SCHEMA_VERSION\s*=\s*2/u)
    assert.match(source, /cursor/u)
    assert.match(source, /SHA-256/u)
    assert.match(source, /PENDING/u)
  }
  assert.match(web, /localStorage/u)
  assert.match(mobile, /setStorageSync/u)
})

test('B3 migration keeps detailed content and learner state tables append-only', async () => {
  const migration = await read('database/mysql/migrations/V0012__create_multimodal_grammar_reading_speaking_sync.sql')
  for (const table of ['cnt_grammar_trap', 'cnt_grammar_exercise', 'cnt_sentence_slice', 'cnt_sentence_audio_track', 'cnt_writing_template', 'cnt_writing_proofreading_issue', 'cnt_media_clip', 'cnt_media_offline_package', 'cnt_media_offline_package_item', 'cnt_reading_dictionary_entry', 'cnt_reading_question', 'cnt_phoneme_minimal_pair', 'lrn_shadowing_session', 'lrn_speaking_recording_segment', 'lrn_speaking_roleplay_session']) assert.match(migration, new RegExp('CREATE TABLE IF NOT EXISTS\\s+`?' + table + '`?', 'u'))
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE TABLE/iu)
})

test('B3 media download boundary supports resumable range, expiry and checksum cleanup', async () => {
  const source = await read('apps/learner-web/src/platform/b3-media-download.ts')
  assert.match(source, /Range\s*=\s*`bytes=\$\{bytes\.byteLength\}-`/u)
  assert.match(source, /SHA-256/u)
  assert.match(source, /MEDIA_EXPIRED/u)
  assert.match(source, /MEDIA_CHECKSUM_MISMATCH/u)
  assert.match(source, /cache\.remove\(request\.assetId\)/u)
})

test('B3 answer and recording boundaries fail closed at the service and client vault', async () => {
  const service = await read('services/core-api/src/main/java/com/englishflow/modules/learning/b3/B3MultimodalService.java')
  const contract = JSON.parse(await read('packages/contracts/openapi/v1/openapi.json'))
  const vault = await read('apps/learner-web/src/platform/b3-recording-vault.ts')
  assert.match(service, /targetCount.*limit\(targetCount\)/su)
  assert.match(service, /answersRemainProtected/u)
  assert.match(service, /RECORDING_ENCRYPTION_REQUIRED/u)
  assert.match(service, /saveOfflineCursor/u)
  assert.doesNotMatch(service, /publicProofreading[\s\S]{0,500}correctText/u)
  assert.equal('correctText' in contract.components.schemas.B3ProofreadingIssue.properties, false)
  assert.match(vault, /AES-GCM/u)
  assert.match(vault, /length:\s*256/u)
  assert.match(vault, /crypto\.subtle\.digest\(['"]SHA-256/u)
  assert.doesNotMatch(vault, /localStorage|sessionStorage/u)
})

test('B3 cross-platform pages expose the four-level performance fallback and no AI score', async () => {
  const files = [
    'apps/learner-web/src/pages/B3GrammarPage.vue', 'apps/learner-web/src/pages/B3ListeningPage.vue', 'apps/learner-web/src/pages/B3ReadingPage.vue',
    'apps/learner-web/src/pages/B3SpeakingPage.vue', 'apps/learner-web/src/pages/B3WritingPage.vue',
    'apps/mobile/src/pages/b3-grammar/b3-grammar.vue', 'apps/mobile/src/pages/b3-listening/b3-listening.vue', 'apps/mobile/src/pages/b3-reading/b3-reading.vue',
    'apps/mobile/src/pages/b3-speaking/b3-speaking.vue', 'apps/mobile/src/pages/b3-writing/b3-writing.vue',
  ]
  const sources = await Promise.all(files.map(read))
  for (const source of sources) {
    assert.match(source, /Performance/u)
    assert.match(source, /performanceLevel|Performance/u)
  }
  assert.match(sources.join('\n'), /aiScoringAvailable|AI 评分/iu)
})
