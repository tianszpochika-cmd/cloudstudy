import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../../', import.meta.url)
const fixtureUrl = (name) => new URL(`./fixtures/${name}`, import.meta.url)

const [srs, assessment, learning] = await Promise.all([
  readFile(fixtureUrl('b2-vocabulary-srs.fixture.json'), 'utf8').then(JSON.parse),
  readFile(fixtureUrl('b2-assessment.fixture.json'), 'utf8').then(JSON.parse),
  readFile(fixtureUrl('b2-learning-flow.fixture.json'), 'utf8').then(JSON.parse),
])

const readRoot = (relativePath) => readFile(new URL(relativePath, root), 'utf8')

function walk(value, visitor, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, visitor, `${path}[${index}]`))
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    visitor(key, child, `${path}.${key}`)
    walk(child, visitor, `${path}.${key}`)
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function applySm2(state, quality, rules = srs.rules) {
  assert.ok(Number.isInteger(quality) && quality >= 0 && quality <= 3, 'quality must be an integer from 0 to 3')
  const nextEaseFactor = Number(clamp(
    state.easeFactor + rules.qualityEaseDelta[String(quality)],
    rules.minEaseFactor,
    rules.maxEaseFactor,
  ).toFixed(2))
  if (quality < rules.passingQuality) {
    return {
      repetition: 0,
      easeFactor: nextEaseFactor,
      intervalDays: 1,
      status: 'LEARNING',
    }
  }

  const repetition = state.repetition + 1
  const intervalDays = repetition <= rules.intervalAnchors.length
    ? rules.intervalAnchors[repetition - 1]
    : Math.min(rules.maxIntervalDays, Math.max(1, Math.round(state.intervalDays * nextEaseFactor)))
  const status = repetition >= 3 || state.status === 'MASTERED' ? 'MASTERED' : 'LEARNING'
  return { repetition, easeFactor: nextEaseFactor, intervalDays, status }
}

function normalizeAnswer(value) {
  return String(value).trim().toLocaleLowerCase().replace(/[.!?,。！？]+$/u, '').replace(/\s+/gu, ' ')
}

function sameArray(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function scoreQuestion(question) {
  const key = question.answerKey
  const candidate = question.candidateAnswer
  switch (question.type) {
    case 'single_choice':
    case 'listening_choice':
      return candidate.selected === key.selected
        ? { scoreBucket: 'FULL', isCorrect: true }
        : { scoreBucket: 'ZERO', isCorrect: false }
    case 'multiple_choice':
      return sameArray([...candidate.selected].sort(), [...key.selected].sort())
        ? { scoreBucket: 'FULL', isCorrect: true }
        : { scoreBucket: 'ZERO', isCorrect: false }
    case 'true_false':
      return candidate.value === key.value
        ? { scoreBucket: 'FULL', isCorrect: true }
        : { scoreBucket: 'ZERO', isCorrect: false }
    case 'matching': {
      const pairs = (value) => value.pairs.map(({ left, right }) => `${left}=>${right}`).sort()
      return sameArray(pairs(candidate), pairs(key))
        ? { scoreBucket: 'FULL', isCorrect: true }
        : { scoreBucket: 'ZERO', isCorrect: false }
    }
    case 'ordering':
      return sameArray(candidate.order, key.order)
        ? { scoreBucket: 'FULL', isCorrect: true }
        : { scoreBucket: 'ZERO', isCorrect: false }
    case 'fill_blank':
      return key.accepted.some((answer) => normalizeAnswer(answer) === normalizeAnswer(candidate.text))
        ? { scoreBucket: 'FULL', isCorrect: true }
        : { scoreBucket: 'ZERO', isCorrect: false }
    case 'speaking_self_record':
      return { scoreBucket: 'PENDING_REVIEW', isCorrect: null }
    default:
      throw new Error(`unregistered question type: ${question.type}`)
  }
}

function addDays(date, days) {
  const result = new Date(`${date}T00:00:00.000Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

test('B2 fixtures are synthetic, versioned, and complete', () => {
  assert.equal(srs.fixtureVersion, 'b2-v1')
  assert.equal(assessment.fixtureVersion, 'b2-v1')
  assert.equal(learning.fixtureVersion, 'b2-v1')
  assert.equal(srs.vocabulary.length, 2)
  for (const item of srs.vocabulary) {
    assert.equal(typeof item.vocabId, 'number')
    assert.equal(typeof item.contentVersionId, 'number')
    assert.ok(item.lemma && item.phonetic)
    assert.ok(item.definitions.length > 0 && item.examples.length > 0)
    assert.equal(item.source.rightsStatus, 'AUTHORIZED')
  }
})

test('B2 fixtures contain no plaintext sensitive fields or credentials', () => {
  const forbidden = new Set([
    'password', 'accessToken', 'refreshToken', 'authorization', 'apiKey', 'secret', 'privateKey',
    'phone', 'mobile', 'email', 'realName', 'identityToken', 'rawAnswer', 'answerText',
    'answerContent', 'userInput', 'promptText', 'rawAudio', 'rawRecording', 'recordingBytes',
    'screenPixels', 'imageBytes', 'paymentCallbackRaw', 'jws', 'signedPayload', 'webhookBody',
    'deviceFingerprint', 'ipAddress', 'cookie',
  ])
  for (const [name, fixture] of [['srs', srs], ['assessment', assessment], ['learning', learning]]) {
    walk(fixture, (key, value, path) => {
      assert.equal(forbidden.has(key), false, `${name} fixture has forbidden field ${path}`)
      if (typeof value === 'string') {
        assert.doesNotMatch(value, /(^|\D)(?:1[3-9]\d{9}|20\d{9})(\D|$)/u, `${path} resembles a phone number`)
        assert.doesNotMatch(value, /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/u, `${path} resembles a private key`)
      }
    })
  }
})

test('SM-2 quality boundaries, ease floor, interval ladder, and cap are deterministic', () => {
  assert.deepEqual(srs.sm2Vectors.map((vector) => applySm2(vector.initial, vector.quality)), srs.sm2Vectors.map((vector) => vector.expected))
  assert.throws(() => applySm2(srs.sm2Vectors[0].initial, -1), /quality/)
  assert.throws(() => applySm2(srs.sm2Vectors[0].initial, 4), /quality/)
  assert.equal(applySm2({ repetition: 4, easeFactor: 1.3, intervalDays: 15, status: 'LEARNING' }, 0).easeFactor, 1.3)
  assert.equal(applySm2({ repetition: 20, easeFactor: 2.5, intervalDays: 365, status: 'MASTERED' }, 3).intervalDays, 365)
  assert.equal(srs.rules.algorithmVersion, 'SM2_Q03_V1')
})

test('SM-2 oracle is anchored to the real Core API implementation', async () => {
  const source = await readRoot('services/core-api/src/main/java/com/englishflow/modules/learning/vocabulary/SrsAlgorithm.java')
  assert.match(source, /VERSION\s*=\s*"SM2_Q03_V1"/u)
  assert.match(source, /MIN_EASE\s*=\s*new BigDecimal\("1\.30"\)/u)
  assert.match(source, /MAX_EASE\s*=\s*new BigDecimal\("2\.50"\)/u)
  assert.match(source, /ANCHORS\s*=\s*\{0, 1, 3, 7, 15, 30, 90\}/u)
  assert.match(source, /if \(q < 2\) nextInterval = 1/u)
  assert.match(source, /Math\.min\(365,/u)
  assert.match(source, /case "UNANSWERED" -> 0/u)
  assert.match(source, /case "INCORRECT" -> Math\.min\(rawQuality, 1\)/u)
})

test('SRS state migration covers recovery and protects illegal jumps', () => {
  const legal = new Set(['NEW>LEARNING', 'LEARNING>LEARNING', 'LEARNING>MASTERED', 'MASTERED>LEARNING', 'MASTERED>MASTERED', 'CONSOLIDATED>LEARNING', 'CONSOLIDATED>CONSOLIDATED'])
  for (const transition of srs.stateTransitions) {
    assert.equal(legal.has(`${transition.from}>${transition.to}`), true, `${transition.from} -> ${transition.to} is not an approved transition`)
  }
  assert.equal(legal.has('NEW>MASTERED'), false)
  assert.equal(legal.has('NEW>CONSOLIDATED'), false)
  assert.equal(legal.has('LEARNING>CONSOLIDATED'), false)
})

test('all objective and non-AI question types use deterministic grading rules', () => {
  assert.deepEqual(assessment.questionTypes.map((question) => question.type), [
    'single_choice', 'multiple_choice', 'true_false', 'matching', 'ordering', 'fill_blank', 'listening_choice', 'speaking_self_record',
  ])
  for (const question of assessment.questionTypes) {
    assert.deepEqual(scoreQuestion(question), question.expected, question.type)
  }
  assert.equal(scoreQuestion(assessment.questionTypes.at(-1)).scoreBucket, 'PENDING_REVIEW', 'Phase 1 speaking self-recording must not imply AI scoring')
})

test('assessment learner projection never exposes answers before submission', () => {
  const forbidden = new Set(assessment.learnerSessionProjection.mustNotExpose)
  for (const field of assessment.learnerSessionProjection.fields) assert.equal(forbidden.has(field), false)
  for (const question of assessment.questionTypes) {
    for (const field of Object.keys(question.public)) assert.equal(forbidden.has(field), false, `${question.questionId}.${field}`)
    assert.equal(Object.hasOwn(question.public, 'answerKey'), false)
  }
  assert.ok(assessment.reviewProjection.fields.includes('referenceAnswer'), 'reference answer belongs to post-submit review projection only')
})

test('4:4:2 daily stream has explainable, unique quotas', () => {
  const { items, quotas, targetCount } = learning.dailyStream
  assert.equal(items.length, targetCount)
  assert.equal(new Set(items.map((item) => item.itemId)).size, targetCount)
  for (const [source, count] of Object.entries(quotas)) {
    assert.equal(items.filter((item) => item.source === source).length, count, source)
  }
  for (const item of items) {
    assert.ok(Number.isInteger(item.priority) && item.priority >= 0)
    assert.ok(item.priorityReason, `${item.itemId} must explain why it was scheduled`)
  }
  assert.equal(items.filter((item) => item.source === 'MISTAKE').every((item) => item.priority >= 90), true)
})

test('D+1 and D+7 mastery verification transitions are traceable and reversible on failure', () => {
  const cases = learning.masteryCases
  for (const item of cases) {
    const expectedDate = item.verification === 'D1' ? addDays('2026-08-20', 1) : addDays('2026-08-20', 7)
    assert.equal(item.scheduledAt, expectedDate, `${item.itemId} schedule`)
    assert.ok(['D1', 'D7'].includes(item.verification))
    assert.ok(item.expectedTo)
  }
  assert.equal(cases.find((item) => item.itemId === 'm-001').expectedTo, 'D7_PENDING')
  assert.equal(cases.find((item) => item.itemId === 'm-002').expectedTo, 'REVIEW_QUEUE')
  assert.equal(cases.find((item) => item.itemId === 'm-003').expectedTo, 'MASTERED')
  assert.equal(cases.find((item) => item.itemId === 'm-004').expectedTo, 'REVIEW_QUEUE')
})

test('idempotency replays the first result and rejects a changed request body', () => {
  const records = new Map()
  for (const command of learning.idempotencyCases) {
    const identity = `${command.scope}|${command.key}`
    const previous = records.get(identity)
    if (!previous) {
      records.set(identity, command.requestHash)
      assert.equal(command.replay, 'same-response')
    } else if (previous === command.requestHash) {
      assert.equal(command.replay, 'same-response')
    } else {
      assert.equal(command.replay, 'IDEMPOTENCY_CONFLICT')
    }
  }
  assert.equal(records.size, 1)
})

test('B2 event catalog contains versioned, payload-safe learning events', async () => {
  const catalog = JSON.parse(await readRoot('packages/contracts/events/v1/catalog.json'))
  const expectedEvents = [
    'learning.srs.batch_created.v1',
    'vocabulary.review.accepted.v1',
    'vocabulary.srs.state_changed.v1',
    'assessment.answer_scored.v1',
    'mastery.state_changed.v1',
    'learning.task.completed.v1',
    'notification.created.v1',
    'notification.delivered.v1',
    'notification.read.v1',
  ]
  const names = new Set(catalog.events.map((event) => event.eventName))
  assert.deepEqual(expectedEvents.filter((name) => !names.has(name)), [])
  const forbiddenPatterns = catalog.forbiddenPayloadFieldPatterns.map((pattern) => new RegExp(pattern, 'iu'))
  for (const [schemaName, schema] of Object.entries(catalog.payloadSchemas)) {
    for (const field of Object.keys(schema.properties ?? {})) {
      assert.equal(forbiddenPatterns.some((pattern) => pattern.test(field)), false, `${schemaName}.${field}`)
    }
  }
})

test('existing performance engine implements all four levels and a real Performance fallback', async () => {
  const source = await readRoot('packages/performance/src/index.ts')
  assert.match(source, /PERFORMANCE_LEVELS\s*=\s*\['Ultra', 'High', 'Medium', 'Performance'\]/u)
  assert.match(source, /Performance:\s*\{[^}]*particleBudget:\s*0[^}]*enableThreeD:\s*false[^}]*enableWaveform:\s*false[^}]*enableRive:\s*false/isu)
  assert.match(source, /if \(reducedMotion\) return 'Performance'/u)
  assert.match(source, /storage\?\.setItem\(storageKey, level\)/u)
  assert.match(source, /Unsupported performance level/u)
})

test('B2 API contract exposes the vocabulary, practice, mastery, report, and notification surfaces', async () => {
  const openapi = JSON.parse(await readRoot('packages/contracts/openapi/v1/openapi.json'))
  const requiredPaths = [
    '/api/v1/content/learner/vocabulary/{vocabularyId}',
    '/api/v1/learning/srs/batches',
    '/api/v1/learning/srs/reviews',
    '/api/v1/learning/plan/current',
    '/api/v1/learning/stream/action',
    '/api/v1/assessment/session/start',
    '/api/v1/assessment/session/answer-item',
    '/api/v1/assessment/session/submit',
    '/api/v1/learning/stream/today',
    '/api/v1/learning/mistakes/queue',
    '/api/v1/learning/mistakes/verify',
    '/api/v1/assessment/report/{sessionUuid}',
    '/api/v1/learning/stats/daily-summary',
    '/api/v1/notifications/messages',
  ]
  const missingPaths = requiredPaths.filter((path) => !openapi.paths[path])
  assert.deepEqual(missingPaths, [], `B2 OpenAPI paths missing: ${missingPaths.join(', ')}`)
})

test('B2 persistence migration covers vocabulary, SRS, assessment, mastery, and notification tables', async () => {
  const migrationFiles = await (await import('node:fs/promises')).readdir(new URL('database/mysql/migrations/', root))
  const migrationText = await Promise.all(migrationFiles.filter((name) => name.endsWith('.sql')).map((name) => readRoot(`database/mysql/migrations/${name}`)))
  const allMigrations = migrationText.join('\n')
  for (const table of ['cnt_vocabulary', 'lrn_srs_state', 'asm_question', 'asm_attempt', 'notifications']) {
    assert.equal(allMigrations.includes(`CREATE TABLE IF NOT EXISTS ${table}`), true, `B2 table missing: ${table}`)
  }
  assert.equal(
    /CREATE TABLE IF NOT EXISTS (?:lrn_mastery_verification|asm_mastery_verification)/u.test(allMigrations),
    true,
    'B2 mastery verification table missing',
  )
})

test.todo('runtime integration: run Core API against MySQL and Redis, replay answer-item requests, and verify D+1/D+7 workers')
test.todo('browser integration: verify learner Web/H5 active recall, answer reveal, keyboard flow, responsive layout, and four-level visual fallback')
test.todo('infrastructure integration: run Docker Compose with fixed ports and verify MySQL/Redis/MinIO/RabbitMQ health')
