// W9 live: learner media direct-read chain (P1-LIVE-012 decision A).
// ADULT_LEARNING consent covers media reads: consented learners carry
// media_consent + media:read + configured content rights; pre-gate tokens
// carry none and stay denied (fail closed).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const device = { deviceType: 'WEB', clientVersion: 'w9-live-1', deviceName: 'w9-live-probe' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
async function call(method, path, { token, body } = {}) {
  const h = { accept: 'application/json', 'x-client-platform': 'web', origin: 'http://127.0.0.1:18180', 'idempotency-key': `w9-live-${stamp}-${++idemN}-k`.slice(0, 60) };
  if (token) h.authorization = `Bearer ${token}`;
  if (body !== undefined) h['content-type'] = 'application/json';
  const res = await fetch(GW + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}
function claims(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}
const asset = execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e', "SELECT asset_id FROM media_service.media_asset WHERE tenant_id='platform' LIMIT 1"], { encoding: 'utf8' }).trim();
record('seed-asset', !!asset, `asset=${asset.slice(0, 8)}…`, 'seed asset exists');
const identifier = `w9m-${stamp}@local.invalid`;
const password = `E2eLive${stamp}Aa9!xQ`;
let r = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device } });
const pre = r.json?.data?.accessToken ?? null;
const c0 = pre ? claims(pre) : {};
record('pregate-no-media', !c0.media_consent && !c0.content_rights && !(c0.permissions ?? []).includes('media:read'), 'no media facts pre-gate', 'absent pre-gate');
r = await call('GET', `/api/v1/media/assets/${asset}`, { token: pre });
record('pregate-denied', r.status === 403 && JSON.stringify(r.json).includes('MEDIA_CONSENT_REQUIRED'), `HTTP ${r.status}`, 'HTTP 403 CONSENT');
await call('POST', '/api/v1/iam/adult-gate', { token: pre, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' } });
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  await call('PUT', '/api/v1/iam/consents', { token: pre, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' } });
}
r = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device } });
const token = r.json?.data?.accessToken ?? null;
const c = token ? claims(token) : {};
record('granted-media-facts', c.media_consent === 'granted' && (c.content_rights ?? []).length > 0 && (c.permissions ?? []).includes('media:read'), `consent=${c.media_consent} rights=${JSON.stringify(c.content_rights)}`, 'facts present');
r = await call('GET', `/api/v1/media/assets/${asset}`, { token });
record('metadata', r.status === 200 && !!(r.json?.asset ?? r.json?.data?.asset), `HTTP ${r.status}`, 'HTTP 200 asset');
r = await call('GET', `/api/v1/media/assets/${asset}/manifest`, { token });
record('manifest', r.status === 200, `HTTP ${r.status}`, 'HTTP 200 manifest');
const passed = checks.filter((co) => co.ok).length;
const evidence = { task: 'W9-LIVE-MEDIA', capturedAt: new Date().toISOString(), assetId: asset, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/w9-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`W9 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
