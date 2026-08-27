import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const gateway = process.env.B32_GATEWAY ?? 'http://127.0.0.1:18070';
const issuer = process.env.OIDC_ISSUER_URI ?? 'http://127.0.0.1:18099/realms/yuxuexing-local';
const realm = process.env.OIDC_REALM ?? 'yuxuexing-local';
const adminUsername = process.env.OIDC_BOOTSTRAP_ADMIN_USERNAME ?? 'local-admin';
const adminPassword = process.env.OIDC_BOOTSTRAP_ADMIN_PASSWORD ?? 'change-me-local-only';
const runId = process.env.B32_RUN_ID ?? `b32-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const clientId = 'b32-runtime-runner';
const userRole = 'learner';
const contentCode = 'course-b25-basics';
const traceId = crypto.createHash('sha256').update(`${runId}:trace`).digest('hex').slice(0, 32);

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

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const body = await bodyOf(response);
  if (!response.ok) fail(`HTTP ${response.status} ${url}`, { status: response.status, body });
  return { status: response.status, body, headers: response.headers };
}

async function adminToken() {
  const form = new URLSearchParams({
    username: adminUsername,
    password: adminPassword,
    grant_type: 'password',
    client_id: 'admin-cli',
  });
  const result = await request(
    'http://127.0.0.1:18099/realms/master/protocol/openid-connect/token',
    { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form },
  );
  return result.body.access_token;
}

function adminHeaders(token) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

async function ensureRole(token, roleName) {
  const headers = adminHeaders(token);
  const url = `http://127.0.0.1:18099/admin/realms/${realm}/roles/${encodeURIComponent(roleName)}`;
  const result = await fetch(url, { headers });
  if (result.ok) return result.json();
  if (result.status !== 404) fail(`role lookup failed: ${roleName}`, { status: result.status });
  await request(`http://127.0.0.1:18099/admin/realms/${realm}/roles`, {
    method: 'POST', headers,
    body: JSON.stringify({ name: roleName, description: 'Local Phase 1 learner runtime role' }),
  });
  return request(url, { headers }).then(result => result.body);
}

async function ensureMapper(headers, mapperUrl, mapper) {
  const current = await request(mapperUrl, { headers });
  if (Array.isArray(current.body) && current.body.some(item => item.name === mapper.name)) return;
  await request(mapperUrl, { method: 'POST', headers, body: JSON.stringify(mapper) });
}

async function ensureDefaultClientScope(headers, clientUuid, scopeName) {
  const scopes = await request(
    `http://127.0.0.1:18099/admin/realms/${realm}/client-scopes?name=${encodeURIComponent(scopeName)}`,
    { headers },
  );
  const scope = Array.isArray(scopes.body) ? scopes.body.find(item => item.name === scopeName) : null;
  if (!scope?.id) fail(`OIDC client scope is missing: ${scopeName}`);
  const assigned = await fetch(
    `http://127.0.0.1:18099/admin/realms/${realm}/clients/${clientUuid}/default-client-scopes`,
    { headers },
  );
  if (!assigned.ok) fail(`OIDC client scope lookup failed: ${scopeName}`, { status: assigned.status });
  const assignedScopes = await assigned.json();
  if (Array.isArray(assignedScopes) && assignedScopes.some(item => item.id === scope.id || item.name === scopeName)) return;
  await request(
    `http://127.0.0.1:18099/admin/realms/${realm}/clients/${clientUuid}/default-client-scopes/${scope.id}`,
    { method: 'PUT', headers },
  );
}

async function ensureUserProfile(token) {
  const headers = adminHeaders(token);
  const profileUrl = `http://127.0.0.1:18099/admin/realms/${realm}/users/profile`;
  const current = await request(profileUrl, { headers });
  const currentAttributes = Array.isArray(current.body?.attributes) ? current.body.attributes : [];
  // Authority-bearing attributes are written only by the local admin bootstrap.
  // They must never be editable (or even offered) on the public registration form.
  // Unmanaged attributes are disabled so a newly registered user cannot mint a
  // tenant, permission, phase, consent, rights, or device claim. ADMIN_EDIT
  // keeps Keycloak 26.7's Admin API able to maintain bootstrap-only attributes
  // while excluding them from end-user registration and account contexts.
  const authorityPermissions = { view: ['admin'], edit: ['admin'] };
  const definitions = [
    { name: 'tenant_id', displayName: 'Tenant ID', multivalued: false },
    { name: 'device_id', displayName: 'Device ID', multivalued: false },
    { name: 'permissions', displayName: 'Permissions', multivalued: true },
  ];
  const attributes = [...currentAttributes];
  for (const definition of definitions) {
    const existing = attributes.find(item => item.name === definition.name);
    if (existing) {
      existing.multivalued = definition.multivalued;
      existing.permissions = authorityPermissions;
      continue;
    }
    attributes.push({ ...definition, permissions: authorityPermissions });
  }
  await request(profileUrl, {
    method: 'PUT', headers,
    body: JSON.stringify({ ...current.body, unmanagedAttributePolicy: 'ADMIN_EDIT', attributes }),
  });
}

async function ensureClient(token) {
  const headers = adminHeaders(token);
  const list = await request(
    `http://127.0.0.1:18099/admin/realms/${realm}/clients?clientId=${encodeURIComponent(clientId)}`,
    { headers },
  );
  let client = Array.isArray(list.body) ? list.body[0] : null;
  if (!client) {
    await request(`http://127.0.0.1:18099/admin/realms/${realm}/clients`, {
      method: 'POST', headers,
      body: JSON.stringify({
        clientId, name: 'B32 local domain runtime runner', enabled: true, publicClient: true,
        protocol: 'openid-connect', standardFlowEnabled: false, implicitFlowEnabled: false,
        directAccessGrantsEnabled: true, serviceAccountsEnabled: false,
      }),
    });
    const created = await request(
      `http://127.0.0.1:18099/admin/realms/${realm}/clients?clientId=${encodeURIComponent(clientId)}`,
      { headers },
    );
    client = Array.isArray(created.body) ? created.body[0] : null;
  }
  if (!client?.id) fail('B32 runtime client was not created');
  for (const scopeName of ['yuxuexing-api', 'yuxuexing-identity']) {
    await ensureDefaultClientScope(headers, client.id, scopeName);
  }
  const mapperUrl = `http://127.0.0.1:18099/admin/realms/${realm}/clients/${client.id}/protocol-mappers/models`;
  await ensureMapper(headers, mapperUrl, {
    name: 'b32-realm-roles', protocol: 'openid-connect',
    protocolMapper: 'oidc-usermodel-realm-role-mapper', consentRequired: false,
    config: { multivalued: 'true', 'id.token.claim': 'false', 'access.token.claim': 'true',
      'userinfo.token.claim': 'false', 'claim.name': 'realm_access.roles', 'jsonType.label': 'String' },
  });
  for (const [name, attribute, claim] of [
    ['b32-tenant-id', 'tenant_id', 'tenant_id'],
    ['b32-device-id', 'device_id', 'device_id'],
    ['b32-permissions', 'permissions', 'permissions'],
  ]) {
    await ensureMapper(headers, mapperUrl, {
      name, protocol: 'openid-connect', protocolMapper: 'oidc-usermodel-attribute-mapper',
      consentRequired: false,
      config: { 'user.attribute': attribute, 'claim.name': claim, 'jsonType.label': 'String',
        multivalued: attribute === 'permissions' ? 'true' : 'false',
        'id.token.claim': 'false', 'access.token.claim': 'true', 'userinfo.token.claim': 'false' },
    });
  }
  if (process.env.B32_DEBUG_TOKEN_CLAIMS === 'true') {
    const mapperState = await request(mapperUrl, { headers });
    console.error(JSON.stringify({ clientScopes: (await request(
      `http://127.0.0.1:18099/admin/realms/${realm}/clients/${client.id}/default-client-scopes`, { headers },
    )).body?.map(item => item.name) ?? [], mappers: mapperState.body?.map(item => ({ name: item.name, config: item.config })) ?? [] }));
  }
}

async function ensureUser(token, role) {
  const username = `${runId}-learner`;
  const password = `${crypto.randomBytes(18).toString('base64url')}Aa9!`;
  const headers = adminHeaders(token);
  await request(`http://127.0.0.1:18099/admin/realms/${realm}/users`, {
    method: 'POST', headers,
    body: JSON.stringify({
      username, enabled: true, email: `${username}@local.invalid`, emailVerified: true,
      firstName: 'B32', lastName: 'Runtime',
      attributes: { tenant_id: 'platform', device_id: `${runId}-device`,
        permissions: ['notification.read', 'notification.write', 'sync.write'] },
      credentials: [{ type: 'password', value: password, temporary: false }],
    }),
  });
  const found = await request(
    `http://127.0.0.1:18099/admin/realms/${realm}/users?username=${encodeURIComponent(username)}&exact=true`,
    { headers },
  );
  const user = Array.isArray(found.body) ? found.body[0] : null;
  if (!user?.id) fail('B32 runtime user was not created');
  await request(`http://127.0.0.1:18099/admin/realms/${realm}/users/${user.id}`, {
    method: 'PUT', headers,
    body: JSON.stringify({
      username, enabled: true, email: `${username}@local.invalid`, emailVerified: true,
      firstName: 'B32', lastName: 'Runtime',
      attributes: { tenant_id: ['platform'], device_id: [`${runId}-device`],
        permissions: ['notification.read', 'notification.write', 'sync.write'] },
    }),
  });
  await request(`http://127.0.0.1:18099/admin/realms/${realm}/users/${user.id}/reset-password`, {
    method: 'PUT', headers,
    body: JSON.stringify({ type: 'password', temporary: false, value: password }),
  });
  const refreshed = await request(`http://127.0.0.1:18099/admin/realms/${realm}/users/${user.id}`, { headers });
  if (process.env.B32_DEBUG_TOKEN_CLAIMS === 'true') {
    console.error(JSON.stringify({ userAttributes: {
      tenant_id: refreshed.body?.attributes?.tenant_id ?? null,
      device_id: refreshed.body?.attributes?.device_id ?? null,
      permissions: refreshed.body?.attributes?.permissions ?? null,
    } }));
  }
  await request(`http://127.0.0.1:18099/admin/realms/${realm}/users/${user.id}/role-mappings/realm`, {
    method: 'POST', headers, body: JSON.stringify([role]),
  });
  return { username, password, subject: user.id };
}

async function userToken(user) {
  const form = new URLSearchParams({
    client_id: clientId, grant_type: 'password', username: user.username, password: user.password,
    scope: 'openid yuxuexing-api yuxuexing-identity',
  });
  const result = await request(`${issuer}/protocol/openid-connect/token`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form,
  });
  if (!result.body.access_token) fail('B32 access token was not issued');
  if (process.env.B32_DEBUG_TOKEN_CLAIMS === 'true') {
    const payload = JSON.parse(Buffer.from(result.body.access_token.split('.')[1], 'base64url').toString('utf8'));
    console.error(JSON.stringify({ claims: {
      sub: payload.sub ?? null,
      tenant_id: payload.tenant_id ?? null,
      device_id: payload.device_id ?? null,
      permissions: payload.permissions ?? null,
      aud: payload.aud ?? null,
      realm_access: payload.realm_access ?? null,
    } }));
  }
  return result.body.access_token;
}

async function gatewayRequest(token, path, options = {}) {
  const headers = {
    authorization: `Bearer ${token}`, 'x-request-id': `${runId}-${options.operation ?? 'read'}`.slice(0, 120),
    'x-trace-id': traceId,
    ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(options.idempotencyKey ? { 'idempotency-key': options.idempotencyKey } : {}),
  };
  const response = await fetch(`${gateway}${path}`, {
    method: options.method ?? 'GET', headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { status: response.status, body: await bodyOf(response),
    requestId: response.headers.get('x-request-id'), traceId: response.headers.get('x-trace-id') };
}

function assertStatus(result, status, name) {
  if (result.status !== status) fail(`${name}: expected ${status}, got ${result.status}`, result.body);
}

function mysqlQuery(schema, sql) {
  const container = process.env.MYSQL_CONTAINER ?? 'yuxuexing-local-mysql-1';
  const result = spawnSync('docker', ['exec', container, 'mysql', '-uroot', '-proot-local-only', schema, '-N', '-B', '-e', sql], {
    encoding: 'utf8', windowsHide: true,
  });
  if (result.status !== 0) return { ok: false, error: (result.stderr ?? '').trim().slice(0, 500) };
  return { ok: true, value: (result.stdout ?? '').trim() };
}

async function main() {
  const admin = await adminToken();
  const learner = await ensureRole(admin, userRole);
  await ensureClient(admin);
  await ensureUserProfile(admin);
  const user = await ensureUser(admin, learner);
  const token = await userToken(user);
  const checks = [];
  const record = (name, result, expected = 200) => {
    assertStatus(result, expected, name);
    checks.push({ name, status: 'PASS', httpStatus: result.status,
      requestId: result.requestId, traceId: result.traceId });
    return result;
  };

  const startKey = `${runId}-assessment-start`;
  const start = record('assessment start', await gatewayRequest(token, '/api/v1/assessment/placement/start', {
    method: 'POST', operation: 'assessment-start', idempotencyKey: startKey, body: { contentCode },
  }));
  const replayStart = record('assessment start replay', await gatewayRequest(token, '/api/v1/assessment/placement/start', {
    method: 'POST', operation: 'assessment-start-replay', idempotencyKey: startKey, body: { contentCode },
  }));
  const sessionId = start.body?.sessionId;
  if (!sessionId || sessionId !== replayStart.body?.sessionId) fail('assessment idempotency did not preserve session');

  let current = start.body?.currentQuestion;
  let completed = null;
  for (let index = 0; index < 10 && current; index += 1) {
    const answer = Array.isArray(current.options) && current.options[0]?.key ? current.options[0].key : 'A';
    const step = record(`assessment answer ${index + 1}`, await gatewayRequest(token, '/api/v1/assessment/placement/submit-step', {
      method: 'POST', operation: `assessment-answer-${index + 1}`, idempotencyKey: `${runId}-answer-${index + 1}`,
      body: { sessionId, questionId: current.questionId, selectedKey: answer },
    }));
    if (step.body?.isCompleted || step.body?.status === 'COMPLETED') { completed = step.body; break; }
    current = step.body?.currentQuestion ?? step.body?.nextQuestion ?? null;
  }
  if (!completed) fail('assessment did not complete from the durable question set');
  const report = record('assessment report', await gatewayRequest(token,
    `/api/v1/assessment/placement/report/${encodeURIComponent(sessionId)}`, { operation: 'assessment-report' }));
  if (!report.body?.reportId && !completed.report?.reportId) fail('assessment report id is missing');

  record('learning plan read', await gatewayRequest(token, '/api/v1/learning/plan/current', { operation: 'learning-plan' }));
  record('learning SRS review', await gatewayRequest(token, '/api/v1/learning/srs/reviews', {
    method: 'POST', operation: 'learning-review', idempotencyKey: `${runId}-review`,
    body: { itemId: `${runId}-item`, quality: 5 },
  }));
  const reviewReplay = record('learning SRS replay', await gatewayRequest(token, '/api/v1/learning/srs/reviews', {
    method: 'POST', operation: 'learning-review-replay', idempotencyKey: `${runId}-review`,
    body: { itemId: `${runId}-item`, quality: 5 },
  }));
  if (reviewReplay.body?.reviewCount !== 1 && reviewReplay.body?.status !== 'DUPLICATE') {
    fail('learning SRS replay changed durable state', reviewReplay.body);
  }
  const overview = record('learning SRS overview', await gatewayRequest(token, '/api/v1/learning/srs/overview', { operation: 'learning-overview' }));
  record('learning daily summary', await gatewayRequest(token, '/api/v1/learning/stats/daily-summary', { operation: 'learning-summary' }));

  const notificationPreferences = await gatewayRequest(token, '/api/v1/notifications/preferences', { operation: 'notification-preferences' });
  if (process.env.B32_DEBUG_TOKEN_CLAIMS === 'true') {
    const direct = await fetch('http://127.0.0.1:18093/internal/v1/notifications/preferences', {
      headers: { authorization: `Bearer ${token}` },
    });
    console.error(JSON.stringify({ directNotificationStatus: direct.status, directNotificationBody: await bodyOf(direct) }));
  }
  record('notification preferences read', notificationPreferences);
  const preference = record('notification preference write', await gatewayRequest(token,
    '/api/v1/notifications/preferences/learning.review.due/IN_APP', {
      method: 'PUT', operation: 'notification-preference-write', idempotencyKey: `${runId}-preference`,
      body: { enabled: true, locale: 'zh-CN', expectedVersion: -1 },
    }));
  const preferenceReplay = record('notification preference replay', await gatewayRequest(token,
    '/api/v1/notifications/preferences/learning.review.due/IN_APP', {
      method: 'PUT', operation: 'notification-preference-replay', idempotencyKey: `${runId}-preference`,
      body: { enabled: true, locale: 'zh-CN', expectedVersion: -1 },
    }));
  if (preference.body?.version !== preferenceReplay.body?.version) fail('notification preference replay changed version');
  const message = record('notification message write', await gatewayRequest(token, '/api/v1/notifications/messages', {
    method: 'POST', operation: 'notification-message', idempotencyKey: `${runId}-message`,
    body: { notificationType: 'learning.review.due', channel: 'IN_APP', templateKey: 'local.review.due',
      templateVersion: 'v1', title: 'B32 local review', safeBody: 'A durable local review reminder.', contentVersion: 'b32-v1' },
  }));
  const messageId = message.body?.messageId;
  if (!messageId) fail('notification message id is missing');
  record('notification messages read', await gatewayRequest(token, '/api/v1/notifications/messages', { operation: 'notification-messages' }));

  const db = {
    assessmentSessions: mysqlQuery('assessment_service', `SELECT COUNT(*) FROM b25_assessment_session WHERE principal_id='${user.subject}' AND idempotency_key LIKE '${runId}%'`),
    assessmentReports: mysqlQuery('assessment_service', `SELECT COUNT(*) FROM b25_assessment_report WHERE principal_id='${user.subject}'`),
    learningReviews: mysqlQuery('learning_service', `SELECT COUNT(*) FROM b25_learning_review WHERE principal_id='${user.subject}' AND idempotency_key LIKE '${runId}%'`),
    learningSrs: mysqlQuery('learning_service', `SELECT COUNT(*) FROM b25_learning_srs_state WHERE principal_id='${user.subject}' AND item_id='${runId}-item'`),
    notificationPreferences: mysqlQuery('notification_service', `SELECT COUNT(*) FROM notification_preference WHERE principal_id='${user.subject}' AND notification_type='learning.review.due'`),
    notificationMessages: mysqlQuery('notification_service', `SELECT COUNT(*) FROM notification_message WHERE subject_id='${user.subject}'`),
    notificationOutbox: mysqlQuery('notification_service', `SELECT COUNT(*) FROM notification_outbox_event WHERE principal_id='${user.subject}' AND request_id LIKE '${runId}%'`),
  };
  for (const [name, result] of Object.entries(db)) if (!result.ok) fail(`B32 MySQL evidence query failed: ${name}`, result.error);
  const dbValues = Object.fromEntries(Object.entries(db).map(([name, result]) => [name, Number(result.value)]));
  if (dbValues.assessmentSessions !== 1 || dbValues.assessmentReports !== 1 || dbValues.learningReviews !== 1
      || dbValues.learningSrs !== 1 || dbValues.notificationPreferences !== 1 || dbValues.notificationMessages !== 1
      || dbValues.notificationOutbox < 1) {
    fail('B32 MySQL domain evidence is incomplete', dbValues);
  }
  if (overview.body?.total < 1) fail('learning overview did not reflect the durable SRS state');
  console.log(JSON.stringify({
    result: 'PASS', runId, subjectBound: true, tokenValuesEmitted: false, credentialsPersisted: false,
    checks, db: dbValues,
  }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ result: 'FAIL', runId, message: error.message, details: error.details ?? null }, null, 2));
  process.exitCode = 1;
});
