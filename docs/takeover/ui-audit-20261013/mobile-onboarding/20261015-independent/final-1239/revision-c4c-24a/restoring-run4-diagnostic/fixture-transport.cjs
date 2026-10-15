// Formal H5 onboarding: fully intercepted synthetic server facts only.
// Never inspect auth storage, cookies, tokens, request body/header or credentials.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = process.cwd(), BASE = 'http://127.0.0.1:18183';
const OUT = path.resolve(ROOT, process.env.UI_AUDIT_OUTPUT || '.git/codex-local-backups/onboarding-' + Date.now());
const GROUP = process.env.UI_AUDIT_GROUP || 'all';
fs.mkdirSync(OUT, { recursive: true });
const sources = ['apps/mobile/src/pages/onboarding/onboarding.vue', 'packages/i18n/src/mobile-experience.ts', 'apps/mobile/src/api/learner-content.ts', 'apps/mobile/src/stores/session.ts', 'apps/mobile/src/auth/gateway-auth.ts', 'apps/mobile/src/domain/onboarding-resume.ts', 'apps/mobile/src/stores/learner-content.ts', 'apps/mobile/src/platform/pointer-feedback.ts', 'apps/mobile/tests/ui-onboarding.e2e.cjs'];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex');
const report = { at: new Date().toISOString(), scope: 'MB004_FORMAL_H5_SYNTHETIC_UI_ONLY', group: GROUP, browserPlugin: 'Browser plugin not available; Playwright Chromium', sourceHashes: Object.fromEntries(sources.map(file => [file, hash(file)])), checks: [], matrix: [], pageErrors: [], consoleErrors: [], fixtureRequests: [] };
const save = () => fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(report, null, 2));
let browser;
const releases = new Set();
const titles = { 'zh-CN': { gate: '确认成人身份', consent: '查看同意事项', goal: '选择学习目标', assessment: '设置已完成' }, 'en-US': { gate: 'Confirm adult eligibility', consent: 'Review consent status', goal: 'Choose your learning goal', assessment: 'Your setup is saved' } };
const purposes = ['ACCOUNT_TERMS', 'PRIVACY_NOTICE', 'ADULT_LEARNING_ELIGIBILITY'];
const record = (type, purpose, required = true) => ({ type, purpose, required, document: { version: 'recorded-fixture-v1', digest: 'synthetic-document-digest', publishedAt: '2026-10-01T00:00:00Z' }, state: 'GRANTED', provenance: { authority: 'IAM_SERVER_RECORDED_CONSENT', recordedAt: '2026-10-02T00:00:00Z', documentSource: 'PUBLISHED_DOCUMENT_VERSION_AND_DIGEST', policySource: 'IAM_ACTIVE_POLICY_CONTROL_PLANE' }, policyRef: 'synthetic-policy-reference', policyVersion: 'fixture-policy-v1', decisionRef: 'synthetic-decision-reference' });
async function open(mode = 'gate', width = 390, locale = 'zh-CN', theme = 'light', height = 844) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  const state = { adult: mode === 'gate' ? 'REQUIRED' : 'PASSED', access: mode === 'gate' ? 'RESTRICTED' : 'ELIGIBLE', accepted: ['goal', 'assessment', 'unreadable'].includes(mode), target: mode === 'assessment' ? { goalCode: 'FOUNDATION', dailyQuotaMinutes: 15, targetLevel: 'A1', status: 'ACTIVE', stateVersion: 0 } : null, hold: null, release: null, adultResponse: 'PASSED', adultAccess: 'ELIGIBLE', adultStatus: 200, targetStatus: 200, recordStatus: 200, records: mode === 'consent' ? [record('TERMS', purposes[0]), record('PRIVACY', purposes[1]), record('ADULT_LEARNING', purposes[2]), record('PRODUCT_ANALYTICS', 'PRODUCT_ANALYTICS', false)] : [], unreadable: mode === 'unreadable', expectedTarget: null, counts: { adult: 0, targetPut: 0, consentPut: 0, preferencePatch: 0, recordGet: 0 } };
  function principal() {
    const permissions = state.accepted && state.adult === 'PASSED' && state.access === 'ELIGIBLE' ? ['learning.plan.read', 'learner.target.read', 'learner.profile.read', 'learner.preference.read'] : [];
    return { principal: { subject: 'ui-onboarding-synthetic', permissions, roles: [], adultGate: state.adult }, adultGate: { status: state.adult, learningAccess: state.access }, learningAccess: state.access, permissions, consentState: { accepted: state.accepted, unsatisfiedPurposes: state.accepted ? [] : purposes, requiredPurposes: purposes, version: 'summary-not-a-published-catalog', learningAccess: state.accepted ? 'ELIGIBLE' : 'RESTRICTED' } };
  }
  await context.route('**/*', route => { const url = new URL(route.request().url()); return url.hostname === '127.0.0.1' && url.port === '18183' ? route.continue() : route.abort(); });
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), p = url.pathname, method = request.method();
    report.fixtureRequests.push({ mode, method, origin: url.origin, path: p });
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true' };
    if (method === 'OPTIONS') { await route.fulfill({ status: 204, headers, body: '' }); return; }
    if (p === '/api/v1/iam/adult-gate') state.counts.adult++;
    if (p === '/api/v1/auth/token/refresh') state.counts.refresh = (state.counts.refresh || 0) + 1;
    if (p === '/api/v1/learner/targets' && method === 'GET') state.counts.targetGet = (state.counts.targetGet || 0) + 1;
    if (p === '/api/v1/learner/targets' && method === 'PUT') state.counts.targetPut++;
    if (p === '/api/v1/iam/consents' && method === 'PUT') state.counts.consentPut++;
    if (state.hold === p) await new Promise(resolve => { state.release = resolve; releases.add(resolve); });
    let status = 200, data = {};
    if (p === '/api/v1/auth/token/refresh' && state.refreshFailure) { status = 401; data = { code: 'INVALID_REFRESH_TOKEN' }; }
    else if (p === '/api/v1/auth/login' || p === '/api/v1/auth/token/refresh') data = { accessToken: 'ui-synthetic-not-a-valid-credential', adultGate: { status: state.adult, learningAccess: state.access } };
    else if (p === '/api/v1/iam/permissions' || p === '/api/v1/iam/principal/me') data = principal();
    else if (p === '/api/v1/iam/adult-gate') {
      status = state.adultStatus;
      if (status < 400) { state.adult = state.adultResponse; state.access = state.adultAccess; data = { ...principal(), status: state.adultResponse, learningAccess: state.access }; }
      else data = { code: 'SERVICE_UNAVAILABLE' };
    } else if (p === '/api/v1/iam/consents') {
      if (method === 'PUT') { status = 409; data = { code: 'UNEXPECTED_CONSENT_SIGNING' }; }
      else { state.counts.recordGet++; status = state.recordStatus; data = { items: state.records }; }
    } else if (p === '/api/v1/learner/targets') {
      if (method === 'PUT') { status = state.targetStatus; if (status < 400) state.target = { ...state.expectedTarget, stateVersion: 1 }; }
      else if (state.unreadable) status = 503;
      else if (!state.target) status = 404;
      data = state.target || { code: status === 503 ? 'SERVICE_UNAVAILABLE' : 'NOT_FOUND' };
      if (state.readbackMismatch && method === 'GET' && state.counts.targetPut > 0 && state.target) data = { ...state.target, dailyQuotaMinutes: 15 };
      if (method === 'GET' && state.targetClaimsStale && (!state.counts.refresh || state.targetClaimsStale === 'persistent')) { status = 403; data = { code: 'CONSENT_REQUIRED' }; }
    } else if (p === '/api/v1/learner/preferences') {
      if (method === 'PATCH') state.counts.preferencePatch++;
      data = { uiLocale: locale, contentLocale: 'es-ES', timezone: 'Asia/Shanghai', themeMode: theme === 'dark' ? 'DARK' : 'LIGHT', highContrast: theme === 'high-contrast', motionMode: 'REDUCED', stateVersion: 0 };
    } else if (p === '/api/v1/learner/profile') data = { stateVersion: 0 };
    else if (p === '/api/v1/auth/logout') data = { success: true };
    else if (p.includes('/plan')) data = { items: [], planVersion: 0 };
    await route.fulfill({ status, headers, body: JSON.stringify(data) });
  });
  const page = await context.newPage(); await page.addInitScript(() => {window.__independentRejections=[];window.addEventListener('unhandledrejection', event => {const r=event.reason;window.__independentRejections.push({route:location.hash.split('?')[0],kind:typeof r,name:typeof r?.name==='string'?r.name:null,message:typeof r?.message==='string'?r.message:null,errMsg:typeof r?.errMsg==='string'?r.errMsg:null})})});
  page.on('pageerror', error => report.pageErrors.push({scenario:report.currentScenario,route:new URL(page.url()).hash.split('?')[0],name:error.name,message:error.message,stack:error.stack}));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  await page.goto(`${BASE}/#/pages/login/login?theme=${theme}&uiLocale=${locale}&returnTo=%2Fpages%2Fonboarding%2Fonboarding`, { waitUntil: 'networkidle' });
  await page.locator('#mobile-login-identifier').fill('ui-onboarding-synthetic'); await page.locator('#mobile-login-password').fill('SyntheticOnly123'); await page.locator('.login-submit').click();
  await page.waitForURL(url => url.hash.startsWith('#/pages/onboarding/onboarding'));
  await page.waitForFunction(expected => {
    let component = document.querySelector('.yx-onboarding')?.__vueParentComponent;
    while (component && !('step' in component.setupState)) component = component.parent;
    return component && component.setupState.step === expected && !component.setupState.busy;
  }, mode === 'unreadable' ? 'goal' : mode);
  return { context, page, state, hold: p => { state.hold = p; }, release: () => { state.hold = null; if (state.release) { releases.delete(state.release); state.release(); state.release = null; } } };
}

module.exports = { open, report, save, releases, init: async () => { browser = await chromium.launch() }, close: async () => { for(const r of releases)r(); await browser?.close() } };


