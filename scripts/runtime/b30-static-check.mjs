import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const EXPECTED_CLIENTS = [
  { id: 'learner-web', clientId: 'yuxuexing-learner-web', portKey: 'learner-web-dev', port: 18180 },
  { id: 'admin-web', clientId: 'yuxuexing-admin-web', portKey: 'admin-web-dev', port: 18181 },
  { id: 'mobile-h5', clientId: 'yuxuexing-mobile-h5', portKey: 'mobile-h5-dev', port: 18183 },
  { id: 'mobile-app', clientId: 'yuxuexing-mobile-app', portKey: null, port: null },
];

const REQUIRED_DISCOVERY_FIELDS = [
  'issuer',
  'authorization_endpoint',
  'token_endpoint',
  'jwks_uri',
  'userinfo_endpoint',
  'end_session_endpoint',
];

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

export function readB30Inputs(root = repositoryRoot) {
  const realmPath = path.join(root, 'infra', 'docker', 'keycloak', 'realm', 'yuxuexing-local-realm.json');
  return {
    root,
    oidc: readJson(root, 'config/local-oidc.json'),
    realm: readJson(root, 'infra/docker/keycloak/realm/yuxuexing-local-realm.json'),
    realmText: fs.readFileSync(realmPath, 'utf8'),
    ports: readJson(root, 'config/local-ports.json'),
  };
}

function sameArray(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function isAbsoluteRedirect(value) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('*') || value.includes('#')) return false;
  try {
    const uri = new URL(value);
    if (uri.username || uri.password || uri.search) return false;
    if (uri.protocol === 'http:') return uri.hostname === '127.0.0.1' && Boolean(uri.port);
    if (uri.protocol === 'englishflow:') return uri.hostname === 'auth' && uri.pathname === '/callback';
    return false;
  } catch {
    return false;
  }
}

function originFromRedirect(value) {
  try {
    const uri = new URL(value);
    return uri.protocol === 'http:' ? uri.origin : null;
  } catch {
    return null;
  }
}

function allStrings(value) {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.length > 0);
}

function findAudienceMapper(realm, name) {
  return realm.clientScopes
    ?.flatMap((scope) => scope.protocolMappers ?? [])
    .find((mapper) => mapper.name === name);
}

function findIdentityMapper(realm) {
  return realm.clientScopes
    ?.flatMap((scope) => scope.protocolMappers ?? [])
    .find((mapper) => mapper.name === 'sub');
}

function check(checks, errors, id, condition, detail) {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ id, status, detail });
  if (!condition) errors.push(`${id}: ${detail}`);
}

function clientById(clients, clientId) {
  return clients.find((client) => client.clientId === clientId);
}

export function validateB30LocalOidc(inputs) {
  const { oidc, realm, realmText, ports } = inputs;
  const checks = [];
  const errors = [];
  const expectedBaseUrl = `http://${oidc.host}:${oidc.port}`;
  const expectedIssuer = `${expectedBaseUrl}/realms/${oidc.realm}`;
  const expectedEndpoints = {
    discovery: `${expectedIssuer}/.well-known/openid-configuration`,
    authorization: `${expectedIssuer}/protocol/openid-connect/auth`,
    token: `${expectedIssuer}/protocol/openid-connect/token`,
    jwks: `${expectedIssuer}/protocol/openid-connect/certs`,
    userinfo: `${expectedIssuer}/protocol/openid-connect/userinfo`,
    logout: `${expectedIssuer}/protocol/openid-connect/logout`,
  };

  check(checks, errors, 'provider-test-only', oidc.provider === 'keycloak' && oidc.testOnly === true && oidc.productionUse === false, 'the local provider must be the disposable Keycloak test IdP');
  check(checks, errors, 'provider-no-token-server', oidc.tokenServerInRepository === false && oidc.adminBootstrap?.usernameEnv === 'OIDC_BOOTSTRAP_ADMIN_USERNAME' && oidc.adminBootstrap?.passwordEnv === 'OIDC_BOOTSTRAP_ADMIN_PASSWORD' && oidc.adminBootstrap?.passwordCommitted === false && !Object.prototype.hasOwnProperty.call(oidc.adminBootstrap ?? {}, 'password'), 'the repository must not contain an application token server, bootstrap password, or private credential');
  check(checks, errors, 'fixed-loopback-port', oidc.host === '127.0.0.1' && oidc.portKey === 'oidc-idp' && ports.services?.['oidc-idp']?.port === oidc.port && ports.services?.['oidc-idp']?.protocol === 'http', 'OIDC must use the registered 127.0.0.1:18099 binding');
  check(checks, errors, 'issuer-and-endpoints', oidc.baseUrl === expectedBaseUrl && oidc.issuer === expectedIssuer && Object.entries(expectedEndpoints).every(([name, value]) => oidc.endpoints?.[name] === value), 'issuer and discovery endpoints must be derived from the fixed realm authority');
  check(checks, errors, 'standard-oidc-code-pkce', oidc.protocol?.standard === 'OIDC/OAuth2.1' && oidc.protocol?.grant === 'authorization_code' && oidc.protocol?.pkce === 'S256' && oidc.protocol?.implicitFlow === false && oidc.protocol?.resourceOwnerPasswordGrant === false, 'authorization-code + PKCE S256 is required and implicit/password grants are disabled');
  check(checks, errors, 'refresh-rotation', oidc.protocol?.refreshTokenRotation === true, 'refresh token rotation must be enabled by the local contract');

  const discovery = oidc.discovery ?? {};
  check(checks, errors, 'discovery-contract', sameArray(discovery.requiredFields, REQUIRED_DISCOVERY_FIELDS) && discovery.requiredResponseType === 'code' && discovery.requiredGrantType === 'authorization_code' && discovery.requiredCodeChallengeMethod === 'S256', 'the local discovery contract must require issuer, endpoints, code, authorization_code, and S256');
  check(checks, errors, 'jwks-contract', oidc.jwks?.uri === oidc.endpoints?.jwks && oidc.jwks?.requiredKeyUse === 'sig' && oidc.jwks?.requiredSigningAlgorithm === 'RS256' && oidc.jwks?.requireKeyId === true && oidc.jwks?.publicKeysOnly === true, 'JWKS must be a public RS256 signing-key set with kid');
  check(checks, errors, 'audience-contract', typeof oidc.audience === 'string' && oidc.audience.length > 0 && oidc.audienceClaim === 'aud' && typeof oidc.audienceMapper === 'string' && oidc.audienceMapper.length > 0, 'the API audience must be carried in the aud claim by a named Keycloak mapper');

  const registration = oidc.registrationPolicy ?? {};
  check(checks, errors, 'registration-policy', registration.selfRegistration === true && registration.dynamicClientRegistration === false && registration.registrationEmailAsUsername === false && registration.verifyEmail === false && registration.loginWithEmail === true && registration.duplicateEmails === false && registration.passwordReset === false && registration.editUsername === false && registration.passwordPolicy === realm.passwordPolicy, 'self-registration is enabled for local synthetic users while dynamic clients, reset, username editing, and email verification remain disabled');
  check(checks, errors, 'redirect-policy', oidc.redirectPolicy?.match === 'exact' && oidc.redirectPolicy?.wildcardsAllowed === false && oidc.redirectPolicy?.fragmentsAllowed === false && oidc.redirectPolicy?.crossClientReuseAllowed === false, 'redirect and logout allowlists must use exact, non-wildcard values');

  const clients = Array.isArray(oidc.clients) ? oidc.clients : [];
  check(checks, errors, 'four-local-clients', clients.length === EXPECTED_CLIENTS.length && EXPECTED_CLIENTS.every((expected) => clients.some((client) => client.id === expected.id && client.clientId === expected.clientId)), 'learner-web, admin-web, mobile-h5, and mobile-app must each have one registered public client');
  check(checks, errors, 'unique-client-ids', new Set(clients.map((client) => client.clientId)).size === clients.length, 'client IDs must be unique');

  const allRedirects = [];
  for (const expected of EXPECTED_CLIENTS) {
    const client = clients.find((item) => item.id === expected.id);
    const realmClient = client ? clientById(realm.clients ?? [], client.clientId) : null;
    const clientPrefix = `client-${expected.id}`;
    const expectedOrigin = expected.port ? `http://127.0.0.1:${expected.port}` : null;
    check(checks, errors, `${clientPrefix}-shape`, Boolean(client) && client.type === 'public-pkce' && allStrings(client.redirectUris) && allStrings(client.logoutRedirectUris) && Array.isArray(client.webOrigins), 'client shape must declare public PKCE, exact redirect allowlists, logout allowlists, and web origins');
    const redirects = client?.redirectUris ?? [];
    const logoutRedirects = client?.logoutRedirectUris ?? [];
    check(checks, errors, `${clientPrefix}-redirects`, redirects.every(isAbsoluteRedirect) && logoutRedirects.every(isAbsoluteRedirect), 'redirect and logout URI entries must be absolute exact values without wildcards, fragments, queries, or credentials');
    check(checks, errors, `${clientPrefix}-loopback-origin`, expectedOrigin === null ? redirects.length === 1 && redirects[0] === 'englishflow://auth/callback' : redirects.length === 1 && redirects[0] === `${expectedOrigin}/auth/callback` && logoutRedirects.length === 1 && logoutRedirects[0] === `${expectedOrigin}/`, 'the client must use its fixed loopback callback or the registered native custom scheme');
    check(checks, errors, `${clientPrefix}-web-origin`, expectedOrigin === null ? client?.webOrigins?.length === 0 : sameArray(client?.webOrigins, [expectedOrigin]), 'web origins must be exact and empty for the native custom-scheme client');
    allRedirects.push(...redirects.map((uri) => ({ kind: 'login', uri, clientId: client?.clientId })));
    allRedirects.push(...logoutRedirects.map((uri) => ({ kind: 'logout', uri, clientId: client?.clientId })));

    check(checks, errors, `${clientPrefix}-realm-alignment`, Boolean(realmClient) && sameArray(realmClient.redirectUris, redirects) && sameArray(realmClient.webOrigins, client?.webOrigins) && realmClient.attributes?.['post.logout.redirect.uris'] === logoutRedirects.join(' ') && realmClient.attributes?.['pkce.code.challenge.method'] === 'S256', 'Keycloak must import the same exact callback, logout, and S256 settings');
    check(checks, errors, `${clientPrefix}-realm-public-code`, Boolean(realmClient) && realmClient.enabled === true && realmClient.publicClient === true && realmClient.clientAuthenticatorType === 'none' && realmClient.standardFlowEnabled === true && realmClient.implicitFlowEnabled === false && realmClient.directAccessGrantsEnabled === false && realmClient.serviceAccountsEnabled === false && realmClient.bearerOnly === false && realmClient.protocol === 'openid-connect', 'Keycloak client must be a public authorization-code client with non-code grants disabled');
    check(checks, errors, `${clientPrefix}-audience-scope`, Boolean(realmClient) && realmClient.defaultClientScopes?.includes('yuxuexing-api'), 'each local client must receive the server API audience scope');
  }
  const redirectOwners = new Map();
  for (const item of allRedirects) {
    const owners = redirectOwners.get(item.uri) ?? new Set();
    owners.add(item.clientId);
    redirectOwners.set(item.uri, owners);
  }
  check(checks, errors, 'no-cross-client-redirect-reuse', oidc.redirectPolicy?.crossClientReuseAllowed !== false || [...redirectOwners.values()].every((owners) => owners.size === 1), 'a redirect URI must not be reused across local clients when cross-client reuse is disabled');

  check(checks, errors, 'realm-registration-settings', realm.registrationAllowed === registration.selfRegistration && realm.registrationEmailAsUsername === registration.registrationEmailAsUsername && realm.verifyEmail === registration.verifyEmail && realm.loginWithEmailAllowed === registration.loginWithEmail && realm.duplicateEmailsAllowed === registration.duplicateEmails && realm.resetPasswordAllowed === registration.passwordReset && realm.editUsernameAllowed === registration.editUsername && realm.passwordPolicy === registration.passwordPolicy, 'Keycloak realm registration settings must match the local registration policy');
  check(checks, errors, 'realm-concrete-import', realm.realm === oidc.realm && !/\$\{[^}]+\}/.test(realmText), 'realm import must be concrete and must not contain unresolved environment placeholders');
  check(checks, errors, 'realm-client-count', Array.isArray(realm.clients) && realm.clients.length === clients.length, 'Keycloak realm client count must match local OIDC config');

  const audienceMapper = findAudienceMapper(realm, oidc.audienceMapper);
    check(checks, errors, 'realm-audience-mapper', audienceMapper?.protocol === 'openid-connect' && audienceMapper?.protocolMapper === 'oidc-audience-mapper' && audienceMapper?.config?.['included.custom.audience'] === oidc.audience && audienceMapper?.config?.['access.token.claim'] === 'true' && audienceMapper?.config?.['id.token.claim'] === 'false' && audienceMapper?.config?.['userinfo.token.claim'] === 'false', 'the Keycloak audience mapper must add only the configured API audience to access tokens');
  const identityMapper = findIdentityMapper(realm);
  check(checks, errors, 'realm-identity-sub-mapper', identityMapper?.protocol === 'openid-connect' && identityMapper?.protocolMapper === 'oidc-sub-mapper' && identityMapper?.config?.['access.token.claim'] === 'true', 'the Keycloak identity scope must carry the standard subject claim in access tokens for server-side principal mapping');
  const serializedRealm = JSON.stringify(realm);
  const serializedOidc = JSON.stringify(oidc);
  check(checks, errors, 'realm-public-only', !/-----BEGIN|\"(?:client_secret|clientSecret|private_key|privateKey|secret|password)\"\s*:\s*\"[^\"]+/i.test(`${realmText}\n${serializedRealm}`) && !/\"(?:client_secret|clientSecret|private_key|privateKey|secret)\"\s*:\s*\"[^\"]+/i.test(serializedOidc), 'realm/config must not contain client secrets, private keys, or committed passwords');

  const passed = checks.filter((item) => item.status === 'PASS').length;
  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    staticStatus: errors.length === 0 ? 'PASS' : 'FAIL',
    checks,
    errors,
    summary: {
      passed,
      total: checks.length,
      clientCount: clients.length,
      redirectCount: allRedirects.length,
      realmClientCount: realm.clients?.length ?? 0,
    },
  };
}

function isMainModule() {
  return process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
}

if (isMainModule()) {
  try {
    const result = validateB30LocalOidc(readB30Inputs());
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.result === 'PASS' ? 0 : 1;
  } catch (error) {
    console.error(JSON.stringify({ result: 'FAIL', errors: [error instanceof Error ? error.message : String(error)] }, null, 2));
    process.exitCode = 1;
  }
}
