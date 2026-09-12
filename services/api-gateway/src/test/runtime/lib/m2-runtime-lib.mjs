import crypto from 'node:crypto'
import net from 'node:net'

export const FIXED = Object.freeze({
  host: '127.0.0.1',
  gatewayPort: 18070,
  iamPort: 18087,
  redisPort: 16379,
  redisDatabase: 15,
})

export const AUDIT_SCHEMA = 'm2.gateway.security-audit.evidence.v1'
export const RUNTIME_SCHEMA = 'm2.gateway.runtime-evidence.v1'

const AUDIT_FIELDS = new Set([
  'schema', 'durability', 'occurredAt', 'routeId', 'method', 'status',
  'requestId', 'traceId', 'subjectHash', 'tenantHash', 'clientProfile',
  'decision', 'reasonCode', 'latencyBucket',
])

const AUDIT_LIMITS = Object.freeze({
  routeId: 128,
  method: 16,
  requestId: 128,
  traceId: 128,
  subjectHash: 64,
  tenantHash: 64,
  clientProfile: 32,
  decision: 16,
  reasonCode: 128,
  latencyBucket: 32,
})

const FORBIDDEN_EVIDENCE_KEY = /(authorization|password|credential|cookie|access.?token|refresh.?token|private.?key|request.?body|query.?string|secret)/i
const FORBIDDEN_EVIDENCE_VALUE = /(-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+/-]+=*|[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/i

export function sha256(value) {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8')
  return crypto.createHash('sha256').update(input).digest('hex')
}

export function gatewayHealthRateKey(remoteAddress = FIXED.host) {
  const logicalKey = `ip-route:${sha256(remoteAddress)}:${sha256('gateway-health')}`
  return `englishflow:gateway:rate-limit:${sha256(logicalKey)}`
}

export function parseArguments(argv) {
  const values = new Set(argv)
  const known = new Set(['--run', '--probe-only', '--fault', '--browser'])
  const unknown = [...values].filter((value) => !known.has(value))
  if (unknown.length) throw safeFailure('UNSUPPORTED_ARGUMENT', 'an unsupported argument was supplied')
  const modes = ['--run', '--probe-only'].filter((value) => values.has(value))
  if (modes.length !== 1) throw safeFailure('MODE_REQUIRED', 'select exactly one of --run or --probe-only')
  return Object.freeze({
    mode: modes[0].slice(2),
    fault: values.has('--fault'),
    browser: values.has('--browser'),
  })
}

export function validateAuditEnvelope(value) {
  if (!isRecord(value)) throw safeFailure('AUDIT_NOT_OBJECT', 'audit line must be a JSON object')
  const fields = Object.keys(value)
  if (fields.length !== AUDIT_FIELDS.size || fields.some((field) => !AUDIT_FIELDS.has(field))) {
    throw safeFailure('AUDIT_FIELD_SET', 'audit line has a non-canonical field set')
  }
  if (value.schema !== AUDIT_SCHEMA || value.durability !== 'NON_DURABLE_TEST_ONLY') {
    throw safeFailure('AUDIT_BOUNDARY', 'audit line is missing its non-durable boundary')
  }
  if (!Number.isInteger(value.status) || value.status < 100 || value.status > 599) {
    throw safeFailure('AUDIT_STATUS', 'audit status is invalid')
  }
  if (!Number.isFinite(Date.parse(value.occurredAt))) {
    throw safeFailure('AUDIT_TIME', 'audit occurredAt is invalid')
  }
  for (const [field, limit] of Object.entries(AUDIT_LIMITS)) {
    if (typeof value[field] !== 'string' || value[field].length > limit || /[\r\n]/u.test(value[field])) {
      throw safeFailure('AUDIT_FIELD_VALUE', `audit ${field} is invalid`)
    }
  }
  for (const field of ['subjectHash', 'tenantHash']) {
    if (value[field] !== '' && value[field] !== 'REDACTED' && !/^[0-9a-f]{64}$/u.test(value[field])) {
      throw safeFailure('AUDIT_HASH', `audit ${field} is not redacted or SHA-256`)
    }
  }
  assertSafeEvidence(value)
  return Object.freeze({ ...value })
}

export function auditEnvelopesFromChunk(chunk) {
  const envelopes = []
  for (const line of String(chunk).split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{') || !trimmed.includes(`"schema":"${AUDIT_SCHEMA}"`)) continue
    let parsed
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      throw safeFailure('AUDIT_JSON', 'audit evidence line is not valid JSON')
    }
    envelopes.push(validateAuditEnvelope(parsed))
  }
  return envelopes
}

export function assertSafeEvidence(value, path = 'evidence') {
  if (value === null || value === undefined) return
  if (typeof value === 'string') {
    if (value.length > 1024) throw safeFailure('EVIDENCE_STRING_LIMIT', `${path} exceeds the evidence string limit`)
    if (FORBIDDEN_EVIDENCE_VALUE.test(value)) throw safeFailure('EVIDENCE_SENSITIVE_VALUE', `${path} resembles sensitive material`)
    return
  }
  if (typeof value === 'number' || typeof value === 'boolean') return
  if (Array.isArray(value)) {
    if (value.length > 256) throw safeFailure('EVIDENCE_ARRAY_LIMIT', `${path} exceeds the evidence array limit`)
    value.forEach((item, index) => assertSafeEvidence(item, `${path}[${index}]`))
    return
  }
  if (!isRecord(value)) throw safeFailure('EVIDENCE_TYPE', `${path} has an unsupported evidence type`)
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_EVIDENCE_KEY.test(key)) throw safeFailure('EVIDENCE_SENSITIVE_FIELD', `${path} contains a forbidden field`)
    assertSafeEvidence(nested, `${path}.${key}`)
  }
}

export function serializeEvidence(value) {
  assertSafeEvidence(value)
  return `${JSON.stringify(value, null, 2)}\n`
}

export function exactlyOneHeader(headers, name, expected = undefined) {
  const value = headers.get(name)
  if (value === null || value.trim() === '' || value.includes(',')) {
    throw safeFailure('HEADER_CARDINALITY', `${name} must have exactly one value`)
  }
  if (expected !== undefined && value !== expected) {
    throw safeFailure('HEADER_VALUE', `${name} did not preserve the expected value`)
  }
  return value
}

export function parseRateState(raw, ttlMillis) {
  if (typeof raw !== 'string' || !/^\d+$/u.test(raw)) {
    throw safeFailure('REDIS_RATE_STATE', 'rate-limit state is absent or invalid')
  }
  if (!Number.isInteger(ttlMillis) || ttlMillis <= 0) {
    throw safeFailure('REDIS_RATE_TTL', 'rate-limit state has no positive expiry')
  }
  return Object.freeze({ count: Number(raw), ttlMillis })
}

export async function redisCommand(command, options = {}) {
  const host = options.host ?? FIXED.host
  const port = options.port ?? FIXED.redisPort
  const database = options.database ?? FIXED.redisDatabase
  const timeoutMs = options.timeoutMs ?? 3000
  if (host !== FIXED.host || port !== FIXED.redisPort || database !== FIXED.redisDatabase) {
    throw safeFailure('REDIS_BOUNDARY', 'runtime harness only permits Redis 127.0.0.1:16379 database 15')
  }
  const operation = Array.isArray(command) && command.length > 0 ? String(command[0]).toUpperCase() : ''
  // CLIENT is admitted only for LIST. It is read-only introspection and is how the harness proves
  // which ACL user the Gateway actually authenticated as; every other subcommand — notably
  // CLIENT KILL — stays outside this boundary.
  const clientList = operation === 'CLIENT' && String(command?.[1] ?? '').toUpperCase() === 'LIST'
  if (!clientList && !new Set(['PING', 'GET', 'PTTL']).has(operation)) {
    throw safeFailure('REDIS_READ_ONLY', 'runtime harness permits only PING, GET, PTTL and CLIENT LIST Redis probes')
  }
  const commands = [['SELECT', String(database)], command.map(String)]
  const payload = Buffer.concat(commands.map(encodeRedisCommand))
  return await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port })
    let buffer = Buffer.alloc(0)
    let replies = []
    let settled = false
    const finish = (error, value) => {
      if (settled) return
      settled = true
      socket.destroy()
      if (error) reject(error)
      else resolve(value)
    }
    socket.setTimeout(timeoutMs, () => finish(safeFailure('REDIS_TIMEOUT', 'Redis probe timed out')))
    socket.once('error', () => finish(safeFailure('REDIS_UNAVAILABLE', 'Redis probe failed')))
    socket.once('close', () => finish(safeFailure('REDIS_CLOSED', 'Redis closed the probe connection early')))
    socket.once('connect', () => socket.write(payload))
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      try {
        let offset = 0
        while (replies.length < commands.length) {
          const parsed = parseRedisValue(buffer, offset)
          if (!parsed) break
          replies.push(parsed.value)
          offset = parsed.next
        }
        if (offset > 0) buffer = buffer.subarray(offset)
        if (replies.length === commands.length) {
          if (replies[0] !== 'OK') finish(safeFailure('REDIS_SELECT', 'Redis database selection failed'))
          else finish(undefined, replies[1])
        }
      } catch (error) {
        finish(error?.safeCode ? error : safeFailure('REDIS_PROTOCOL', 'Redis returned an invalid response'))
      }
    })
  })
}

export function safeFailure(code, message) {
  const error = new Error(message)
  error.safeCode = code
  return error
}

function encodeRedisCommand(parts) {
  const chunks = [Buffer.from(`*${parts.length}\r\n`, 'utf8')]
  for (const part of parts) {
    const value = Buffer.from(part, 'utf8')
    chunks.push(Buffer.from(`$${value.length}\r\n`, 'utf8'), value, Buffer.from('\r\n', 'utf8'))
  }
  return Buffer.concat(chunks)
}

function parseRedisValue(buffer, offset) {
  if (offset >= buffer.length) return null
  const marker = String.fromCharCode(buffer[offset])
  const line = redisLine(buffer, offset + 1)
  if (!line) return null
  if (marker === '+' || marker === ':' || marker === '-') {
    const text = buffer.toString('utf8', offset + 1, line.end)
    if (marker === '-') throw safeFailure('REDIS_ERROR', 'Redis returned an error')
    return { value: marker === ':' ? Number(text) : text, next: line.next }
  }
  if (marker === '$') {
    const length = Number(buffer.toString('ascii', offset + 1, line.end))
    if (length === -1) return { value: null, next: line.next }
    const end = line.next + length
    if (!Number.isInteger(length) || length < 0 || buffer.length < end + 2) return null
    return { value: buffer.toString('utf8', line.next, end), next: end + 2 }
  }
  if (marker === '*') {
    const count = Number(buffer.toString('ascii', offset + 1, line.end))
    if (count === -1) return { value: null, next: line.next }
    if (!Number.isInteger(count) || count < 0) throw safeFailure('REDIS_PROTOCOL', 'Redis array length is invalid')
    const values = []
    let next = line.next
    for (let index = 0; index < count; index++) {
      const parsed = parseRedisValue(buffer, next)
      if (!parsed) return null
      values.push(parsed.value)
      next = parsed.next
    }
    return { value: values, next }
  }
  throw safeFailure('REDIS_PROTOCOL', 'Redis response marker is unsupported')
}

function redisLine(buffer, offset) {
  const end = buffer.indexOf('\r\n', offset, 'utf8')
  return end < 0 ? null : { end, next: end + 2 }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
