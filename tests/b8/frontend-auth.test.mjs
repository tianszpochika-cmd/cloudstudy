import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('all four frontend projects use the Gateway and share the platform login seam', () => {
  const files = [
    'apps/learner-web/src/auth/gateway-auth.ts',
    'apps/admin-web/src/auth/gateway-auth.ts',
    'apps/mobile/src/auth/gateway-auth.ts',
    'apps/official-site/utils/public-links.mjs',
  ];
  for (const file of files) {
    const source = read(file);
    assert.match(source, /18070|VITE_GATEWAY_BASE_URL|Gateway/i, file);
    assert.doesNotMatch(source, /18080|core-api/i, file);
  }
});

test('learner and admin use account-password login, memory Access Tokens and server responses', () => {
  const adapters = [
    read('apps/learner-web/src/auth/gateway-auth.ts'),
    read('apps/admin-web/src/auth/gateway-auth.ts'),
  ];
  for (const source of adapters) {
    assert.match(source, /auth\/login/);
    assert.match(source, /identifier/);
    assert.match(source, /password/);
    assert.match(source, /auth\/token\/refresh/);
    assert.match(source, /logout|revoke/);
    assert.doesNotMatch(source, /sessionStorage\.setItem\([^\n]*(token|access|refresh)/i);
    assert.doesNotMatch(source, /localStorage\.setItem\([^\n]*(token|access|refresh)/i);
    assert.doesNotMatch(source, /x-(?:b5-)?role|x-(?:tenant|owner|permission)(?:-|\b)/i);
  }
  for (const source of [read('apps/learner-web/src/stores/session.ts'), read('apps/admin-web/src/stores/admin.ts')]) {
    assert.match(source, /login\(/);
    assert.match(source, /password/);
    assert.match(source, /refreshSilently/);
    assert.match(source, /logout|revoke/);
    assert.doesNotMatch(source, /sessionStorage\.setItem\([^\n]*(token|access|refresh)/i);
    assert.doesNotMatch(source, /localStorage\.setItem\([^\n]*(token|access|refresh)/i);
  }
  assert.match(read('apps/learner-web/src/auth/access-token.ts'), /memory/i);
  assert.match(read('apps/admin-web/src/auth/access-token.ts'), /memory/i);
});

test('frontend auth adapters expose only the direct JWT routes', () => {
  const adapters = [
    read('apps/learner-web/src/auth/gateway-auth.ts'),
    read('apps/admin-web/src/auth/gateway-auth.ts'),
    read('apps/mobile/src/auth/gateway-auth.ts'),
  ];
  for (const source of adapters) {
    for (const route of ['auth/login', 'auth/token/refresh', 'auth/logout', 'iam/principal/me', 'iam/permissions']) {
      assert.match(source, new RegExp(route.replaceAll('/', '\\/')));
    }
    assert.doesNotMatch(source, /Oidc|oidc|authorization\/start|auth\/callback|codeVerifier|codeChallenge|nonce|state/i);
  }
});

test('mobile keeps Refresh Tokens only in native secure storage and uses a bounded H5 cookie session', () => {
  const session = read('apps/mobile/src/stores/session.ts');
  const runtime = read('apps/mobile/src/platform/uni-runtime.ts');
  assert.match(session, /getSecureStorage/);
  assert.match(session, /secure\.setItem\(REFRESH_TOKEN_KEY/);
  assert.match(session, /REFRESH_TOKEN_KEY/);
  assert.match(session, /secure storage|secureStorage/i);
  assert.doesNotMatch(session, /setStorageSync\(['"]yx\.session\.refresh-token/);
  assert.match(runtime, /secure|Secure/i);
});

test('frontend routes expose explicit login and forbidden states and preserve locale/theme context', () => {
  const sources = [
    read('apps/learner-web/src/router/index.ts'),
    read('apps/admin-web/src/router/index.ts'),
    read('apps/learner-web/src/auth/gateway-auth.ts'),
    read('apps/admin-web/src/auth/gateway-auth.ts'),
    read('apps/mobile/src/auth/navigation.ts'),
    read('apps/official-site/utils/public-links.mjs'),
  ];
  for (const source of sources.slice(0, 2)) {
    assert.match(source, /login|forbidden/);
    assert.match(source, /requiresAuth|permission/);
    assert.doesNotMatch(source, /auth\/callback|callback/i);
  }
  assert.match(sources[5], /uiLocale|locale/i);
  assert.match(sources[5], /theme/i);
});

test('learner web and mobile submit passwords to the IAM TLS entry and keep the Gateway seam', () => {
  for (const app of ['learner-web', 'mobile']) {
    const gateway = read(`apps/${app}/src/platform/gateway.ts`);
    assert.match(gateway, /https:\/\/127\.0\.0\.1:18087\/api\/v1/);
    assert.match(gateway, /getIamAuthBaseUrl/);
    assert.match(gateway, /http:\/\/127\.0\.0\.1:18070\/api\/v1/);
  }
  const webAuth = read('apps/learner-web/src/auth/gateway-auth.ts');
  const webSession = read('apps/learner-web/src/stores/session.ts');
  assert.match(webSession, /getGatewayBaseUrl\(\)/);
  assert.match(webSession, /iamAuthBaseUrl: getIamAuthBaseUrl\(\)/);
  assert.match(webAuth, /passwordClient\.post\('\/auth\/login'/);
  assert.match(webAuth, /passwordClient\.post\('\/auth\/register'/);
  assert.match(webAuth, /passwordClient\.post\('\/auth\/password-reset\/request'/);
  assert.match(webAuth, /passwordClient\.post\('\/auth\/password-reset\/confirm'/);
  assert.match(webAuth, /client\.get\('\/iam\/principal\/me'/);
  const mobileAuth = read('apps/mobile/src/auth/gateway-auth.ts');
  const mobileClient = read('apps/mobile/src/api/client.ts');
  assert.match(mobileClient, /getGatewayBaseUrl\(\)/);
  assert.match(mobileClient, /getIamAuthBaseUrl\(\)/);
  assert.match(mobileClient, /mobileIamAuthClient/);
  assert.match(mobileAuth, /mobileIamAuthClient\.request\('\/auth\/login'/);
  assert.match(mobileAuth, /mobileApiClient\.request\('\/iam\/principal\/me'/);
  assert.doesNotMatch(mobileAuth, /fetch\(|new URL\(|VITE_GATEWAY_BASE_URL/);
});

test('official site creates only a controlled public login link and owns no business session state', () => {
  const source = read('apps/official-site/utils/public-links.mjs');
  assert.match(source, /buildLearnerLoginLink/);
  assert.match(source, /safePublicReturnTo/);
  assert.match(source, /business tokens?/i);
  assert.doesNotMatch(source, /sessionStorage|localStorage|refreshToken|Authorization/i);
});
