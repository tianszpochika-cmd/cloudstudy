import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const composeFile = 'infra/docker/docker-compose.dev.yml';
const composeService = 'keycloak';
const configPath = path.join(root, 'config', 'local-oidc.json');
const portsPath = path.join(root, 'config', 'local-ports.json');
const oidc = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const ports = JSON.parse(fs.readFileSync(portsPath, 'utf8'));
const portEntry = ports.services?.[oidc.portKey];
const realmPath = path.join(root, 'infra', 'docker', 'keycloak', 'realm', 'yuxuexing-local-realm.json');
const realmText = fs.readFileSync(realmPath, 'utf8');
const realm = JSON.parse(realmText);
const command = process.argv[2] ?? 'status';

if (!portEntry || portEntry.port !== oidc.port || portEntry.protocol !== 'http') {
  throw new Error(`OIDC fixed port registration mismatch: expected ${oidc.portKey}=http/${oidc.port}`);
}
if (oidc.host !== '127.0.0.1' || !oidc.baseUrl.startsWith(`http://${oidc.host}:${oidc.port}`)) {
  throw new Error('Local OIDC IdP must use the registered loopback host and port');
}
if (oidc.protocol?.grant !== 'authorization_code' || oidc.protocol?.pkce !== 'S256' || oidc.protocol?.implicitFlow !== false || oidc.protocol?.resourceOwnerPasswordGrant !== false) {
  throw new Error('Local OIDC must use authorization code + PKCE S256 and disable implicit/password grants');
}
if (oidc.protocol?.registration?.endUserSelfRegistration !== true || oidc.protocol?.registration?.dynamicClientRegistration !== false) {
  throw new Error('Local OIDC registration policy must enable end-user registration and disable dynamic client registration');
}
if (oidc.tokenServerInRepository !== false || oidc.adminBootstrap?.passwordCommitted !== false) {
  throw new Error('Local OIDC configuration must not contain an application token server or committed password');
}
if (realm.registrationAllowed !== true || realm.clients?.length !== oidc.clients?.length) {
  throw new Error('Keycloak realm registration or client count does not match local OIDC configuration');
}
if (realm.userProfile?.unmanagedAttributePolicy !== 'ADMIN_EDIT') {
  throw new Error('Keycloak local realm must keep unmanaged attributes admin-editable only');
}
for (const attribute of realm.userProfile?.attributes ?? []) {
  if (!['tenant_id', 'device_id', 'permissions'].includes(attribute.name)) continue;
  const view = attribute.permissions?.view ?? [];
  const edit = attribute.permissions?.edit ?? [];
  if (view.some((role) => role !== 'admin') || edit.some((role) => role !== 'admin')) {
    throw new Error(`Keycloak authority attribute ${attribute.name} must be admin-only`);
  }
}
if (realm.realm !== oidc.realm || /\$\{[^}]+\}/.test(realmText)) {
  throw new Error('Keycloak realm import must contain concrete local values; unresolved environment placeholders are not supported');
}
const expectedClientIds = new Set(oidc.clients.map((client) => client.clientId));
if (realm.clients.some((client) => !expectedClientIds.has(client.clientId))) {
  throw new Error('Keycloak realm client IDs do not match config/local-oidc.json');
}
const audienceMapper = realm.clientScopes
  ?.flatMap((scope) => scope.protocolMappers ?? [])
  .find((mapper) => mapper.name === 'yuxuexing-api-audience');
if (audienceMapper?.config?.['included.custom.audience'] !== oidc.audience) {
  throw new Error('Keycloak realm audience does not match config/local-oidc.json');
}
for (const client of realm.clients) {
  if (client.publicClient !== true || client.standardFlowEnabled !== true || client.implicitFlowEnabled !== false || client.directAccessGrantsEnabled !== false || client.clientAuthenticatorType !== 'none' || client.attributes?.['pkce.code.challenge.method'] !== 'S256') {
    throw new Error(`Keycloak client ${client.clientId} is not a public S256 PKCE authorization-code client`);
  }
}
if (/-----BEGIN|client_secret|private[_-]?key/i.test(realmText)) {
  throw new Error('Keycloak realm contains a possible secret or private key marker');
}

function usage() {
  console.log('Usage: node scripts/runtime/local-oidc-idp.mjs <up|down|status|check|logs>');
  console.log('  up      start only the local Keycloak test IdP and wait for discovery/JWKS');
  console.log('  down    stop Keycloak and preserve its local volume');
  console.log('  status  show the Compose status');
  console.log('  check   verify static configuration, discovery and JWKS');
  console.log('  logs    show the last 100 Keycloak log lines');
}

function compose(args, { inherit = false } = {}) {
  return spawnSync('docker', ['compose', '-f', composeFile, ...args], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    stdio: inherit ? 'inherit' : 'pipe'
  });
}

function parseComposePs(output) {
  const text = String(output ?? '').trim();
  if (!text) return [];
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value : [value];
  } catch {
    return text.split(/\r?\n/).flatMap((line) => {
      try {
        const value = JSON.parse(line);
        return Array.isArray(value) ? value : [value];
      } catch {
        return [];
      }
    });
  }
}

function currentRecord() {
  const result = compose(['ps', '--all', '--format', 'json', composeService]);
  if (result.status !== 0) return null;
  const records = parseComposePs(result.stdout);
  return records.find((record) => record.Service === composeService) ?? records[0] ?? null;
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (error) => resolve({ free: false, error }));
    server.listen({ host: oidc.host, port }, () => {
      server.close(() => resolve({ free: true }));
    });
  });
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    const body = await response.text();
    let value;
    try {
      value = JSON.parse(body);
    } catch {
      throw new Error(`${url} returned non-JSON response (${response.status})`);
    }
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    return value;
  } finally {
    clearTimeout(timeout);
  }
}

function requiredDiscoveryFields(discovery) {
  const fields = ['issuer', 'authorization_endpoint', 'token_endpoint', 'jwks_uri', 'userinfo_endpoint', 'end_session_endpoint'];
  return fields.filter((field) => typeof discovery[field] !== 'string' || discovery[field].length === 0);
}

async function checkRuntime() {
  const discovery = await fetchJson(oidc.endpoints.discovery);
  const missing = requiredDiscoveryFields(discovery);
  if (missing.length > 0) throw new Error(`OIDC discovery is missing: ${missing.join(', ')}`);
  if (discovery.issuer !== oidc.issuer) throw new Error(`OIDC issuer mismatch: ${discovery.issuer}`);
  if (discovery.authorization_endpoint !== oidc.endpoints.authorization) throw new Error('OIDC authorization endpoint mismatch');
  if (discovery.token_endpoint !== oidc.endpoints.token) throw new Error('OIDC token endpoint mismatch');
  if (discovery.jwks_uri !== oidc.endpoints.jwks) throw new Error('OIDC JWKS endpoint mismatch');

  const jwks = await fetchJson(discovery.jwks_uri);
  if (!Array.isArray(jwks.keys) || jwks.keys.length === 0) throw new Error('OIDC JWKS contains no keys');
  const signingKeys = jwks.keys.filter((key) => key.use === 'sig');
  if (signingKeys.length === 0) throw new Error('OIDC JWKS contains no signing keys');
  if (signingKeys.some((key) => !key.kid || !key.kty || key.use !== 'sig')) throw new Error('OIDC JWKS contains an invalid signing-key descriptor');

  console.log(`[PASS] OIDC discovery: ${discovery.issuer}`);
  console.log(`[PASS] OIDC authorization-code endpoint: ${discovery.authorization_endpoint}`);
  console.log(`[PASS] OIDC token endpoint: ${discovery.token_endpoint}`);
  console.log(`[PASS] JWKS: ${discovery.jwks_uri} (${signingKeys.length} signing key(s), ${jwks.keys.length - signingKeys.length} encryption key(s))`);
  console.log('[PASS] Local clients are public PKCE clients; no client secret is required.');
}

async function waitForRuntime(timeoutMs = 120000) {
  const startedAt = Date.now();
  let lastError = 'not ready';
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await checkRuntime();
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw new Error(`Local OIDC IdP did not become ready within ${timeoutMs / 1000}s: ${lastError}`);
}

async function up() {
  const record = currentRecord();
  const state = String(record?.State ?? '').toLowerCase();
  if (!['running', 'restarting', 'created'].includes(state)) {
    const port = await isPortFree(oidc.port);
    if (!port.free) {
      throw new Error(`fixed OIDC port ${oidc.host}:${oidc.port} is busy; stop its owner instead of choosing another port`);
    }
  }
  const result = compose(['up', '-d', '--no-deps', composeService], { inherit: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
  await waitForRuntime();
  console.log(`[PASS] local OIDC IdP is ready at ${oidc.baseUrl}`);
}

function down() {
  const result = compose(['stop', composeService], { inherit: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log('[PASS] local OIDC IdP stopped; yuxuexing-keycloak volume was preserved.');
}

function status() {
  const result = compose(['ps', '--all', composeService], { inherit: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function check() {
  const staticCheck = spawnSync(process.execPath, [path.join(root, 'scripts', 'check-local-infra.mjs'), '--static-only'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    stdio: 'inherit'
  });
  if (staticCheck.status !== 0) process.exit(staticCheck.status ?? 1);
  await checkRuntime();
}

function logs() {
  const result = compose(['logs', '--tail', '100', composeService], { inherit: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

try {
  if (command === 'up') await up();
  else if (command === 'down') down();
  else if (command === 'status') status();
  else if (command === 'check') await check();
  else if (command === 'logs') logs();
  else {
    usage();
    process.exitCode = 2;
  }
} catch (error) {
  console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
