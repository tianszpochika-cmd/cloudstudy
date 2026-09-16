// M3-004 live: object-storage round-trip + workbench run. The service
// boundary is metadata-only by design (bytes never cross it): the service
// mints TTL-capped grants and binds checksum/size at activate; bytes move
// over S3 via the operator path (mc, documented). MinIO PUT -> activate ->
// read grant -> MinIO GET -> bytes match, plus tasks/subtitles/manifest,
// retry-negative, learner read and the browser listening workbench.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const WEB = 'http://127.0.0.1:18180';
const stamp = Date.now().toString(36);
const device = { deviceType: 'WEB', clientVersion: 'w3004-live-1', deviceName: 'w3004-live-probe' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w3004-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
async function call(method, path, { token, body, idemKey } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (idemKey) headers['idempotency-key'] = idemKey;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(GW + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}
const data = (r) => r.json?.data ?? r.json ?? {};
function mysql(q) {
  return execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e', q], { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
}
function mc(args, input) {
  return execFileSync('docker', ['run', '--rm', '-i', '--network', 'yuxuexing-local_yuxuexing-local', '-e', 'MC_HOST_local=http://change-me:change-me-local@minio:9000', 'minio/mc:latest', ...args], { input, encoding: 'utf8' }).trim();
}
// staff with media perms (grant BEFORE gate so the post-gate token carries them).
const identifier = `test-m3004-${stamp}@local.invalid`;
const password = `E2eX${stamp}Aa9!xQ`;
let r = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device }, idemKey: idem('reg') });
record('setup-register', r.status === 201, `HTTP ${r.status}`, 'HTTP 201');
let stok = r.json?.data?.accessToken ?? null;
mysql(`UPDATE iam_service.iam_account SET roles = 'staff,media-uploader', permissions = 'media:write,media:read' WHERE identifier = '${identifier}'`);
await call('POST', '/api/v1/iam/adult-gate', { token: stok, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idemKey: idem('gate') });
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  await call('PUT', '/api/v1/iam/consents', { token: stok, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idemKey: idem(`c-${t}`) });
}
r = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device }, idemKey: idem('login') });
const token = r.json?.data?.accessToken ?? null;
record('setup-login', r.status === 200 && !!token, `HTTP ${r.status}`, 'HTTP 200 + token');
const bytes = Buffer.from(`m3004-probe-bytes-${stamp}-`.padEnd(1024, 'x'));
const sha = createHash('sha256').update(bytes).digest('hex');
const assetId = `m3004-asset-${stamp}`;
const objectKey = `probe/${assetId}.mp3`;
const regBody = {
  assetId, assetKey: objectKey, kind: 'AUDIO', mimeType: 'audio/mpeg',
  storageProvider: 'minio', bucketName: 'yuxuexing-local', objectKey,
  checksumSha256: sha, sizeBytes: bytes.length, supportsRange: true, chunkSizeBytes: 524288, partCount: 1,
  contentVersionId: '301', contentRole: 'LISTENING_MATERIAL', rightsId: 'LOCAL_FIXTURE',
  licenseCode: 'LOCAL_DEV_LICENSE', rightsStatus: 'ACTIVE', permittedChannels: ['LEARNER', 'RECORDING', 'STREAM'],
  allowOffline: false, authorizationEvidenceRef: 'local-probe',
};
const regKey = idem('register');
r = await call('POST', '/api/v1/media/assets', { token, body: regBody, idemKey: regKey });
record('register', r.status === 201, `HTTP ${r.status}`, 'HTTP 201');
const r2 = await call('POST', '/api/v1/media/assets', { token, body: regBody, idemKey: regKey });
record('register-replay', r2.status === 201 && (data(r2).asset?.assetId ?? data(r2).assetId) === assetId, `HTTP ${r2.status} same asset`, 'same-key replay');
r = await call('POST', `/api/v1/media/assets/${assetId}/upload-url`, { token, body: {}, idemKey: idem('upurl') });
{
  const d = data(r);
  const ttlOk = d.url && d.expiresAt && (new Date(d.expiresAt) - new Date()) / 1000 <= 901;
  record('upload-grant', r.status === 200 && !!d.url && ttlOk, `HTTP ${r.status} ttl-capped=${ttlOk}`, 'HTTP 200 grant');
}
// bytes move over S3 (operator path via mc pipe); the service never sees them.
mc(['pipe', `local/yuxuexing-local/${objectKey}`], bytes);
record('minio-put', true, `${bytes.length} bytes -> ${objectKey}`, 'PUT ok');
r = await call('PUT', `/api/v1/media/assets/${assetId}/active`, { token, body: { verifiedChecksumSha256: sha, verifiedSizeBytes: bytes.length }, idemKey: idem('activate') });
record('activate', r.status === 200 && (data(r).asset?.status ?? data(r).status) === 'ACTIVE', `HTTP ${r.status}`, 'HTTP 200 ACTIVE');
r = await call('POST', `/api/v1/media/assets/${assetId}/signed-url`, { token, body: {}, idemKey: idem('readgrant') });
{
  const d = data(r);
  const grantToken = d.token ?? (d.url && d.url.includes('token=') ? d.url.split('token=')[1] : null);
  record('read-grant', r.status === 200 && !!grantToken, `HTTP ${r.status}`, 'HTTP 200 grant');
}
{
  const fetched = execFileSync('docker', ['run', '--rm', '--network', 'yuxuexing-local_yuxuexing-local', '-e', 'MC_HOST_local=http://change-me:change-me-local@minio:9000', 'minio/mc:latest', 'cat', `local/yuxuexing-local/${objectKey}`]);
  const fsha = createHash('sha256').update(fetched).digest('hex');
  record('roundtrip-match', fsha === sha && fetched.length === bytes.length, `sha match=${fsha === sha}`, 'bytes identical');
}
r = await call('GET', `/api/v1/media/assets/${assetId}/tasks`, { token });
record('tasks', r.status === 200 && (data(r).tasks?.assetId ?? data(r).assetId) === assetId, `HTTP ${r.status}`, 'HTTP 200 workbench');
const subSha = createHash('sha256').update(`vtt-${stamp}`).digest('hex');
r = await call('POST', `/api/v1/media/assets/${assetId}/subtitles`, { token, body: { locale: 'zh-CN', format: 'VTT', checksumSha256: subSha, sizeBytes: 64 }, idemKey: idem('sub') });
record('subtitle', r.status === 200, `HTTP ${r.status}`, 'HTTP 200 subtitle');
r = await call('GET', `/api/v1/media/assets/${assetId}/manifest`, { token });
record('manifest', r.status === 200 && JSON.stringify(r.json).includes(sha.slice(0, 16)), `HTTP ${r.status}`, 'HTTP 200 checksum in manifest');
r = await call('POST', `/api/v1/media/assets/${assetId}/retry`, { token, idemKey: idem('retry') });
record('retry-negative', r.status === 409 && JSON.stringify(r.json).includes('MEDIA_NOTHING_TO_RETRY'), `HTTP ${r.status}`, 'HTTP 409 nothing failed');
// learner read path (post-gate media:read).
const lidentifier = `w3004l-${stamp}@local.invalid`;
const lpassword = `E2eLive${stamp}Aa9!xQ`;
let lr = await call('POST', '/api/v1/auth/register', { body: { identifier: lidentifier, password: lpassword, device }, idemKey: idem('lreg') });
const lt0 = lr.json?.data?.accessToken ?? null;
await call('POST', '/api/v1/iam/adult-gate', { token: lt0, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idemKey: idem('lgate') });
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  await call('PUT', '/api/v1/iam/consents', { token: lt0, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idemKey: idem(`lc-${t}`) });
}
lr = await call('POST', '/api/v1/auth/login', { body: { identifier: lidentifier, password: lpassword, device }, idemKey: idem('llogin') });
const ltok = lr.json?.data?.accessToken ?? null;
r = await call('GET', `/api/v1/media/assets/${assetId}/manifest`, { token: ltok });
record('learner-manifest', r.status === 200, `HTTP ${r.status}`, 'HTTP 200 learner read');
// browser workbench: listening page with fixture material, zero pageerrors.
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 130)));
await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(2000);
await page.getByLabel(/账号|邮箱/i).first().fill(lidentifier);
await page.getByLabel(/密码/i).first().fill(lpassword);
await page.getByRole('button', { name: /登录/i }).first().click();
await page.waitForTimeout(4000);
await page.goto(`${WEB}/listening`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(6000);
const bodyText = (await page.locator('body').first().textContent().catch(() => '')) ?? '';
record('browser-workbench', page.url().includes('/listening') && bodyText.includes('听力精练') && errs.length === 0, 'workbench renders + zero errors', 'renders, zero errors');
await browser.close();
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'M3004-LIVE-ROUNDTRIP', capturedAt: new Date().toISOString(), gateway: GW, assetId, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/m3004-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`M3004 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
