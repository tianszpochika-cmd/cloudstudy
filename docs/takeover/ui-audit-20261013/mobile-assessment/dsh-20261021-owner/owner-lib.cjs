// Prepared owner-lifecycle helpers. No browser is launched by importing this module.
// Adapted from dsh-20261020-risk/risk-lib.cjs and dsh-20261020-lifecycle/lifecycle-lib.cjs.
// Strict rules kept: eight-source freeze, mobile package/lock dependency freeze, Root
// env page gate, unique run directory, guaranteed close, before/after hashes, exact
// injection-bound console exclusion, and exit 0 only for a non-empty executed PASS.
// No product store/session/token/storage/guard/onShow/history hook is read or written.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '../../../../..');
const FREEZE_FILE = path.join(__dirname, 'source-freeze.json');
const PAGE = 'apps/mobile/src/pages/assessment/assessment.vue';
const SUPPORT = [
  'packages/i18n/src/mobile-experience.ts',
  'apps/mobile/src/api/learner-content.ts',
  'apps/mobile/src/stores/learner-content.ts',
  'apps/mobile/src/stores/session.ts',
  'apps/mobile/src/auth/navigation.ts',
  'apps/mobile/src/platform/uni-runtime.ts',
  'apps/mobile/src/uni.scss',
];
const DEPS = ['apps/mobile/package.json', 'pnpm-lock.yaml'];
const RUN_NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;
const GROUP_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;
const EXECUTOR_RE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,79}$/;
const HEX_RE = /^[0-9a-f]{64}$/;

class SetupIncomplete extends Error {}
class ProductFailure extends Error {}

function refuse(message) {
  console.error('REFUSED: ' + message + ' Nothing was started.');
  process.exit(2);
}
function sha256(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.resolve(ROOT, rel))).digest('hex');
}
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function countsOf(current) { return current ? { ...current.state.counts } : null; }

function verifyDependencies(freeze) {
  const expected = freeze.dependencies || {};
  const actual = {};
  const drift = [];
  for (const file of DEPS) actual[file] = sha256(file);
  for (const [file, want] of Object.entries(expected)) {
    if (!DEPS.includes(file)) drift.push({ file, expected: want, actual: 'unexpected-dependency-file' });
    else if (actual[file] !== want) drift.push({ file, expected: want, actual: actual[file] });
  }
  if (!freeze.dependencies || DEPS.some(file => typeof expected[file] !== 'string')) {
    drift.push({ file: '<dependencies>', expected: 'apps/mobile/package.json + pnpm-lock.yaml', actual: 'missing-or-incomplete' });
  }
  return { ok: drift.length === 0, actual, drift };
}

function verifyFreeze(expectedPage) {
  const freeze = JSON.parse(fs.readFileSync(FREEZE_FILE, 'utf8'));
  const actual = {};
  const drift = [];
  const files = [PAGE, ...SUPPORT];
  for (const file of files) actual[file] = sha256(file);
  for (const [file, want] of Object.entries(freeze.sources || {})) {
    if (!files.includes(file)) drift.push({ file, expected: want, actual: 'unexpected-source-file' });
    else if (actual[file] !== want) drift.push({ file, expected: want, actual: actual[file] });
  }
  for (const file of files) {
    if (typeof freeze.sources?.[file] !== 'string') drift.push({ file, expected: '<frozen>', actual: 'missing' });
  }
  if (actual[PAGE] !== expectedPage) drift.push({ file: PAGE, expected: expectedPage, actual: actual[PAGE], reason: 'Root env page hash does not match current page bytes' });
  if (freeze.sources?.[PAGE] !== expectedPage) drift.push({ file: PAGE, expected: expectedPage, actual: freeze.sources?.[PAGE], reason: 'Root env page hash is not the approved frozen page' });
  if (freeze.approvedPage !== expectedPage) drift.push({ file: PAGE, expected: expectedPage, actual: freeze.approvedPage, reason: 'Root env page hash is not the approved C8 page' });
  const dependencies = verifyDependencies(freeze);
  return {
    ok: drift.length === 0 && dependencies.ok,
    preparedAt: freeze.preparedAt,
    approvedPage: freeze.approvedPage,
    expectedPage,
    actual,
    drift,
    dependencies: dependencies.actual,
    dependencyDrift: dependencies.drift,
  };
}

function gate() {
  if (process.env.OWNER_CONFIRM_BROWSER !== '1') {
    refuse('set OWNER_CONFIRM_BROWSER=1 to run the prepared owner-lifecycle suite in the Root review environment.');
  }
  const run = (process.env.OWNER_RUN || '').trim();
  if (!run) refuse('OWNER_RUN is required and must be unique; run directories are never overwritten.');
  if (!RUN_NAME_RE.test(run)) refuse('OWNER_RUN must match /^[a-z0-9][a-z0-9-]{0,63}$/i.');
  const executor = (process.env.OWNER_EXECUTOR || '').trim();
  if (!executor) refuse('OWNER_EXECUTOR is required (1-80 characters from [A-Za-z0-9 ._-]).');
  if (!EXECUTOR_RE.test(executor)) refuse('OWNER_EXECUTOR must be 1-80 characters from [A-Za-z0-9 ._-].');
  const expectedPage = (process.env.OWNER_EXPECTED_PAGE_SHA || '').trim().toLowerCase();
  if (!expectedPage) refuse('OWNER_EXPECTED_PAGE_SHA is required: Root must pass the verified 64-hex page hash.');
  if (!HEX_RE.test(expectedPage)) refuse('OWNER_EXPECTED_PAGE_SHA must be exactly 64 lowercase hexadecimal characters.');
  const freezeCheck = verifyFreeze(expectedPage);
  if (!freezeCheck.ok) refuse('frozen source/dependency drift before start: ' + JSON.stringify({ drift: freezeCheck.drift, dependencyDrift: freezeCheck.dependencyDrift }));
  return { run, executor, expectedPage, freezeCheck };
}

function prepareDir(group, run) {
  if (!GROUP_RE.test(group)) refuse('case name must match /^[a-z0-9][a-z0-9-]{0,63}$/i.');
  const runs = path.resolve(__dirname, 'runs');
  const dir = path.resolve(runs, run, group);
  const rel = path.relative(runs, dir);
  if (!rel || path.isAbsolute(rel) || rel.split(path.sep).length !== 2) refuse('run directory resolved outside runs/: ' + dir);
  if (fs.existsSync(dir)) refuse('run directory already exists and is never overwritten: ' + dir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createReporter({ dir, group, run, executor, expectedPage, approvedPage, sourceHashesBefore, dependenciesBefore, freezePreparedAt }) {
  const report = {
    label: 'Owner late-response UI lifecycle (Root review executor)',
    preparedBy: 'DSH author (test preparation only; DSH launched no browser and executed no case)',
    scope: 'MB006_OWNER_LIFECYCLE_PREPARED_NOT_RUN',
    group, run, executor,
    expectedPage,
    approvedPage,
    fixture: 'synthetic API transport via local fixture.cjs; real uni-app login form, real existing IAM/navigation guard, real UI and real browser history',
    native: 'NOT_RUN (no native/device capability in this prepared H5 suite)',
    realBackend: 'NOT_RUN (no real backend, IAM, DB or external network is contacted)',
    injection: 'Only synthetic API status flags (principalStatus/refreshStatus) and explicit transport holds. No store/session/token/storage/JWT/guard/onShow private hook.',
    startedAt: new Date().toISOString(),
    freezePreparedAt,
    sourceHashesBefore,
    sourceHashesAfter: null,
    sourceStable: null,
    dependenciesBefore,
    dependenciesAfter: null,
    dependenciesStable: null,
    cases: [],
    checks: [],
    notRun: [],
    limitations: [],
    setupFailures: [],
    screenshots: [],
    screenshotFailures: [],
    snapshots: [],
    routes: [],
    consoleWarnings: [],
    warningsStatus: 'NONE',
    dialogues: [],
    transport: [],
    closed: false,
    failure: null,
    result: 'NOT_RUN',
    completion: 'NOT_THE_WHOLE_PAGE',
  };
  function write() {
    report.summary = {
      cases: report.cases.length,
      checks: report.checks.length,
      passed: report.checks.filter(c => c.result === 'PASS').length,
      failed: report.checks.filter(c => c.result === 'FAIL').length,
      notRun: report.notRun.length,
      setupFailures: report.setupFailures.length,
      screenshots: report.screenshots.length,
      screenshotFailures: report.screenshotFailures.length,
      warnings: report.consoleWarnings.length,
      result: report.result,
    };
    fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(report, null, 2));
  }
  function check(name, ok, detail) {
    report.checks.push({ name, result: ok ? 'PASS' : 'FAIL', ...(detail === undefined ? {} : { detail }) });
    write();
    return ok;
  }
  function product(name, ok, detail) {
    check(name, ok, detail);
    if (!ok) throw new ProductFailure(name);
    return true;
  }
  function recordSetup(name, reason, detail) {
    report.setupFailures.push({ name, reason, ...(detail === undefined ? {} : { detail }) });
    report.notRun.push({ name, reason, ...(detail === undefined ? {} : { detail }) });
    write();
  }
  function setup(name, reason, detail) {
    recordSetup(name, reason, detail);
    throw new SetupIncomplete(name + ': ' + reason);
  }
  function notRun(name, reason, detail) {
    report.notRun.push({ name, reason, ...(detail === undefined ? {} : { detail }) });
    write();
  }
  // A scoped-out capability (for example backend owner authorization) is a stated
  // limitation, not an unexecuted branch of this suite. It must not force BLOCKED.
  function limitation(name, reason) {
    report.limitations.push({ name, reason });
    write();
  }
  function startCase(name, extra) {
    const item = { name, startedAt: new Date().toISOString(), ...(extra || {}) };
    report.cases.push(item);
    write();
    return item;
  }
  function endCase(item, outcome, details) {
    Object.assign(item, { outcome, finishedAt: new Date().toISOString(), ...(details || {}) });
    write();
  }
  async function shot(page, name) {
    try {
      await page.evaluate(() => scrollTo(0, 0));
    } catch { /* page may already be closing; the screenshot records what remains */ }
    try {
      await page.screenshot({ path: path.join(dir, name + '.png'), fullPage: true });
      report.screenshots.push(name + '.png');
    } catch (error) {
      report.screenshotFailures.push({ name: name + '.png', message: String(error && error.message || error).slice(0, 300) });
    }
    write();
  }
  async function capture(page, label, current) {
    const snapshot = await facts(page);
    const currentCounts = current ? countsOf(current) : undefined;
    const pending = current ? current.pending() : undefined;
    report.snapshots.push({ label, at: new Date().toISOString(), ...snapshot, counts: currentCounts, pending });
    await shot(page, label);
    write();
    return { ...snapshot, counts: currentCounts, pending };
  }
  async function route(page, label) {
    const value = await page.evaluate(() => location.hash.split('?')[0]);
    report.routes.push({ label, route: value });
    write();
    return value;
  }
  function fail(error) {
    report.failure = { message: String(error && error.message || error), stack: error && error.stack };
  }
  function finish() {
    const failed = report.checks.filter(c => c.result === 'FAIL').length;
    const anyCaseFail = report.cases.some(item => item.outcome === 'FAIL');
    if (failed > 0 || report.failure || anyCaseFail) report.result = 'FAIL';
    else if (report.setupFailures.length > 0 || report.notRun.length > 0 || report.checks.length === 0 || report.screenshotFailures.length > 0) report.result = 'BLOCKED_SETUP_INCOMPLETE';
    else report.result = 'PASS_EXECUTED_CHECKS';
    report.completion = 'NOT_THE_WHOLE_PAGE';
    if (report.notRun.length > 0) report.caveat = 'Executed checks only. notRun entries are untested branches, not passes.';
    write();
    const manifest = {
      label: report.label,
      preparedBy: report.preparedBy,
      scope: report.scope,
      group, run, executor,
      expectedPage: report.expectedPage,
      approvedPage: report.approvedPage,
      result: report.result,
      completion: report.completion,
      sourceHashesBefore: report.sourceHashesBefore,
      sourceHashesAfter: report.sourceHashesAfter,
      sourceStable: report.sourceStable,
      dependenciesBefore: report.dependenciesBefore,
      dependenciesAfter: report.dependenciesAfter,
      dependenciesStable: report.dependenciesStable,
      checks: report.checks.map(c => ({ name: c.name, result: c.result })),
      notRun: report.notRun,
      limitations: report.limitations,
      setupFailures: report.setupFailures,
      screenshots: report.screenshots,
      screenshotFailures: report.screenshotFailures,
      warnings: report.consoleWarnings,
      warningsStatus: report.warningsStatus,
      dialogues: report.dialogues,
      routes: report.routes,
      cases: report.cases.map(c => ({ name: c.name, outcome: c.outcome, setup: c.setup })),
      transport: report.transport,
      fixture: report.fixture,
      native: report.native,
      realBackend: report.realBackend,
      closed: report.closed,
      failure: report.failure,
    };
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    return report;
  }
  write();
  return { report, dir, write, check, product, setup, recordSetup, notRun, limitation, startCase, endCase, shot, capture, route, fail, finish };
}

// ── read-only DOM facts ──────────────────────────────────────────────────────
async function facts(page) {
  return page.evaluate(() => {
    const root = document.getElementById('assessment-page');
    const bar = root?.querySelector('[role=progressbar]');
    const stem = root?.querySelector('.assessment-stem');
    const active = document.activeElement;
    const ids = ['assessment-page', 'assessment-guide', 'assessment-question', 'assessment-report', 'assessment-skipped', 'assessment-pending', 'assessment-error', 'assessment-leave-confirmation', 'assessment-retest-confirmation', 'assessment-submit', 'assessment-reload-answer', 'assessment-start', 'assessment-title', 'assessment-option-A'];
    const button = (id) => {
      const el = document.getElementById(id);
      return el ? { text: (el.innerText || '').trim(), disabled: el.hasAttribute('disabled'), ariaDisabled: el.getAttribute('aria-disabled') } : null;
    };
    return {
      url: location.href,
      route: location.hash.split('?')[0],
      origin: location.origin,
      title: document.title,
      root: !!root,
      overlay: !!document.querySelector('vite-error-overlay'),
      bodyLen: root ? root.innerText.length : 0,
      bodyText: root ? root.innerText.slice(0, 2400) : '',
      present: Object.fromEntries(ids.map(id => [id, !!document.getElementById(id)])),
      busy: root ? root.getAttribute('aria-busy') : null,
      options: root ? [...root.querySelectorAll('.assessment-option')].map(el => ({ id: el.id, pressed: el.getAttribute('aria-pressed'), disabled: el.hasAttribute('disabled'), text: (el.innerText || '').trim() })) : [],
      submit: button('assessment-submit'),
      start: button('assessment-start'),
      titleText: (document.getElementById('assessment-title')?.textContent || '').trim(),
      errorText: (document.getElementById('assessment-error')?.innerText || '').trim(),
      guideText: (document.getElementById('assessment-guide')?.innerText || '').trim().slice(0, 600),
      reportText: (document.getElementById('assessment-report')?.innerText || '').trim().slice(0, 600),
      questionText: (document.getElementById('assessment-question')?.innerText || '').trim().slice(0, 600),
      valuenow: bar ? bar.getAttribute('aria-valuenow') : null,
      valuemax: bar ? bar.getAttribute('aria-valuemax') : null,
      valuetext: bar ? bar.getAttribute('aria-valuetext') : null,
      stem: stem ? stem.textContent.trim() : null,
      active: active ? { tag: active.tagName.toLowerCase(), id: active.id || '', role: active.getAttribute('role'), focusVisible: active.matches(':focus-visible'), disabled: active.hasAttribute('disabled') } : null,
      scrollY: Math.round(scrollY),
    };
  });
}

async function waitIdle(page, timeout = 10000) {
  await page.waitForFunction(() => document.getElementById('assessment-page')?.getAttribute('aria-busy') === 'false', null, { timeout });
}
async function waitPresent(page, id, timeout = 10000) {
  await page.waitForFunction((value) => !!document.getElementById(value), id, { timeout });
}
async function waitGone(page, id, timeout = 10000) {
  await page.waitForFunction((value) => !document.getElementById(value), id, { timeout });
}
async function waitRoute(page, prefix, timeout = 12000) {
  await page.waitForFunction((value) => location.hash.startsWith(value), prefix, { timeout });
}
async function hashNow(page) {
  return page.evaluate(() => location.hash.split('?')[0]);
}
// Waits until a hash predicate holds continuously for holdMs. A one-frame bounce to
// login/onboarding is recorded, not treated as a stable landing.
async function waitRouteStable(page, predicate, holdMs = 800, timeout = 15000) {
  const ok = typeof predicate === 'string' ? (hash) => hash.startsWith(predicate) : predicate;
  const end = Date.now() + timeout;
  let since = null;
  while (Date.now() < end) {
    let hash = '';
    try { hash = await hashNow(page); } catch { hash = ''; }
    if (ok(hash)) {
      if (since === null) since = Date.now();
      if (Date.now() - since >= holdMs) return hash;
    } else since = null;
    await page.waitForTimeout(120);
  }
  return null;
}
async function waitNode(predicate, timeout = 10000, interval = 50) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (predicate()) return true;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return false;
}

// Real mouse press/release at the element center (no synthetic DOM click call).
async function pointerPress(page, selector, { holdMs = 0 } = {}) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible' });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('no bounding box for ' + selector);
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  if (holdMs > 0) await page.waitForTimeout(holdMs);
  await page.mouse.up();
  return { cx, cy };
}

// Real browser Back is begun but never awaited to settlement: while the existing hash
// guard is prompting/vetoing, page.goBack() may stay pending. The caller records the
// promise state with settle() and observes the actual route/DOM instead.
function beginBack(page) {
  try {
    return page.goBack({ waitUntil: 'commit', timeout: 15000 })
      .then(result => ({ state: 'resolved', response: !!result }))
      .catch(error => ({ state: 'rejected', message: String(error && error.message || error).slice(0, 300) }));
  } catch (error) {
    return Promise.resolve({ state: 'sync-rejected', message: String(error && error.message || error).slice(0, 300) });
  }
}
function settle(promise, ms = 3000) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve({ state: 'pending' }), ms)),
  ]);
}

// Dialogs are observed and only ever dismissed. No beforeunload/alert is auto-accepted.
// alert/confirm/prompt are unexpected for this suite and are a measured FAIL at audit.
function observeDialogs(page, tag) {
  const state = { events: [], unexpected: [] };
  async function handler(dialog) {
    const type = dialog.type();
    const event = { tag, type, plannedAction: 'dismiss', actualAction: null, at: new Date().toISOString(), unexpected: type !== 'beforeunload' };
    try { await dialog.dismiss(); event.actualAction = 'dismiss'; }
    catch (error) { event.actualAction = 'error'; event.error = String(error && error.message || error).slice(0, 200); }
    state.events.push(event);
    if (event.unexpected) state.unexpected.push(event);
  }
  page.on('dialog', handler);
  return { state, detach: () => { try { page.off('dialog', handler); } catch { /* page may be gone */ } } };
}

// Exact-injection console policy: a resource-failure line is excluded only when it
// names this case's own injected status on exactly the resource path that injection
// recorded. Warnings are never excluded; they are returned verbatim.
function caseErrors(fixtureReport, id) {
  const pageErrors = fixtureReport.pageErrors.filter(item => item.id === id);
  const injected = (fixtureReport.injectedFailures || []).filter(item => item.id === id);
  const rawConsole = fixtureReport.consoleErrors.filter(item => item.id === id);
  const warnings = fixtureReport.consoleWarnings.filter(item => item.id === id);
  const kept = [];
  const excluded = [];
  for (const item of rawConsole) {
    const message = item.message || '';
    const resourceFailure = /^Failed to load resource/i.test(message.trim());
    const hit = resourceFailure
      ? injected.find(entry => item.path && entry.path === item.path && new RegExp(`status of\\s+${entry.status}\\b`).test(message))
      : null;
    if (hit) excluded.push({ message, path: item.path, reason: 'matched fixture injection ' + hit.injection + ' ' + hit.method + ' ' + hit.path + ' -> ' + hit.status });
    else kept.push(item);
  }
  return { pageErrors, consoleErrors: kept, consoleRaw: rawConsole.length, consoleExcluded: excluded.length, excluded, injected, warnings };
}

async function auditTransport(reporter, ctx, tag) {
  const errors = caseErrors(reporter.fixtureReport(), ctx.state.id);
  const unknown = reporter.fixtureReport().unexpected.filter(item => item.id === ctx.state.id);
  const dialogues = ctx.dialogs ? ctx.dialogs.state.events : [];
  for (const warning of errors.warnings) {
    reporter.report.consoleWarnings.push({
      case: tag,
      ...warning,
      knownSettingsTextAppIcon: /Do not nest other components in text/i.test(warning.message || ''),
    });
  }
  reporter.report.warningsStatus = reporter.report.consoleWarnings.length ? 'RECORDED_NAMED' : 'NONE';
  reporter.report.dialogues.push({ case: tag, events: dialogues });
  reporter.check(tag + '-no-pageerror', errors.pageErrors.length === 0, { pageErrors: errors.pageErrors });
  reporter.check(tag + '-no-unexcluded-console-error', errors.consoleErrors.length === 0, {
    consoleErrors: errors.consoleErrors,
    consoleRaw: errors.consoleRaw,
    excluded: errors.excluded,
    note: 'only a fixture-injected status on the exact injected path may be excluded',
  });
  reporter.check(tag + '-no-unknown-501', unknown.length === 0, { unexpected: unknown });
  reporter.check(tag + '-no-unexpected-dialog', !ctx.dialogs || ctx.dialogs.state.unexpected.length === 0, {
    dialogues,
    policy: 'dialogs are dismissed, never accepted; alert/confirm/prompt are unexpected here',
  });
  reporter.report.transport.push({
    case: tag,
    fixtureId: ctx.state.id,
    counts: countsOf(ctx),
    pending: ctx.pending(),
    injectedFailures: errors.injected,
    pageErrors: errors.pageErrors,
    consoleErrors: errors.consoleErrors,
    consoleWarnings: errors.warnings,
    excluded: errors.excluded,
    unknown,
    dialogues,
    fulfillErrors: reporter.fixtureReport().fulfillErrors.filter(item => item.id === ctx.state.id),
    fulfillResults: reporter.fixtureReport().fulfillResults.filter(item => item.id === ctx.state.id),
    httpResponses: reporter.fixtureReport().httpResponses.filter(item => item.id === ctx.state.id),
  });
  reporter.write();
  return errors;
}

// Runs one independent case: gate, strict freeze, unique run dir, guaranteed close,
// source/dependency re-hash after, and explicit 0/1/2 code.
async function execute({ group, fixture }, main) {
  const { run, executor, expectedPage, freezeCheck } = gate();
  const dir = prepareDir(group, run);
  const reporter = createReporter({
    dir, group, run, executor, expectedPage,
    approvedPage: freezeCheck.approvedPage,
    sourceHashesBefore: freezeCheck.actual,
    dependenciesBefore: freezeCheck.dependencies,
    freezePreparedAt: freezeCheck.preparedAt,
  });
  reporter.fixtureReport = () => fixture.report;
  let outcome = { code: 2, report: reporter.report };
  try {
    fixture.freeze(Object.fromEntries(fixture.sources.map(file => [file, freezeCheck.actual[file]])));
    await fixture.init();
    await main({ reporter, dir, fixture });
  } catch (error) {
    if (error instanceof SetupIncomplete) {
      if (!reporter.report.setupFailures.length) reporter.recordSetup(error.name, error.message);
    } else if (error instanceof ProductFailure) {
      reporter.fail(error);
    } else {
      reporter.recordSetup('unexpected-error', String(error && error.message || error), { stack: error && error.stack });
    }
  } finally {
    try {
      await fixture.close();
      reporter.report.closed = true;
    } catch (closeError) {
      reporter.report.closed = false;
      reporter.recordSetup('fixture-close', 'Context close failed: ' + String(closeError && closeError.message || closeError));
    }
    const after = {};
    for (const file of Object.keys(freezeCheck.actual)) after[file] = sha256(file);
    reporter.report.sourceHashesAfter = after;
    reporter.report.sourceStable = same(freezeCheck.actual, after);
    if (reporter.report.sourceStable !== true) reporter.recordSetup('source-stable-during-run', 'Frozen source changed during the run; this is not a product verdict.', { sourceHashesAfter: after });
    const depsAfter = {};
    for (const file of DEPS) depsAfter[file] = sha256(file);
    reporter.report.dependenciesAfter = depsAfter;
    reporter.report.dependenciesStable = same(freezeCheck.dependencies, depsAfter);
    if (reporter.report.dependenciesStable !== true) reporter.recordSetup('dependencies-stable-during-run', 'Frozen mobile package/lock changed during the run; this is not a product verdict.', { dependenciesAfter: depsAfter });
    if (reporter.report.closed !== true) reporter.recordSetup('fixture-closed-all-contexts', 'Not every browser context closed; the run is incomplete.');
    if (reporter.report.checks.length === 0 && reporter.report.setupFailures.length === 0) reporter.recordSetup('executed-check-count', 'No executed checks were recorded; an empty run is not a pass.');
    if (reporter.report.screenshotFailures.length > 0) reporter.recordSetup('screenshots-recorded', 'At least one step screenshot failed; the evidence set is incomplete.', { screenshotFailures: reporter.report.screenshotFailures });
    const report = reporter.finish();
    const passedOnly = report.result === 'PASS_EXECUTED_CHECKS' && report.checks.length > 0;
    const code = passedOnly ? 0 : report.result === 'FAIL' ? 1 : 2;
    outcome = { code, report };
  }
  return outcome;
}

module.exports = {
  ROOT, refuse, sha256, verifyFreeze, gate, prepareDir, createReporter, execute,
  facts, waitIdle, waitPresent, waitGone, waitRoute, waitRouteStable, waitNode, hashNow,
  pointerPress, beginBack, settle, observeDialogs, caseErrors, auditTransport, same, countsOf,
  SetupIncomplete, ProductFailure, PAGE, SUPPORT, DEPS,
};
