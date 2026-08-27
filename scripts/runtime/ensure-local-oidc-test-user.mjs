const baseUrl = process.env.OIDC_ADMIN_BASE_URL ?? 'http://127.0.0.1:18099';
const realm = process.env.OIDC_REALM ?? 'yuxuexing-local';
const adminUsername = process.env.OIDC_BOOTSTRAP_ADMIN_USERNAME ?? 'local-admin';
const adminPassword = process.env.OIDC_BOOTSTRAP_ADMIN_PASSWORD ?? 'change-me-local-only';
const username = process.env.OIDC_TEST_USERNAME ?? 'codex-contract-repair-learner';
const deviceId = process.env.OIDC_TEST_DEVICE_ID ?? 'local-browser';

const permissions = [
  'learner.profile.read', 'learner.profile.write', 'learner.goal.write',
  'learner.preference.write', 'learner.onboarding.read',
  'content.read', 'content.catalog.read', 'learning.read', 'learning.write',
  'assessment.read', 'assessment.write',
  'media:read', 'media:download', 'media:stream',
  'gamification.read', 'gamification.rewards.claim', 'gamification.events.consume',
  'social.room.read', 'social.room.join', 'social.room.member.read', 'social.room.write',
  'social.focus.write', 'social.interaction.send', 'social.leaderboard.read',
  'social.report.create', 'social.report.read', 'social.visibility.write',
  'notification.read', 'notification.write', 'sync.write',
  'commerce:order:read', 'commerce:order:write', 'commerce:payment:write',
  'commerce:entitlement:read', 'commerce:activation:write', 'commerce:activation:redeem',
  'commerce:refund:write', 'commerce:sku:write', 'commerce:reconciliation:read',
  'analytics.read', 'analytics.recompute', 'analytics.events.consume'
];

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

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await bodyOf(response);
  if (!response.ok) fail(`OIDC admin request failed: ${response.status} ${path}`, { status: response.status, body });
  return { response, body };
}

async function adminToken() {
  const form = new URLSearchParams({
    username: adminUsername,
    password: adminPassword,
    grant_type: 'password',
    client_id: 'admin-cli',
  });
  const result = await request('/realms/master/protocol/openid-connect/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form,
  });
  if (!result.body?.access_token) fail('OIDC admin token was not issued');
  return result.body.access_token;
}

function headers(token) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

async function adminRequest(token, path, options = {}) {
  return request(`/admin/realms/${encodeURIComponent(realm)}${path}`, { ...options, headers: { ...headers(token), ...(options.headers ?? {}) } });
}

async function ensureClientScope(token) {
  const list = await adminRequest(token, `/client-scopes?name=${encodeURIComponent('local-learner-claims')}`);
  let scope = Array.isArray(list.body) ? list.body.find(item => item.name === 'local-learner-claims') : null;
  if (!scope) {
    await adminRequest(token, '/client-scopes', {
      method: 'POST',
      body: JSON.stringify({
        name: 'local-learner-claims',
        description: 'Local-only signed claims for real browser fixture testing; never use in production.',
        protocol: 'openid-connect',
        attributes: { 'include.in.token.scope': 'true', 'display.on.consent.screen': 'false' },
      }),
    });
    const created = await adminRequest(token, `/client-scopes?name=${encodeURIComponent('local-learner-claims')}`);
    scope = Array.isArray(created.body) ? created.body.find(item => item.name === 'local-learner-claims') : null;
  }
  if (!scope?.id) fail('local-learner-claims scope is missing after ensure');
  return scope;
}

async function ensureMappers(token, scope) {
  const mapperUrl = `/client-scopes/${encodeURIComponent(scope.id)}/protocol-mappers/models`;
  const existing = await adminRequest(token, mapperUrl);
  const names = new Set(Array.isArray(existing.body) ? existing.body.map(item => item.name) : []);
  const mappers = [
    ['local-tenant-id', 'tenant_id', 'tenant_id', 'String', false],
    ['local-device-id', 'device_id', 'device_id', 'String', false],
    ['local-phase', 'phase', 'phase', 'String', false],
    ['local-consent-state', 'consent_state', 'consent_state', 'String', false],
    ['local-account-status', 'account_status', 'account_status', 'String', false],
    ['local-media-consent', 'media_consent', 'media_consent', 'boolean', false],
    ['local-device-trusted', 'device_trusted', 'device_trusted', 'boolean', false],
    ['local-permissions', 'permissions', 'permissions', 'String', true],
    ['local-content-rights', 'content_rights', 'content_rights', 'String', true],
  ];
  for (const [name, attribute, claim, jsonType, multivalued] of mappers) {
    if (names.has(name)) continue;
    await adminRequest(token, mapperUrl, {
      method: 'POST',
      body: JSON.stringify({
        name,
        protocol: 'openid-connect',
        protocolMapper: 'oidc-usermodel-attribute-mapper',
        consentRequired: false,
        config: {
          'user.attribute': attribute,
          'claim.name': claim,
          'jsonType.label': jsonType,
          multivalued: String(multivalued),
          'id.token.claim': 'false',
          'access.token.claim': 'true',
          'userinfo.token.claim': 'false',
        },
      }),
    });
  }
}

async function attachScope(token, scope) {
  const clients = await adminRequest(token, '/clients?max=100');
  const clientIds = new Set(['yuxuexing-learner-web', 'yuxuexing-mobile-h5', 'yuxuexing-admin-web', 'yuxuexing-mobile-app']);
  for (const client of Array.isArray(clients.body) ? clients.body : []) {
    if (!clientIds.has(client.clientId)) continue;
    const assigned = await adminRequest(token, `/clients/${encodeURIComponent(client.id)}/default-client-scopes`);
    if (Array.isArray(assigned.body) && assigned.body.some(item => item.id === scope.id || item.name === scope.name)) continue;
    await adminRequest(token, `/clients/${encodeURIComponent(client.id)}/default-client-scopes/${encodeURIComponent(scope.id)}`, { method: 'PUT' });
  }
}

async function ensureUser(token) {
  const result = await adminRequest(token, `/users?username=${encodeURIComponent(username)}&exact=true`);
  const user = Array.isArray(result.body) ? result.body.find(item => item.username === username) : null;
  if (!user?.id) fail(`local OIDC user does not exist: ${username}`);
  const attributes = {
    ...(user.attributes ?? {}),
    tenant_id: ['platform'],
    device_id: [deviceId],
    phase: ['phase-1'],
    consent_state: ['GRANTED'],
    account_status: ['ACTIVE'],
    media_consent: ['true'],
    device_trusted: ['true'],
    permissions,
    content_rights: ['*', '301', 'LOCAL_FIXTURE_AUDIO'],
  };
  await adminRequest(token, `/users/${encodeURIComponent(user.id)}`, {
    method: 'PUT',
    body: JSON.stringify({
      id: user.id,
      username: user.username,
      enabled: user.enabled !== false,
      email: user.email,
      emailVerified: user.emailVerified !== false,
      firstName: user.firstName,
      lastName: user.lastName,
      attributes,
    }),
  });
  return { id: user.id, username };
}

const token = await adminToken();
const scope = await ensureClientScope(token);
await ensureMappers(token, scope);
await attachScope(token, scope);
const user = await ensureUser(token);
console.log(JSON.stringify({
  status: 'ready',
  realm,
  username: user.username,
  subject: user.id,
  clientScope: scope.name,
  permissionCount: permissions.length,
  browserDeviceId: deviceId,
}));
