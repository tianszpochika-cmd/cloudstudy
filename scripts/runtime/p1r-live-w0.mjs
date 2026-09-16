// W0 live chain, web recipe per b30-runtime-probe (proven): email identifier,
// WEB device, x-client-platform + idempotency-key. Then adult-gate + profile + negatives.
const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const identifier = `w0-${stamp}@local.invalid`;
const password = `E2eLive${stamp}Aa9!xQ`;
const device = { deviceType: 'WEB', clientVersion: 'w0-live-1', deviceName: 'w0-live-probe' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
async function call(method, path, { token, body, idem, cookie } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (idem) headers['idempotency-key'] = idem;
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(GW + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  return { status: res.status, json, setCookies };
}
console.log('W0 live: identifier=' + identifier);
let r = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device }, idem: `w0-live-${stamp}-register-01` });
const token0 = r.json?.accessToken ?? r.json?.data?.accessToken ?? null;
record('register-201', r.status === 201 && !!token0, `HTTP ${r.status} token=${token0 ? 'present' : 'absent'}`, 'HTTP 201 + accessToken');
r = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device }, idem: `w0-live-${stamp}-register-01-dup` });
record('duplicate-409', r.status === 409, `HTTP ${r.status}`, 'HTTP 409');
r = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device }, idem: `w0-live-${stamp}-login-01` });
const token = r.json?.accessToken ?? r.json?.data?.accessToken ?? null;
console.log("  login-body-keys:", r.json ? Object.keys(r.json).join(",") : "null");
const refreshCookie = (r.setCookies ?? []).find((c) => c.startsWith('yuxuexing_refresh='));
record('login-200-token', r.status === 200 && !!token, `HTTP ${r.status} token=${token ? 'present' : 'absent'}`, 'HTTP 200 + accessToken');
record('login-refresh-cookie', !!refreshCookie, `refresh-cookie=${refreshCookie ? 'present' : 'absent'}`, 'yuxuexing_refresh cookie');
r = await call('POST', '/api/v1/iam/adult-gate', { token, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idem: `w0-live-${stamp}-gate-01` });
for (const ctype of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  const cr = await call('PUT', '/api/v1/iam/consents', { token, body: { type: ctype, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idem: `w0-live-${stamp}-consent-${ctype}` });
  record(`consent-${ctype}`, cr.status === 200, `HTTP ${cr.status}`, 'HTTP 200');
}
record('adult-gate-pass', r.status === 200, `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 140)}`, 'HTTP 200 PASSED');
r = await call('POST', '/api/v1/auth/login', { body: { identifier, password, device }, idem: `w0-live-${stamp}-login-02` });
const token2 = r.json?.accessToken ?? r.json?.data?.accessToken ?? null;
record('relogin-200-token', r.status === 200 && !!token2, `HTTP ${r.status}`, 'HTTP 200 + fresh token');
r = await call('GET', '/api/v1/learner/profile', { token: token2 });
record('profile-authed', r.status === 200, `HTTP ${r.status}`, 'HTTP 200');
r = await call('GET', '/api/v1/learner/profile');
record('profile-anon-401', r.status === 401, `HTTP ${r.status}`, 'HTTP 401');
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'W0-LIVE-E2E', capturedAt: new Date().toISOString(), gateway: GW, identifier, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
await (await import('node:fs')).promises.writeFile('evidence/live/2026-09-16/w0-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`W0 live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
