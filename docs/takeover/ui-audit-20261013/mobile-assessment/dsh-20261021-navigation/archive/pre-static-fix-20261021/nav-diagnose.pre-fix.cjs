// =============================================================================
// MB006 / C6b — minimal real-H5 navigation diagnostic. PREPARED ONLY.
// The DSH author session did not launch a browser, did not run any case, and
// claims no PASS. Root reviews and executes this file later.
//
// Prepared: 2026-10-21 | branch dev-redesign | scope: navigation only.
// One case per invocation:  node nav-diagnose.cjs --case <guide-exits|cycle-back|report-today>
//
// Required environment at execution:
//   MB006_CONFIRM_BROWSER=1                 explicit browser consent (no default)
//   NAV_EXPECTED_PAGE_SHA=<64 lowercase hex> Root-approved page hash; no default,
//                                           no auto-accept, must equal the real file
// Optional:
//   NAV_RUN_ID=<one safe segment>           default nav-<case>-<utc stamp>
//   NAV_EXECUTOR=<1-80 safe chars>          recorded only
//
// Guarded and must stay at the reviewed C6b values (strict, drift refuses):
//   i18n, API, store, session, navigation, uni-runtime, uni.scss, package, lock.
// The page hash is never stored here: it comes only from NAV_EXPECTED_PAGE_SHA.
//
// Exit codes: 0 = every check PASS and before/after hashes stable;
//             1 = real FAIL (failed check, page/console error, unknown API,
//                 unstable hashes, or a thrown case step);
//             2 = setup refusal (env/guard/hash/server/browser-launch) before
//                 or around launch; setup refusals write no run artifacts.
//
// Read-only by design: routes come from globalThis.getCurrentPages() and are
// recorded, never trusted blindly; physical back is Playwright page.goBack();
// navigation always goes through real UI buttons. No storage, token, store,
// guard, router or browser-history override of any kind.
// =============================================================================
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const f = require('./fixture.nav.cjs');

const ROOT = (() => {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'apps/mobile/src/pages/assessment/assessment.vue'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '';
})();
if (!ROOT) {
  console.error('REFUSED (setup, exit 2): repo root not resolved from ' + __dirname + '. Nothing was started.');
  process.exit(2);
}
const PAGE = f.PAGE;
const FIXED = {
  'packages/i18n/src/mobile-experience.ts': '6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380',
  'apps/mobile/src/api/learner-content.ts': '43ce2ad5d6519b5fab7e38867d1349b569d08b6153b74c87e5c96f11e24e1ae6',
  'apps/mobile/src/stores/learner-content.ts': '95cc92496db996242d91baed3301d76f985e4e3b9134e1e50c2b9ab8d41e4c61',
  'apps/mobile/src/stores/session.ts': 'd944c9e84617af5ad553d2fbc1fd0c07120ce790411dbe02603f9338333f8931',
  'apps/mobile/src/auth/navigation.ts': '7365fec07c55857445fdb1d87b60659734e9e94dc06cfb65afabcb3e8863a4b5',
  'apps/mobile/src/platform/uni-runtime.ts': 'fcbeba8626d8364af0ae96db64a05fcff9a3bb2b46a7d8fbcba21507ef609751',
  'apps/mobile/src/uni.scss': '0bd56842fc5baebd8767e721f2d938986e293d1d87bfc74bb087b3c228f638d7',
};
const DEPS = {
  'apps/mobile/package.json': '484382c73929055cc4ecd9a83679f8bab72388dd8069f71a056b3bbc595c0078',
  'pnpm-lock.yaml': 'd57a87ca84985549fd53c69b1fe1d59db0b136036f2f7bf640d3b30c0a106624',
};
const CASE = (() => { const i = process.argv.indexOf('--case'); return i >= 0 ? String(process.argv[i + 1] || '').trim() : ''; })();
const CASES = ['guide-exits', 'cycle-back', 'report-today'];
const PAGE_SHA = String(process.env.NAV_EXPECTED_PAGE_SHA || '').trim().toLowerCase();
function refuse(message) { console.error('REFUSED (setup, exit 2): ' + message + ' Nothing was started.'); process.exit(2); }
if (!CASES.includes(CASE)) refuse('pass exactly one --case <' + CASES.join('|') + '>.');
if (process.env.MB006_CONFIRM_BROWSER !== '1') refuse('set MB006_CONFIRM_BROWSER=1 to launch this prepared real-H5 diagnostic.');
if (!/^[0-9a-f]{64}$/.test(PAGE_SHA)) refuse('NAV_EXPECTED_PAGE_SHA must be an explicit 64-lowercase-hex Root-approved page hash; no default and no auto-accept.');
for (const [rel, expected] of Object.entries({ [PAGE]: PAGE_SHA, ...FIXED, ...DEPS })) {
  const actual = f.hash(rel);
  if (actual !== expected) refuse('hash mismatch ' + rel + ': expected ' + expected + ' got ' + actual + '.');
}

const checks = [];
const steps = [];
let planned = [];
let cur = null;
let OUT = null;
const counts = () => ({ ...cur.state.counts });
const writes = c => ({ start: c.start, respond: c.respond, retest: c.retest, ensure: c.ensure });
const zeroWrites = c => ['start', 'respond', 'retest', 'ensure'].every(k => c[k] === 0);
const norm = route => (typeof route === 'string' ? '/' + route.replace(/^\/+/, '') : null);
function check(name, ok, detail) { checks.push({ name, result: ok ? 'PASS' : 'FAIL', ...(detail ? { detail } : {}) }); }
function probe() {
  return new Promise(resolve => {
    const request = http.get(f.BASE, response => { response.resume(); resolve(response.statusCode || 0); });
    request.on('error', () => resolve(0));
    request.setTimeout(3000, () => { request.destroy(); resolve(0); });
  });
}
async function capture(page) {
  return page.evaluate(() => {
    const q = selector => document.querySelector(selector);
    const g = globalThis.getCurrentPages;
    let stack;
    if (typeof g !== 'function') stack = { available: false, reason: 'getCurrentPages is not a function', pages: [] };
    else {
      try { stack = { available: true, pages: (g() || []).map(p => ({ route: typeof p?.route === 'string' ? p.route : null })) }; }
      catch (error) { stack = { available: false, reason: String((error && error.message) || error), pages: [] }; }
    }
    const options = [...document.querySelectorAll('[id^="assessment-option-"]')];
    return {
      url: location.href,
      hash: location.hash,
      stack,
      busy: q('#assessment-page')?.getAttribute('aria-busy') ?? null,
      screens: {
        guide: Boolean(q('#assessment-guide')),
        question: Boolean(q('#assessment-question')),
        report: Boolean(q('#assessment-report')),
        leaveConfirm: Boolean(q('#assessment-leave-confirmation')),
        error: (q('#assessment-error')?.textContent || '').trim() || null,
      },
      selection: options.map(node => ({ id: node.id, pressed: node.getAttribute('aria-pressed'), disabled: node.hasAttribute('disabled') })),
      submitDisabled: q('#assessment-submit') ? q('#assessment-submit').hasAttribute('disabled') : null,
      progress: q('[role="progressbar"]')?.getAttribute('aria-valuenow') ?? null,
    };
  });
}
async function snap(page, name) {
  const entry = { step: name, at: new Date().toISOString(), ...(await capture(page)), counts: counts() };
  steps.push(entry);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });
  entry.shot = name + '.png';
  return entry;
}
const lastRoute = snapshot => {
  const stack = snapshot.stack;
  if (!stack.available || !stack.pages.length) return null;
  return norm(stack.pages[stack.pages.length - 1].route);
};
async function waitHash(page, prefix) { await page.waitForFunction(p => location.hash.startsWith(p), prefix, { timeout: 20000 }); }
async function waitOffAssessment(page) {
  try { await page.waitForFunction(() => !location.hash.startsWith('#/pages/assessment/assessment'), null, { timeout: 10000 }); return true; }
  catch { return false; }
}

async function guideExits() {
  planned = ['guide-visible-and-clean', 'back-button-exits-to-home', 'guide-back-zero-assessment-writes', 'home-button-exits-to-home', 'guide-home-zero-assessment-writes'];
  const first = await f.fresh(); cur = first;
  await first.page.locator('#assessment-guide').waitFor();
  const guide = await snap(first.page, '01-guide');
  check('guide-visible-and-clean', guide.screens.guide === true && !guide.selection.some(s => s.pressed === 'true'), { hash: guide.hash, stack: guide.stack, busy: guide.busy });
  await first.page.locator('#assessment-back').click();
  const leftByBack = await waitOffAssessment(first.page);
  const back = await snap(first.page, '02-after-back');
  check('back-button-exits-to-home', leftByBack && back.hash.startsWith('#/pages/home/home'), { hash: back.hash, route: lastRoute(back), stack: back.stack });
  check('guide-back-zero-assessment-writes', zeroWrites(writes(counts())), { counts: counts() });
  await first.close();

  const second = await f.fresh(); cur = second;
  await second.page.locator('#assessment-guide').waitFor();
  await snap(second.page, '03-guide-home-entry');
  await second.page.locator('#assessment-home').click();
  const leftByHome = await waitOffAssessment(second.page);
  const home = await snap(second.page, '04-after-home');
  check('home-button-exits-to-home', leftByHome && home.hash.startsWith('#/pages/home/home'), { hash: home.hash, route: lastRoute(home), stack: home.stack });
  check('guide-home-zero-assessment-writes', zeroWrites(writes(counts())), { counts: counts() });
  await second.close();
}

async function cycleBack() {
  planned = ['settings-confirm-shown', 'settings-confirm-reaches-settings', 'browser-back-restores-question', 'browser-back-clears-selection', 'browser-back-reGETs-placement', 'one-submit-accepted', 'back-leaves-assessment', 'back-target-is-home', 'cycle-back-no-extra-writes'];
  const item = await f.fresh(); cur = item;
  const page = item.page;
  await page.locator('#assessment-guide').waitFor();
  await page.locator('#assessment-start').click();
  await page.locator('#assessment-question').waitFor();
  await page.locator('#assessment-page[aria-busy=false]').waitFor();
  await page.locator('#assessment-option-A').click();
  await page.locator('#assessment-settings').click();
  await page.locator('#assessment-leave-confirmation').waitFor();
  const confirm = await snap(page, '01-settings-confirm');
  check('settings-confirm-shown', confirm.screens.leaveConfirm === true, { hash: confirm.hash, selection: confirm.selection });
  await page.locator('#assessment-leave-confirm').click();
  await waitHash(page, '#/pages/settings/settings');
  // uni-app H5 may keep the previous page mounted (hidden), so do not wait on DOM
  // removal; hash is the real route, and the stack is recorded read-only below.
  await page.waitForTimeout(500);
  const settings = await snap(page, '02-settings');
  check('settings-confirm-reaches-settings', settings.hash.startsWith('#/pages/settings/settings'), { hash: settings.hash, stack: settings.stack });
  const getBefore = counts().placementGet;
  await page.goBack();
  await page.locator('#assessment-question').waitFor();
  await page.locator('#assessment-page[aria-busy=false]').waitFor();
  const restored = await snap(page, '03-browser-back-restored');
  const getAfter = counts().placementGet;
  check('browser-back-restores-question', restored.screens.question === true, { hash: restored.hash, stack: restored.stack, busy: restored.busy });
  check('browser-back-clears-selection', restored.selection.every(s => s.pressed !== 'true') && restored.submitDisabled === true, { selection: restored.selection, submitDisabled: restored.submitDisabled });
  check('browser-back-reGETs-placement', getAfter === getBefore + 1, { getBefore, getAfter });
  await page.locator('#assessment-option-A').click();
  await page.locator('#assessment-submit').click();
  await page.waitForFunction(() => document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') === '1', null, { timeout: 20000 });
  await page.locator('#assessment-page[aria-busy=false]').waitFor();
  const submitted = await snap(page, '04-first-accepted');
  check('one-submit-accepted', counts().respond === 1 && submitted.progress === '1' && submitted.screens.question === true, { counts: counts(), progress: submitted.progress });
  const beforeBack = counts();
  await page.locator('#assessment-back').click();
  const left = await waitOffAssessment(page);
  const after = await snap(page, '05-after-back');
  check('back-leaves-assessment', left && !after.hash.includes('/pages/assessment/assessment'), { hash: after.hash, route: lastRoute(after), stack: after.stack, before: beforeBack });
  check('back-target-is-home', after.hash.startsWith('#/pages/home/home'), { hash: after.hash, route: lastRoute(after), stack: after.stack, expected: 'home; another legitimate stack target is recorded here, never silently accepted' });
  check('cycle-back-no-extra-writes', counts().respond === 1 && counts().retest === 0 && counts().ensure === 0, { before: beforeBack, after: counts() });
  await item.close();
}

async function reportToday() {
  planned = ['report-reaches-assessed-a2', 'ensure-count-per-existing-contract', 'today-button-reaches-today', 'report-today-zero-unplanned-writes'];
  const item = await f.fresh(); cur = item;
  const page = item.page;
  await page.locator('#assessment-guide').waitFor();
  await page.locator('#assessment-start').click();
  await page.locator('#assessment-question').waitFor();
  for (let n = 1; n <= 10; n++) {
    await page.locator('#assessment-option-A').click();
    await page.locator('#assessment-submit').click();
    if (n < 10) await page.waitForFunction(expected => document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') === String(expected), n, { timeout: 20000 });
    else await page.locator('#assessment-report').waitFor();
  }
  await page.locator('#assessment-page[aria-busy=false]').waitFor();
  const assessed = await snap(page, '01-assessed-report');
  const text = (await page.locator('#assessment-report').innerText()).trim();
  check('report-reaches-assessed-a2', /A2/.test(text) && counts().respond === 10 && assessed.screens.report === true, { excerpt: text.slice(0, 160), counts: counts() });
  check('ensure-count-per-existing-contract', counts().ensure === 1, { ensure: counts().ensure, contract: 'ASSESSED report feeds shouldEnsurePlan -> exactly one POST /learning/plans:ensure; recorded, not a business PASS' });
  await page.locator('#assessment-today').click();
  await waitHash(page, '#/pages/today/today');
  const today = await snap(page, '02-today');
  check('today-button-reaches-today', today.hash.startsWith('#/pages/today/today'), { hash: today.hash, route: lastRoute(today), stack: today.stack });
  check('report-today-zero-unplanned-writes', counts().retest === 0 && counts().respond === 10, { counts: counts() });
  await item.close();
}

(async () => {
  const status = await probe();
  if (!status) refuse('no dev server answering ' + f.BASE + ' on the fixed mobile H5 port.');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  const runId = String(process.env.NAV_RUN_ID || ('nav-' + CASE + '-' + stamp)).trim();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(runId)) refuse('NAV_RUN_ID must be one safe path segment.');
  const runsRoot = path.resolve(__dirname, '..', 'runs');
  OUT = path.resolve(runsRoot, runId);
  if (path.dirname(OUT) !== runsRoot) refuse('run directory escaped runs/.');
  const before = f.hashes();
  f.freeze({ ...before, [PAGE]: PAGE_SHA });
  try { await f.init(); } catch (error) { refuse('browser launch failed (setup): ' + error.message); }
  fs.mkdirSync(OUT, { recursive: true });
  let failure = null;
  try {
    if (CASE === 'guide-exits') await guideExits();
    else if (CASE === 'cycle-back') await cycleBack();
    else await reportToday();
  } catch (error) {
    failure = { message: error.message, stack: error.stack };
    check('case-completed-without-exception', false, failure);
  } finally {
    try { await f.close(); } catch (error) { failure = failure || { message: 'close failed: ' + error.message }; }
  }

  const after = f.hashes();
  const depsBefore = Object.fromEntries(Object.keys(DEPS).map(rel => [rel, f.hash(rel)]));
  const depsAfter = Object.fromEntries(Object.keys(DEPS).map(rel => [rel, f.hash(rel)]));
  const stable = JSON.stringify(before) === JSON.stringify(after) && JSON.stringify(depsBefore) === JSON.stringify(depsAfter);
  check('source-and-dependency-hashes-stable', stable, { before, after, depsBefore, depsAfter });
  check('no-unexpected-api-route', f.report.unexpected.length === 0, { unexpected: f.report.unexpected, rule: 'unknown path => 501 + FAIL; no broad 200 fallback' });
  check('no-page-errors', f.report.pageErrors.length === 0, { pageErrors: f.report.pageErrors });
  check('no-console-errors', f.report.consoleErrors.length === 0, { consoleErrors: f.report.consoleErrors, note: 'console warnings are retained separately, not normalized away' });
  const missing = planned.filter(name => !checks.some(c => c.name === name));
  check('planned-checks-present-and-non-empty', missing.length === 0 && checks.length > 0, { planned, missing, total: checks.length });
  const result = checks.every(c => c.result === 'PASS') ? 'PASS' : 'FAIL';

  const payload = {
    scope: 'MB006_C6B_NAV_DIAGNOSTIC',
    preparedBy: 'DSH author session (prepared, not executed)',
    runBy: process.env.NAV_EXECUTOR || null,
    preparedAt: '2026-10-21',
    case: CASE,
    run: runId,
    at: new Date().toISOString(),
    base: f.BASE,
    expectedPageShaFromEnv: PAGE_SHA,
    pageHashDefaulted: false,
    checks,
    counts: cur ? counts() : null,
    steps,
    report: f.report,
    sourceHashesBefore: before,
    sourceHashesAfter: after,
    dependenciesBefore: depsBefore,
    dependenciesAfter: depsAfter,
    result,
    failure,
    exitCode: result === 'PASS' ? 0 : 1,
  };
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({ case: CASE, run: runId, runDirectory: path.relative(path.resolve(__dirname, '..'), OUT).split(path.sep).join('/'), result, checks: checks.length, failed: checks.filter(c => c.result === 'FAIL').map(c => c.name), steps: steps.map(s => s.step) }, null, 2));
  process.exitCode = result === 'PASS' ? 0 : 1;
})();
