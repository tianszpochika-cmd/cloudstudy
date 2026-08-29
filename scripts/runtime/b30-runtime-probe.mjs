import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readB30Inputs, repositoryRoot, validateB30LocalJwt } from './b30-static-check.mjs';

const gatewayUrl = (process.env.B30_GATEWAY ?? 'http://127.0.0.1:18070').replace(/\/$/, '');
const runId = process.env.B30_JWT_RUN_ID ?? `b30-jwt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

function safeIdentifier() {
  return `${runId}@local.invalid`;
}

function safePassword() {
  return `${crypto.randomBytes(24).toString('base64url')}Aa9!`;
}

function extractCookie(headers, current) {
  const values = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : (headers.get('set-cookie') ? [headers.get('set-cookie')] : []);
  const next = values.find((value) => value.startsWith('yuxuexing_refresh='));
  return next ? next.split(';', 1)[0] : current;
}

async function request(pathname, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('accept', 'application/json');
  if (options.token) headers.set('authorization', `Bearer ${options.token}`);
  if (options.body !== undefined) {
    headers.set('content-type', 'application/json');
  }
  if (options.cookie) headers.set('cookie', options.cookie);
  const response = await fetch(`${gatewayUrl}${pathname}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: 'manual',
  });
  let body = null;
  const text = await response.text();
  if (text) {
    try { body = JSON.parse(text); } catch { body = text.slice(0, 800); }
  }
  return { status: response.status, body, cookie: extractCookie(response.headers, options.cookie) };
}

function requireStatus(result, expected, label) {
  if (result.status !== expected) throw new Error(`${label}: expected HTTP ${expected}, got ${result.status}`);
}

function requireToken(result, label) {
  if (typeof result.body?.accessToken !== 'string' || !result.body.accessToken) {
    throw new Error(`${label}: IAM did not return an access token`);
  }
  return result.body.accessToken;
}

async function runProbe() {
  const identifier = safeIdentifier();
  const password = safePassword();
  const device = { deviceType: 'WEB', clientVersion: 'b30-runtime', deviceName: 'runtime-probe' };
  const checks = [];
  const register = await request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'x-client-platform': 'web', 'idempotency-key': `${runId}-register` },
    body: { identifier, password, device },
  });
  requireStatus(register, 201, 'account registration');
  const firstToken = requireToken(register, 'registration');
  let cookie = register.cookie;
  checks.push({ id: 'account-password-registration', status: 'PASS' });

  const login = await request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'x-client-platform': 'web', 'idempotency-key': `${runId}-login` },
    body: { identifier, password, device },
  });
  requireStatus(login, 200, 'account login');
  const loginToken = requireToken(login, 'login');
  cookie = login.cookie ?? cookie;
  checks.push({ id: 'account-password-login', status: 'PASS' });

  const jwks = await request('/api/v1/auth/jwks');
  requireStatus(jwks, 200, 'JWKS');
  if (!Array.isArray(jwks.body?.keys) || !jwks.body.keys.some((key) => key.alg === 'RS256' && key.use === 'sig' && key.kid && !key.d)) {
    throw new Error('JWKS did not expose a public RS256 signing key');
  }
  checks.push({ id: 'jwks-public-rs256', status: 'PASS' });

  const principal = await request('/api/v1/iam/principal/me', {
    token: loginToken,
    headers: { 'x-role': 'admin', 'x-tenant-id': 'forged-tenant', 'x-owner-id': 'forged-owner' },
  });
  requireStatus(principal, 200, 'principal/me');
  if (principal.body?.roles?.includes('admin') || principal.body?.tenantId !== 'platform') {
    throw new Error('client authority headers changed the server-derived principal');
  }
  checks.push({ id: 'principal-and-forged-authority-headers', status: 'PASS' });

  const refreshBefore = cookie;
  if (!refreshBefore) throw new Error('web login did not return an HttpOnly refresh cookie');
  const rotated = await request('/api/v1/auth/token/refresh', {
    method: 'POST', headers: { 'x-client-platform': 'web', 'idempotency-key': `${runId}-refresh-1` }, cookie: refreshBefore,
  });
  requireStatus(rotated, 200, 'refresh rotation');
  const rotatedToken = requireToken(rotated, 'refresh rotation');
  cookie = rotated.cookie ?? cookie;
  if (cookie === refreshBefore) throw new Error('refresh cookie was not rotated');
  checks.push({ id: 'refresh-rotation', status: 'PASS' });

  const replay = await request('/api/v1/auth/token/refresh', {
    method: 'POST', headers: { 'x-client-platform': 'web', 'idempotency-key': `${runId}-refresh-replay` }, cookie: refreshBefore,
  });
  requireStatus(replay, 401, 'refresh replay');
  checks.push({ id: 'refresh-replay-rejected', status: 'PASS' });

  const logout = await request('/api/v1/auth/logout', {
    method: 'POST', token: rotatedToken, cookie, body: {}, headers: { 'idempotency-key': `${runId}-logout` },
  });
  requireStatus(logout, 200, 'logout');
  const afterLogout = await request('/api/v1/auth/token/refresh', {
    method: 'POST', headers: { 'x-client-platform': 'web', 'idempotency-key': `${runId}-refresh-after-logout` }, cookie,
  });
  requireStatus(afterLogout, 401, 'refresh after logout');
  checks.push({ id: 'logout-revocation', status: 'PASS' });

  const lockIdentifier = `${runId}-lock@local.invalid`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await request('/api/v1/auth/register', {
      method: 'POST', headers: { 'x-client-platform': 'web', 'idempotency-key': `${runId}-lock-register` },
      body: { identifier: lockIdentifier, password, device },
    });
    const failure = await request('/api/v1/auth/login', {
      method: 'POST', headers: { 'x-client-platform': 'web', 'idempotency-key': `${runId}-lock-login-${attempt}` },
      body: { identifier: lockIdentifier, password: `${password}-wrong`, device },
    });
    if (attempt < 4) requireStatus(failure, 401, `wrong password ${attempt + 1}`);
    else requireStatus(failure, 423, 'account lockout');
  }
  checks.push({ id: 'wrong-password-and-account-lockout', status: 'PASS' });

  return {
    result: 'PASS',
    batch: 'B30',
    evidenceClass: 'runtime-self-owned-jwt',
    runId,
    checks,
    tokenMaterial: { tokenValuesEmitted: false, credentialsPersisted: false, jwtCreated: false },
  };
}

function evidencePathFromEnv(root) {
  const value = process.env.B30_RUNTIME_EVIDENCE_FILE?.trim();
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.resolve(root, value);
}

const currentFile = path.resolve(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  try {
    const inputs = readB30Inputs(repositoryRoot);
    const staticResult = validateB30LocalJwt(inputs);
    if (staticResult.result !== 'PASS') throw new Error(`B30 static contract failed: ${staticResult.errors.join('; ')}`);
    const evidence = await runProbe();
    const outputPath = evidencePathFromEnv(repositoryRoot);
    if (outputPath) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    }
    console.log(JSON.stringify({ ...evidence, evidencePath: outputPath ? path.relative(repositoryRoot, outputPath) : null }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ status: 'BLOCKED', batch: 'B30', message: error instanceof Error ? error.message : String(error), tokenMaterial: { tokenValuesEmitted: false, credentialsPersisted: false } }, null, 2));
    process.exitCode = 1;
  }
}

export { runProbe };
