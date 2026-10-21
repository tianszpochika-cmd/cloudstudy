// TEST PREPARATION ONLY. Importing this module never starts a browser.
// Local reduced copy of dsh-20261020-risk/fixture.cjs for the 2026-10-21
// navigation diagnostic. The risk copy stays immutable and is not modified.
// Differences (all subtractive or additive-metadata only):
//   1. 8 guarded sources (page + i18n + api/store/session/navigation + uni-runtime + uni.scss);
//      the page hash is never defaulted here — freeze(expected) requires an explicit map.
//   2. no delay/hold/release machinery and no failure injection (not needed by these cases);
//   3. console warnings are retained separately from console errors.
// Real uni-app/login/guard, synthetic API transport. Never read cookies/storage,
// request bodies/headers/tokens, or replace component/store/guard behavior.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ROOT = (() => {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'apps/mobile/src/pages/assessment/assessment.vue'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('repo root not found from ' + __dirname);
})();
const BASE = 'http://127.0.0.1:18183';
const PAGE = 'apps/mobile/src/pages/assessment/assessment.vue';
const sources = [PAGE, 'packages/i18n/src/mobile-experience.ts', 'apps/mobile/src/api/learner-content.ts', 'apps/mobile/src/stores/learner-content.ts', 'apps/mobile/src/stores/session.ts', 'apps/mobile/src/auth/navigation.ts', 'apps/mobile/src/platform/uni-runtime.ts', 'apps/mobile/src/uni.scss'];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(ROOT, file))).digest('hex');
const hashes = () => Object.fromEntries(sources.map(file => [file, hash(file)]));
const report = { scope: 'MB006_C6B_NAV_DIAGNOSTIC_SYNTHETIC_TRANSPORT', requests: [], targetReads: [], unexpected: [], pageErrors: [], consoleErrors: [], consoleWarnings: [], navigationDiagnostics: [] };
const live = new Set();
let browser, frozenHashes = null, caseNumber = 0;
function frozen() { if (frozenHashes) assert.deepEqual(hashes(), frozenHashes, 'Frozen sources changed'); }
function freeze(expected) {
  if (!expected || typeof expected !== 'object' || Object.keys(expected).length !== sources.length) throw new Error('freeze(expected) requires all 8 explicit hashes; no default/auto-accept');
  frozenHashes = { ...expected }; frozen(); return frozenHashes;
}
// Read-only console diagnostic capture. Accepts ONLY a string that literally starts
// with the product tag prefix "[MB006"; keeps the tag plus length-capped tokens made
// of a conservative charset (path/meta/boolean-shaped). Rejects braces, quotes,
// commas, "@", JSHandle/object renderings and anything over the hard cap, so arg
// objects (owner/token/headers) are never parsed, serialized or stored.
const DIAG_RAW_MAX = 400, DIAG_TEXT_MAX = 200;
function sanitizeNavigationDiagnostic(text) {
  if (typeof text !== 'string') return null;
  const raw = text.trim();
  if (!raw.startsWith('[MB006')) return null;
  if (raw.length > DIAG_RAW_MAX) return null;
  const parts = raw.split(/\s+/).filter(Boolean);
  let tag = parts.shift() || '';
  if (!tag.endsWith(']') && parts[0] && parts[0].endsWith(']')) tag = tag + ' ' + parts.shift();
  if (!/^\[MB006[A-Za-z0-9_.:\- ]{0,48}\]?$/.test(tag)) return null;
  const fields = [];
  for (const token of parts) {
    if (fields.length >= 8) break;
    if (token === 'true' || token === 'false') { fields.push(token); continue; }
    if (!/^[A-Za-z0-9_./:#=\-]{1,120}$/.test(token)) continue;
    fields.push(token.slice(0, 120));
  }
  const value = [tag].concat(fields).join(' ').slice(0, DIAG_TEXT_MAX);
  return { tag: tag.slice(0, 56), text: value, fieldCount: fields.length };
}
async function init() { frozen(); if (!browser) browser = await chromium.launch(); return browser; }
async function close() { for (const item of [...live]) await item.close(); await browser?.close(); browser = null; }

async function fresh(options = {}) {
  if (!browser) throw new Error('Call init() explicitly after the explicit page-hash guard');
  frozen();
  const { locale = 'zh-CN', theme = 'light', width = 390, height = 844, colorScheme = 'light', hasTouch = false, case: caseId = null } = options;
  const id = ++caseNumber;
  const context = await browser.newContext({ viewport: { width, height }, colorScheme, reducedMotion: 'reduce', hasTouch });
  const sessions = new Map();
  const state = { id, caseId, locale, theme, subject: `ui-mb006-nav-${id}`, adultGate: 'PASSED', access: 'ELIGIBLE', accepted: true, generation: 0, activeSessionId: null, counts: { login: 0, refresh: 0, logout: 0, principal: 0, start: 0, respond: 0, retest: 0, ensure: 0, GET: 0, placementGet: 0 } };
  const permissions = ['learning.plan.read', 'learner.target.read', 'learner.profile.read', 'learner.preference.read', 'assessment.placement.read', 'assessment.placement.start', 'assessment.placement.respond', 'assessment.placement.retest'];
  const principal = () => ({ principal: { subject: state.subject, permissions, roles: ['learner'], adultGate: state.adultGate }, adultGate: { status: state.adultGate, learningAccess: state.access }, learningAccess: state.access, permissions, consentState: { accepted: state.accepted, unsatisfiedPurposes: state.accepted ? [] : ['ACCOUNT_TERMS', 'PRIVACY_NOTICE', 'ADULT_LEARNING_ELIGIBILITY'], requiredPurposes: ['ACCOUNT_TERMS', 'PRIVACY_NOTICE', 'ADULT_LEARNING_ELIGIBILITY'], version: 'synthetic-summary-only' } });
  function newSession() {
    const session = { sessionId: `asess_ui_nav_${id}_${++state.generation}`, sequence: 0 };
    sessions.set(session.sessionId, session); state.activeSessionId = session.sessionId;
    return session;
  }
  function projection(session) {
    const n = session.sequence, sid = session.sessionId;
    if (n === 10) return { sessionId: sid, status: 'COMPLETED', stateVersion: 10, acceptedSequence: 10, nextSequence: null, manifest: { totalItemCount: 10 }, finalResult: { reportId: `prpt_ui_nav_${sid}`, sessionId: sid, resultKind: 'ASSESSED', referenceLevel: 'A2', aggregateScore: 70, summary: { fullCount: 7, zeroCount: 3, itemCount: 10 } }, outcome: 'ZERO' };
    return { sessionId: sid, status: 'IN_PROGRESS', stateVersion: n, acceptedSequence: n, nextSequence: n + 1, manifest: { totalItemCount: 10 }, currentItem: { itemId: 6100 + n + 1, itemSequence: n + 1, dimension: 'VOCABULARY', stem: n === 0 ? 'Choose the phrase that completes the sentence: I ___ every evening.' : `Synthetic item ${n + 1}: Choose the phrase that completes the sentence.`, timeLimitSec: 60, options: [{ optionId: 'A', text: 'read a book' }, { optionId: 'B', text: 'reads a book' }, { optionId: 'C', text: 'reading a book' }, { optionId: 'D', text: 'has read a book' }] }, ...(n > 0 ? { outcome: n <= 7 ? 'FULL' : 'ZERO' } : {}) };
  }
  await context.route('**/*', async route => {
    const q = route.request(), u = new URL(q.url()), p = u.pathname, method = q.method();
    if (!p.startsWith('/api/v1/')) return u.origin === BASE ? route.continue() : route.abort();
    report.requests.push({ id, method, path: p });
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true' };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers, body: '' });
    if (method === 'GET') state.counts.GET++;
    let status = 200, data;
    if (method === 'POST' && (p === '/api/v1/auth/login' || p === '/api/v1/auth/token/refresh')) {
      state.counts[p.endsWith('/login') ? 'login' : 'refresh']++;
      data = { accessToken: 'synthetic-invalid-ui-fixture-only', adultGate: { status: state.adultGate, learningAccess: state.access } };
    } else if (method === 'POST' && p === '/api/v1/auth/logout') { state.counts.logout++; status = 204; }
    else if (method === 'GET' && (p === '/api/v1/iam/principal/me' || p === '/api/v1/iam/permissions')) { state.counts.principal++; data = principal(); }
    else if (method === 'GET' && p === '/api/v1/learner/profile') data = { stateVersion: 0 };
    else if (method === 'GET' && p === '/api/v1/learner/targets') data = { goalCode: 'FOUNDATION', dailyQuotaMinutes: 15, targetLevel: 'A1', status: 'ACTIVE', stateVersion: 0 };
    else if (method === 'GET' && p === '/api/v1/learner/preferences') data = { uiLocale: locale, contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: theme === 'system' ? 'SYSTEM' : theme === 'dark' ? 'DARK' : 'LIGHT', highContrast: theme === 'high-contrast', motionMode: 'REDUCED', stateVersion: 0 };
    else if (method === 'POST' && p === '/api/v1/assessment/placement/sessions') { state.counts.start++; data = projection(newSession()); }
    else if (p.startsWith('/api/v1/assessment/placement/sessions/')) {
      const parts = p.slice('/api/v1/assessment/placement/sessions/'.length).split('/'), sid = decodeURIComponent(parts[0]), session = sessions.get(sid);
      if (!session) { status = 404; data = { code: 'SYNTHETIC_SESSION_NOT_FOUND' }; }
      else if (method === 'GET' && parts.length === 1) { state.counts.placementGet++; data = projection(session); }
      else if (method === 'POST' && parts.length === 2 && parts[1] === 'responses') {
        state.counts.respond++;
        if (session.sequence < 10) { session.sequence++; data = projection(session); }
        else { status = 409; data = { code: 'SYNTHETIC_ALREADY_COMPLETE' }; }
      } else if (method === 'POST' && parts.length === 2 && parts[1] === 'retest') {
        state.counts.retest++;
        if (session.sequence === 10) data = projection(newSession());
        else { status = 409; data = { code: 'SYNTHETIC_REPORT_REQUIRED' }; }
      } else { status = 501; data = { code: 'UNEXPECTED_SYNTHETIC_ROUTE' }; report.unexpected.push({ id, method, path: p }); }
    } else if (method === 'POST' && p === '/api/v1/learning/plans:ensure') { state.counts.ensure++; data = { planId: `plan_ui_nav_${id}`, planVersion: 1, stateVersion: 1 }; }
    else if (method === 'GET' && p === '/api/v1/learning/today') data = { planId: `plan_ui_nav_${id}`, planVersion: 1, items: [], itemCount: 0 };
    else if (method === 'GET' && p === '/api/v1/notifications/preferences') { report.targetReads.push({ id, method, path: p, page: 'settings' }); data = { items: [], meta: { hasMore: false, nextCursor: null } }; }
    else if (method === 'GET' && p === '/api/v1/support/tickets') { report.targetReads.push({ id, method, path: p, page: 'settings-support' }); data = { data: { ticketCopy: '', supportNumber: '' } }; }
    else if (method === 'GET' && p === '/api/v1/learner/home') { report.targetReads.push({ id, method, path: p, page: 'home-or-today' }); data = { projectionVersion: 1, contentEpoch: 1, tasks: [], targetMinutes: 15, completedMinutes: 0, dailyStream: { completedMinutes: 0, targetMinutes: 15 }, contentStatus: 'EMPTY', stale: false }; }
    else if (method === 'GET' && p === '/api/v1/content/learner/catalog') { report.targetReads.push({ id, method, path: p, page: 'home-or-today' }); data = { items: [] }; }
    else { status = 501; data = { code: 'UNEXPECTED_SYNTHETIC_ROUTE' }; report.unexpected.push({ id, method, path: p }); }
    await route.fulfill({ status, headers, body: status === 204 ? '' : JSON.stringify(data) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push({ id, message: error.message }));
  page.on('console', message => {
    const type = message.type();
    if (type === 'debug' || type === 'log' || type === 'info') {
      // Read-only product diagnostic channel: only messages whose text literally
      // starts with "[MB006"; sanitized to tag + path/meta/boolean tokens. Other
      // logs are ignored, and this branch never changes error/warning handling.
      const captured = sanitizeNavigationDiagnostic(message.text());
      if (captured) report.navigationDiagnostics.push({ id, caseId: state.caseId, route: page.url(), at: new Date().toISOString(), tag: captured.tag, text: captured.text, fieldCount: captured.fieldCount });
      return;
    }
    if (type === 'warning') { report.consoleWarnings.push({ id, message: message.text() }); return; }
    if (type !== 'error') return;
    let consolePath = null;
    if (/^Failed to load resource/i.test(message.text().trim())) {
      try { const location = message.location(); if (location && location.url) consolePath = new URL(location.url).pathname; } catch { consolePath = null; }
    }
    report.consoleErrors.push({ id, message: message.text(), path: consolePath });
  });
  const item = { page, context, state, projection: () => { const session = sessions.get(state.activeSessionId); return session ? projection(session) : null; }, close: async () => { await context.close(); live.delete(item); } };
  live.add(item);
  await page.goto(`${BASE}/#/pages/login/login?theme=${theme}&uiLocale=${locale}&returnTo=%2Fpages%2Fassessment%2Fassessment`, { waitUntil: 'networkidle' });
  await page.locator('#mobile-login-identifier').fill(state.subject);
  await page.locator('#mobile-login-password').fill('SyntheticOnly123');
  await page.locator('.login-submit').click();
  await page.waitForURL(url => url.hash.startsWith('#/pages/assessment/assessment'));
  await page.locator('h1:visible,[role="heading"]:visible').first().waitFor();
  frozen();
  return item;
}
module.exports = { BASE, PAGE, sources, report, hash, hashes, freeze, frozen, init, close, fresh, sanitizeNavigationDiagnostic };
