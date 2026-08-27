import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const gateway = process.env.B35_GATEWAY ?? 'http://127.0.0.1:18070'
const runId = process.env.B35_RUN_ID ?? `b35-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
const ports = JSON.parse(readFileSync(path.join(root, 'config', 'local-ports.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(path.join(root, 'config', 'v2-runtime-services.json'), 'utf8'))

function fail(message, details) {
  const error = new Error(message)
  error.details = details
  throw error
}

async function readBody(response) {
  const text = await response.text()
  if (!text) return null
  try { return JSON.parse(text) } catch { return text.slice(0, 500) }
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: 'application/json',
      'x-request-id': `${runId}-${options.name ?? 'check'}`.slice(0, 120),
      'x-trace-id': `${runId}-trace`.slice(0, 120),
      ...(options.headers ?? {}),
    },
  })
  return {
    status: response.status,
    body: await readBody(response),
    requestId: response.headers.get('x-request-id'),
    traceId: response.headers.get('x-trace-id'),
  }
}

function assert(condition, message, details) {
  if (!condition) fail(message, details)
}

async function readiness() {
  const checks = []
  for (const service of manifest.services) {
    const registration = ports.services[service.portKey]
    assert(registration?.port, `${service.id} has no registered fixed port`)
    const base = service.healthBasePath ?? ''
    const result = await request(`http://${manifest.host}:${registration.port}${base}${service.healthPath}`, { name: `ready-${service.id}` })
    assert(result.status === 200, `${service.id} readiness failed`, result)
    checks.push({ service: service.id, port: registration.port, status: result.status })
  }
  return checks
}

async function authNegativeChecks() {
  const cases = [
    ['/api/v1/iam/principal/me', 401],
    ['/api/v1/iam/permissions', 401],
    ['/api/v1/learner/home', 401],
    ['/api/v1/learning/stream/today', 401],
    ['/api/v1/assessment/placement/start', 401],
    ['/api/v1/admin/content-commands', 401],
  ]
  const results = []
  for (const [route, expected] of cases) {
    const result = await request(`${gateway}${route}`, { name: `unauth-${route.replaceAll('/', '-')}` })
    assert(result.status === expected, `${route}: expected ${expected}, got ${result.status}`, result)
    assert(result.requestId && result.traceId, `${route}: request/trace correlation missing`, result)
    results.push({ route, status: result.status, requestId: result.requestId, traceId: result.traceId })
  }

  const forgedHeaders = {
    'x-b5-role': 'admin',
    'x-role': 'admin',
    'x-tenant-id': 'tenant-attacker',
    'x-owner-id': 'owner-attacker',
  }
  const forged = await request(`${gateway}/api/v1/learner/home`, { name: 'forged-authority', headers: forgedHeaders })
  assert(forged.status === 401, 'forged client authority changed an unauthenticated decision', forged)
  results.push({ route: '/api/v1/learner/home', case: 'forged-authority', status: forged.status, requestId: forged.requestId, traceId: forged.traceId })

  const malformed = await request(`${gateway}/api/v1/iam/principal/me`, { name: 'malformed-bearer', headers: { authorization: 'Bearer forged-local-token' } })
  assert(malformed.status === 401, 'malformed bearer token was accepted', malformed)
  results.push({ route: '/api/v1/iam/principal/me', case: 'malformed-bearer', status: malformed.status, requestId: malformed.requestId, traceId: malformed.traceId })
  return results
}

async function publicProjection() {
  const result = await request(`${gateway}/api/v1/public/site/projection?uiLocale=zh-CN`, { name: 'public-projection' })
  assert(result.status === 200, 'public projection is not available', result)
  const source = String(result.body?.meta?.source ?? '').toUpperCase()
  const courseCount = result.body?.data?.courses?.length ?? 0
  assert(source === 'CONTENT_SERVICE' && Number(result.body?.data?.contentEpoch ?? 0) > 0, 'public projection is not a ready Gateway/owner response', result.body)
  return { status: result.status, state: 'ready', source, courseCount, requestId: result.requestId, traceId: result.traceId }
}

function docker(command, args) {
  const result = spawnSync('docker', [command, ...args], { cwd: root, encoding: 'utf8', windowsHide: true })
  assert(result.status === 0, `docker ${command} failed`, { stdout: result.stdout, stderr: result.stderr })
  return result.stdout.trim()
}

function infrastructure() {
  const names = docker('ps', ['--format', '{{.Names}}']).split(/\r?\n/).filter(Boolean)
  const expected = [
    'yuxuexing-local-mysql-1', 'yuxuexing-local-redis-1', 'yuxuexing-local-kafka-1',
    'yuxuexing-local-minio-1', 'yuxuexing-local-keycloak-1',
  ]
  for (const name of expected) assert(names.includes(name), `required local container is not running: ${name}`, names)
  const redis = spawnSync('docker', ['exec', 'yuxuexing-local-redis-1', 'redis-cli', '-p', '6379', 'PING'], { encoding: 'utf8', windowsHide: true })
  assert(redis.status === 0 && redis.stdout.trim() === 'PONG', 'Redis did not answer PONG', redis.stdout)
  const kafka = docker('exec', ['yuxuexing-local-kafka-1', '/opt/kafka/bin/kafka-topics.sh', '--bootstrap-server', '127.0.0.1:9092', '--list'])
  const topics = kafka.split(/\r?\n/).filter(Boolean)
  assert(topics.length >= 6, 'Kafka topic baseline is incomplete', topics)
  const minio = fetch('http://127.0.0.1:19000/minio/health/ready')
  return { containers: expected, redis: 'PONG', kafkaTopicCount: topics.length, minioReady: minio.then((r) => r.status === 200) }
}

const ready = await readiness()
const auth = await authNegativeChecks()
const projection = await publicProjection()
const infra = infrastructure()
const result = {
  result: 'PASS', runId, readiness: ready.length, authNegative: auth.length,
  projection, infrastructure: { containers: infra.containers, redis: infra.redis, kafkaTopicCount: infra.kafkaTopicCount, minioReady: await infra.minioReady },
  tokenValuesEmitted: false,
}
assert(result.infrastructure.minioReady, 'MinIO readiness endpoint did not return 200')
console.log(JSON.stringify(result, null, 2))
