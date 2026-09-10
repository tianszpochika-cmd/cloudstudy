import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  AUDIT_SCHEMA,
  FIXED,
  RUNTIME_SCHEMA,
  auditEnvelopesFromChunk,
  exactlyOneHeader,
  gatewayHealthRateKey,
  parseArguments,
  parseRateState,
  redisCommand,
  safeFailure,
  serializeEvidence,
  sha256,
} from './lib/m2-runtime-lib.mjs'
import { runBrowserChecks } from './lib/m2-browser-checks.mjs'

const runtimeDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(runtimeDirectory, '../../../../..')
const gatewayRoot = path.join(repositoryRoot, 'services', 'api-gateway')
const iamRoot = path.join(repositoryRoot, 'services', 'iam-service')
const gatewayOrigin = `http://${FIXED.host}:${FIXED.gatewayPort}`
const iamOrigin = `http://${FIXED.host}:${FIXED.iamPort}`
const runId = `m2-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
const children = new Set()
const auditRows = []
let auditFailure
let pausedRedisContainer
let cleanupStarted = false

function check(condition, code, message) {
  if (!condition) throw safeFailure(code, message)
}

function git(...args) {
  const result = spawnSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    windowsHide: true,
  })
  check(result.status === 0, 'GIT_CHECK_FAILED', 'repository provenance check failed')
  return result.stdout.trim()
}

function newestModification(root) {
  let newest = fs.statSync(path.join(root, 'pom.xml')).mtimeMs
  const pending = [path.join(root, 'src', 'main')]
  while (pending.length) {
    const current = pending.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name)
      if (entry.isDirectory()) pending.push(absolute)
      else if (entry.isFile()) newest = Math.max(newest, fs.statSync(absolute).mtimeMs)
    }
  }
  return newest
}

function resolveJar(serviceRoot, explicit, expectedPrefix) {
  if (explicit) {
    const absolute = path.resolve(explicit)
    const targetRoot = `${fs.realpathSync(path.join(serviceRoot, 'target'))}${path.sep}`
    check(fs.existsSync(absolute) && fs.statSync(absolute).isFile()
      && `${fs.realpathSync(absolute)}`.startsWith(targetRoot),
    'JAR_MISSING', 'an explicit service jar must exist inside that service target directory')
    return absolute
  }
  const target = path.join(serviceRoot, 'target')
  check(fs.existsSync(target), 'JAR_MISSING', 'a service target directory is missing')
  const candidates = fs.readdirSync(target)
    .filter((name) => name.startsWith(expectedPrefix) && name.endsWith('.jar'))
    .filter((name) => !/(?:-sources|-javadoc|\.original)\.jar$/u.test(name))
    .map((name) => path.join(target, name))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)
  check(candidates.length > 0, 'JAR_MISSING', 'a current service jar must be built before the runtime batch')
  return candidates[0]
}

function serviceBuild(serviceRoot, explicit, prefix) {
  const jar = resolveJar(serviceRoot, explicit, prefix)
  check(fs.statSync(jar).mtimeMs >= newestModification(serviceRoot), 'STALE_JAR', 'a service jar is older than its packaged sources')
  return Object.freeze({
    artifact: path.relative(repositoryRoot, jar).replaceAll('\\', '/'),
    digest: sha256(fs.readFileSync(jar)),
    jar,
  })
}

function assertCommittedInputs() {
  const state = git('status', '--porcelain=v1', '--', 'services/api-gateway', 'services/iam-service')
  check(state === '', 'DIRTY_SERVICE_INPUT', 'Gateway and IAM must be committed before current-commit runtime evidence is collected')
  return Object.freeze({
    revision: git('rev-parse', 'HEAD'),
    gatewayTree: git('rev-parse', 'HEAD:services/api-gateway'),
    iamTree: git('rev-parse', 'HEAD:services/iam-service'),
  })
}

function assertJava25(javaBin) {
  const result = spawnSync(javaBin, ['-version'], { encoding: 'utf8', windowsHide: true })
  const version = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  check(result.status === 0 && /(?:version\s+"25(?:\.|"))|(?:openjdk\s+25(?:\.|\s))/iu.test(version),
    'JAVA_25_REQUIRED', 'the runtime batch requires Java 25')
}

async function assertPortFree(port, service) {
  await new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.once('error', () => reject(safeFailure('FIXED_PORT_BUSY', `${service} fixed port is already occupied`)))
    server.listen({ host: FIXED.host, port, exclusive: true }, () => server.close(resolve))
  })
}

function absorbAuditLine(source, line) {
  try {
    for (const envelope of auditEnvelopesFromChunk(line)) auditRows.push({ source, envelope })
  } catch (error) {
    auditFailure = error?.safeCode ? error : safeFailure('AUDIT_CAPTURE', 'audit stdout validation failed')
  }
}

function sanitizedProcessEnvironment(overrides) {
  const environment = { ...process.env }
  for (const name of Object.keys(environment)) {
    const canonical = name.toUpperCase()
    if (/(?:PASSWORD|TOKEN|SECRET|CREDENTIAL|PRIVATE_KEY|COOKIE)/u.test(canonical)
      || new Set([
        'SPRING_APPLICATION_JSON', 'SPRING_CONFIG_LOCATION', 'SPRING_CONFIG_ADDITIONAL_LOCATION',
        'JAVA_TOOL_OPTIONS', 'JDK_JAVA_OPTIONS', '_JAVA_OPTIONS',
        'LOGGING_FILE_NAME', 'LOGGING_FILE_PATH',
      ]).has(canonical)) delete environment[name]
  }
  return { ...environment, ...overrides }
}

function startJava(source, javaBin, jar, args, environment) {
  const child = spawn(javaBin, ['-jar', jar, ...args], {
    cwd: repositoryRoot,
    env: sanitizedProcessEnvironment(environment),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  children.add(child)
  let pending = ''
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    pending += chunk
    const lines = pending.split(/\r?\n/u)
    pending = lines.pop() ?? ''
    for (const line of lines) absorbAuditLine(source, line)
  })
  child.stdout.once('end', () => {
    if (pending) absorbAuditLine(source, pending)
  })
  child.stderr.resume()
  return child
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    if (child) children.delete(child)
    return
  }
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 8000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
    child.kill('SIGTERM')
  })
  children.delete(child)
}

async function waitForHttp(url, child, expectedStatus = 200, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    check(child.exitCode === null && child.signalCode === null, 'SERVICE_EXITED', 'a runtime service exited before readiness')
    try {
      const response = await fetch(url, { headers: { connection: 'close' }, signal: AbortSignal.timeout(1500) })
      if (response.status === expectedStatus) {
        await response.arrayBuffer()
        return
      }
      await response.arrayBuffer()
    } catch {
      // A bounded retry is expected while the local Java process binds its fixed port.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw safeFailure('READINESS_TIMEOUT', 'a runtime service did not become ready on its fixed port')
}

function requestHeaders(operation, additional = {}) {
  return {
    accept: 'application/json',
    connection: 'close',
    'x-request-id': `${runId}-${operation}`.slice(0, 120),
    'x-trace-id': sha256(`${runId}:${operation}`).slice(0, 32),
    ...additional,
  }
}

async function gatewayRequest(pathname, options = {}) {
  check(pathname.startsWith('/') && !pathname.includes('?') && !pathname.includes('#'),
    'REQUEST_PATH_BOUNDARY', 'runtime requests may not contain query strings or fragments')
  const headers = requestHeaders(options.operation ?? 'probe', options.headers)
  if (options.bearer) headers.authorization = `Bearer ${options.bearer}`
  let payload
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json'
    payload = JSON.stringify(options.body)
  }
  let response
  try {
    response = await fetch(`${gatewayOrigin}${pathname}`, {
      method: options.method ?? 'GET',
      headers,
      body: payload,
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs ?? 8000),
    })
  } catch {
    throw safeFailure('GATEWAY_REQUEST_FAILED', 'a bounded Gateway request failed')
  }
  const text = await response.text()
  check(text.length <= 1024 * 1024, 'RESPONSE_LIMIT', 'a Gateway response exceeded the in-memory test limit')
  let body = null
  if (text) {
    try { body = JSON.parse(text) } catch { body = null }
  }
  return Object.freeze({ status: response.status, headers: response.headers, body, operation: options.operation ?? 'probe' })
}

function assertHttp(checks, id, response, expectedStatus) {
  check(response.status === expectedStatus, 'HTTP_STATUS', `${id} returned an unexpected HTTP status`)
  const requestId = exactlyOneHeader(response.headers, 'x-request-id', requestHeaders(response.operation)['x-request-id'])
  const traceId = exactlyOneHeader(response.headers, 'x-trace-id', requestHeaders(response.operation)['x-trace-id'])
  checks.push({ id, result: 'PASS', status: response.status, requestId, traceId })
  return response
}

function gatewayEnvironment(publicLimit = 240) {
  return {
    API_GATEWAY_PORT: String(FIXED.gatewayPort),
    SERVER_ADDRESS: FIXED.host,
    REDIS_URL: `redis://${FIXED.host}:${FIXED.redisPort}/${FIXED.redisDatabase}`,
    IAM_SERVICE_BASE_URL: iamOrigin,
    IAM_JWT_ISSUER: iamOrigin,
    IAM_JWT_AUDIENCE: 'yuxuexing-api',
    IAM_JWT_JWKS_URI: `${iamOrigin}/api/v1/auth/jwks`,
    GATEWAY_RATE_LIMIT_BACKEND: 'redis',
    GATEWAY_RATE_LIMIT_FAIL_OPEN: 'false',
    GATEWAY_RATE_LIMIT_BACKEND_TIMEOUT: '750ms',
    GATEWAY_RATE_LIMIT_PUBLIC_READ_REQUESTS: String(publicLimit),
    GATEWAY_RATE_LIMIT_PUBLIC_READ_WINDOW: '5m',
    B12_SERVICES_ENABLED: 'false',
    B13_SERVICES_ENABLED: 'false',
    B14_STRANGLER_ENABLED: 'false',
    OTEL_ENABLED: 'false',
    OTEL_TRACING_EXPORT_ENABLED: 'false',
    MANAGEMENT_OTLP_METRICS_EXPORT_ENABLED: 'false',
  }
}

function iamEnvironment() {
  return {
    IAM_SERVICE_PORT: String(FIXED.iamPort),
    IAM_SERVER_ADDRESS: FIXED.host,
    IAM_PERSISTENCE_ENABLED: 'false',
    IAM_FLYWAY_ENABLED: 'false',
    IAM_JWT_ISSUER: iamOrigin,
    IAM_JWT_AUDIENCE: 'yuxuexing-api',
    IAM_JWT_EPHEMERAL_KEYS_ALLOWED: 'true',
    IAM_LOCAL_ADULT_GATE_ENABLED: 'true',
    OTEL_ENABLED: 'false',
    OTEL_TRACING_EXPORT_ENABLED: 'false',
    MANAGEMENT_OTLP_METRICS_EXPORT_ENABLED: 'false',
  }
}

async function startIam(javaBin, jar) {
  const child = startJava('iam', javaBin, jar, [
    `--server.address=${FIXED.host}`,
    `--server.port=${FIXED.iamPort}`,
    '--spring.profiles.active=local',
  ], iamEnvironment())
  await waitForHttp(`${iamOrigin}/actuator/health/readiness`, child)
  return child
}

async function startGateway(javaBin, jar, label, publicLimit = 240) {
  const child = startJava(label, javaBin, jar, [
    `--server.address=${FIXED.host}`,
    `--server.port=${FIXED.gatewayPort}`,
    '--spring.profiles.active=m2-evidence',
  ], gatewayEnvironment(publicLimit))
  await waitForHttp(`${gatewayOrigin}/actuator/health/readiness`, child)
  return child
}

async function ordinaryRuntimeChecks(checks) {
  const jwks = assertHttp(checks, 'gateway-to-iam-jwks', await gatewayRequest('/api/v1/auth/jwks', {
    operation: 'jwks',
  }), 200)
  const jwksData = jwks.body?.data ?? jwks.body
  const publicKeys = Array.isArray(jwksData?.keys)
    ? jwksData.keys.filter((item) => item?.alg === 'RS256' && item?.use === 'sig' && typeof item?.kid === 'string' && !('d' in item))
    : []
  check(publicKeys.length > 0, 'JWKS_BOUNDARY', 'IAM did not publish a public RS256 JWKS')
  checks.push({ id: 'jwks-public-material-only', result: 'PASS', keyCount: publicKeys.length, kidDigest: sha256(publicKeys[0].kid) })

  assertHttp(checks, 'protected-route-no-auth', await gatewayRequest('/api/v1/iam/principal/me', {
    operation: 'no-auth',
  }), 401)
  assertHttp(checks, 'protected-route-malformed-auth', await gatewayRequest('/api/v1/iam/principal/me', {
    operation: 'bad-auth', bearer: 'not-a-valid-jwt',
  }), 401)

  const identifier = `${runId}@local.invalid`
  const password = `${crypto.randomBytes(32).toString('base64url')}Aa9!`
  const registration = assertHttp(checks, 'iam-account-registration', await gatewayRequest('/api/v1/auth/register', {
    operation: 'register',
    method: 'POST',
    headers: {
      'idempotency-key': `${runId}-register`,
      'x-auth-transport': 'WEB_COOKIE',
    },
    body: {
      identifier,
      password,
      device: { deviceType: 'WEB', deviceName: 'm2-runtime', clientVersion: 'm2-runtime' },
    },
  }), 201)
  const access = registration.body?.data?.accessToken
  check(typeof access === 'string' && access.split('.').length === 3, 'ACCESS_MATERIAL_MISSING', 'IAM registration did not return an in-memory access credential')

  const principal = assertHttp(checks, 'protected-iam-upstream', await gatewayRequest('/api/v1/iam/principal/me', {
    operation: 'principal',
    bearer: access,
    headers: {
      'x-b5-role': 'admin',
      'x-role': 'admin',
      'x-tenant-id': 'forged-tenant',
      'x-owner-id': 'forged-owner',
    },
  }), 200)
  const principalData = principal.body?.data ?? principal.body
  check(principalData?.tenantId === 'platform'
    && Array.isArray(principalData?.roles)
    && !principalData.roles.includes('admin'),
  'AUTHORITY_HEADER_BOUNDARY', 'client authority headers changed the IAM-derived principal')
  checks.push({ id: 'authority-headers-ignored', result: 'PASS', serverDerived: true })

  assertHttp(checks, 'ordinary-user-policy-forbidden', await gatewayRequest('/api/v1/iam/policy-versions', {
    operation: 'forbidden', bearer: access,
  }), 403)
  assertHttp(checks, 'default-owner-route-fail-closed', await gatewayRequest('/api/v1/public/site/projection', {
    operation: 'owner-404',
  }), 404)
  assertHttp(checks, 'internal-path-not-exposed', await gatewayRequest('/internal/v1/iam/principal/me', {
    operation: 'internal-404', bearer: access,
  }), 404)
}

function docker(args) {
  const result = spawnSync('docker', args, { cwd: repositoryRoot, encoding: 'utf8', windowsHide: true })
  check(result.status === 0, 'REDIS_FAULT_COMMAND', 'the bounded Redis container action failed')
  return result.stdout.trim()
}

function inspectFaultContainer() {
  check(process.env.M2_REDIS_FAULT_OPT_IN === 'PAUSE_EXACT_REDIS_16379_AND_RECOVER',
    'FAULT_OPT_IN_REQUIRED', 'Redis failure injection needs the exact recovery opt-in')
  const name = process.env.M2_REDIS_CONTAINER?.trim()
  check(name && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(name),
    'FAULT_CONTAINER_REQUIRED', 'Redis failure injection needs one exact container name')
  let inspect
  try { inspect = JSON.parse(docker(['inspect', name]))?.[0] } catch {
    throw safeFailure('FAULT_CONTAINER_INSPECT', 'the exact Redis container could not be validated')
  }
  const mappings = inspect?.NetworkSettings?.Ports?.['6379/tcp']
  check(inspect?.Name === `/${name}`
    && typeof inspect?.Config?.Image === 'string'
    && inspect.Config.Image.toLowerCase().includes('redis')
    && inspect?.State?.Status === 'running'
    && inspect?.State?.Paused === false
    && Array.isArray(mappings)
    && mappings.some((mapping) => mapping.HostIp === FIXED.host && mapping.HostPort === String(FIXED.redisPort)),
  'FAULT_CONTAINER_BOUNDARY', 'the named container is not the running Redis bound to 127.0.0.1:16379')
  return name
}

async function restoreRedis() {
  if (!pausedRedisContainer) return
  const name = pausedRedisContainer
  pausedRedisContainer = undefined
  docker(['unpause', name])
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    try {
      if (await redisCommand(['PING']) === 'PONG') return
    } catch {
      // Wait only for the exact container that this process unpaused.
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw safeFailure('REDIS_RECOVERY_TIMEOUT', 'the explicitly paused Redis container did not recover')
}

async function faultCheck(checks) {
  const name = inspectFaultContainer()
  docker(['pause', name])
  pausedRedisContainer = name
  try {
    const unavailable = await gatewayRequest('/api/v1/auth/jwks', {
      operation: 'redis-unavailable', timeoutMs: 5000,
    })
    assertHttp(checks, 'redis-failure-fails-closed', unavailable, 503)
    exactlyOneHeader(unavailable.headers, 'x-ratelimit-backend', 'unavailable')
  } finally {
    await restoreRedis()
  }
  const recovered = await gatewayRequest('/api/v1/auth/jwks', { operation: 'redis-recovered' })
  assertHttp(checks, 'redis-recovery-restores-traffic', recovered, 200)
}

async function healthRateState() {
  const key = gatewayHealthRateKey()
  const raw = await redisCommand(['GET', key])
  if (raw === null) return null
  const ttl = await redisCommand(['PTTL', key])
  return parseRateState(raw, ttl)
}

async function sequentialProcessCheck(javaBin, gatewayJar, checks) {
  const existing = await healthRateState()
  check(existing === null, 'HEALTH_RATE_KEY_EXISTS', 'the shared DB15 health bucket already exists; wait for its TTL instead of deleting it')

  let first
  let second
  try {
    first = await startGateway(javaBin, gatewayJar, 'gateway-a', 3)
    const firstPid = first.pid
    const firstHealth = assertHttp(checks, 'redis-limit-process-a-first',
      await gatewayRequest('/api/v1/health', { operation: 'rate-a1' }), 200)
    const healthData = firstHealth.body?.data
    check(healthData?.status === 'UP'
      && healthData?.service === 'api-gateway'
      && Array.isArray(healthData?.dependencies)
      && healthData.dependencies.length === 0,
    'GATEWAY_HEALTH_OWNER', 'the canonical health response did not identify only api-gateway')
    checks.push({ id: 'gateway-health-owner', result: 'PASS', owner: 'api-gateway', dependencyCount: 0 })
    assertHttp(checks, 'redis-limit-process-a-second', await gatewayRequest('/api/v1/health', { operation: 'rate-a2' }), 200)
    const afterFirst = await healthRateState()
    check(afterFirst?.count === 2, 'REDIS_PROCESS_A_STATE', 'Gateway process A did not leave the expected DB15 rate state')
    await stopChild(first)
    first = undefined

    second = await startGateway(javaBin, gatewayJar, 'gateway-b', 3)
    check(second.pid !== firstPid, 'PROCESS_CONTINUATION', 'the continuation check did not start a distinct Gateway process')
    assertHttp(checks, 'redis-limit-process-b-continues', await gatewayRequest('/api/v1/health', { operation: 'rate-b1' }), 200)
    const limited = assertHttp(checks, 'redis-limit-process-b-rejects', await gatewayRequest('/api/v1/health', { operation: 'rate-b2' }), 429)
    const retryAfter = Number(exactlyOneHeader(limited.headers, 'retry-after'))
    exactlyOneHeader(limited.headers, 'x-ratelimit-policy', 'public-read')
    check(Number.isInteger(retryAfter) && retryAfter > 0, 'RETRY_AFTER', 'the 429 response has no positive Retry-After value')
    const afterSecond = await healthRateState()
    check(afterSecond?.count === 4 && afterSecond.ttlMillis > 0,
      'REDIS_PROCESS_B_STATE', 'Gateway process B did not continue the same DB15 rate state')
    checks.push({
      id: 'sequential-cross-process-state-continuation',
      result: 'PASS',
      topology: 'SEQUENTIAL_DISTINCT_PROCESSES_NOT_CONCURRENT_REPLICAS',
      processAObservedCount: afterFirst.count,
      processBObservedCount: afterSecond.count,
      retryAfterSeconds: retryAfter,
    })
  } finally {
    await stopChild(first)
    await stopChild(second)
  }
}

function verifyAuditCoverage(requiredStatuses, checks) {
  if (auditFailure) throw auditFailure
  const selected = []
  for (const status of requiredStatuses) {
    const requestIds = new Set(checks.filter((item) => item.status === status).map((item) => item.requestId))
    const row = auditRows.find((candidate) => candidate.envelope.status === status
      && requestIds.has(candidate.envelope.requestId))
    check(row, 'AUDIT_STATUS_COVERAGE', `the evidence sink did not emit the required HTTP ${status} row`)
    selected.push({ sourceProcess: row.source, ...row.envelope })
  }
  return selected
}

function verifyBrowserAudit(requirements) {
  const selected = []
  for (const requirement of requirements) {
    const row = auditRows.find((candidate) => candidate.envelope.status === requirement.status
      && candidate.envelope.reasonCode === requirement.reasonCode)
    check(row, 'BROWSER_AUDIT_REASON', `the evidence sink did not emit ${requirement.reasonCode}`)
    selected.push({ sourceProcess: row.source, matchedCheck: requirement.checkId, ...row.envelope })
  }
  return selected
}

async function runFull(options) {
  const checks = []
  const source = assertCommittedInputs()
  const javaBin = process.env.M2_JAVA_BIN?.trim() || 'java'
  assertJava25(javaBin)
  const gatewayBuild = serviceBuild(gatewayRoot, process.env.M2_GATEWAY_JAR?.trim(), 'api-gateway-')
  const iamBuild = serviceBuild(iamRoot, process.env.M2_IAM_JAR?.trim(), 'iam-service-')
  await assertPortFree(FIXED.gatewayPort, 'Gateway')
  await assertPortFree(FIXED.iamPort, 'IAM')
  check(await redisCommand(['PING']) === 'PONG', 'REDIS_PING', 'Redis DB15 is unavailable')

  let iam
  let gateway
  try {
    iam = await startIam(javaBin, iamBuild.jar)
    gateway = await startGateway(javaBin, gatewayBuild.jar, 'gateway-baseline')
    await ordinaryRuntimeChecks(checks)
    const browserAuditRequirements = []
    const browser = options.browser
      ? await runBrowserChecks({
        gatewayOrigin,
        fixtureServerPath: path.join(runtimeDirectory, 'browser-fixture-server.mjs'),
        checks,
        auditRequirements: browserAuditRequirements,
      })
      : null
    if (options.fault) await faultCheck(checks)
    await stopChild(gateway)
    gateway = undefined
    await sequentialProcessCheck(javaBin, gatewayBuild.jar, checks)
    await new Promise((resolve) => setTimeout(resolve, 150))
    const statuses = options.fault ? [200, 401, 403, 404, 429, 503] : [200, 401, 403, 404, 429]
    const audits = [...verifyAuditCoverage(statuses, checks), ...verifyBrowserAudit(browserAuditRequirements)]
    return {
      schema: RUNTIME_SCHEMA,
      result: options.fault ? 'PASS' : 'PARTIAL',
      scope: 'P1R-M2-001_GATEWAY_BOUNDARY_RUNTIME',
      runId,
      repository: { revision: source.revision, serviceInputs: 'CLEAN' },
      processes: {
        gateway: {
          artifact: gatewayBuild.artifact, artifactDigest: gatewayBuild.digest,
          sourceTree: source.gatewayTree, host: FIXED.host, port: FIXED.gatewayPort,
        },
        iam: {
          artifact: iamBuild.artifact, artifactDigest: iamBuild.digest,
          sourceTree: source.iamTree, host: FIXED.host, port: FIXED.iamPort,
        },
      },
      redis: {
        host: FIXED.host,
        port: FIXED.redisPort,
        database: FIXED.redisDatabase,
        destructiveCommandsUsed: false,
        faultInjection: options.fault ? 'EXACT_CONTAINER_PAUSE_AND_RECOVER' : 'NOT_REQUESTED',
      },
      checks,
      browser: browser ?? { status: 'NOT_EXECUTED' },
      audit: { schema: AUDIT_SCHEMA, durability: 'NON_DURABLE_TEST_ONLY', rows: audits },
      sensitiveMaterial: { persisted: false, emitted: false },
      notRuntimeVerified: [
        ...(options.fault ? [] : ['HTTP_503_AND_REDIS_RECOVERY']),
        ...(options.browser ? [] : ['BROWSER_EXECUTION']),
      ],
      exclusions: [
        'M2-006_DURABLE_AUDIT',
        'M2-008_NETWORK_POLICY',
        'CONCURRENT_GATEWAY_REPLICAS',
        ...(options.browser ? [] : ['BROWSER_EXECUTION']),
      ],
    }
  } finally {
    await stopChild(gateway)
    await stopChild(iam)
    await restoreRedis()
  }
}

async function runProbeOnly() {
  const checks = []
  check(await redisCommand(['PING']) === 'PONG', 'REDIS_PING', 'Redis DB15 is unavailable')
  assertHttp(checks, 'existing-gateway-jwks', await gatewayRequest('/api/v1/auth/jwks', { operation: 'probe-jwks' }), 200)
  assertHttp(checks, 'existing-gateway-protected-route', await gatewayRequest('/api/v1/iam/principal/me', { operation: 'probe-401' }), 401)
  assertHttp(checks, 'existing-gateway-default-owner', await gatewayRequest('/api/v1/public/site/projection', { operation: 'probe-404' }), 404)
  return {
    schema: RUNTIME_SCHEMA,
    result: 'PASS',
    scope: 'P1R-M2-001_READ_ONLY_EXISTING_PROCESS_PROBE',
    runId,
    runtimeStatus: 'PARTIAL_PROBE_ONLY',
    fixedEndpoints: { gateway: gatewayOrigin, iam: iamOrigin, redisDatabase: FIXED.redisDatabase },
    checks,
    notRuntimeVerified: [
      'CURRENT_COMMIT_PROCESS_PROVENANCE',
      'VALID_JWT_PROTECTED_UPSTREAM',
      'HTTP_403',
      'HTTP_429_AND_RETRY_AFTER',
      'HTTP_503_AND_RECOVERY',
      'CROSS_PROCESS_REDIS_CONTINUATION',
      'BROWSER_CORS_CSRF_ORIGIN_REFERER',
      'NDJSON_AUDIT_STDOUT',
    ],
    sensitiveMaterial: { persisted: false, emitted: false },
  }
}

async function cleanup() {
  if (cleanupStarted) return
  cleanupStarted = true
  for (const child of [...children].reverse()) await stopChild(child)
  await restoreRedis()
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    try { await cleanup() } finally { process.exit(130) }
  })
}

try {
  const options = parseArguments(process.argv.slice(2))
  check(!options.fault || options.mode === 'run', 'FAULT_MODE', '--fault is valid only with --run')
  check(!options.browser || options.mode === 'run', 'BROWSER_MODE', '--browser is valid only with --run')
  const evidence = options.mode === 'run' ? await runFull(options) : await runProbeOnly()
  process.stdout.write(serializeEvidence(evidence))
} catch (error) {
  try { await cleanup() } catch { /* Preserve the original safe failure. */ }
  const safe = {
    schema: RUNTIME_SCHEMA,
    result: 'BLOCKED',
    scope: 'P1R-M2-001_GATEWAY_BOUNDARY_RUNTIME',
    runId,
    failureCode: error?.safeCode ?? 'UNEXPECTED_FAILURE',
    message: error?.safeCode ? error.message : 'the runtime batch failed without emitting process output',
    sensitiveMaterial: { persisted: false, emitted: false },
  }
  process.stderr.write(serializeEvidence(safe))
  process.exitCode = 1
}
