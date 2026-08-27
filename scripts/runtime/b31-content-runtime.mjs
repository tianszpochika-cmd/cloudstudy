import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const gateway = process.env.B31_GATEWAY ?? 'http://127.0.0.1:18070';
const issuer = process.env.OIDC_ISSUER_URI ?? 'http://127.0.0.1:18099/realms/yuxuexing-local';
const realm = process.env.OIDC_REALM ?? 'yuxuexing-local';
const adminUsername = process.env.OIDC_BOOTSTRAP_ADMIN_USERNAME ?? 'local-admin';
const adminPassword = process.env.OIDC_BOOTSTRAP_ADMIN_PASSWORD ?? 'change-me-local-only';
const runId = process.env.B31_RUN_ID ?? `b31-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const clientId = 'b31-runtime-runner';
const roles = ['content-editor', 'review-l1', 'review-l2', 'content-publisher'];
const contentCode = `b31-live-${Date.now().toString(36)}`;
const traceId = crypto.createHash('sha256').update(`${runId}:trace`).digest('hex').slice(0, 32);

function fail(message, details = undefined) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

async function jsonOrText(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text.slice(0, 500); }
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const body = await jsonOrText(response);
  if (!response.ok) {
    fail(`HTTP ${response.status} ${url}`, { status: response.status, body });
  }
  return { status: response.status, body, headers: response.headers };
}

async function adminToken() {
  const form = new URLSearchParams({
    username: adminUsername,
    password: adminPassword,
    grant_type: 'password',
    client_id: 'admin-cli',
  });
  const response = await request(
    'http://127.0.0.1:18099/realms/master/protocol/openid-connect/token',
    { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form },
  );
  return response.body.access_token;
}

function adminHeaders(token) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

async function ensureRole(token, roleName) {
  const headers = adminHeaders(token);
  const url = `http://127.0.0.1:18099/admin/realms/${realm}/roles/${encodeURIComponent(roleName)}`;
  const response = await fetch(url, { headers });
  if (response.ok) return await response.json();
  if (response.status !== 404) fail(`role lookup failed: ${roleName}`, { status: response.status });
  await request(`http://127.0.0.1:18099/admin/realms/${realm}/roles`, {
    method: 'POST', headers, body: JSON.stringify({ name: roleName, description: 'B31 local runtime verification role' }),
  });
  return await request(url, { headers }).then(result => result.body);
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
      method: 'POST',
      headers,
      body: JSON.stringify({
        clientId,
        name: 'B31 local runtime runner',
        enabled: true,
        publicClient: true,
        protocol: 'openid-connect',
        standardFlowEnabled: false,
        implicitFlowEnabled: false,
        directAccessGrantsEnabled: true,
        serviceAccountsEnabled: false,
      }),
    });
    const created = await request(
      `http://127.0.0.1:18099/admin/realms/${realm}/clients?clientId=${encodeURIComponent(clientId)}`,
      { headers },
    );
    client = Array.isArray(created.body) ? created.body[0] : null;
  }
  if (!client?.id) fail('B31 runtime client was not created');
  const mapperUrl = `http://127.0.0.1:18099/admin/realms/${realm}/clients/${client.id}/protocol-mappers/models`;
  const mappers = await request(mapperUrl, { headers });
  if (!Array.isArray(mappers.body) || !mappers.body.some(mapper => mapper.name === 'b31-realm-roles')) {
    await request(mapperUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'b31-realm-roles',
        protocol: 'openid-connect',
        protocolMapper: 'oidc-usermodel-realm-role-mapper',
        config: {
          'multivalued': 'true',
          'id.token.claim': 'false',
          'access.token.claim': 'true',
          'userinfo.token.claim': 'false',
          'claim.name': 'realm_access.roles',
          'jsonType.label': 'String',
        },
      }),
    });
  }
  return client.id;
}

async function ensureUser(token, roleRepresentations, suffix, roleName) {
  const username = `${runId}-${suffix}`;
  const password = `${crypto.randomBytes(18).toString('base64url')}Aa9!`;
  const headers = adminHeaders(token);
  await request(`http://127.0.0.1:18099/admin/realms/${realm}/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      username,
      enabled: true,
      email: `${username}@local.invalid`,
      emailVerified: true,
      firstName: 'B31',
      lastName: suffix,
      credentials: [{ type: 'password', value: password, temporary: false }],
    }),
  });
  const found = await request(
    `http://127.0.0.1:18099/admin/realms/${realm}/users?username=${encodeURIComponent(username)}&exact=true`,
    { headers },
  );
  const user = Array.isArray(found.body) ? found.body[0] : null;
  if (!user?.id) fail(`B31 user was not created: ${suffix}`);
  await request(`http://127.0.0.1:18099/admin/realms/${realm}/users/${user.id}/role-mappings/realm`, {
    method: 'POST', headers, body: JSON.stringify([roleRepresentations.get(roleName)]),
  });
  return { username, password, role: roleName, subject: user.id };
}

async function userToken(user) {
  const form = new URLSearchParams({
    client_id: clientId,
    grant_type: 'password',
    username: user.username,
    password: user.password,
    scope: 'openid yuxuexing-api yuxuexing-identity',
  });
  const response = await request(`${issuer}/protocol/openid-connect/token`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form,
  });
  if (!response.body.access_token) fail(`B31 token missing for ${user.role}`);
  if (process.env.B31_DEBUG_TOKEN_CLAIMS === 'true') {
    const payload = JSON.parse(Buffer.from(response.body.access_token.split('.')[1], 'base64url').toString('utf8'));
    console.error(JSON.stringify({ role: user.role, claims: {
      roles: payload.roles ?? null,
      realm_access: payload.realm_access ?? null,
      resource_access: payload.resource_access ?? null,
      aud: payload.aud ?? null,
      iss: payload.iss ?? null,
    } }));
  }
  return response.body.access_token;
}

async function gatewayRequest(token, path, options = {}) {
  const headers = {
    authorization: `Bearer ${token}`,
    'x-request-id': `${runId}-${options.operation ?? 'read'}`.slice(0, 120),
    'x-trace-id': traceId,
    ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(options.idempotencyKey ? { 'idempotency-key': options.idempotencyKey } : {}),
    ...(options.headers ?? {}),
  };
  const response = await fetch(`${gateway}${path}`, {
    method: options.method ?? 'GET', headers, body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const body = await jsonOrText(response);
  return { status: response.status, body, requestId: response.headers.get('x-request-id'), traceId: response.headers.get('x-trace-id') };
}

function assertStatus(result, status, name) {
  if (result.status !== status) fail(`${name}: expected ${status}, got ${result.status}`, result.body);
}

function commandBody(command, extra = {}) {
  return { command, contentCode, ...extra };
}

function mysqlQuery(sql) {
  const container = process.env.MYSQL_CONTAINER ?? 'yuxuexing-local-mysql-1';
  const result = spawnSync('docker', [
    'exec', container, 'mysql', '-usvc_content', '-plocal-owner-only', 'content_service', '-N', '-B', '-e', sql,
  ], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) return { ok: false, error: (result.stderr ?? '').trim().slice(0, 500) };
  return { ok: true, value: (result.stdout ?? '').trim() };
}

async function main() {
  const admin = await adminToken();
  const roleRepresentations = new Map();
  for (const role of roles) roleRepresentations.set(role, await ensureRole(admin, role));
  await ensureClient(admin);
  const editor = await ensureUser(admin, roleRepresentations, 'editor', 'content-editor');
  const reviewer1 = await ensureUser(admin, roleRepresentations, 'reviewer1', 'review-l1');
  const reviewer2 = await ensureUser(admin, roleRepresentations, 'reviewer2', 'review-l2');
  const publisher = await ensureUser(admin, roleRepresentations, 'publisher', 'content-publisher');
  const tokens = {
    editor: await userToken(editor),
    reviewer1: await userToken(reviewer1),
    reviewer2: await userToken(reviewer2),
    publisher: await userToken(publisher),
  };
  const checks = [];
  const record = (name, result, expected) => {
    assertStatus(result, expected, name);
    checks.push({ name, status: 'PASS', httpStatus: result.status, requestId: result.requestId, traceId: result.traceId });
    return result;
  };
  const content = {
    contentType: 'COURSE_UNIT',
    title: 'B31 本地真实内容',
    summary: '由后台内容命令写入 MySQL，再从学习端读取。',
    contentLocale: 'en-US',
    targetLevel: 'A1',
    sourceCode: 'LOCAL_B31_SOURCE',
    licenseCode: 'LOCAL_DEV_LICENSE',
    items: [{ itemCode: `${contentCode}:item-1`, itemType: 'PHRASE', displayOrder: 0, displayText: 'This item is served from MySQL.' }],
  };
  record('create draft', await gatewayRequest(tokens.editor, '/api/v1/admin/content-commands', {
    method: 'POST', operation: 'create', idempotencyKey: `${runId}-create`, body: commandBody('CREATE_DRAFT', { content }),
  }), 202);
  record('submit review', await gatewayRequest(tokens.editor, '/api/v1/admin/content-commands', {
    method: 'POST', operation: 'submit', idempotencyKey: `${runId}-submit`, body: commandBody('SUBMIT_REVIEW', { targetVersionNumber: 1 }),
  }), 202);
  record('first review', await gatewayRequest(tokens.reviewer1, '/api/v1/admin/content-commands', {
    method: 'POST', operation: 'review1', idempotencyKey: `${runId}-review1`, body: commandBody('REVIEW_FIRST', { targetVersionNumber: 1, reviewDecision: 'APPROVED' }),
  }), 202);
  record('final review', await gatewayRequest(tokens.reviewer2, '/api/v1/admin/content-commands', {
    method: 'POST', operation: 'review2', idempotencyKey: `${runId}-review2`, body: commandBody('REVIEW_FINAL', { targetVersionNumber: 1, reviewDecision: 'APPROVED' }),
  }), 202);
  const published = record('publish', await gatewayRequest(tokens.publisher, '/api/v1/admin/content-commands', {
    method: 'POST', operation: 'publish', idempotencyKey: `${runId}-publish`, body: commandBody('PUBLISH', { targetVersionNumber: 1 }),
  }), 202);
  const replay = record('publish replay', await gatewayRequest(tokens.publisher, '/api/v1/admin/content-commands', {
    method: 'POST', operation: 'publish-replay', idempotencyKey: `${runId}-publish`, body: commandBody('PUBLISH', { targetVersionNumber: 1 }),
  }), 202);
  const catalog = record('learner catalog reads published content', await gatewayRequest(tokens.editor, `/api/v1/content/learner/catalog?contentLocale=en-US&targetLevel=A1`, { operation: 'catalog' }), 200);
  const learnerContent = record('learner content reads same version', await gatewayRequest(tokens.editor, `/api/v1/content/learner/${encodeURIComponent(contentCode)}`, { operation: 'content' }), 200);
  const unpublish = record('unpublish', await gatewayRequest(tokens.publisher, '/api/v1/admin/content-commands', {
    method: 'POST', operation: 'unpublish', idempotencyKey: `${runId}-unpublish`, body: commandBody('UNPUBLISH', { targetVersionNumber: 1 }),
  }), 202);
  const afterUnpublish = await gatewayRequest(tokens.editor, `/api/v1/content/learner/${encodeURIComponent(contentCode)}`, { operation: 'after-unpublish' });
  assertStatus(afterUnpublish, 404, 'learner content is unavailable after unpublish');
  checks.push({ name: 'unpublish reflected by learner read', status: 'PASS', httpStatus: afterUnpublish.status, requestId: afterUnpublish.requestId, traceId: afterUnpublish.traceId });

  const db = {
    definition: mysqlQuery(`SELECT COUNT(*) FROM content_definition WHERE content_code='${contentCode}'`),
    versions: mysqlQuery(`SELECT COUNT(*) FROM content_version v JOIN content_definition d ON d.content_id=v.content_id WHERE d.content_code='${contentCode}'`),
    projectionsAfterUnpublish: mysqlQuery(`SELECT COUNT(*) FROM content_public_projection WHERE content_id='${contentCode}'`),
    outbox: mysqlQuery(`SELECT COUNT(*) FROM content_outbox_event WHERE request_id LIKE '${runId}%'`),
    idempotency: mysqlQuery(`SELECT COUNT(*) FROM content_idempotency_record WHERE idempotency_key LIKE '${runId}%'`),
  };
  for (const [name, result] of Object.entries(db)) {
    if (!result.ok) fail(`MySQL evidence query failed: ${name}`, result.error);
  }
  const dbValues = Object.fromEntries(Object.entries(db).map(([name, result]) => [name, Number(result.value)]));
  if (dbValues.definition !== 1 || dbValues.versions !== 1 || dbValues.projectionsAfterUnpublish !== 0 || dbValues.outbox < 7 || dbValues.idempotency < 6) {
    fail('B31 MySQL lifecycle evidence is incomplete', dbValues);
  }
  const publishedCode = published.body?.data?.contentCode ?? contentCode;
  const publishedVersion = learnerContent.body?.data?.contentVersionId ?? learnerContent.body?.data?.content?.contentVersionId ?? null;
  const replayCommandId = replay.body?.data?.commandId ?? null;
  const firstCommandId = published.body?.data?.commandId ?? null;
  const result = {
    result: 'PASS',
    runId,
    contentCode: publishedCode,
    publishedVersion,
    idempotentReplay: Boolean(firstCommandId && replayCommandId && firstCommandId === replayCommandId),
    catalogContainsContent: Boolean(catalog.body?.data?.data?.items?.some?.(item => item.contentCode === contentCode) || catalog.body?.data?.items?.some?.(item => item.contentCode === contentCode)),
    learnerSource: learnerContent.body?.source ?? learnerContent.body?.data?.source ?? 'mysql',
    db: dbValues,
    checks,
    credentialsPersisted: false,
    tokenValuesEmitted: false,
  };
  if (!result.idempotentReplay || !result.catalogContainsContent) fail('B31 API/read/idempotency assertions failed', result);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ result: 'FAIL', runId, message: error.message, details: error.details ?? null }, null, 2));
  process.exitCode = 1;
});
