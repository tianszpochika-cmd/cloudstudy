import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('all four frontend projects enter through the Gateway and keep login/session seams separate', () => {
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

test('learner and admin session restore/refresh/revoke use server responses, not client roles', () => {
  const learner = read('apps/learner-web/src/stores/session.ts');
  const learnerClient = read('apps/learner-web/src/api/client.ts');
  const admin = read('apps/admin-web/src/stores/admin.ts');
  const adminClient = read('apps/admin-web/src/api/client.ts');
  for (const source of [learner, admin]) {
    assert.match(source, /restore/);
    assert.match(source, /refreshSilently/);
    assert.match(source, /logout|revoke/);
  }
  assert.match(learnerClient, /onUnauthorized/);
  assert.match(adminClient, /refreshSilently/);
  assert.match(adminClient, /forbiddenHeaderNames/);
  assert.match(adminClient, /x-b5-role/);
  assert.doesNotMatch(admin, /sessionStorage\.setItem\(['"]englishflow\.admin\.role/);
});

test('frontend auth adapters use canonical B8 IAM routes and only leave legacy aliases at the Gateway', () => {
  const adapters = [
    read('apps/learner-web/src/auth/gateway-auth.ts'),
    read('apps/admin-web/src/auth/gateway-auth.ts'),
    read('apps/mobile/src/auth/gateway-auth.ts'),
  ];
  for (const source of adapters) {
    assert.match(source, /authorization\/start/);
    assert.match(source, /OIDC_PROVIDER/);
    assert.match(source, /callback/);
    assert.match(source, /iam\/principal\/me/);
    assert.match(source, /iam\/permissions/);
    assert.match(source, /iam\/session\/refresh/);
    assert.match(source, /iam\/session\/logout/);
    assert.doesNotMatch(source, /['"]\/auth\/refresh|['"]\/auth\/logout|['"]\/iam\/session['"]/);
    assert.doesNotMatch(source, /codeVerifier|codeChallenge|nonce/);
  }
});

test('mobile keeps refresh credentials out of ordinary storage and supports callback restoration', () => {
  const session = read('apps/mobile/src/stores/session.ts');
  const runtime = read('apps/mobile/src/platform/uni-runtime.ts');
  assert.match(session, /getSecureStorage/);
  assert.match(session, /setItem\(REFRESH_TOKEN_KEY/);
  assert.match(session, /removeStorageSync\(['"]yx\.session\.refresh-token/);
  assert.match(session, /readLaunchCallback/);
  assert.match(runtime, /secure|Secure/i);
});

test('frontend routes expose explicit callback/forbidden states and reuse locale/theme context', () => {
  const learnerRouter = read('apps/learner-web/src/router/index.ts');
  const adminRouter = read('apps/admin-web/src/router/index.ts');
  const learnerAuth = read('apps/learner-web/src/auth/gateway-auth.ts');
  const adminAuth = read('apps/admin-web/src/auth/gateway-auth.ts');
  const official = read('apps/official-site/utils/public-links.mjs');
  for (const source of [learnerRouter, adminRouter]) {
    assert.match(source, /auth\/callback|forbidden/);
    assert.match(source, /requiresAuth|permission/);
  }
  for (const source of [learnerAuth, adminAuth, official]) {
    assert.match(source, /uiLocale/);
    assert.match(source, /theme/);
  }
});

test('official site only builds a controlled public login link and does not own business session state', () => {
  const source = read('apps/official-site/utils/public-links.mjs');
  assert.match(source, /standard-oidc\/authorization\/start/);
  assert.match(source, /redirectUri/);
  assert.match(source, /safePublicReturnTo/);
  assert.match(source, /controlled absolute learner callback/);
  assert.doesNotMatch(source, /sessionStorage|localStorage|refreshToken|Authorization/);
});
