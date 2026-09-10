import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  AUDIT_SCHEMA,
  RUNTIME_SCHEMA,
  assertSafeEvidence,
  auditEnvelopesFromChunk,
  gatewayHealthRateKey,
  parseArguments,
  parseRateState,
  redisCommand,
  serializeEvidence,
  validateAuditEnvelope,
} from './lib/m2-runtime-lib.mjs'
import { BROWSER_CASE_IDS, planHeaderRewrite } from './lib/m2-browser-checks.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const runtimeSource = fs.readFileSync(path.join(root, 'p1r-m2-001-runtime.mjs'), 'utf8')
const browserSource = fs.readFileSync(path.join(root, 'browser-fixture-client.js'), 'utf8')
const serverSource = fs.readFileSync(path.join(root, 'browser-fixture-server.mjs'), 'utf8')

function audit(overrides = {}) {
  return {
    schema: AUDIT_SCHEMA,
    durability: 'NON_DURABLE_TEST_ONLY',
    occurredAt: '2026-09-04T00:00:00Z',
    routeId: 'iam-principal',
    method: 'GET',
    status: 401,
    requestId: 'request-1',
    traceId: 'trace-1',
    subjectHash: '1'.repeat(64),
    tenantHash: '2'.repeat(64),
    clientProfile: 'NO_BROWSER_PROFILE',
    decision: 'DENY',
    reasonCode: 'authentication_required',
    latencyBucket: 'LT_50_MS',
    ...overrides,
  }
}

test('CLI requires one explicit mode and keeps failure injection opt-in', () => {
  assert.deepEqual(parseArguments(['--run']), { mode: 'run', fault: false, browser: false })
  assert.deepEqual(parseArguments(['--run', '--fault']), { mode: 'run', fault: true, browser: false })
  assert.deepEqual(parseArguments(['--run', '--browser']), { mode: 'run', fault: false, browser: true })
  assert.deepEqual(parseArguments(['--probe-only']), { mode: 'probe-only', fault: false, browser: false })
  assert.throws(() => parseArguments([]), /exactly one/u)
  assert.throws(() => parseArguments(['--run', '--probe-only']), /exactly one/u)
  assert.throws(() => parseArguments(['--run', '--unknown']), /unsupported/u)
})

test('browser refresh rewrite plans are bounded, deterministic, and non-mutating', () => {
  const original = [
    { name: 'Origin', value: 'http://127.0.0.1:18180' },
    { name: 'Referer', value: 'http://127.0.0.1:18180/' },
    { name: 'Idempotency-Key', value: 'key-1' },
  ]
  const keep = planHeaderRewrite('KEEP_ORIGIN_UNTRUSTED_REFERER', original)
  assert.equal(keep.find((item) => item.name.toLowerCase() === 'origin').value, 'http://127.0.0.1:18180')
  assert.match(keep.find((item) => item.name.toLowerCase() === 'referer').value, /^https:\/\/untrusted\.invalid\//u)
  const fallback = planHeaderRewrite('DROP_ORIGIN_TRUSTED_REFERER', original)
  assert.equal(fallback.some((item) => item.name.toLowerCase() === 'origin'), false)
  assert.equal(fallback.find((item) => item.name.toLowerCase() === 'referer').value, 'http://127.0.0.1:18180/')
  const untrusted = planHeaderRewrite('DROP_ORIGIN_UNTRUSTED_REFERER', original)
  assert.equal(untrusted.some((item) => item.name.toLowerCase() === 'origin'), false)
  assert.match(untrusted.find((item) => item.name.toLowerCase() === 'referer').value, /^https:\/\/untrusted\.invalid\//u)
  const forged = planHeaderRewrite('FORGE_AUTHORITY', original)
  assert.equal(forged.find((item) => item.name.toLowerCase() === 'x-role').value, 'admin')
  assert.equal(forged.find((item) => item.name.toLowerCase() === 'x-tenant-id').value, 'forged-tenant')
  assert.equal(original.length, 3)
  assert.throws(() => planHeaderRewrite('UNKNOWN_MODE', original), /unknown browser header rewrite mode/u)
  assert.equal(BROWSER_CASE_IDS.length, 11)
  assert.equal(new Set(BROWSER_CASE_IDS).size, BROWSER_CASE_IDS.length)
})

test('Gateway health Redis key is pinned to the production hash algorithm', () => {
  assert.equal(gatewayHealthRateKey(),
    'englishflow:gateway:rate-limit:7281b6dff99d5eed14d94142033d251a22f07adaea0d08ebfee1da00be48656a')
  assert.deepEqual(parseRateState('4', 299_000), { count: 4, ttlMillis: 299_000 })
  assert.throws(() => parseRateState('4|299000', 299_000), /absent or invalid/u)
  assert.throws(() => parseRateState('4', -1), /positive expiry/u)
})

test('Redis helper rejects every write command before opening a socket', async () => {
  await assert.rejects(redisCommand(['DEL', 'any-key']), /permits only PING, GET, and PTTL/u)
  await assert.rejects(redisCommand(['FLUSHDB']), /permits only PING, GET, and PTTL/u)
})

test('NDJSON parser accepts only the closed bounded audit schema', () => {
  assert.deepEqual(validateAuditEnvelope(audit()), audit())
  const rows = auditEnvelopesFromChunk(`ordinary log\n${JSON.stringify(audit({ status: 403 }))}\n`)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].status, 403)
  assert.throws(() => validateAuditEnvelope({ ...audit(), extra: 'no' }), /non-canonical field set/u)
  assert.throws(() => validateAuditEnvelope(audit({ routeId: 'a'.repeat(129) })), /routeId is invalid/u)
  assert.throws(() => validateAuditEnvelope(audit({ subjectHash: 'raw-subject' })), /not redacted or SHA-256/u)
})

test('evidence serializer rejects sensitive field names and credential-shaped values', () => {
  const safe = {
    schema: RUNTIME_SCHEMA,
    result: 'PASS',
    audit: audit(),
    sensitiveMaterial: { persisted: false, emitted: false },
  }
  assert.doesNotThrow(() => assertSafeEvidence(safe))
  assert.equal(JSON.parse(serializeEvidence(safe)).schema, RUNTIME_SCHEMA)
  assert.throws(() => assertSafeEvidence({ requestBody: 'hidden' }), /forbidden field/u)
  assert.throws(() => assertSafeEvidence({ value: 'Bearer abcdefghijklmnopqrstuvwxyz' }), /sensitive material/u)
  assert.throws(() => assertSafeEvidence({ value: 'aaaaaaaaaa.bbbbbbbbbb.cccccccccc' }), /sensitive material/u)
})

test('runtime source has bounded exact-container failure injection and no destructive Redis action', () => {
  assert.match(runtimeSource, /PAUSE_EXACT_REDIS_16379_AND_RECOVER/u)
  assert.match(runtimeSource, /docker\(\['pause', name\]\)/u)
  assert.match(runtimeSource, /docker\(\['unpause', name\]\)/u)
  assert.match(runtimeSource, /HostIp === FIXED\.host/u)
  assert.match(runtimeSource, /HostPort === String\(FIXED\.redisPort\)/u)
  assert.doesNotMatch(runtimeSource, /\bFLUSH(?:ALL|DB)\b/iu)
  assert.doesNotMatch(runtimeSource, /docker\(\['(?:stop|restart|rm|kill)'/iu)
  assert.doesNotMatch(runtimeSource, /writeFile|appendFile|createWriteStream/u)
  assert.doesNotMatch(runtimeSource, /stdio:\s*'inherit'/u)
  assert.match(runtimeSource, /sanitizedProcessEnvironment/u)
  assert.match(runtimeSource, /PASSWORD\|TOKEN\|SECRET\|CREDENTIAL\|PRIVATE_KEY\|COOKIE/u)
  assert.match(runtimeSource, /HEAD:services\/api-gateway/u)
  assert.match(runtimeSource, /HEAD:services\/iam-service/u)
  assert.match(runtimeSource, /healthData\?\.service === 'api-gateway'/u)
  assert.match(runtimeSource, /healthData\.dependencies\.length === 0/u)
  assert.match(runtimeSource, /SEQUENTIAL_DISTINCT_PROCESSES_NOT_CONCURRENT_REPLICAS/u)
  assert.match(runtimeSource, /runBrowserChecks/u)
  assert.doesNotMatch(runtimeSource, /x-client-platform/u)
})

test('browser fixture uses only registered ports and never stores or renders access material', () => {
  assert.match(serverSource, /learner: \{ port: 18180/u)
  assert.match(serverSource, /admin: \{ port: 18181/u)
  assert.match(serverSource, /official: \{ port: 18182/u)
  assert.match(serverSource, /mobile: \{ port: 18183/u)
  assert.doesNotMatch(serverSource, /18184|18185|8080|3000/u)
  assert.doesNotMatch(browserSource, /localStorage|sessionStorage|document\.cookie|console\./u)
  assert.doesNotMatch(browserSource, /innerHTML|insertAdjacentHTML/u)
  assert.match(browserSource, /held\.access = result\?\.data\?\.data\?\.accessToken/u)
  assert.match(browserSource, /identifierInput\.value = ''/u)
  assert.match(browserSource, /passwordInput\.value = ''/u)
  assert.doesNotMatch(browserSource, /append\([^\n]*held\.access/u)
})
