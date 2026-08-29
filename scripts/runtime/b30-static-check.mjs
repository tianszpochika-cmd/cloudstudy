import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readText(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

export function readB30Inputs(root = repositoryRoot) {
  return {
    root,
    jwt: readJson(root, 'config/local-jwt-auth.json'),
    ports: readJson(root, 'config/local-ports.json'),
    b23: readJson(root, 'config/b23-auth-runtime.json'),
  };
}

function check(checks, errors, id, condition, detail) {
  checks.push({ id, status: condition ? 'PASS' : 'FAIL', detail });
  if (!condition) errors.push(`${id}: ${detail}`);
}

function hasAll(values, required) {
  return required.every((value) => values?.includes(value));
}

export function validateB30LocalJwt(inputs) {
  const { jwt, ports, b23, root } = inputs;
  const checks = [];
  const errors = [];
  const gateway = ports.services?.['api-gateway'];
  const iam = ports.services?.['iam-service'];
  const requiredClaims = ['iss', 'sub', 'aud', 'exp', 'iat', 'nbf', 'jti', 'token_type', 'scope', 'roles', 'permissions', 'tenant_id', 'session_id'];

  check(checks, errors, 'self-owned-mode', jwt.mode === 'self-owned-jwt' && b23.authentication?.mode === 'self-owned-jwt', 'all runtime manifests must select the platform-owned JWT authentication center');
  check(checks, errors, 'fixed-loopback-ports', gateway?.port === 18070 && iam?.port === 18087, 'Gateway and IAM must use fixed loopback ports 18070 and 18087');
  check(checks, errors, 'issuer-jwks-audience', jwt.issuer === 'http://127.0.0.1:18087' && jwt.jwksUri === 'http://127.0.0.1:18087/api/v1/auth/jwks' && jwt.audience === 'yuxuexing-api', 'issuer, JWKS and audience must use the canonical IAM values');
  check(checks, errors, 'rs256-access-token', jwt.algorithm === 'RS256' && jwt.accessToken?.tokenType === 'access', 'access tokens must be short-lived RS256 bearer JWTs');
  check(checks, errors, 'required-claims', hasAll(jwt.accessToken?.requiredClaims, requiredClaims) && hasAll(b23.authentication?.requiredClaims, requiredClaims), 'JWT claims must include identity, time, token-type, authority and session facts');
  check(checks, errors, 'canonical-endpoints', jwt.tokenEndpoint === '/api/v1/auth/login' && jwt.refreshEndpoint === '/api/v1/auth/token/refresh' && jwt.logoutEndpoint === '/api/v1/auth/logout' && jwt.revokeEndpoint.includes('/sessions/'), 'login, refresh, logout and session revoke endpoints must be explicit');
  check(checks, errors, 'refresh-replay-policy', jwt.refreshToken?.rotation === 'every-use' && jwt.refreshToken?.replay.includes('revoke'), 'refresh tokens must rotate on every use and revoke the family on replay');
  check(checks, errors, 'secure-storage-policy', jwt.clients?.['learner-web']?.accessTokenStorage === 'memory' && jwt.clients?.['admin-web']?.accessTokenStorage === 'memory' && jwt.clients?.mobile?.refreshTokenStorage === 'Keychain-or-Keystore' && jwt.clients?.['official-site']?.storesBusinessToken === false, 'four-client storage boundaries must be explicit');
  check(checks, errors, 'password-security', jwt.security?.passwordHash?.includes('bcrypt') && jwt.security?.failedLoginLockout && jwt.security?.resetToken?.includes('one-time'), 'password hashing, lockout and password reset must be configured');
  check(checks, errors, 'private-key-boundary', jwt.security?.productionPrivateKey === 'secret-manager-or-mounted-secret-only' && !/BEGIN .*PRIVATE KEY|password\s*:/i.test(readText(root, 'config/local-jwt-auth.json')), 'private signing material must remain outside repository and ordinary logs');
  check(checks, errors, 'no-browser-callback', b23.authentication?.noBrowserCallback === true && !fs.existsSync(path.join(root, 'apps/learner-web/src/pages/AuthCallbackPage.vue')) && !fs.existsSync(path.join(root, 'apps/mobile/src/pages/auth-callback/auth-callback.vue')), 'frontends must not expose authorization callback pages');

  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    staticStatus: errors.length === 0 ? 'PASS' : 'FAIL',
    checks,
    errors,
    summary: { passed: checks.filter((item) => item.status === 'PASS').length, total: checks.length },
  };
}

function isMainModule() {
  return process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
}

if (isMainModule()) {
  const result = validateB30LocalJwt(readB30Inputs());
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.result === 'PASS' ? 0 : 1;
}
