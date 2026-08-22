import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { createApiErrorEnvelope, createTelemetryEnvelope } from '../../packages/telemetry/src/index.mjs'
import { validateMigrationSet } from '../../scripts/database/lib/migration-utils.mjs'

const root = path.resolve(import.meta.dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('B7 data foundation keeps migrations replay-safe and durable boundaries explicit', () => {
  const result = validateMigrationSet()
  assert.deepEqual(result.errors, [])
  assert.ok(result.migrations.length >= 15)

  const foundation = result.migrations.slice(0, 4).map(({ sql }) => sql).join('\n')
  for (const required of [
    'CREATE TABLE IF NOT EXISTS schema_version',
    'CREATE TABLE IF NOT EXISTS idempotency_keys',
    'CREATE TABLE IF NOT EXISTS outbox_events',
    'CREATE TABLE IF NOT EXISTS audit_logs',
    'UNIQUE KEY uk_idempotency_scope_key',
    'UNIQUE KEY uk_outbox_dedupe_key',
  ]) assert.match(foundation, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
  assert.doesNotMatch(foundation, /DROP\s+(DATABASE|SCHEMA|TABLE)|TRUNCATE\s+TABLE/i)

  const redisRegistry = JSON.parse(read('database/redis/keyspace.registry.json'))
  assert.equal(redisRegistry.redisVersion, '7.x')
  assert.equal(redisRegistry.globalRules.allKeysMustExpire, true)
  assert.ok(redisRegistry.entries.some((entry) => /idempotency/i.test(entry.id)))
  assert.ok(redisRegistry.entries.some((entry) => /outbox|dedupe/i.test(entry.id)))
})

test('B7 observability preserves correlation and rejects sensitive telemetry', () => {
  const event = createTelemetryEnvelope({
    eventName: 'telemetry.error.v1',
    requestId: 'req_b7_observe_001',
    traceId: 'trace_b7_observe_001',
    correlationId: 'corr_b7_observe_001',
    payload: { schema: 'telemetry.error', errorCode: 'UPSTREAM_TIMEOUT', category: 'upstream', retryable: true },
  })
  assert.equal(event.requestId, 'req_b7_observe_001')
  assert.equal(event.traceId, 'trace_b7_observe_001')
  assert.equal(event.correlationId, 'corr_b7_observe_001')
  assert.throws(() => createTelemetryEnvelope({
    eventName: 'telemetry.error.v1',
    payload: { schema: 'telemetry.error', errorCode: 'SENSITIVE', category: 'security', retryable: false, authorization: 'Bearer should-never-be-recorded' },
  }), /sensitive|not allowed/i)

  const error = createApiErrorEnvelope({
    requestId: 'req_b7_error_001',
    traceId: 'trace_b7_error_001',
    code: 'UPSTREAM_TIMEOUT',
    message: 'upstream unavailable',
  })
  assert.equal(error.requestId, 'req_b7_error_001')
  assert.equal(error.traceId, 'trace_b7_error_001')
  assert.equal(error.error.code, 'UPSTREAM_TIMEOUT')
})

test('B7 redis registry passes the executable static security validator', () => {
  const output = execFileSync(process.execPath, ['scripts/database/validate-redis-keyspace.mjs'], {
    cwd: root,
    encoding: 'utf8',
  })
  assert.match(output, /Redis keyspace validation passed/i)
})
