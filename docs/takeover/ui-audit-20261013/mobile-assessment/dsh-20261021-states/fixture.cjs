// TEST PREPARATION ONLY. Importing this module never starts a browser.
// Local copy of dsh-20261020-risk/fixture.cjs for the bounded STATES suite.
// The C5c-era risk fixture remains unchanged as history; this copy adds only:
//   1. `state.refreshStatus` so a planned 401 refresh is an explicit transport flag,
//   2. `state.skippedRead`/`skippedProjection()` to serve a canonical SKIPPED GET
//      after an actual start+reentry, with no reportId/score/grade/currentItem,
//   3. `report.skippedReads` audit metadata and `report.consoleWarnings`.
// It keeps the original strict known-API list, unknown-route 501, injectedFailures
// metadata, targetReads separation and console path-only resource classification.
// Real uni-app/login/guard, synthetic API transport. Never read cookies/storage,
// request bodies/headers/tokens, or replace component/store/guard behavior.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../../../../..');
const BASE = 'http://127.0.0.1:18183';
const sources = ['apps/mobile/src/pages/assessment/assessment.vue', 'packages/i18n/src/mobile-experience.ts', 'apps/mobile/src/api/learner-content.ts', 'apps/mobile/src/stores/learner-content.ts', 'apps/mobile/src/stores/session.ts', 'apps/mobile/src/auth/navigation.ts'];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(ROOT, file))).digest('hex');
const hashes = () => Object.fromEntries(sources.map(file => [file, hash(file)]));
const report = { scope: 'MB006_STATES_PREPARED_SYNTHETIC_TRANSPORT_NOT_RUN', browser: 'Playwright Chromium; DSH did not launch it', requests: [], targetReads: [], unexpected: [], injectedFailures: [], pageErrors: [], consoleErrors: [], consoleWarnings: [], skippedReads: [], unhandledRejections: [], windowErrors: [] };
const live = new Set();
let browser, frozenHashes = null, caseNumber = 0;
function frozen() { if (frozenHashes) assert.deepEqual(hashes(), frozenHashes, 'Frozen candidate sources changed'); }
function freeze(expected = hashes()) { frozenHashes = { ...expected }; frozen(); return frozenHashes; }
async function init() { frozen(); if (!browser) browser = await chromium.launch(); return browser; }
async function close() { for (const item of [...live]) await item.close(); await browser?.close(); browser = null; }
function statusOf(flag) { return typeof flag === 'number' ? flag : flag ? 503 : 200; }
function scrubText(value) {
  if (typeof value !== 'string') return null;
  // Keep diagnostics short and strip token/code/session query values; never
  // capture headers, cookies or response bodies.
  return value.replace(/([?&](?:token|access_token|refresh_token|authorization|code|session)=)[^&\s)]+/gi, '$1[redacted]').slice(0, 800);
}
function routeInfo(url) {
  try {
    const u = new URL(url); const route = u.hash.split('?')[0];
    const stage = route.includes('/settings/') ? 'settings' : route.includes('/assessment/') ? 'assessment' : route.includes('/login/') ? 'login' : route.includes('/onboarding/') ? 'onboarding' : 'other';
    return { pathname: u.pathname, route, stage };
  } catch { return { pathname: null, route: null, stage: null }; }
}

async function fresh(options = {}) {
  if (!browser) throw new Error('Call init() explicitly after quota and candidate hash freeze');
  frozen();
  const { locale = 'zh-CN', theme = 'light', width = 390, height = 844, colorScheme = 'light', hasTouch = false, readySelector = 'h1:visible,[role="heading"]:visible' } = options;
  const id = ++caseNumber;
  const context = await browser.newContext({ viewport: { width, height }, colorScheme, reducedMotion: 'reduce', hasTouch });
  const pending = new Set(), sessions = new Map();
  const state = { id, locale, theme, subject: `ui-mb006-risk-${id}`, adultGate: 'PASSED', access: 'ELIGIBLE', accepted: true, principalStatus: 200, principalDelay: 0, refreshStatus: 200, skippedRead: false, lastSkipped: null, generation: 0, activeSessionId: null, startError: false, responseError: false, retestError: false, ensureError: false, getError: false, responseDelay: 0, retestDelay: 0, getDelay: 0, counts: { login: 0, refresh: 0, logout: 0, principal: 0, start: 0, respond: 0, retest: 0, ensure: 0, GET: 0, placementGet: 0 } };
  const permissions = ['learning.plan.read', 'learner.target.read', 'learner.profile.read', 'learner.preference.read', 'assessment.placement.read', 'assessment.placement.start', 'assessment.placement.respond', 'assessment.placement.retest'];
  const principal = () => ({ principal: { subject: state.subject, permissions, roles: ['learner'], adultGate: state.adultGate }, adultGate: { status: state.adultGate, learningAccess: state.access }, learningAccess: state.access, permissions, consentState: { accepted: state.accepted, unsatisfiedPurposes: state.accepted ? [] : ['ACCOUNT_TERMS', 'PRIVACY_NOTICE', 'ADULT_LEARNING_ELIGIBILITY'], requiredPurposes: ['ACCOUNT_TERMS', 'PRIVACY_NOTICE', 'ADULT_LEARNING_ELIGIBILITY'], version: 'synthetic-summary-only' } });
  function newSession() {
    const session = { sessionId: `asess_ui_risk_${id}_${++state.generation}`, sequence: 0 };
    sessions.set(session.sessionId, session); state.activeSessionId = session.sessionId;
    return session;
  }
  function projection(session) {
    const n = session.sequence, sid = session.sessionId;
    if (n === 10) return { sessionId: sid, status: 'COMPLETED', stateVersion: 10, acceptedSequence: 10, nextSequence: null, manifest: { totalItemCount: 10 }, finalResult: { reportId: `prpt_ui_risk_${sid}`, sessionId: sid, resultKind: 'ASSESSED', referenceLevel: 'A2', aggregateScore: 70, summary: { fullCount: 7, zeroCount: 3, itemCount: 10 } }, outcome: 'ZERO' };
    return { sessionId: sid, status: 'IN_PROGRESS', stateVersion: n, acceptedSequence: n, nextSequence: n + 1, manifest: { totalItemCount: 10 }, currentItem: { itemId: 6100 + n + 1, itemSequence: n + 1, dimension: 'VOCABULARY', stem: n === 0 ? 'Choose the phrase that completes the sentence: I ___ every evening.' : `Synthetic item ${n + 1}: Choose the phrase that completes the sentence.`, timeLimitSec: 60, options: [{ optionId: 'A', text: 'read a book' }, { optionId: 'B', text: 'reads a book' }, { optionId: 'C', text: 'reading a book' }, { optionId: 'D', text: 'has read a book' }] }, ...(n > 0 ? { outcome: n <= 7 ? 'FULL' : 'ZERO' } : {}) };
  }
  function skippedProjection(session) {
    // Canonical historical SKIPPED read: status + finalResult SKIPPED, no reportId,
    // no score/grade/level and no currentItem. The existing API parse leaves report
    // null and the page's isSkipped branch renders the unverified copy.
    return {
      sessionId: session.sessionId,
      status: 'SKIPPED',
      stateVersion: 0,
      acceptedSequence: 0,
      nextSequence: null,
      manifest: { totalItemCount: 10 },
      currentItem: null,
      finalResult: { resultKind: 'SKIPPED' },
    };
  }
  async function delay(kind) {
    const setting = state[kind + 'Delay'];
    if (!setting) return;
    await new Promise(resolve => {
      let timer;
      const done = () => { clearTimeout(timer); pending.delete(entry); resolve(); };
      const entry = { kind, done }; pending.add(entry);
      if (typeof setting === 'number' && setting > 0) timer = setTimeout(done, setting);
    });
  }
  function release(kind = 'response') {
    state[kind + 'Delay'] = 0;
    for (const item of [...pending]) if (item.kind === kind) item.done();
  }
  function releaseAll() { for (const item of [...pending]) item.done(); }
  // Audit metadata only: which case deliberately received a non-2xx response,
  // and at which method/path/status. No body/header/token is recorded here.
  function injected(kind, method, p, status) {
    if (typeof status === 'number' && status >= 400) report.injectedFailures.push({ id, method, path: p, status, injection: kind });
  }
  await context.route('**/*', async route => {
    const q = route.request(), u = new URL(q.url()), p = u.pathname, method = q.method();
    if (!p.startsWith('/api/v1/')) return u.origin === BASE ? route.continue() : route.abort();
    report.requests.push({ id, locale, theme, origin: u.origin, method, path: p });
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true' };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers, body: '' });
    if (method === 'GET') state.counts.GET++;
    let status = 200, data;
    if (method === 'POST' && (p === '/api/v1/auth/login' || p === '/api/v1/auth/token/refresh')) {
      const isRefresh = p.endsWith('/token/refresh');
      state.counts[isRefresh ? 'refresh' : 'login']++;
      if (isRefresh) { status = statusOf(state.refreshStatus); injected('refreshStatus', method, p, status); }
      data = status < 400 ? { accessToken: 'synthetic-invalid-ui-fixture-only', adultGate: { status: state.adultGate, learningAccess: state.access } } : { code: 'SYNTHETIC_REFRESH_UNAVAILABLE' };
    } else if (method === 'POST' && p === '/api/v1/auth/logout') { state.counts.logout++; status = 204; }
    else if (method === 'GET' && (p === '/api/v1/iam/principal/me' || p === '/api/v1/iam/permissions')) { state.counts.principal++; if (state.principalDelay > 0) await new Promise(resolve => setTimeout(resolve, state.principalDelay)); status = state.principalStatus; injected('principalStatus', method, p, status); data = status < 400 ? principal() : { code: 'SYNTHETIC_PRINCIPAL_UNAVAILABLE' }; }
    else if (method === 'GET' && p === '/api/v1/learner/profile') data = { stateVersion: 0 };
    else if (method === 'GET' && p === '/api/v1/learner/targets') data = { goalCode: 'FOUNDATION', dailyQuotaMinutes: 15, targetLevel: 'A1', status: 'ACTIVE', stateVersion: 0 };
    else if (method === 'GET' && p === '/api/v1/learner/preferences') data = { uiLocale: locale, contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: theme === 'system' ? 'SYSTEM' : theme === 'dark' ? 'DARK' : 'LIGHT', highContrast: theme === 'high-contrast', motionMode: 'REDUCED', stateVersion: 0 };
    else if (method === 'POST' && p === '/api/v1/assessment/placement/sessions') { state.counts.start++; status = statusOf(state.startError); injected('startError', method, p, status); data = status < 400 ? projection(newSession()) : { code: 'SYNTHETIC_START_UNAVAILABLE' }; }
    else if (p.startsWith('/api/v1/assessment/placement/sessions/')) {
      const parts = p.slice('/api/v1/assessment/placement/sessions/'.length).split('/'), sid = decodeURIComponent(parts[0]), session = sessions.get(sid);
      if (!session) { status = 404; data = { code: 'SYNTHETIC_SESSION_NOT_FOUND' }; }
      else if (method === 'GET' && parts.length === 1) {
        state.counts.placementGet++;
        const snapshot = state.skippedRead ? skippedProjection(session) : projection(session);
        await delay('get'); status = statusOf(state.getError); injected('getError', method, p, status);
        if (status < 400 && state.skippedRead) {
          state.lastSkipped = { sessionId: sid, status: snapshot.status, resultKind: snapshot.finalResult.resultKind, hasCurrentItem: snapshot.currentItem !== null, hasReportId: Object.prototype.hasOwnProperty.call(snapshot, 'reportId') || Object.prototype.hasOwnProperty.call(snapshot.finalResult, 'reportId') };
          report.skippedReads.push({ id, ...state.lastSkipped });
        }
        data = status < 400 ? snapshot : { code: 'SYNTHETIC_CHECKPOINT_UNAVAILABLE' };
      }
      else if (method === 'POST' && parts.length === 2 && parts[1] === 'responses') {
        state.counts.respond++; await delay('response'); status = statusOf(state.responseError); injected('responseError', method, p, status);
        if (status < 400 && session.sequence < 10) { session.sequence++; data = projection(session); }
        else if (status < 400) { status = 409; data = { code: 'SYNTHETIC_ALREADY_COMPLETE' }; }
        else data = { code: 'SYNTHETIC_RESPONSE_UNAVAILABLE' };
      } else if (method === 'POST' && parts.length === 2 && parts[1] === 'retest') {
        state.counts.retest++; await delay('retest'); status = statusOf(state.retestError); injected('retestError', method, p, status);
        if (status < 400 && session.sequence === 10) data = projection(newSession());
        else if (status < 400) { status = 409; data = { code: 'SYNTHETIC_REPORT_REQUIRED' }; }
        else data = { code: 'SYNTHETIC_RETEST_UNAVAILABLE' };
      } else { status = 501; data = { code: 'UNEXPECTED_SYNTHETIC_ROUTE' }; report.unexpected.push({ id, method, path: p }); }
    } else if (method === 'POST' && p === '/api/v1/learning/plans:ensure') { state.counts.ensure++; status = statusOf(state.ensureError); injected('ensureError', method, p, status); data = status < 400 ? { planId: `plan_ui_risk_${id}`, planVersion: 1, stateVersion: 1 } : { code: 'SYNTHETIC_PLAN_ENSURE_UNAVAILABLE' }; }
    else if (method === 'GET' && p === '/api/v1/learning/today') data = { planId: `plan_ui_risk_${id}`, planVersion: 1, items: [], itemCount: 0 };
    // ── additive target-page reads (settings / home). Paths and shapes were read
    // from apps/mobile/src/api/{b12,learner-content}.ts and the two page sources.
    else if (method === 'GET' && p === '/api/v1/notifications/preferences') { report.targetReads.push({ id, method, path: p, page: 'settings' }); data = { items: [], meta: { hasMore: false, nextCursor: null } }; }
    else if (method === 'GET' && p === '/api/v1/support/tickets') { report.targetReads.push({ id, method, path: p, page: 'settings-support' }); data = { data: { ticketCopy: '', supportNumber: '' } }; }
    else if (method === 'GET' && p === '/api/v1/learner/home') { report.targetReads.push({ id, method, path: p, page: 'home' }); data = { projectionVersion: 1, contentEpoch: 1, tasks: [], targetMinutes: 15, completedMinutes: 0, dailyStream: { completedMinutes: 0, targetMinutes: 15 }, contentStatus: 'EMPTY', stale: false }; }
    else if (method === 'GET' && p === '/api/v1/content/learner/catalog') { report.targetReads.push({ id, method, path: p, page: 'home' }); data = { items: [] }; }
    else { status = 501; data = { code: 'UNEXPECTED_SYNTHETIC_ROUTE' }; report.unexpected.push({ id, method, path: p }); }
    await route.fulfill({ status, headers, body: status === 204 ? '' : JSON.stringify(data) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => {
    const info = routeInfo(page.url());
    report.pageErrors.push({ id, message: error.message, stack: scrubText(error.stack), ...info });
  });
  page.on('console', message => {
    const type = message.type();
    if (type !== 'error' && type !== 'warning') return;
    const text = message.text();
    const info = routeInfo(page.url());
    // For resource-failure lines only, keep the URL pathname (no query/body/header/
    // token) so an exclusion can be matched to a recorded fixture injection instead
    // of being waived by a blanket regex. Other console entries keep text only.
    let consolePath = null;
    if (/^Failed to load resource/i.test(text.trim())) {
      try { const location = message.location(); if (location && location.url) consolePath = new URL(location.url).pathname; } catch { consolePath = null; }
    }
    const entry = { id, message: text, path: consolePath, pathname: info.pathname, route: info.route, stage: info.stage };
    if (type === 'error') report.consoleErrors.push(entry);
    else report.consoleWarnings.push(entry);
  });
  await page.exposeFunction('__mb006ReportDiagnostic', (record) => {
    const entry = { id, at: new Date().toISOString(), ...record };
    if (record && record.kind === 'unhandledrejection') report.unhandledRejections.push(entry);
    else if (record && record.kind === 'window-error') report.windowErrors.push(entry);
  });
  await page.addInitScript(() => {
    const short = (value) => typeof value === 'string' ? value.replace(/([?&](?:token|access_token|refresh_token|authorization|code|session)=)[^&\s)]+/gi, '$1[redacted]').slice(0, 500) : null;
    const info = () => {
      const route = location.hash.split('?')[0];
      const stage = route.includes('/settings/') ? 'settings' : route.includes('/assessment/') ? 'assessment' : route.includes('/login/') ? 'login' : route.includes('/onboarding/') ? 'onboarding' : 'other';
      return { pathname: location.pathname, route, stage };
    };
    const shape = (value) => {
      const type = typeof value;
      if (value === null) return { type: 'null' };
      if (type !== 'object' && type !== 'function') return { type };
      const out = { type };
      try {
        for (const key of ['name', 'message', 'errMsg', 'code']) if (typeof value[key] === 'string') out[key] = short(value[key]);
        if (typeof value.stack === 'string') out.stack = short(value.stack);
      } catch (error) { out.readError = short(error && error.message || error); }
      return out;
    };
    const send = (record) => {
      if (typeof window.__mb006ReportDiagnostic === 'function') window.__mb006ReportDiagnostic(record);
    };
    // Read-only: no preventDefault, no Promise replacement, no app state touched.
    window.addEventListener('unhandledrejection', event => {
      send({ kind: 'unhandledrejection', at: Date.now(), ...info(), reason: shape(event.reason) });
    });
    window.addEventListener('error', event => {
      send({ kind: 'window-error', at: Date.now(), ...info(), message: short(event.message), filename: short(event.filename), lineno: event.lineno, colno: event.colno, error: shape(event.error) });
    });
  });
  const item = { page, p: page, context, state, projection: () => { const session = sessions.get(state.activeSessionId); return session ? projection(session) : null; }, release, hold: (kind = 'response') => { state[kind + 'Delay'] = true; }, pending: () => [...pending].map(entry => entry.kind), close: async () => { releaseAll(); await context.close(); live.delete(item); } };
  live.add(item);
  await page.goto(`${BASE}/#/pages/login/login?theme=${theme}&uiLocale=${locale}&returnTo=%2Fpages%2Fassessment%2Fassessment`, { waitUntil: 'networkidle' });
  await page.locator('#mobile-login-identifier').fill(state.subject);
  await page.locator('#mobile-login-password').fill('SyntheticOnly123');
  await page.locator('.login-submit').click();
  await page.waitForURL(url => url.hash.startsWith('#/pages/assessment/assessment'));
  await page.locator(readySelector).first().waitFor();
  frozen();
  return item;
}
module.exports = { BASE, sources, report, hash, hashes, freeze, frozen, init, close, fresh };
