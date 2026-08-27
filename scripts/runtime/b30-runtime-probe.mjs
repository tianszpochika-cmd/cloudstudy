import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readB30Inputs, repositoryRoot, validateB30LocalOidc } from './b30-static-check.mjs';

const ACCEPTED_REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const PRIVATE_JWK_MEMBERS = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'k'];

function randomOpaque(prefix) {
  return `${prefix}-${crypto.randomBytes(18).toString('base64url')}`;
}

function s256(value) {
  return crypto.createHash('sha256').update(value).digest('base64url');
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      redirect: options.redirect ?? 'manual',
      ...options,
      signal: controller.signal,
    });
    return {
      status: response.status,
      headers: response.headers,
      location: response.headers.get('location'),
      finalUrl: response.url,
      body: await response.text(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function jsonRequest(url) {
  const response = await request(url, { headers: { accept: 'application/json' } });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  try {
    return JSON.parse(response.body);
  } catch {
    throw new Error(`${url} returned non-JSON content`);
  }
}

function locationError(response) {
  if (!response.location) return null;
  try {
    const location = new URL(response.location);
    return {
      error: location.searchParams.get('error'),
      description: location.searchParams.get('error_description') ?? '',
    };
  } catch {
    return null;
  }
}

function acceptedAuthorizationResponse(response) {
  return (response.status >= 200 && response.status < 300) || ACCEPTED_REDIRECT_STATUSES.has(response.status);
}

function rejectedWith(response, pattern) {
  const error = locationError(response);
  return response.status >= 400
    || (error?.error === 'invalid_request' && pattern.test(error.description))
    || pattern.test(response.body);
}

function badRedirectUri(uri) {
  if (uri.startsWith('http://')) return uri.replace(/\/callback$/, '/callback-not-allowlisted');
  return 'englishflow://auth/not-allowlisted';
}

function badLogoutRedirectUri(uri) {
  if (uri.startsWith('http://')) {
    const parsed = new URL(uri);
    return `${parsed.origin}/not-allowlisted`;
  }
  return 'englishflow://auth/not-allowlisted';
}

function normalizedUri(value) {
  const parsed = new URL(value);
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

function logoutUrl(oidc, client, redirectUri) {
  const url = new URL(oidc.endpoints.logout);
  url.searchParams.set('client_id', client.clientId);
  url.searchParams.set('post_logout_redirect_uri', redirectUri);
  url.searchParams.set('state', randomOpaque('b30-logout-state'));
  return url;
}

function authorizationUrl(oidc, client, mode, redirectUri = client.redirectUris[0]) {
  const verifier = randomOpaque('b30-verifier');
  const url = new URL(oidc.endpoints.authorization);
  url.searchParams.set('client_id', client.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid');
  url.searchParams.set('state', randomOpaque('b30-state'));
  url.searchParams.set('nonce', randomOpaque('b30-nonce'));
  if (mode === 's256') {
    url.searchParams.set('code_challenge', s256(verifier));
    url.searchParams.set('code_challenge_method', 'S256');
  } else if (mode === 'plain') {
    url.searchParams.set('code_challenge', verifier);
    url.searchParams.set('code_challenge_method', 'plain');
  }
  return url;
}

async function probeClient(oidc, client) {
  const exact = await request(authorizationUrl(oidc, client, 's256'), {
    redirect: 'manual',
    headers: { accept: 'text/html,application/xhtml+xml' },
  });
  const loginPage = await request(authorizationUrl(oidc, client, 's256'), {
    redirect: 'follow',
    headers: { accept: 'text/html,application/xhtml+xml' },
  });
  const plain = await request(authorizationUrl(oidc, client, 'plain'), {
    redirect: 'manual',
    headers: { accept: 'text/html,application/xhtml+xml' },
  });
  const missing = await request(authorizationUrl(oidc, client, 'missing'), {
    redirect: 'manual',
    headers: { accept: 'text/html,application/xhtml+xml' },
  });
  const rejectedRedirect = await request(authorizationUrl(oidc, client, 's256', badRedirectUri(client.redirectUris[0])), {
    redirect: 'manual',
    headers: { accept: 'text/html,application/xhtml+xml' },
  });
  const logoutExact = await request(logoutUrl(oidc, client, client.logoutRedirectUris[0]), {
    redirect: 'manual',
    headers: { accept: 'text/html,application/xhtml+xml' },
  });
  const logoutRejected = await request(logoutUrl(oidc, client, badLogoutRedirectUri(client.logoutRedirectUris[0])), {
    redirect: 'manual',
    headers: { accept: 'text/html,application/xhtml+xml' },
  });

  const exactAccepted = acceptedAuthorizationResponse(exact) && !locationError(exact);
  const registrationLink = /login-actions\/registration(?:[?&"'])/i.test(loginPage.body);
  const finalUrlOnKeycloak = loginPage.finalUrl.startsWith(`${oidc.baseUrl}/realms/${oidc.realm}/`);
  const plainRejected = rejectedWith(plain, /code[_\s-]*challenge|pkce/i);
  const missingRejected = rejectedWith(missing, /code[_\s-]*challenge|pkce/i);
  const redirectRejected = rejectedRedirect.status === 400 && /invalid parameter|redirect_uri/i.test(rejectedRedirect.body);
  const logoutExactLocation = logoutExact.location ? normalizedUri(logoutExact.location) : null;
  const logoutExactAccepted = ACCEPTED_REDIRECT_STATUSES.has(logoutExact.status) && logoutExactLocation === normalizedUri(client.logoutRedirectUris[0]);
  const logoutRedirectRejected = logoutRejected.status === 400;

  if (!exactAccepted) throw new Error(`${client.clientId} exact redirect was not accepted by Keycloak (HTTP ${exact.status})`);
  if (!finalUrlOnKeycloak || !registrationLink) throw new Error(`${client.clientId} did not expose the local Keycloak registration page`);
  if (!plainRejected) throw new Error(`${client.clientId} accepted a non-S256 PKCE authorization request`);
  if (!missingRejected) throw new Error(`${client.clientId} accepted an authorization request without PKCE`);
  if (!redirectRejected) throw new Error(`${client.clientId} accepted a redirect URI outside its exact allowlist`);
  if (!logoutExactAccepted) throw new Error(`${client.clientId} exact post-logout redirect was not accepted by Keycloak (HTTP ${logoutExact.status})`);
  if (!logoutRedirectRejected) throw new Error(`${client.clientId} accepted a post-logout redirect outside its exact allowlist`);

  return {
    clientId: client.clientId,
    redirectUri: client.redirectUris[0],
    login: {
      exactRedirectAccepted: true,
      httpStatus: exact.status,
      registrationLink: true,
      loginPageFinalHost: new URL(loginPage.finalUrl).host,
    },
    pkce: {
      method: 'S256',
      exactS256Accepted: true,
      plainRejected: true,
      missingChallengeRejected: true,
      plainHttpStatus: plain.status,
      missingChallengeHttpStatus: missing.status,
    },
    redirectAllowlist: {
      exactMatch: true,
      wildcardRejected: true,
      rejectedRedirectHttpStatus: rejectedRedirect.status,
    },
    logoutAllowlist: {
      exactMatch: true,
      wildcardRejected: true,
      exactHttpStatus: logoutExact.status,
      rejectedRedirectHttpStatus: logoutRejected.status,
    },
  };
}

export function validateB30RuntimeEvidence(evidence, expectedClientIds) {
  const errors = [];
  const requiredChecks = [
    'discovery-issuer-endpoints',
    'jwks-rs256-public-signing-key',
    'registration-policy-runtime',
    'dynamic-registration-not-public',
    'client-exact-redirects',
    'client-pkce-s256',
    'client-pkce-required',
    'client-redirect-allowlist',
    'client-logout-allowlist',
  ];
  if (evidence?.batch !== 'B30') errors.push('evidence.batch must be B30');
  if (evidence?.status !== 'PASS') errors.push('evidence.status must be PASS');
  if (evidence?.evidenceClass !== 'runtime-external') errors.push('evidence must be marked runtime-external');
  if (evidence?.provenance?.external !== true || evidence?.provenance?.synthetic !== false) errors.push('evidence provenance must identify an external non-synthetic Keycloak run');
  if (evidence?.tokenMaterial?.tokenEndpointCalled !== false || evidence?.tokenMaterial?.tokensCollected !== false || evidence?.tokenMaterial?.jwtCreated !== false) errors.push('the probe must not call the token endpoint or create/collect JWT material');
  const checks = new Map((evidence?.checks ?? []).map((item) => [item.id, item]));
  for (const checkId of requiredChecks) {
    if (checks.get(checkId)?.status !== 'PASS') errors.push(`missing passing runtime check: ${checkId}`);
  }
  const actualClientIds = (evidence?.clients ?? []).map((item) => item.clientId);
  if (JSON.stringify(actualClientIds) !== JSON.stringify(expectedClientIds)) errors.push('runtime evidence client order/IDs do not match local OIDC config');
  for (const client of evidence?.clients ?? []) {
    if (client.login?.exactRedirectAccepted !== true || client.login?.registrationLink !== true) errors.push(`${client.clientId} login/registration evidence is incomplete`);
    if (client.pkce?.exactS256Accepted !== true || client.pkce?.plainRejected !== true || client.pkce?.missingChallengeRejected !== true) errors.push(`${client.clientId} PKCE evidence is incomplete`);
    if (client.redirectAllowlist?.exactMatch !== true || client.redirectAllowlist?.wildcardRejected !== true) errors.push(`${client.clientId} redirect allowlist evidence is incomplete`);
    if (client.logoutAllowlist?.exactMatch !== true || client.logoutAllowlist?.wildcardRejected !== true) errors.push(`${client.clientId} post-logout redirect allowlist evidence is incomplete`);
  }
  return { result: errors.length === 0 ? 'PASS' : 'FAIL', errors };
}

async function runProbe(inputs) {
  const { oidc } = inputs;
  const discovery = await jsonRequest(oidc.endpoints.discovery);
  const missingDiscovery = (oidc.discovery?.requiredFields ?? []).filter((field) => typeof discovery[field] !== 'string' || discovery[field].length === 0);
  if (missingDiscovery.length > 0) throw new Error(`Keycloak discovery is missing: ${missingDiscovery.join(', ')}`);
  if (discovery.issuer !== oidc.issuer) throw new Error(`Keycloak issuer mismatch: ${discovery.issuer}`);
  if (discovery.authorization_endpoint !== oidc.endpoints.authorization) throw new Error('Keycloak authorization endpoint mismatch');
  if (discovery.token_endpoint !== oidc.endpoints.token) throw new Error('Keycloak token endpoint mismatch');
  if (discovery.jwks_uri !== oidc.jwks.uri) throw new Error('Keycloak JWKS endpoint mismatch');
  if (discovery.userinfo_endpoint !== oidc.endpoints.userinfo) throw new Error('Keycloak userinfo endpoint mismatch');
  if (discovery.end_session_endpoint !== oidc.endpoints.logout) throw new Error('Keycloak logout endpoint mismatch');
  if (!discovery.response_types_supported?.includes(oidc.discovery.requiredResponseType)) throw new Error('Keycloak discovery does not advertise authorization code response type');
  if (!discovery.grant_types_supported?.includes(oidc.discovery.requiredGrantType)) throw new Error('Keycloak discovery does not advertise authorization_code');
  if (!discovery.code_challenge_methods_supported?.includes(oidc.discovery.requiredCodeChallengeMethod)) throw new Error('Keycloak discovery does not advertise S256');

  const jwks = await jsonRequest(discovery.jwks_uri);
  const signingKeys = (jwks.keys ?? []).filter((key) => key.use === oidc.jwks.requiredKeyUse && key.alg === oidc.jwks.requiredSigningAlgorithm && typeof key.kid === 'string' && key.kid.length > 0);
  if (signingKeys.length === 0) throw new Error('Keycloak JWKS has no usable public RS256 signing key with kid');
  if (oidc.jwks.publicKeysOnly && (jwks.keys ?? []).some((key) => PRIVATE_JWK_MEMBERS.some((member) => Object.prototype.hasOwnProperty.call(key, member)))) {
    throw new Error('Keycloak JWKS exposed private key material');
  }

  const clients = oidc.clients;
  const clientEvidence = [];
  for (const client of clients) clientEvidence.push(await probeClient(oidc, client));

  const dynamicRegistration = await request(`${oidc.issuer}/clients-registrations/openid-connect`, {
    method: 'GET',
    headers: { accept: 'application/json' },
  });
  const dynamicRegistrationBlocked = [401, 403, 404, 405].includes(dynamicRegistration.status);
  if (!dynamicRegistrationBlocked) throw new Error(`unauthenticated dynamic client registration returned HTTP ${dynamicRegistration.status}`);

  const checks = [
    { id: 'discovery-issuer-endpoints', status: 'PASS', detail: `issuer=${discovery.issuer}` },
    { id: 'jwks-rs256-public-signing-key', status: 'PASS', detail: `${signingKeys.length} RS256 signing key(s); private members absent` },
    { id: 'registration-policy-runtime', status: 'PASS', detail: 'Keycloak login page exposes self-registration' },
    { id: 'dynamic-registration-not-public', status: 'PASS', detail: `unauthenticated client registration is blocked with HTTP ${dynamicRegistration.status}` },
    { id: 'client-exact-redirects', status: 'PASS', detail: 'all four exact callbacks reached the Keycloak login page' },
    { id: 'client-pkce-s256', status: 'PASS', detail: 'all four clients accepted S256 authorization requests' },
    { id: 'client-pkce-required', status: 'PASS', detail: 'all four clients rejected plain and missing PKCE requests' },
    { id: 'client-redirect-allowlist', status: 'PASS', detail: 'all four clients rejected a non-allowlisted callback' },
    { id: 'client-logout-allowlist', status: 'PASS', detail: 'all four clients rejected a non-allowlisted post-logout redirect' },
  ];
  const runId = `b30-oidc-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
  const evidence = {
    batch: 'B30',
    runId,
    capturedAt: new Date().toISOString(),
    mode: 'local-real',
    status: 'PASS',
    evidenceClass: 'runtime-external',
    provenance: {
      external: true,
      producer: 'b30-runtime-probe',
      source: 'executed-local-keycloak-public-endpoints',
      synthetic: false,
    },
    tokenMaterial: {
      tokenEndpointCalled: false,
      tokensCollected: false,
      jwtCreated: false,
      passwordsCollected: false,
    },
    provider: {
      provider: oidc.provider,
      baseUrl: oidc.baseUrl,
      realm: oidc.realm,
      issuer: discovery.issuer,
      discovery: oidc.endpoints.discovery,
      jwks: { uri: discovery.jwks_uri, signingKeyCount: signingKeys.length },
      audience: oidc.audience,
    },
    clients: clientEvidence,
    checks,
  };
  const validation = validateB30RuntimeEvidence(evidence, clients.map((client) => client.clientId));
  if (validation.result !== 'PASS') throw new Error(validation.errors.join('; '));
  return evidence;
}

function evidencePathFromEnv(root) {
  const value = process.env.B30_RUNTIME_EVIDENCE_FILE?.trim();
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.resolve(root, value);
}

function isMainModule() {
  return process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
}

if (isMainModule()) {
  try {
    const inputs = readB30Inputs(repositoryRoot);
    const staticResult = validateB30LocalOidc(inputs);
    if (staticResult.result !== 'PASS') throw new Error(`B30 static contract failed: ${staticResult.errors.join('; ')}`);
    const evidence = await runProbe(inputs);
    const outputPath = evidencePathFromEnv(repositoryRoot);
    if (outputPath) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    }
    console.log(JSON.stringify({ status: 'PASS', runId: evidence.runId, clientCount: evidence.clients.length, checks: evidence.checks.length, evidencePath: outputPath ? path.relative(repositoryRoot, outputPath) : null, tokenEndpointCalled: evidence.tokenMaterial.tokenEndpointCalled }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ status: 'FAIL', error: error instanceof Error ? error.message : String(error), tokenEndpointCalled: false }, null, 2));
    process.exitCode = 1;
  }
}
