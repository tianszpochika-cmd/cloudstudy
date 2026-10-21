// Prepared lifecycle helpers. No browser is launched by importing this module.
// Adapted from dsh-20261020-risk/risk-lib.cjs (that sibling remains unchanged).
// Keeps the 8-source freeze, exact-injection console policy and done-measurement
// helpers. Exit semantics for this suite:
//   0 only when every selected case actually executed and every check passed;
//   1 when a measured product assertion failed;
//   2 for refusal / setup incomplete / NOT_RUN / no executed checks.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '../../../../..');
const FREEZE_FILE = path.join(__dirname, 'source-freeze.json');
const RUN_NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;
const GROUP_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;
const EXECUTOR_RE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,79}$/;

class SetupIncomplete extends Error {}
class ProductFailure extends Error {}

function refuse(message) {
  console.error('REFUSED: ' + message + ' Nothing was started.');
  process.exit(2);
}

function sha256(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.resolve(ROOT, rel))).digest('hex');
}

function verifyDependencies(freeze) {
  const expected = freeze.dependencies || {};
  const actual = {};
  const drift = [];
  for (const file of Object.keys(expected)) actual[file] = sha256(file);
  for (const [file, want] of Object.entries(expected)) {
    if (actual[file] !== want) drift.push({ file, expected: want, actual: actual[file] });
  }
  // Never auto-allow a freeze file that silently drops or narrows the dependency guard.
  if (!freeze.dependencies || Object.keys(expected).length < 2) {
    drift.push({ file: '<dependencies>', expected: 'apps/mobile/package.json + pnpm-lock.yaml', actual: 'missing-or-incomplete' });
  }
  return { ok: drift.length === 0, actual, drift };
}

function verifyFreeze() {
  const freeze = JSON.parse(fs.readFileSync(FREEZE_FILE, 'utf8'));
  const actual = {};
  const drift = [];
  for (const file of Object.keys(freeze.sources)) actual[file] = sha256(file);
  for (const [file, expected] of Object.entries(freeze.sources)) {
    if (actual[file] !== expected) drift.push({ file, expected, actual: actual[file] });
  }
  const dependencies = verifyDependencies(freeze);
  return {
    ok: drift.length === 0 && dependencies.ok,
    preparedAt: freeze.preparedAt,
    actual,
    drift,
    dependencies: dependencies.actual,
    dependencyDrift: dependencies.drift,
  };
}

function defaultRunId() {
  return 'lifecycle-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function runIdentity(env) {
  if (env.MB006_CONFIRM_BROWSER !== '1') {
    refuse('set MB006_CONFIRM_BROWSER=1 to run the prepared lifecycle suite in the Root review environment.');
  }
  const run = (env.MB006_LIFECYCLE_RUN || '').trim() || defaultRunId();
  if (!RUN_NAME_RE.test(run)) refuse('MB006_LIFECYCLE_RUN must match /^[a-z0-9][a-z0-9-]{0,63}$/i.');
  const executor = (env.MB006_LIFECYCLE_EXECUTOR || '').trim() || 'prepared';
  if (!EXECUTOR_RE.test(executor)) refuse('MB006_LIFECYCLE_EXECUTOR must be 1-80 characters from [A-Za-z0-9 ._-].');
  return { run, executor };
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

function createReporter({ dir, group, run, executor, sourceHashesBefore, freezePreparedAt }) {
  const report = {
    label: 'Lifecycle prepared suite (Root review executor)',
    preparedBy: 'DSH author (test preparation only; no browser was launched by DSH and no test was run by DSH)',
    scope: 'MB006_LIFECYCLE_GET_PREPARED_NOT_RUN',
    group,
    run,
    executor,
    fixture: 'synthetic API transport via fixture.cjs; real uni-app login, guard and browser history',
    native: 'NOT_RUN (no native/device capability in this prepared suite)',
    realBackend: 'NOT_RUN (no real backend, IAM, DB or network is contacted)',
    suspectedIssue: 'UNVERIFIED: shared store loadPlacement checks subject+identityRevision after the await; a held same-owner GET may overwrite later same-owner progress. Not labelled PASS or FAIL before execution.',
    startedAt: new Date().toISOString(),
    freezePreparedAt,
    sourceHashesBefore,
    sourceHashesAfter: null,
    sourceStable: null,
    dependenciesBefore: null,
    dependenciesAfter: null,
    dependenciesStable: null,
    cases: [],
    checks: [],
    notRun: [],
    setupFailures: [],
    screenshots: [],
    routes: [],
    closed: false,
    failure: null,
    result: 'NOT_RUN',
  };
  function write() {
    report.summary = {
      cases: report.cases.length,
      checks: report.checks.length,
      passed: report.checks.filter(c => c.result === 'PASS').length,
      failed: report.checks.filter(c => c.result === 'FAIL').length,
      notRun: report.notRun.length,
      setupFailures: report.setupFailures.length,
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
    // Scroll before the screenshot so DOM coordinates and the PNG share a viewport.
    await page.evaluate(() => scrollTo(0, 0));
    const file = path.join(dir, name + '.png');
    await page.screenshot({ path: file, fullPage: true });
    report.screenshots.push(name + '.png');
    write();
    return file;
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
    if (failed > 0 || report.failure) report.result = 'FAIL';
    else if (report.checks.length === 0 || report.setupFailures.length > 0 || report.notRun.length > 0) report.result = 'BLOCKED_SETUP_INCOMPLETE';
    else report.result = 'PASS_EXECUTED_CHECKS';
    report.completion = 'NOT_THE_WHOLE_PAGE';
    if (report.notRun.length > 0) report.caveat = 'Executed checks only. notRun entries are untested branches, not passes.';
    write();
    const manifest = {
      label: report.label,
      preparedBy: report.preparedBy,
      group,
      run,
      executor,
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
      setupFailures: report.setupFailures,
      failure: report.failure,
      routes: report.routes,
      screenshots: report.screenshots,
      cases: report.cases.map(c => ({ name: c.name, outcome: c.outcome, setup: c.setup })),
      fixture: report.fixture,
      native: report.native,
      realBackend: report.realBackend,
      transport: report.transport,
      closed: report.closed,
    };
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    return report;
  }
  write();
  return { report, write, check, product, setup, recordSetup, notRun, startCase, endCase, shot, route, fail, finish, dir };
}

// ── DOM facts (read-only) ────────────────────────────────────────────────────
async function facts(page) {
  return page.evaluate(() => {
    const root = document.getElementById('assessment-page');
    const meta = root?.querySelector('.assessment-question-meta');
    const bar = root?.querySelector('[role=progressbar]');
    const stem = root?.querySelector('.assessment-stem');
    const active = document.activeElement;
    const ids = ['assessment-page', 'assessment-guide', 'assessment-question', 'assessment-report', 'assessment-skipped', 'assessment-pending', 'assessment-leave-confirmation', 'assessment-retest-confirmation', 'assessment-error', 'assessment-submit', 'assessment-reload-answer', 'assessment-title'];
    return {
      url: location.href,
      route: location.hash.split('?')[0],
      title: document.title,
      root: !!root,
      bodyLen: root ? root.innerText.length : 0,
      bodyText: root ? root.innerText : '',
      overlay: !!document.querySelector('vite-error-overlay'),
      present: Object.fromEntries(ids.map(id => [id, !!document.getElementById(id)])),
      busy: root ? root.getAttribute('aria-busy') : null,
      options: root ? [...root.querySelectorAll('.assessment-option')].map(el => ({ id: el.id, pressed: el.getAttribute('aria-pressed'), disabled: el.hasAttribute('disabled'), text: (el.innerText || '').trim() })) : [],
      submit: (() => { const el = document.getElementById('assessment-submit'); return el ? { disabled: el.hasAttribute('disabled'), text: (el.innerText || '').trim() } : null; })(),
      titleText: (document.getElementById('assessment-title')?.textContent || '').trim(),
      errorText: (document.getElementById('assessment-error')?.innerText || '').trim(),
      meta: meta ? [...meta.children].map(c => c.textContent.trim()) : null,
      valuenow: bar ? bar.getAttribute('aria-valuenow') : null,
      valuemax: bar ? bar.getAttribute('aria-valuemax') : null,
      valuetext: bar ? bar.getAttribute('aria-valuetext') : null,
      stem: stem ? stem.textContent.trim() : null,
      active: active ? { tag: active.tagName.toLowerCase(), id: active.id || '' } : null,
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

// Exact-injection console policy copied from the risk suite: a resource-failure
// console line is excluded only when it names this case's own injected status on
// exactly the resource path that injection recorded. Everything else is kept.
function caseErrors(fixtureReport, id) {
  const pageErrors = fixtureReport.pageErrors.filter(item => item.id === id);
  const injected = (fixtureReport.injectedFailures || []).filter(item => item.id === id);
  const rawConsole = fixtureReport.consoleErrors.filter(item => item.id === id);
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
  return { pageErrors, consoleErrors: kept, consoleRaw: rawConsole.length, consoleExcluded: excluded.length, excluded, injected };
}

function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// Runs one case: guards, 8-source freeze, fresh run dir, guaranteed close,
// source re-hash after, and an explicit 0/1/2 code returned to the driver.
async function execute({ group, fixture }, main) {
  const { run, executor } = runIdentity(process.env);
  const freezeCheck = verifyFreeze();
  if (!freezeCheck.ok) {
    refuse('frozen source drift before start: ' + JSON.stringify(freezeCheck.drift));
  }
  const dir = prepareDir(group, run);
  const sourceHashesBefore = freezeCheck.actual;
  const dependenciesBefore = freezeCheck.dependencies;
  const reporter = createReporter({ dir, group, run, executor, sourceHashesBefore, freezePreparedAt: freezeCheck.preparedAt });
  reporter.report.dependenciesBefore = dependenciesBefore;
  reporter.write();
  const fixtureSources = Object.fromEntries(fixture.sources.map(file => [file, sourceHashesBefore[file]]));
  let outcome = { code: 2, report: reporter.report };
  try {
    fixture.freeze(fixtureSources);
    await fixture.init();
    await main({ reporter, dir, fixture, sourceHashesBefore });
  } catch (error) {
    if (error instanceof SetupIncomplete) {
      if (!reporter.report.setupFailures.length) reporter.recordSetup(error.name, error.message);
    } else if (error instanceof ProductFailure) {
      reporter.fail(error);
    } else {
      // An unexpected harness/timeout error is not a measured product assertion.
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
    for (const file of Object.keys(sourceHashesBefore)) after[file] = sha256(file);
    reporter.report.sourceHashesAfter = after;
    reporter.report.sourceStable = same(sourceHashesBefore, after);
    if (reporter.report.sourceStable !== true) {
      reporter.recordSetup('source-stable-during-run', 'Frozen source changed during the run; the run is not a product verdict.', { sourceHashesAfter: after });
    }
    const dependenciesAfter = {};
    for (const file of Object.keys(dependenciesBefore)) dependenciesAfter[file] = sha256(file);
    reporter.report.dependenciesAfter = dependenciesAfter;
    reporter.report.dependenciesStable = same(dependenciesBefore, dependenciesAfter);
    if (reporter.report.dependenciesStable !== true) {
      reporter.recordSetup('dependencies-stable-during-run', 'Frozen mobile package/lock changed during the run; the run is not a product verdict.', { dependenciesAfter });
    }
    if (reporter.report.closed !== true) {
      reporter.recordSetup('fixture-closed-all-contexts', 'Not every browser context closed; the run is incomplete.');
    }
    if (reporter.report.checks.length === 0 && reporter.report.setupFailures.length === 0) {
      reporter.recordSetup('executed-check-count', 'No executed checks were recorded; an empty run is not a pass.');
    }
    reporter.report.transport = {
      requests: fixture.report.requests.length,
      unexpected: fixture.report.unexpected,
      targetReads: fixture.report.targetReads,
      injectedFailures: fixture.report.injectedFailures,
      pageErrors: fixture.report.pageErrors.length,
      consoleErrors: fixture.report.consoleErrors.length,
    };
    const report = reporter.finish();
    const passedOnly = report.result === 'PASS_EXECUTED_CHECKS' && report.checks.length > 0;
    const code = passedOnly ? 0 : report.result === 'FAIL' ? 1 : 2;
    outcome = { code, report };
  }
  return outcome;
}

module.exports = {
  ROOT, refuse, sha256, verifyFreeze, runIdentity, prepareDir, createReporter, execute,
  facts, waitIdle, waitPresent, waitGone, waitRoute, waitNode, pointerPress, caseErrors, same,
  SetupIncomplete, ProductFailure,
};
