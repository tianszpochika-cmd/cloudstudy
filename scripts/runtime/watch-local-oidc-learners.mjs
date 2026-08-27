import { spawnSync } from 'node:child_process';
import path from 'node:path';

const baseUrl = process.env.OIDC_ADMIN_BASE_URL ?? 'http://127.0.0.1:18099';
const realm = process.env.OIDC_REALM ?? 'yuxuexing-local';
const adminUsername = process.env.OIDC_BOOTSTRAP_ADMIN_USERNAME ?? 'local-admin';
const adminPassword = process.env.OIDC_BOOTSTRAP_ADMIN_PASSWORD ?? 'change-me-local-only';
const root = process.cwd();
const pollMs = Number(process.env.LOCAL_OIDC_WATCH_INTERVAL_MS ?? 2500);
const startedAt = Date.now() - 5000;
const processed = new Set();
const authorityRoles = new Set(['admin', 'content-editor', 'content-publisher', 'review-l1', 'review-l2']);

function fail(message, details = undefined) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

async function bodyOf(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text.slice(0, 500); }
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const body = await bodyOf(response);
  if (!response.ok) fail(`OIDC admin request failed: ${response.status} ${pathname}`, { status: response.status, body });
  return body;
}

async function adminToken() {
  const form = new URLSearchParams({
    username: adminUsername,
    password: adminPassword,
    grant_type: 'password',
    client_id: 'admin-cli',
  });
  const result = await request('/realms/master/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  if (!result?.access_token) fail('OIDC admin token was not issued');
  return result.access_token;
}

async function listUsers(token) {
  return request(`/admin/realms/${encodeURIComponent(realm)}/users?max=100`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

async function realmRoles(token, userId) {
  return request(`/admin/realms/${encodeURIComponent(realm)}/users/${encodeURIComponent(userId)}/role-mappings/realm`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

function isEligible(user, roles) {
  if (!user?.id || user.enabled === false || (user.createdTimestamp ?? 0) < startedAt) return false;
  if (processed.has(user.id)) return false;
  return !roles.some((role) => authorityRoles.has(role.name));
}

function runNode(script, env) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'runtime', script)], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    windowsHide: true,
  });
}

function parseReady(stdout) {
  const line = String(stdout ?? '').trim().split(/\r?\n/).filter(Boolean).at(-1);
  if (!line) return null;
  try { return JSON.parse(line); } catch { return null; }
}

function provision(user) {
  const claims = runNode('ensure-local-oidc-test-user.mjs', {
    OIDC_TEST_USERNAME: user.username,
    OIDC_TEST_DEVICE_ID: 'local-browser',
  });
  if (claims.status !== 0) {
    fail(`local authority provisioning failed for ${user.username}`, String(claims.stderr ?? '').slice(-1000));
  }
  const ready = parseReady(claims.stdout);
  if (!ready?.subject) fail(`local authority provisioning returned no subject for ${user.username}`);

  const fixture = runNode('seed-local-real-all.mjs', { LOCAL_TEST_SUBJECT: ready.subject });
  if (fixture.status !== 0) {
    fail(`local fixture provisioning failed for ${user.username}`, String(fixture.stderr ?? '').slice(-1000));
  }
  const coverage = runNode('check-local-real-data-coverage.mjs', { LOCAL_TEST_SUBJECT: ready.subject });
  if (coverage.status !== 0) {
    fail(`local fixture coverage failed for ${user.username}`, String(coverage.stderr ?? '').slice(-1000));
  }
  const evidence = parseReady(coverage.stdout);
  processed.add(user.id);
  console.log(JSON.stringify({
    event: 'LOCAL_OIDC_LEARNER_READY',
    username: user.username,
    subject: ready.subject,
    clientScope: ready.clientScope,
    permissionCount: ready.permissionCount,
    coverage: evidence?.status ?? 'PASS',
    checks: evidence?.checks ?? null,
  }));
}

async function scan() {
  const token = await adminToken();
  const users = await listUsers(token);
  for (const user of Array.isArray(users) ? users : []) {
    const roles = await realmRoles(token, user.id);
    if (!isEligible(user, Array.isArray(roles) ? roles : [])) continue;
    try {
      provision(user);
    } catch (error) {
      console.error(JSON.stringify({
        event: 'LOCAL_OIDC_LEARNER_RETRY',
        username: user.username,
        message: error instanceof Error ? error.message : String(error),
      }));
    }
  }
}

const once = process.argv.includes('--once');
if (once) {
  await scan();
} else {
  console.log(JSON.stringify({ event: 'LOCAL_OIDC_LEARNER_WATCHING', startedAt: new Date(startedAt).toISOString(), pollMs }));
  while (true) {
    try { await scan(); }
    catch (error) {
      console.error(JSON.stringify({ event: 'LOCAL_OIDC_LEARNER_WATCH_ERROR', message: error instanceof Error ? error.message : String(error) }));
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}
