import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const iam = 'https://127.0.0.1:18087';
const learner = 'http://127.0.0.1:18088';
const out = [];
const failures = [];

function note(name, value) {
  out.push({ name, ...value });
  const status = value.status ?? '';
  const extra = value.detail ? ' ' + JSON.stringify(value.detail) : '';
  console.log(`${name} ${status}${extra}`);
}

function expect(name, ok, detail) {
  if (!ok) failures.push({ name, detail });
}

async function call(method, url, { token, body, idem } = {}) {
  const headers = { accept: 'application/json', 'x-auth-transport': 'WEB_COOKIE' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = 'Bearer ' + token;
  if (idem) headers['idempotency-key'] = idem;
  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { status: res.status, json, text: text.slice(0, 700) };
}

function claims(token) {
  const part = token.split('.')[1];
  const padded = part.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((part.length + 3) % 4);
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

function effect(response) {
  return response.json?.data?.withdrawalEffect ?? null;
}

const DIGEST = {
  TERMS: 'eb74b7254589589f61f5f3747d83379bc6f1e950ab7d8fd52f64f3ab50fb39fb',
  PRIVACY: '4ab15e31c11c9ef99b267ae620910420fdb8a9b6f720b988afeb59d5262ddd84',
  ADULT_LEARNING: '9702cd4fe3e50613f84030998f65c0c8e7961f058176b24f8a9e82006abea189',
  PRODUCT_ANALYTICS: '5fccd02376d4426e18b36ffb43743e33a844d37d5fb92e505801b5095f56f6f7',
};

async function registerAndGrant(label) {
  const password = randomUUID().replaceAll('-', '') + 'Aa1';
  const identifier = `${label}-${randomUUID().slice(0, 8)}@example.invalid`;
  const device = {
    deviceId: randomUUID(),
    deviceType: 'WEB',
    deviceName: label,
    osVersion: 'test',
    clientVersion: 'r1-009',
  };
  const creds = { identifier, password, device };
  const registered = await call('POST', iam + '/api/v1/auth/register', {
    body: creds, idem: randomUUID(),
  });
  note(label + '.register', { status: registered.status, detail: registered.json?.error ?? registered.json?.data?.sessionId ?? registered.text });
  expect(label + '.register', registered.status === 201, registered.text);
  let token = registered.json?.data?.accessToken;
  if (!token) throw new Error(label + ' register missing access token');
  const adult = await call('POST', iam + '/api/v1/iam/adult-gate', {
    token, idem: randomUUID(),
    body: { confirmed: true, birthYear: 1990, policyVersion: 'b30-adult-v1' },
  });
  note(label + '.adult', { status: adult.status, detail: adult.json?.data ?? adult.text });
  expect(label + '.adult', adult.status === 200, adult.text);
  for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING', 'PRODUCT_ANALYTICS']) {
    const accepted = await call('PUT', iam + '/api/v1/iam/consents', {
      token, idem: randomUUID(),
      body: {
        type, version: 'b30-consent-v1', decision: 'ACCEPTED',
        expectedDocumentDigest: DIGEST[type],
      },
    });
    note(label + '.accept.' + type, {
      status: accepted.status,
      detail: accepted.json?.data?.decision ?? accepted.text,
    });
    expect(label + '.accept.' + type, accepted.status === 200 && accepted.json?.data?.decision === 'ACCEPTED', accepted.text);
  }
  const login = await call('POST', iam + '/api/v1/auth/login', { body: creds, idem: randomUUID() });
  note(label + '.login', { status: login.status });
  expect(label + '.login', login.status === 200, login.text);
  token = login.json?.data?.accessToken;
  if (!token) throw new Error(label + ' login missing access token');
  const fact = claims(token);
  note(label + '.claims', {
    detail: {
      consent_state: fact.consent_state,
      adult_gate: fact.adult_gate,
      token_type: fact.token_type,
      sub: fact.sub,
    },
  });
  expect(label + '.claims', fact.consent_state === 'GRANTED' && fact.adult_gate === 'PASSED', fact.consent_state);
  return { token, principalId: fact.sub, password, identifier, device };
}

const primary = await registerAndGrant('primary');
writeFileSync('/tmp/r1-009-runtime/primary-token', primary.token, { mode: 0o600 });
writeFileSync('/tmp/r1-009-runtime/primary-id', primary.principalId, { mode: 0o600 });

async function learning(name, token) {
  const profile = await call('GET', learner + '/api/v1/learner/profile', { token });
  const options = await call('GET', learner + '/internal/v1/learner/onboarding/options', { token });
  const b25 = await call('GET', learner + '/internal/v1/learner/profile', { token });
  const write = await call('PUT', learner + '/internal/v1/learner/targets', {
    token, idem: randomUUID(),
    body: { goalCode: 'EXAM', targetLevel: 'B1', dailyQuotaMinutes: 15 },
  });
  note(name + '.public-profile', { status: profile.status, detail: codeOf(profile) });
  note(name + '.b25-options', { status: options.status, detail: codeOf(options) });
  note(name + '.b25-profile', { status: b25.status, detail: codeOf(b25) });
  note(name + '.b25-targets', { status: write.status, detail: codeOf(write) });
  return { profile, options, b25, write };
}

function codeOf(response) {
  return response.json?.error?.code
    ?? response.json?.code
    ?? response.json?.error
    ?? response.json?.detail
    ?? response.json?.message
    ?? (response.json?.data ? 'has-data' : response.text.slice(0, 180));
}

const before = await learning('before', primary.token);
expect('before.public-profile', before.profile.status === 200, before.profile.text);
expect('before.b25-options', before.options.status === 200, before.options.text);
expect('before.b25-profile', before.b25.status === 200, before.b25.text);
expect('before.b25-targets', before.write.status === 200, before.write.text);

const privacyBefore = await call('POST', learner + '/internal/v1/learner/privacy/export', {
  token: primary.token, idem: randomUUID(), body: { policyName: 'learner-self' },
});
note('before.privacy-export', { status: privacyBefore.status, detail: codeOf(privacyBefore) });
expect('before.privacy-export', privacyBefore.status === 200, privacyBefore.text);

const meBefore = await call('GET', iam + '/api/v1/iam/principal/me', { token: primary.token });
note('before.principal-me', { status: meBefore.status, detail: meBefore.json?.data?.status ?? codeOf(meBefore) });
expect('before.principal-me', meBefore.status === 200, meBefore.text);

const analytics = await call('PUT', iam + '/api/v1/iam/consents', {
  token: primary.token, idem: randomUUID(),
  body: {
    type: 'PRODUCT_ANALYTICS', version: 'b30-consent-v1', decision: 'WITHDRAWN',
    expectedDocumentDigest: DIGEST.PRODUCT_ANALYTICS,
  },
});
note('withdraw.analytics', { status: analytics.status, detail: effect(analytics) });
expect('withdraw.analytics.status', analytics.status === 200, analytics.text);
expect('withdraw.analytics.effect', effect(analytics)?.effect === 'RESTRICT_PROTECTED_CAPABILITY', effect(analytics));
expect('withdraw.analytics.affected', Array.isArray(effect(analytics)?.affectedCapabilities)
  && effect(analytics).affectedCapabilities.length === 0, effect(analytics));
expect('withdraw.analytics.session', effect(analytics)?.sessionEffect === 'UNCHANGED', effect(analytics));
expect('withdraw.analytics.account', effect(analytics)?.accountEffect === 'RETAINED', effect(analytics));
expect('withdraw.analytics.history', effect(analytics)?.historyEffect === 'RETAINED', effect(analytics));

const afterAnalytics = await learning('after-analytics', primary.token);
expect('after-analytics.public-profile', afterAnalytics.profile.status === 200, afterAnalytics.profile.text);

const adult = await call('PUT', iam + '/api/v1/iam/consents', {
  token: primary.token, idem: randomUUID(),
  body: {
    type: 'ADULT_LEARNING', version: 'b30-consent-v1', decision: 'WITHDRAWN',
    expectedDocumentDigest: DIGEST.ADULT_LEARNING,
  },
});
note('withdraw.adult', { status: adult.status, detail: effect(adult) });
expect('withdraw.adult.status', adult.status === 200, adult.text);
const adultEffect = effect(adult);
expect('withdraw.adult.effect', adultEffect?.effect === 'RESTRICT_ALL_LEARNING_ACCESS', adultEffect);
expect('withdraw.adult.affected', JSON.stringify(adultEffect?.affectedCapabilities) === '["LEARNING"]', adultEffect);
expect('withdraw.adult.session', adultEffect?.sessionEffect === 'REVOKE_ALL_SESSIONS', adultEffect);
expect('withdraw.adult.account', adultEffect?.accountEffect === 'RETAINED', adultEffect);
expect('withdraw.adult.history', adultEffect?.historyEffect === 'RETAINED', adultEffect);
expect('withdraw.adult.cache', adultEffect?.cacheInvalidationRequired === true, adultEffect);

const after = await learning('after-adult', primary.token);
for (const [key, response] of Object.entries(after)) {
  expect('after-adult.' + key + '.403', response.status === 403, response.text);
  expect('after-adult.' + key + '.not401', response.status !== 401, response.status);
}
expect('after-adult.public.consent-required', codeOf(after.profile) === 'CONSENT_REQUIRED', after.profile.text);

const privacyAfter = await call('POST', learner + '/internal/v1/learner/privacy/export', {
  token: primary.token, idem: randomUUID(), body: { policyName: 'learner-self' },
});
note('after.privacy-export', { status: privacyAfter.status, detail: codeOf(privacyAfter) });
expect('after.privacy-not-403', privacyAfter.status !== 403, privacyAfter.text);
expect('after.privacy-ok', privacyAfter.status === 200, privacyAfter.text);

const meAfter = await call('GET', iam + '/api/v1/iam/principal/me', { token: primary.token });
note('after.principal-me', { status: meAfter.status, detail: codeOf(meAfter) });

const userOnFact = await call('GET', iam + '/internal/v1/iam/principals/' + primary.principalId + '/learning-consent', {
  token: primary.token,
});
note('fact.user-token', { status: userOnFact.status, detail: codeOf(userOnFact) });
expect('fact.user-token-403', userOnFact.status === 403, userOnFact.text);

const service = await call('POST', iam + '/internal/v1/iam/service-token', {
  body: { clientId: 'learner-service', clientSecret: process.env.R1_CLIENT_SECRET },
});
note('fact.service-token', { status: service.status, detail: service.json?.permissions ?? service.text });
expect('fact.service-token', service.status === 200, service.text);
const fact = await call('GET', iam + '/internal/v1/iam/principals/' + primary.principalId + '/learning-consent', {
  token: service.json?.accessToken,
});
note('fact.after-withdraw', { status: fact.status, detail: fact.json?.data ?? fact.text });
expect('fact.after-withdraw', fact.status === 200
  && fact.json?.data?.learningConsent === 'WITHDRAWN'
  && fact.json?.data?.learningAccess === 'RESTRICTED'
  && fact.json?.data?.principalId === primary.principalId, fact.text);

const second = await registerAndGrant('second');
writeFileSync('/tmp/r1-009-runtime/second-token', second.token, { mode: 0o600 });
writeFileSync('/tmp/r1-009-runtime/second-id', second.principalId, { mode: 0o600 });
const secondBefore = await call('GET', learner + '/api/v1/learner/profile', { token: second.token });
note('second.before-iam-stop', { status: secondBefore.status, detail: codeOf(secondBefore) });
expect('second.before-iam-stop', secondBefore.status === 200, secondBefore.text);
const secondMe = await call('GET', iam + '/api/v1/iam/principal/me', { token: second.token });
note('second.principal-me', { status: secondMe.status, detail: secondMe.json?.data?.status ?? codeOf(secondMe) });
expect('second.principal-me', secondMe.status === 200, secondMe.text);

writeFileSync('/tmp/r1-009-runtime/http-result.json', JSON.stringify({ failures, out }, null, 2));
if (failures.length) {
  console.log('HTTP_ASSERTIONS_FAILED ' + failures.length);
  process.exitCode = 1;
} else {
  console.log('HTTP_ASSERTIONS_OK');
}
