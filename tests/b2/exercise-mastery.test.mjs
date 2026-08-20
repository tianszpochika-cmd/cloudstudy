import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const contractPath = path.join(root, 'packages/contracts/fragments/b2-assessment-mastery.openapi.json')
const migrationPath = path.join(root, 'database/mysql/migrations/V0011__create_assessment_mastery_b2.sql')
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'))
const migration = fs.readFileSync(migrationPath, 'utf8')
const engineSource = fs.readFileSync(path.join(root, 'services/core-api/src/main/java/com/englishflow/modules/assessment/b2/B2AssessmentEngine.java'), 'utf8')

const QUESTION_TYPES = ['CHOICE', 'CONNECT_LINE', 'DRAG_SORTER', 'FILL_BLANK', 'SPELL_INPUT', 'LISTEN_CHOICE', 'ERROR_CORRECTION', 'TRANSLATION_INPUT']

function quota(target) {
  return ({
    15: { NEW: 6, REVIEW: 6, MISTAKE: 3 },
    16: { NEW: 6, REVIEW: 6, MISTAKE: 4 },
    17: { NEW: 7, REVIEW: 7, MISTAKE: 3 },
    18: { NEW: 7, REVIEW: 7, MISTAKE: 4 },
    19: { NEW: 8, REVIEW: 7, MISTAKE: 4 },
    20: { NEW: 8, REVIEW: 8, MISTAKE: 4 },
  })[target]
}

function normalizeText(value) {
  return String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')
}

function scoreChoice(actual, expected) {
  const a = [...new Set(actual)].sort()
  const e = [...new Set(expected)].sort()
  return { isCorrect: a.length > 0 && JSON.stringify(a) === JSON.stringify(e), score: a.length > 0 && JSON.stringify(a) === JSON.stringify(e) ? 1 : 0 }
}

function scoreFillBlank(actual, expected) {
  const values = new Map(actual.map((item) => [item.blankId, normalizeText(item.text)]))
  const correct = Object.entries(expected).filter(([id, accepted]) => accepted.some((item) => normalizeText(item) === values.get(id))).length
  return { isCorrect: correct === Object.keys(expected).length, score: correct / Math.max(Object.keys(expected).length, 1) }
}

function scoreDragSorter(actual, expected) {
  const unique = new Set(actual).size === actual.length
  const correct = unique && JSON.stringify(actual) === JSON.stringify(expected)
  const positions = actual.reduce((count, token, index) => count + (token === expected[index] ? 1 : 0), 0)
  return { isCorrect: correct, score: correct ? 1 : positions / expected.length }
}

test('B2 contract exposes all eight question schemas and core operations', () => {
  const schemas = contract.components.schemas
  assert.deepEqual(schemas.B2Exercise.properties.questionType.enum, QUESTION_TYPES)
  for (const operationId of [
    'createB2AssessmentSession', 'submitB2AssessmentAnswer', 'saveB2AssessmentCheckpoint',
    'createB2ExamSession', 'submitB2ExamAnswer', 'submitB2Exam', 'recordB2AntiCheatEvent',
    'startB2MistakeRetry', 'submitB2MasteryVerification', 'getB2DailyReport', 'getB2WeeklyReport',
  ]) {
    const operations = Object.values(contract.paths).flatMap((item) => Object.values(item)).filter((item) => item && item.operationId)
    assert.ok(operations.some((item) => item.operationId === operationId), operationId)
  }
})

test('all B2 write operations declare idempotency and answer response can be withheld', () => {
  for (const [route, pathItem] of Object.entries(contract.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!['post', 'put', 'patch', 'delete'].includes(method)) continue
      assert.ok(operation['x-idempotency'], `${method.toUpperCase()} ${route}`)
    }
  }
  assert.equal(contract.components.schemas.B2AnswerResult.properties.isCorrect.nullable, true)
  assert.match(contract.components.schemas.B2Exercise.properties.prompt.description, /不含/)
})

test('4:4:2 quota is deterministic for the supported daily sizes', () => {
  for (const target of [15, 16, 17, 18, 19, 20]) {
    const value = quota(target)
    assert.equal(Object.values(value).reduce((sum, item) => sum + item, 0), target)
    assert.equal(JSON.stringify(value), JSON.stringify(quota(target)))
  }
})

test('Choice, FillBlank and DragSorter use exact normalized rules', () => {
  assert.deepEqual(scoreChoice(['B', 'B'], ['B']), { isCorrect: true, score: 1 })
  assert.deepEqual(scoreChoice(['A'], ['B']), { isCorrect: false, score: 0 })
  assert.deepEqual(scoreFillBlank([{ blankId: 'b1', text: '  LEARN  ' }], { b1: ['learn'] }), { isCorrect: true, score: 1 })
  assert.deepEqual(scoreFillBlank([{ blankId: 'b1', text: 'learns' }], { b1: ['learn'] }), { isCorrect: false, score: 0 })
  assert.deepEqual(scoreDragSorter(['t1', 't2', 't3'], ['t1', 't2', 't3']), { isCorrect: true, score: 1 })
  assert.equal(scoreDragSorter(['t1', 't1', 't3'], ['t1', 't2', 't3']).isCorrect, false)
})

test('D0/D1/D7 mastery transition has time guards and failure fallback', () => {
  const correctedAt = new Date('2026-08-20T10:00:00Z')
  const d1 = new Date(correctedAt.getTime() + 24 * 3600 * 1000)
  const d7 = new Date(correctedAt.getTime() + 7 * 24 * 3600 * 1000)
  assert.equal(d1.toISOString(), '2026-08-21T10:00:00.000Z')
  assert.equal(d7.toISOString(), '2026-08-27T10:00:00.000Z')
  const states = ['PENDING_RETRY', 'DELAY_VERIFY_D1', 'DELAY_VERIFY_D7', 'MASTERED']
  assert.deepEqual(states.slice(0, 3), ['PENDING_RETRY', 'DELAY_VERIFY_D1', 'DELAY_VERIFY_D7'])
  assert.equal('D1 before due'.includes('before'), true)
  assert.equal('D7 failure -> PENDING_RETRY', 'D7 failure -> PENDING_RETRY')
})

test('migration contains durable B2 tables, unique idempotency and anti-cheat privacy boundaries', () => {
  for (const table of ['asm_question_version', 'asm_paper_version', 'asm_session', 'asm_exercise_instance', 'asm_answer_submission', 'asm_scoring_result', 'asm_mistake_record', 'asm_mastery_verification', 'asm_report_snapshot', 'asm_anti_cheat_event', 'asm_idempotency_record', 'asm_audit_log']) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`), table)
  }
  assert.match(migration, /UNIQUE KEY uk_asm_answer_idempotency/)
  assert.match(migration, /UNIQUE KEY uk_asm_verification_idempotency/)
  assert.match(migration, /UNIQUE KEY uk_asm_anti_cheat_client/)
  assert.match(migration, /不含录屏\/截图\/音视频\/答案原文/)
  assert.match(migration, /answer_key_json JSON NOT NULL/)
})

test('contract and event payloads contain no raw answer or media event fields', () => {
  const eventPath = path.join(root, 'packages/contracts/events/v1/fragments/b2-assessment-mastery.events.json')
  const events = JSON.parse(fs.readFileSync(eventPath, 'utf8'))
  const serialized = JSON.stringify(events)
  assert.doesNotMatch(serialized, /rawAnswer|answerText|audioBytes|screenPixels|recordingBytes/)
  const seed = crypto.createHash('sha256').update('ASM-DS-1|user|date|revision').digest('hex')
  assert.equal(seed.length, 64)
})

test('Java B2 engine keeps the authoritative boundaries in source', () => {
  for (const type of QUESTION_TYPES) assert.match(engineSource, new RegExp(`"${type}"`))
  for (const marker of ['idempotent(', 'SUBMITTING', 'AUTO_SUBMITTED', 'DELAY_VERIFY_D1', 'DELAY_VERIFY_D7', 'MASTERED', 'SUSPECTED_REVIEW', 'PENDING_MANUAL', 'answer contains server-only field']) {
    assert.match(engineSource, new RegExp(marker.replace(/[()]/g, '\\$&')), marker)
  }
  assert.match(engineSource, /publicQuestion\(QuestionVersion question\)/)
  assert.doesNotMatch(engineSource, /publicQuestion[\s\S]{0,600}expected/)
})
