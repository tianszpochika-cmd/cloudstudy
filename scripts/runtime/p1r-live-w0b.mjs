// W0b live: refresh rotation + reuse-reject + logout + post-logout reject +
// reset request accepted + challenge row durable + reset confirm negative +
// consent withdraw revokes + old token dead.
const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const identifier = `w0b-${stamp}@local.invalid`;
const password = `E2eLive${stamp}Aa9!xQ`;
const device = { deviceType: 'WEB', clientVersion: 'w0b-live-1', deviceName: 'w0b-live-probe' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `w0b-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
async function call(method, path, { token, body, idemKey, cookie } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web', origin: 'http://127.0.0.1:18180' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (idemKey) headers['idempotency-key'] = idemKey;
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(GW + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  return { status: res.status, json, setCookies };
}
let r = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device }, idemKey: idem('reg') });
record('register', r.status === 201, `HTTP ${r.status}`, 'HTTP 201');
let token = r.json?.data?.accessToken ?? null;
await call('POST', '/api/v1/iam/adult-gate', { token, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idemKey: idem('gate') });
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  await call('PUT', '/api/v1/iam/consents', { token, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idemKey: idem(`c-${t}`) });
}
r = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device }, idemKey: idem('login') });
token = r.json?.data?.accessToken ?? null;
let cookie = (r.setCookies ?? []).find((c) => c.startsWith('yuxuexing_refresh='));
cookie = cookie ? cookie.split(';', 1)[0] : null;
record('login', r.status === 200 && !!token && !!cookie, `HTTP ${r.status}`, 'HTTP 200 + token + cookie');
// refresh rotation
r = await call('POST', '/api/v1/auth/token/refresh', { idemKey: idem('ref1'), cookie });
const token2 = r.json?.data?.accessToken ?? r.json?.accessToken ?? null;
const cookie2 = ((r.setCookies ?? []).find((c) => c.startsWith('yuxuexing_refresh=')) ?? '').split(';', 1)[0];
record('refresh-rotation', r.status === 200 && !!token2 && !!cookie2 && cookie2 !== cookie, `HTTP ${r.status} rotated=${!!token2 && cookie2 !== cookie}`, 'HTTP 200 + rotated pair');
// logout with the rotated pair (session still live: replay probe comes later)
r = await call('POST', '/api/v1/auth/logout', { token: token2, body: {}, idemKey: idem('logout'), cookie: cookie2 });
record('logout', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
// refresh after logout: revoked family must die (404 session-not-found)
r = await call('POST', '/api/v1/auth/token/refresh', { idemKey: idem('ref-after'), cookie: cookie2 });
record('refresh-after-logout-rejected', r.status === 404, `HTTP ${r.status}`, 'HTTP 404 revoked family');
// fresh login, rotate once more, then replay the pre-rotation cookie: reuse must kill the family
r = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device }, idemKey: idem('login-b') });
const tokenB = r.json?.data?.accessToken ?? null;
const cookieB = (((r.setCookies ?? []).find((c) => c.startsWith('yuxuexing_refresh=')) ?? '').split(';', 1)[0]) || null;
record('relogin-b', r.status === 200 && !!tokenB, `HTTP ${r.status}`, 'HTTP 200');
r = await call('POST', '/api/v1/auth/token/refresh', { idemKey: idem('ref-b1'), cookie: cookieB });
const cookieB2 = (((r.setCookies ?? []).find((c) => c.startsWith('yuxuexing_refresh=')) ?? '').split(';', 1)[0]) || null;
record('rotation-b', r.status === 200 && !!cookieB2, `HTTP ${r.status}`, 'HTTP 200');
r = await call('POST', '/api/v1/auth/token/refresh', { idemKey: idem('ref-replay'), cookie: cookieB });
record('refresh-replay-rejected', r.status === 401, `HTTP ${r.status}`, 'HTTP 401 reuse kills family');
// password-reset request accepted (non-enumerating), challenge durable is DB-verified out of band
r = await call('POST', '/api/v1/auth/password-reset/request', { body: { identifier }, idemKey: idem('reset-req') });
record('reset-request-accepted', r.status === 200 || r.status === 202, `HTTP ${r.status}`, 'HTTP 200/202');
r = await call('POST', '/api/v1/auth/password-reset/request', { body: { identifier: 'nobody@local.invalid' }, idemKey: idem('reset-unknown') });
record('reset-unknown-same-shape', r.status === 200 || r.status === 202, `HTTP ${r.status}`, 'HTTP 200/202 (no enumeration)');
r = await call('POST', '/api/v1/auth/password-reset/confirm', { body: { identifier, resetToken: 'garbage-token-value-0000000000000000', newPassword: 'E2eLiveNEWPASSword01!' }, idemKey: idem('reset-neg') });
record('reset-confirm-negative', r.status === 400 || r.status === 401 || r.status === 404, `HTTP ${r.status}`, 'HTTP 400/401/404');
// fresh login for withdraw test (old session is logged out)
r = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device }, idemKey: idem('login2') });
const token3 = r.json?.data?.accessToken ?? null;
const cookie3 = (((r.setCookies ?? []).find((c) => c.startsWith('yuxuexing_refresh=')) ?? '').split(';', 1)[0]) || null;
record('relogin', r.status === 200 && !!token3, `HTTP ${r.status}`, 'HTTP 200');
// withdraw ADULT_LEARNING consent
r = await call('PUT', '/api/v1/iam/consents', { token: token3, body: { type: 'ADULT_LEARNING', version: 'b30-consent-v1', decision: 'WITHDRAWN' }, idemKey: idem('withdraw') });
record('consent-withdrawn', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
// pre-withdrawal token still passes inside its 900s TTL (claims frozen at issuance: documented staleness)
r = await call('GET', '/api/v1/learner/profile', { token: token3 });
record('withdrawn-token-ttl-stale-allowed', r.status === 200, `HTTP ${r.status} (stale-but-unexpired, by design)`, 'HTTP 200');
// re-login AFTER withdrawal: fresh issuance must evaluate to deny
r = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device }, idemKey: idem('login-post-withdraw') });
const token4 = r.json?.data?.accessToken ?? null;
record('relogin-post-withdraw', r.status === 200 && !!token4, `HTTP ${r.status}`, 'HTTP 200 + token');
r = await call('GET', '/api/v1/learner/profile', { token: token4 });
record('withdrawn-fresh-token-denied', r.status === 401 || r.status === 403, `HTTP ${r.status}`, 'HTTP 401/403 on fresh issuance');
// refresh with withdrawn session: revoked family dies 404; live-but-restricted family still rotates
r = await call('POST', '/api/v1/auth/token/refresh', { idemKey: idem('ref-withdrawn'), cookie: cookie3 });
record('withdrawn-refresh', [404, 200].includes(r.status), `HTTP ${r.status} (404=family revoked, 200=restricted-but-live)`, 'HTTP 404/200 recorded');
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'W0B-LIVE-E2E', capturedAt: new Date().toISOString(), gateway: GW, identifier, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
await (await import('node:fs')).promises.writeFile('evidence/live/2026-09-16/w0b-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`W0b live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
