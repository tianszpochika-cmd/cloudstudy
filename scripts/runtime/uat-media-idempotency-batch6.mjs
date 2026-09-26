/** Local-only Gateway/media owner probe. Synthetic account, metadata and receipts are removed. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'

const stamp = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
const identifier = `uat-media-${stamp}@local.invalid`
const password = `Uat!${randomBytes(20).toString('base64url')}a9`
const assetId = randomUUID()
const hash = 'a'.repeat(64)
const gateway = 'http://127.0.0.1:18070'
const output = path.resolve('artifacts/uat-2026-09-23/media-idempotency-runtime.json')
const checks = []
const evidence = { scope: 'local Gateway media metadata idempotency; no uploaded object bytes', assetId, checks, cleanup: null }
let principalId = null
let registered = false

function mysql(sql) {
  return execFileSync('docker', [
    'exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1',
    'mysql', '-uroot', '--batch', '--skip-column-names', '-e', sql,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function record(name, observed, expected, ok) {
  checks.push({ name, observed, expected, ok })
  if (!ok) throw new Error(`${name}: observed ${JSON.stringify(observed)}, expected ${JSON.stringify(expected)}`)
}

async function call(method, route, { token, body, key } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' }
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (key) headers['Idempotency-Key'] = key
  const response = await fetch(`${gateway}${route}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual',
  })
  const json = await response.json().catch(() => null)
  return { status: response.status, data: json?.data ?? json, code: json?.error?.code ?? json?.code ?? null }
}

function cleanup() {
  assert.match(identifier, /^uat-media-[a-z0-9]+@local\.invalid$/)
  assert.match(assetId, /^[0-9a-f-]{36}$/)
  if (principalId) assert.match(principalId, /^[0-9a-f-]{36}$/)
  const owner = mysql(`SELECT owner_subject FROM media_service.media_asset WHERE asset_id='${assetId}'`)
  if (owner) assert.equal(owner, principalId, 'probe asset owner')
  const result = mysql(`START TRANSACTION;
    DELETE FROM media_service.media_rendition WHERE asset_id='${assetId}'; SELECT CONCAT('renditions:',ROW_COUNT());
    DELETE FROM media_service.media_outbox_event WHERE aggregate_id='${assetId}'; SELECT CONCAT('outbox:',ROW_COUNT());
    DELETE FROM media_service.media_write_idempotency_record WHERE tenant_id='platform' AND subject_id='${principalId}' AND idempotency_key LIKE 'uat-media-${stamp}-%'; SELECT CONCAT('writeReceipts:',ROW_COUNT());
    DELETE FROM media_service.media_idempotency_record WHERE tenant_id='platform' AND subject_id='${principalId}' AND asset_id='${assetId}'; SELECT CONCAT('registrationReceipts:',ROW_COUNT());
    DELETE FROM media_service.media_asset WHERE asset_id='${assetId}' AND owner_subject='${principalId}'; SELECT CONCAT('asset:',ROW_COUNT());
    COMMIT;`)
  const removed = Object.fromEntries(result.split(/\r?\n/).filter(line => /^(renditions|outbox|writeReceipts|registrationReceipts|asset):\d+$/.test(line)).map(line => {
    const [key, value] = line.split(':'); return [key, Number(value)]
  }))
  if (owner) assert.equal(removed.asset, 1)
  const account = mysql(`START TRANSACTION;
    UPDATE iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
       SET s.status='REVOKED',s.revoked_at=UTC_TIMESTAMP(6),s.revoke_reason='LOCAL_UAT_CLEANUP'
     WHERE a.identifier='${identifier}' AND s.status='ACTIVE';
    UPDATE iam_service.iam_account SET status='DISABLED',roles='',permissions='' WHERE identifier='${identifier}';
    SELECT CONCAT(COUNT(*),':',COALESCE(MAX(status),'NONE')) FROM iam_service.iam_account WHERE identifier='${identifier}';
    COMMIT;`)
  const activeSessions = Number(mysql(`SELECT COUNT(*) FROM iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id WHERE a.identifier='${identifier}' AND s.status='ACTIVE'`))
  if (registered) assert.equal(account, '1:DISABLED')
  assert.equal(activeSessions, 0)
  return { removed, account, activeSessions }
}

try {
  const health = await fetch(`${gateway}/actuator/health/readiness`)
  assert.equal(health.status, 200)
  const device = { deviceType: 'WEB', clientVersion: 'uat-media-1', deviceName: 'uat-media' }
  const registration = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device }, key: `reg-${stamp}` })
  registered = registration.status === 201
  record('register account', registration.status, 201, registered)
  principalId = mysql(`SELECT principal_id FROM iam_service.iam_account WHERE identifier='${identifier}'`)
  assert.match(principalId, /^[0-9a-f-]{36}$/)
  mysql(`UPDATE iam_service.iam_account SET roles='staff,media-editor', permissions='media:write,media:read' WHERE identifier='${identifier}'`)
  const preGateToken = registration.data?.accessToken
  assert.equal(typeof preGateToken, 'string')
  const gate = await call('POST', '/api/v1/iam/adult-gate', { token: preGateToken,
    body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, key: `uat-media-${stamp}-gate` })
  record('adult Gate', gate.status, 200, gate.status === 200)
  for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    const consent = await call('PUT', '/api/v1/iam/consents', { token: preGateToken,
      body: { type, version: 'b30-consent-v1', decision: 'ACCEPTED' }, key: `uat-media-${stamp}-${type.toLowerCase()}` })
    record(`${type} consent`, consent.status, 200, consent.status === 200)
  }
  const login = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device }, key: `login-${stamp}` })
  record('staff login', login.status, 200, login.status === 200)
  const token = login.data?.accessToken
  assert.equal(typeof token, 'string')
  const contentAuthProbe = await call('GET', '/api/v1/admin/content-commands?pageSize=1', { token })
  record('Gateway recognizes the issued JWT', { status: contentAuthProbe.status, code: contentAuthProbe.code },
    'not 401', contentAuthProbe.status !== 401)

  const asset = {
    assetId, assetKey: `uat-media-${stamp}`, kind: 'AUDIO', mimeType: 'audio/mpeg',
    storageProvider: 'MINIO', bucketName: 'yuxuexing-local', objectKey: `uat-media/${assetId}.mp3`, objectVersion: 'missing-v1',
    checksumSha256: hash, sizeBytes: 1024, supportsRange: false, chunkSizeBytes: 0, partCount: 0,
    contentVersionId: '91', contentRole: 'LEARNING_AUDIO', segmentId: `uat-${stamp}`,
    rightsId: `uat-rights-${stamp}`, licenseCode: 'LOCAL_UAT_PENDING', rightsStatus: 'PENDING',
    permittedChannels: ['STREAM'], allowOffline: false,
  }
  const route = '/api/v1/media/assets'
  const missingKey = await call('POST', route, { token, body: asset })
  const directProbeResponse = await fetch('http://127.0.0.1:18092/internal/v1/media/assets', {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(asset),
  })
  const directProbeBody = await directProbeResponse.json().catch(() => null)
  evidence.directMissingKeyProbe = { status: directProbeResponse.status, code: directProbeBody?.code ?? directProbeBody?.errorCode ?? null }
  record('registration requires key', { status: missingKey.status, code: missingKey.code, response: missingKey.data },
    { status: 400 }, missingKey.status === 400)
  const key = `uat-media-${stamp}-register`
  const first = await call('POST', route, { token, body: asset, key })
  record('asset registration', { status: first.status, version: first.data?.asset?.assetVersion }, { status: 201, version: 1 },
    first.status === 201 && first.data?.asset?.assetVersion === 1)
  const replay = await call('POST', route, { token, body: asset, key })
  record('registration exact replay', { status: replay.status, same: isDeepStrictEqual(replay.data, first.data) }, { status: 201, same: true },
    replay.status === 201 && isDeepStrictEqual(replay.data, first.data))
  const changed = await call('POST', route, { token, body: { ...asset, sizeBytes: 2048 }, key })
  record('registration changed body denied', { status: changed.status, code: changed.code },
    { status: 409, code: 'MEDIA_IDEMPOTENCY_CONFLICT' },
    changed.status === 409 && changed.code === 'MEDIA_IDEMPOTENCY_CONFLICT')
  const noObjectActivation = await call('PUT', `${route}/${assetId}/active`, { token,
    body: { verifiedChecksumSha256: hash, verifiedSizeBytes: 1024 }, key: `uat-media-${stamp}-activate` })
  record('unuploaded object cannot activate', { status: noObjectActivation.status, code: noObjectActivation.code },
    { status: 503, code: 'MEDIA_OBJECT_STORE_NOT_CONFIGURED' },
    noObjectActivation.status === 503 && noObjectActivation.code === 'MEDIA_OBJECT_STORE_NOT_CONFIGURED')

  const subtitleRoute = `${route}/${assetId}/subtitles`
  const subtitle = { locale: 'zh-CN', format: 'VTT', checksumSha256: hash, sizeBytes: 64 }
  const subtitleKey = `uat-media-${stamp}-subtitle`
  const subtitled = await call('POST', subtitleRoute, { token, body: subtitle, key: subtitleKey })
  record('subtitle metadata', { status: subtitled.status, version: subtitled.data?.asset?.assetVersion },
    { status: 200, version: 2 }, subtitled.status === 200 && subtitled.data?.asset?.assetVersion === 2)
  const subtitleReplay = await call('POST', subtitleRoute, { token, body: subtitle, key: subtitleKey })
  record('subtitle exact replay', { status: subtitleReplay.status, same: isDeepStrictEqual(subtitleReplay.data, subtitled.data) },
    { status: 200, same: true }, subtitleReplay.status === 200 && isDeepStrictEqual(subtitleReplay.data, subtitled.data))
  const subtitleChanged = await call('POST', subtitleRoute, { token, body: { ...subtitle, sizeBytes: 65 }, key: subtitleKey })
  record('subtitle changed body denied', { status: subtitleChanged.status, code: subtitleChanged.code },
    { status: 409, code: 'MEDIA_IDEMPOTENCY_CONFLICT' },
    subtitleChanged.status === 409 && subtitleChanged.code === 'MEDIA_IDEMPOTENCY_CONFLICT')
  // Processing callbacks have no public Gateway projection. Set the FAILED owner
  // state through the authenticated internal API, then exercise retry via Gateway.
  const transcodingResponse = await fetch(`http://127.0.0.1:18092/internal/v1/media/assets/${assetId}/transcoding`, {
    method: 'PUT', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'FAILED', failureCode: 'LOCAL_UAT_CODEC_FAILURE' }),
  })
  const transcoding = { status: transcodingResponse.status,
    data: await transcodingResponse.json().catch(() => null) }
  evidence.retrySetup = 'authenticated direct owner processing callback; no public Gateway transcoding route'
  record('processing failure recorded', { status: transcoding.status, version: transcoding.data?.asset?.assetVersion },
    { status: 200, version: 3 }, transcoding.status === 200 && transcoding.data?.asset?.assetVersion === 3)
  const retryRoute = `${route}/${assetId}/retry`
  const retryKey = `uat-media-${stamp}-retry`
  const retried = await call('POST', retryRoute, { token, key: retryKey })
  record('failed processing queued', { status: retried.status, version: retried.data?.asset?.assetVersion,
    transcodingStatus: retried.data?.asset?.transcodingStatus },
    { status: 200, version: 4, transcodingStatus: 'QUEUED' },
    retried.status === 200 && retried.data?.asset?.assetVersion === 4 && retried.data?.asset?.transcodingStatus === 'QUEUED')
  const retryReplay = await call('POST', retryRoute, { token, key: retryKey })
  record('retry exact replay', { status: retryReplay.status, same: isDeepStrictEqual(retryReplay.data, retried.data) },
    { status: 200, same: true }, retryReplay.status === 200 && isDeepStrictEqual(retryReplay.data, retried.data))
  const retryOtherKey = await call('POST', retryRoute, { token, key: `uat-media-${stamp}-retry-other` })
  record('new retry without failure rejected', { status: retryOtherKey.status, code: retryOtherKey.code },
    { status: 409, code: 'MEDIA_NOTHING_TO_RETRY' },
    retryOtherKey.status === 409 && retryOtherKey.code === 'MEDIA_NOTHING_TO_RETRY')
  const state = mysql(`SELECT CONCAT(asset_version,':',asset_status) FROM media_service.media_asset WHERE asset_id='${assetId}'`)
  record('owner stored version', state, '4:UPLOADING', state === '4:UPLOADING')
  const receiptCount = Number(mysql(`SELECT COUNT(*) FROM media_service.media_write_idempotency_record WHERE tenant_id='platform' AND subject_id='${principalId}'`))
  record('one receipt per successful write', receiptCount, 3, receiptCount === 3)
  evidence.result = 'PASS'
} catch (error) {
  evidence.result = 'FAIL'
  evidence.failure = { name: error.name, message: String(error.message).slice(0, 400) }
  process.exitCode = 1
} finally {
  try { evidence.cleanup = cleanup() } catch (error) {
    evidence.cleanup = { error: String(error.message).slice(0, 400) }
    process.exitCode = 1
  }
  evidence.capturedAt = new Date().toISOString()
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`)
  console.log(JSON.stringify({ result: evidence.result, checks: checks.length, failure: evidence.failure ?? null, cleanup: evidence.cleanup, output }))
}
