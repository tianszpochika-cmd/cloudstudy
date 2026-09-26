// Local-only minor rejection probe. Credentials and JWTs remain in memory.
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'

const nonce = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
const identifier = `uat-minor-${nonce}@local.invalid`
const password = `Uat!${randomBytes(20).toString('base64url')}a9`
const gateway = 'http://127.0.0.1:18070'
const checks = []
let sequence = 0
let token

async function call(method, path, body) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' }
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) {
    headers['content-type'] = 'application/json'
    headers['idempotency-key'] = `uat-minor-${nonce}-${++sequence}`
  }
  const response = await fetch(gateway + path, { method, headers,
    body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' })
  const result = await response.json().catch(() => ({}))
  return { status: response.status, token: result?.data?.accessToken,
    code: result?.error?.code ?? result?.code ?? null }
}

function cleanupExact() {
  if (!/^uat-minor-[a-z0-9-]+@local\.invalid$/.test(identifier)) throw new Error('unsafe identifier')
  const sql = `START TRANSACTION;
UPDATE iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
 SET s.status='REVOKED', s.revoked_at=UTC_TIMESTAMP(6), s.revoke_reason='LOCAL_UAT_CLEANUP'
 WHERE a.identifier='${identifier}' AND s.status='ACTIVE';
UPDATE iam_service.iam_account SET status='DISABLED', roles='', permissions=''
 WHERE identifier='${identifier}';
SELECT CONCAT('ACCOUNT:',COUNT(*),':',COALESCE(MAX(status),'NONE')) FROM iam_service.iam_account WHERE identifier='${identifier}';
SELECT CONCAT('ACTIVE_SESSIONS:',COUNT(*)) FROM iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
 WHERE a.identifier='${identifier}' AND s.status='ACTIVE';
COMMIT;`
  const output = execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only',
    'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-B', '-e', sql],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  return { status: output.match(/ACCOUNT:(\d+):(DISABLED|NONE)/)?.slice(1) ?? null,
    activeSessions: Number(output.match(/ACTIVE_SESSIONS:(\d+)/)?.[1] ?? NaN) }
}

let cleanup
try {
  const registration = await call('POST', '/api/v1/auth/register', { identifier, password,
    device: { deviceType: 'WEB', clientVersion: 'uat-minor-gate', deviceName: 'local-uat' } })
  checks.push({ stage: 'register', status: registration.status })
  if (registration.status !== 201 || !registration.token) throw new Error('registration failed')
  token = registration.token

  for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    const consent = await call('PUT', '/api/v1/iam/consents', {
      type, version: 'b30-consent-v1', decision: 'ACCEPTED' })
    checks.push({ stage: `consent-${type}`, status: consent.status })
    if (consent.status !== 200) throw new Error(`${type} consent could not be accepted before Gate`)
  }
  const gate = await call('POST', '/api/v1/iam/adult-gate', {
    confirmed: true, birthYear: 2010, policyVersion: 'b30-adult-v1' })
  checks.push({ stage: 'minor-adult-gate', status: gate.status, code: gate.code })
  if (gate.status !== 403) throw new Error('minor adult gate was not rejected')
  const relogin = await call('POST', '/api/v1/auth/login', { identifier, password,
    device: { deviceType: 'WEB', clientVersion: 'uat-minor-gate', deviceName: 'local-uat' } })
  checks.push({ stage: 'fresh-login', status: relogin.status })
  if (relogin.status !== 200 || !relogin.token) throw new Error('fresh login failed')
  token = relogin.token
  for (const path of ['/api/v1/learner/profile', '/api/v1/learning/plan/current',
    '/api/v1/assessment/placement/start', '/api/v1/content/learner/catalog']) {
    const read = await call('GET', path)
    checks.push({ stage: 'learning-denied', path, status: read.status, code: read.code })
    if (path !== '/api/v1/learner/profile' && read.status !== 403) {
      throw new Error(`minor learning access ${path}: ${read.status}`)
    }
  }
} catch (error) {
  checks.push({ stage: 'probe-error', message: error instanceof Error ? error.message : String(error) })
  process.exitCode = 1
} finally {
  try {
    cleanup = cleanupExact()
    if (cleanup.status?.[0] !== '1' || cleanup.status?.[1] !== 'DISABLED' || cleanup.activeSessions !== 0) {
      throw new Error('exact cleanup verification failed')
    }
  } catch (error) {
    cleanup = { error: error instanceof Error ? error.message : String(error) }
    process.exitCode = 1
  }
  console.log(JSON.stringify({ probe: 'minor-gate-live', localOnly: true, checks, cleanup,
    secretsPrinted: false }, null, 2))
}
