import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

// This probe uses a disposable user and real authorization-code + PKCE login against the
// local Keycloak. It intentionally keeps all credential/token material in process memory and
// emits only statuses, identifiers and counts.
const gatewayUrl = process.env.B30_GATEWAY ?? 'http://127.0.0.1:18070';
const issuer = process.env.OIDC_ISSUER_URI ?? 'http://127.0.0.1:18099/realms/yuxuexing-local';
const realm = process.env.OIDC_REALM ?? 'yuxuexing-local';
const adminUsername = process.env.OIDC_BOOTSTRAP_ADMIN_USERNAME ?? 'local-admin';
const adminPassword = process.env.OIDC_BOOTSTRAP_ADMIN_PASSWORD ?? 'change-me-local-only';
const keycloakContainer = process.env.KEYCLOAK_CONTAINER ?? 'yuxuexing-local-keycloak-1';
const redirectUri = 'http://127.0.0.1:18180/auth/callback';
const runId = process.env.B30_LIFECYCLE_RUN_ID
  ?? `b30-lifecycle-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const traceId = crypto.createHash('sha256').update(`${runId}:trace`).digest('hex').slice(0, 32);

function fail(message, details = undefined) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

async function parseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return /^\s*</.test(text) ? text : text.slice(0, 800); }
}

async function http(url, options = {}) {
  const response = await fetch(url, { redirect: 'manual', ...options });
  return { status: response.status, headers: response.headers, body: await parseBody(response) };
}

async function requireHttp(url, options = {}) {
  const result = await http(url, options);
  if (!result.status || result.status < 200 || result.status >= 300) {
    fail(`HTTP ${result.status || 'network'} ${url}`, { status: result.status, body: result.body });
  }
  return result;
}

function adminHeaders(token) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

async function adminToken() {
  const form = new URLSearchParams({
    username: adminUsername,
    password: adminPassword,
    grant_type: 'password',
    client_id: 'admin-cli',
  });
  const result = await requireHttp(
    'http://127.0.0.1:18099/realms/master/protocol/openid-connect/token',
    { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form },
  );
  if (!result.body?.access_token) fail('Keycloak admin token was not issued');
  return result.body.access_token;
}

async function createDisposableUser(token) {
  const username = `${runId}-user`;
  const password = `${crypto.randomBytes(18).toString('base64url')}Aa9!`;
  const headers = adminHeaders(token);
  const created = await http(`http://127.0.0.1:18099/admin/realms/${realm}/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      username,
      enabled: true,
      email: `${username}@local.invalid`,
      emailVerified: true,
      firstName: 'B30',
      lastName: 'Lifecycle',
      credentials: [{ type: 'password', value: password, temporary: false }],
    }),
  });
  if (created.status !== 201 && created.status !== 409) {
    fail(`disposable Keycloak user create failed: HTTP ${created.status}`, created.body);
  }
  const found = await requireHttp(
    `http://127.0.0.1:18099/admin/realms/${realm}/users?username=${encodeURIComponent(username)}&exact=true`,
    { headers },
  );
  const user = Array.isArray(found.body) ? found.body[0] : null;
  if (!user?.id) fail('disposable Keycloak user was not found after create');
  await requireHttp(`http://127.0.0.1:18099/admin/realms/${realm}/users/${user.id}/reset-password`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ type: 'password', temporary: false, value: password }),
  });
  return { username, password, subject: user.id };
}

class CookieJar {
  #cookies = new Map();

  accept(headers) {
    const values = typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : (headers.get('set-cookie') ? [headers.get('set-cookie')] : []);
    for (const value of values) {
      const first = value.split(';', 1)[0];
      const index = first.indexOf('=');
      if (index > 0) this.#cookies.set(first.slice(0, index), first.slice(index + 1));
    }
  }

  header() {
    return [...this.#cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }
}

function htmlAttribute(tag, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i');
  return tag.match(pattern)?.[1] ?? null;
}

function htmlDecode(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&#39;', "'");
}

function loginForm(html) {
  const formMatch = html.match(/<form\b[^>]*id=["']kc-form-login["'][^>]*>[\s\S]*?<\/form>/i)
    ?? html.match(/<form\b[^>]*>[\s\S]*?<input[^>]+name=["']username["'][\s\S]*?<\/form>/i);
  if (!formMatch) return null;
  const formTag = formMatch[0].match(/<form\b[^>]*>/i)?.[0];
  const action = formTag ? htmlDecode(htmlAttribute(formTag, 'action') ?? '') : '';
  if (!action) return null;
  const fields = new URLSearchParams();
  for (const input of formMatch[0].matchAll(/<input\b[^>]*>/gi)) {
    const tag = input[0];
    const name = htmlAttribute(tag, 'name');
    if (!name) continue;
    const type = (htmlAttribute(tag, 'type') ?? 'text').toLowerCase();
    if (type === 'submit' || type === 'button') continue;
    fields.set(name, htmlDecode(htmlAttribute(tag, 'value') ?? ''));
  }
  return { action, fields };
}

async function authorizationCode(authUrl, user, password) {
  const jar = new CookieJar();
  let url = authUrl;
  let method = 'GET';
  let body;
  let loginSubmitted = false;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const headers = { accept: 'text/html,application/xhtml+xml' };
    const cookie = jar.header();
    if (cookie) headers.cookie = cookie;
    const response = await http(url, { method, headers, body });
    jar.accept(response.headers);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) fail('Keycloak redirect omitted location');
      const next = new URL(location, url);
      if (next.origin === new URL(redirectUri).origin && next.pathname === new URL(redirectUri).pathname) {
        return { callbackUrl: next, rejected: false };
      }
      url = next.toString();
      method = 'GET';
      body = undefined;
      continue;
    }
    if (response.status !== 200 || typeof response.body !== 'string') {
      fail(`Keycloak authorization page failed: HTTP ${response.status}`);
    }
    const form = loginForm(response.body);
    if (!form) {
      fail('Keycloak did not expose the expected login form', { finalHost: new URL(url).host });
    }
    if (loginSubmitted) {
      return { callbackUrl: null, rejected: /invalid|incorrect|error|failed/i.test(response.body) };
    }
    form.fields.set('username', user);
    form.fields.set('password', password);
    url = new URL(form.action, url).toString();
    method = 'POST';
    body = form.fields;
    loginSubmitted = true;
  }
  fail('Keycloak authorization flow exceeded redirect limit');
}

function gatewayHeaders(label, token = undefined) {
  return {
    accept: 'application/json',
    'x-request-id': `${runId}-${label}`.slice(0, 128),
    'x-trace-id': traceId,
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function gateway(path, options = {}) {
  const headers = {
    ...gatewayHeaders(options.label ?? 'request', options.token),
    ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(options.idempotencyKey ? { 'idempotency-key': options.idempotencyKey } : {}),
    ...(options.headers ?? {}),
  };
  return http(`${gatewayBase()}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

function gatewayBase() {
  return gatewayUrl.replace(/\/$/, '');
}

function assertStatus(result, expected, label) {
  if (result.status !== expected) fail(`${label}: expected HTTP ${expected}, got ${result.status}`, result.body);
}

async function startAuthorization(label) {
  const query = new URLSearchParams({
    intent: 'login',
    redirectUri,
    returnTo: '/home',
    uiLocale: 'zh-CN',
    theme: 'system',
  });
  const result = await gateway(`/api/v1/auth/oidc/standard-oidc/authorization/start?${query}`, { label });
  assertStatus(result, 200, `${label} authorization start`);
  const authUrl = result.body?.authorizationUrl;
  if (typeof authUrl !== 'string' || !authUrl.startsWith('http://127.0.0.1:18099/')) {
    fail(`${label} authorization start did not return a local Keycloak URL`);
  }
  return { authUrl, state: new URL(authUrl).searchParams.get('state') };
}

async function establishSession(user, label) {
  const start = await startAuthorization(`${label}-start`);
  const login = await authorizationCode(start.authUrl, user.username, user.password);
  if (!login.callbackUrl || login.rejected) fail(`${label} valid login was rejected by Keycloak`);
  const callback = await gateway('/api/v1/auth/oidc/standard-oidc/callback', {
    method: 'POST',
    label: `${label}-callback`,
    body: { code: login.callbackUrl.searchParams.get('code'), state: start.state, redirectUri },
    idempotencyKey: `${runId}-${label}-callback`,
  });
  assertStatus(callback, 200, `${label} callback`);
  const session = callback.body?.session;
  if (!session?.accessToken || !session?.refreshToken || !session?.sessionId) {
    fail(`${label} callback did not return a complete session shape`);
  }
  return { start, login, callback, session };
}

function mysqlQuery(sql) {
  const container = process.env.MYSQL_CONTAINER ?? 'yuxuexing-local-mysql-1';
  const result = spawnSync('docker', [
    'exec', container, 'mysql', '-usvc_iam', '-plocal-owner-only', 'iam_service', '-N', '-B', '-e', sql,
  ], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) return { ok: false, error: (result.stderr ?? '').trim().slice(0, 400) };
  return { ok: true, value: (result.stdout ?? '').trim() };
}

function numericQuery(sql, label) {
  const result = mysqlQuery(sql);
  if (!result.ok) fail(`${label}: MySQL query failed`, result.error);
  const value = Number(result.value);
  if (!Number.isFinite(value)) fail(`${label}: MySQL result was not numeric`);
  return value;
}

function docker(action) {
  const result = spawnSync('docker', [action, keycloakContainer], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) fail(`docker ${action} ${keycloakContainer} failed`, (result.stderr ?? '').trim().slice(0, 400));
}

async function waitForKeycloak() {
  const discovery = `${issuer}/.well-known/openid-configuration`;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const result = await http(discovery, { headers: { accept: 'application/json' } });
      if (result.status === 200 && result.body?.issuer === issuer) return;
    } catch {
      // The provider is expected to be unavailable during part of a restart.
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  fail('Keycloak did not recover within 30 seconds');
}

async function main() {
  const admin = await adminToken();
  const user = await createDisposableUser(admin);
  const checks = [];
  const sessionOne = await establishSession(user, 'session-one');
  checks.push({ id: 'authorization-code-login', status: 'PASS' });

  const principal = await gateway('/api/v1/iam/principal/me', {
    label: 'principal-me', token: sessionOne.session.accessToken,
  });
  assertStatus(principal, 200, 'principal/me');
  if (!principal.body?.principalId || principal.body?.policyVersion !== 'b30-rbac-v1') {
    fail('principal/me did not return the server-side IAM policy snapshot');
  }
  checks.push({ id: 'principal-me', status: 'PASS', policyVersion: principal.body.policyVersion });

  const replay = await gateway('/api/v1/auth/oidc/standard-oidc/callback', {
    method: 'POST', label: 'callback-replay',
    body: {
      code: sessionOne.login.callbackUrl.searchParams.get('code'),
      state: sessionOne.start.state,
      redirectUri,
    },
  });
  assertStatus(replay, 409, 'repeated callback');
  checks.push({ id: 'callback-replay-rejected', status: 'PASS', httpStatus: replay.status });

  const rotated = await gateway('/api/v1/iam/session/refresh', {
    method: 'POST', label: 'refresh-rotation',
    body: { refreshToken: sessionOne.session.refreshToken },
  });
  assertStatus(rotated, 200, 'refresh rotation');
  const rotatedSession = rotated.body;
  if (!rotatedSession?.accessToken || !rotatedSession?.refreshToken
      || rotatedSession.refreshToken === sessionOne.session.refreshToken) {
    fail('refresh rotation did not replace the provider refresh token');
  }
  checks.push({ id: 'refresh-rotation', status: 'PASS' });

  const oldRefresh = await gateway('/api/v1/iam/session/refresh', {
    method: 'POST', label: 'refresh-replay',
    body: { refreshToken: sessionOne.session.refreshToken },
  });
  assertStatus(oldRefresh, 401, 'old refresh replay');
  checks.push({ id: 'refresh-replay-rejected', status: 'PASS', httpStatus: oldRefresh.status });

  const logout = await gateway('/api/v1/iam/session/logout', {
    method: 'POST', label: 'logout', token: rotatedSession.accessToken,
    headers: { 'x-session-id': rotatedSession.sessionId }, body: {},
  });
  assertStatus(logout, 200, 'session logout');
  const afterLogout = await gateway('/api/v1/iam/session/refresh', {
    method: 'POST', label: 'refresh-after-logout',
    body: { refreshToken: rotatedSession.refreshToken },
  });
  assertStatus(afterLogout, 401, 'refresh after logout');
  checks.push({ id: 'logout-revokes-session', status: 'PASS' });

  const sessionTwo = await establishSession(user, 'session-two');
  const explicitRevoke = await gateway(
    `/api/v1/iam/sessions/${encodeURIComponent(sessionTwo.session.sessionId)}/revoke`,
    { method: 'POST', label: 'explicit-revoke', token: sessionTwo.session.accessToken, body: {} },
  );
  assertStatus(explicitRevoke, 200, 'explicit revoke');
  const afterExplicitRevoke = await gateway('/api/v1/iam/session/refresh', {
    method: 'POST', label: 'refresh-after-explicit-revoke',
    body: { refreshToken: sessionTwo.session.refreshToken },
  });
  assertStatus(afterExplicitRevoke, 401, 'refresh after explicit revoke');
  checks.push({ id: 'explicit-revoke', status: 'PASS' });

  const wrongStart = await startAuthorization('wrong-password-start');
  const wrongLogin = await authorizationCode(wrongStart.authUrl, user.username, `${user.password}wrong`);
  if (!wrongLogin.rejected || wrongLogin.callbackUrl) fail('wrong password was not rejected by Keycloak');
  checks.push({ id: 'wrong-password-rejected', status: 'PASS' });

  // Obtain a real authorization code, then make the provider unavailable before IAM exchanges it.
  // The callback must fail closed and must not create a session. The container and volume are
  // restored in finally so this probe cannot leave the local stack unusable.
  const outageStart = await startAuthorization('idp-outage-start');
  const outageLogin = await authorizationCode(outageStart.authUrl, user.username, user.password);
  if (!outageLogin.callbackUrl) fail('outage precondition login did not produce an authorization code');
  let providerStopped = false;
  try {
    docker('stop');
    providerStopped = true;
    const outageCallback = await gateway('/api/v1/auth/oidc/standard-oidc/callback', {
      method: 'POST', label: 'idp-outage-callback',
      body: {
        code: outageLogin.callbackUrl.searchParams.get('code'),
        state: outageStart.state,
        redirectUri,
      },
    });
    if (outageCallback.status >= 200 && outageCallback.status < 300) {
      fail('IAM fabricated a successful session while the OIDC provider was unavailable');
    }
    checks.push({ id: 'idp-outage-fail-closed', status: 'PASS', httpStatus: outageCallback.status });
  } finally {
    if (providerStopped) {
      docker('start');
      await waitForKeycloak();
    }
  }

  const recovered = await establishSession(user, 'post-idp-restart');
  const recoveredPrincipal = await gateway('/api/v1/iam/principal/me', {
    label: 'post-idp-restart-principal', token: recovered.session.accessToken,
  });
  assertStatus(recoveredPrincipal, 200, 'post-IdP restart principal');
  checks.push({ id: 'idp-restart-recovery', status: 'PASS' });

  const principalId = principal.body.principalId;
  const auditCount = numericQuery(
    `SELECT COUNT(*) FROM iam_decision_audit WHERE request_id LIKE '${runId}-%' AND trace_id = '${traceId}'`,
    'correlation audit count');
  const revokedCount = numericQuery(
    `SELECT COUNT(*) FROM iam_session WHERE principal_id = '${principalId}' AND session_id IN ('${sessionOne.session.sessionId}', '${sessionTwo.session.sessionId}') AND status = 'REVOKED'`,
    'revoked session count');
  const identityCount = numericQuery(
    `SELECT COUNT(*) FROM iam_external_identity WHERE principal_id = '${principalId}'`,
    'external identity count');
  const policyCount = numericQuery(
    "SELECT COUNT(*) FROM iam_policy_version WHERE policy_version = 'b30-rbac-v1'",
    'policy version count');
  if (auditCount < 4 || revokedCount < 2 || identityCount < 1 || policyCount < 1) {
    fail('IAM durable lifecycle facts did not meet the minimum evidence counts', {
      auditCount, revokedCount, identityCount, policyCount,
    });
  }

  console.log(JSON.stringify({
    result: 'PASS',
    batch: 'B30',
    evidenceClass: 'runtime-external-lifecycle',
    runId,
    traceId,
    checks,
    db: { auditRowsCorrelated: auditCount, revokedSessions: revokedCount, externalIdentities: identityCount, policyVersions: policyCount },
    tokenMaterial: { tokenValuesEmitted: false, credentialsPersisted: false, jwtCreated: false },
  }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({
    result: 'FAIL', batch: 'B30', runId, message: error.message, details: error.details ?? null,
    tokenMaterial: { tokenValuesEmitted: false, credentialsPersisted: false },
  }, null, 2));
  process.exitCode = 1;
});
