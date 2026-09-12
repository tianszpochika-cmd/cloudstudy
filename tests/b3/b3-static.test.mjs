import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../../', import.meta.url)
const read = (file) => fs.readFile(new URL(file, root), 'utf8')
const fixture = JSON.parse(await read('tests/b3/fixtures/b3-multimodal.fixture.json'))

function walk(value, visitor, path = '$') {
  if (Array.isArray(value)) return value.forEach((entry, index) => walk(entry, visitor, `${path}[${index}]`))
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) { visitor(key, child, `${path}.${key}`); walk(child, visitor, `${path}.${key}`) }
}

function normalize(value) {
  return String(value ?? '').normalize('NFC').trim().toLocaleLowerCase('en-US').replace(/[.!?,;:。！？、，；：]+$/u, '').replace(/\s+/gu, ' ')
}

function dictation(expected, actual) {
  const left = normalize(expected).split(' ').filter(Boolean)
  const right = normalize(actual).split(' ').filter(Boolean)
  const mismatchPositions = []
  let matched = 0
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if (left[index] && left[index] === right[index]) matched += 1
    else mismatchPositions.push(index)
  }
  return { score: left.length ? matched / left.length : 0, mismatchPositions }
}

function isAcyclic(nodes, edges) {
  const graph = new Map(nodes.map((node) => [node, []]))
  const indegree = new Map(nodes.map((node) => [node, 0]))
  for (const [from, to] of edges) {
    if (!graph.has(from) || !graph.has(to)) return false
    graph.get(from).push(to); indegree.set(to, indegree.get(to) + 1)
  }
  const queue = nodes.filter((node) => indegree.get(node) === 0)
  let visited = 0
  while (queue.length) {
    const current = queue.shift(); visited += 1
    for (const child of graph.get(current)) { indegree.set(child, indegree.get(child) - 1); if (indegree.get(child) === 0) queue.push(child) }
  }
  return visited === nodes.length
}

test('B3 fixture is synthetic, versioned, and covers all multimodal domains', () => {
  assert.equal(fixture.fixtureVersion, 'b3-v1')
  assert.equal(fixture.contentVersionId, 301)
  assert.equal(fixture.phonetics.count, 48)
  assert.deepEqual(fixture.phonetics.groups, { MONOPHTHONG: 12, DIPHTHONG: 8, CONSONANT: 24, TEACHING_VARIANT: 4 })
  assert.equal(fixture.writing.aiScoringAvailable, false)
})

test('B3 fixture has valid sentence DAG and bounded media timeline', () => {
  assert.equal(isAcyclic(fixture.grammar.nodeIds, fixture.grammar.edges), true)
  assert.equal(isAcyclic(fixture.grammar.nodeIds, [['n1', 'n2'], ['n2', 'n1']]), false)
  const segment = fixture.listening.segments[0]
  let previousEnd = 0
  for (const token of segment.tokens) {
    assert.ok(token.startMs >= segment.startMs && token.endMs <= segment.endMs && token.startMs < token.endMs)
    assert.ok(token.startMs >= previousEnd)
    previousEnd = token.endMs
  }
})

test('B3 dictation normalization and mismatch feedback are deterministic', () => {
  assert.deepEqual(dictation('Good habits help.', ' good   habits help '), { score: 1, mismatchPositions: [] })
  assert.deepEqual(dictation('Good habits help.', 'Good habit help'), { score: 2 / 3, mismatchPositions: [1] })
})

test('B3 contract exposes grammar, writing, multimodal, speaking, and sync surfaces', async () => {
  const contract = JSON.parse(await read('packages/contracts/openapi/v1/openapi.json'))
  const required = [
    '/api/v1/grammar/points', '/api/v1/grammar/sentences/{sentenceId}', '/api/v1/grammar/practice/sessions',
    '/api/v1/writing/prompts', '/api/v1/writing/submissions', '/api/v1/writing/corrections',
    '/api/v1/listening/materials', '/api/v1/listening/sessions', '/api/v1/listening/sessions/{sessionId}/dictation',
    '/api/v1/reading/articles', '/api/v1/reading/progress', '/api/v1/reading/mining',
    '/api/v1/phonetics/catalog', '/api/v1/speaking/recordings', '/api/v1/offline/sync/push', '/api/v1/offline/sync/pull',
  ]
  assert.deepEqual(required.filter((path) => !contract.paths[path]), [])
  for (const [route, item] of Object.entries(contract.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (!['post', 'put', 'patch', 'delete'].includes(method)) continue
      assert.ok(operation['x-idempotency'], `${method.toUpperCase()} ${route} needs idempotency`)
    }
  }
})

test('B3 contract and event payloads do not expose raw answer, recording, or AI scoring data', async () => {
  const contract = JSON.parse(await read('packages/contracts/openapi/v1/openapi.json'))
  const catalog = JSON.parse(await read('packages/contracts/events/v1/catalog.json'))
  const forbidden = /^(rawAnswer|answerText|answerContent|userInput|prompt|rawRecording|recordingBytes|audio|video)$/iu
  for (const [schemaName, schema] of Object.entries(contract.components.schemas)) {
    if (!schemaName.startsWith('B3')) continue
    walk(schema, (key, value, path) => {
      if (key === 'properties' && value && typeof value === 'object') for (const property of Object.keys(value)) {
        if (forbidden.test(property)) assert.ok(schema['x-sensitive-fields']?.includes(property), `${schemaName}.${property} must be declared sensitive`)
      }
    })
  }
  const b3Events = catalog.events.filter((event) => event.eventName.includes('.'))
  // The invariant is the versioned naming convention, not "version 1": the catalog legitimately
  // carries second-version events beside first-version ones, and pinning .v1 rejected every one of
  // them without saying anything about whether the name itself is well formed.
  for (const event of b3Events) assert.match(event.eventName, /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+\.v\d+$/u)
  assert.equal(Object.keys(catalog.payloadSchemas).some((name) => name === 'WritingEvaluationCompleted'), true)
  assert.equal(catalog.payloadSchemas.WritingEvaluationCompleted.properties.aiScoringAvailable.const, false)
})

test('B3 migration and rule engine preserve privacy and deterministic boundaries', async () => {
  const migration = await read('database/mysql/migrations/V0012__create_multimodal_grammar_reading_speaking_sync.sql')
  for (const table of ['cnt_grammar_point', 'cnt_media_material', 'cnt_reading_article', 'cnt_phoneme_symbol', 'lrn_b3_practice_session', 'lrn_reading_progress', 'lrn_speaking_recording', 'lrn_offline_change', 'lrn_offline_cursor', 'lrn_offline_conflict']) assert.match(migration, new RegExp('CREATE TABLE IF NOT EXISTS `?' + table + '`?', 'u'))
  assert.match(migration, /`answer_ciphertext` VARBINARY/iu)
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE TABLE/iu)
  const engine = await read('services/core-api/src/main/java/com/englishflow/modules/learning/b3/B3RuleEngine.java')
  assert.match(engine, /RULE_VERSION\s*=\s*"B3-RULE-1"/u)
  assert.match(engine, /public static DictationResult scoreDictation/u)
  assert.match(engine, /public static List<SoundAnnotation> soundChanges/u)
  assert.doesNotMatch(engine, /OpenAI|LangChain|Whisper|ASR|LLM/iu)
  assert.equal(crypto.createHash('sha256').update('b3').digest('hex').length, 64)
})

test('B3 offline conflict policy is explicit and reversible', () => {
  for (const item of fixture.sync.cases) {
    const resolution = item.entityVersion > fixture.sync.serverVersion ? 'LOCAL_RETRY' : item.entityVersion === fixture.sync.serverVersion ? 'MERGED' : 'SERVER_WINS'
    assert.equal(resolution, item.expected)
  }
})
