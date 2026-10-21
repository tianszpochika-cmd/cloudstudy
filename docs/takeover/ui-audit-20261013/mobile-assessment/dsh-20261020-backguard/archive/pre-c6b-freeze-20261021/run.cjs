// TEST PREPARATION ONLY. DSH wrote this suite; DSH did not launch a browser or run it.
// Root executes it in the review environment. Importing this file launches nothing.
//
// Scope: the C5c H5 Vue Router public onBeforeRouteLeave guard on the assessment page,
// exercised with the real login/guard/UI/navigation and the strict synthetic API
// transport from the sibling ../dsh-20261020-risk/fixture.cjs. No product server, Git,
// real backend, native runner, external page, storage/token reader, or app-state hook
// is used. See README.md for the execution contract.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const lib = require('../dsh-20261020-risk/risk-lib.cjs');
const f = require('../dsh-20261020-risk/fixture.cjs');

const ROOT = lib.ROOT;
const BASE = f.BASE;
const ASSESSMENT_PATH = '#/pages/assessment/assessment';
const PAGE = 'apps/mobile/src/pages/assessment/assessment.vue';
// C5c changes the mobile manifest, not the root manifest. Root's EXPECTED_PACKAGE_SHA
// therefore means apps/mobile/package.json; pnpm-lock.yaml stays at the workspace root.
const DEPS = ['apps/mobile/package.json', 'pnpm-lock.yaml'];
const ROOT_MANIFEST = 'package.json';
const CASES = ['cancel-confirm', 'busy-back', 'repeat-back', 'repeat-back-confirm', 'repeat-native-accept', 'clean-back'];
const RUN_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;
const EXECUTOR_RE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,79}$/;
const HEX_RE = /^[0-9a-f]{64}$/;
// Root-approved C5c facts. A Root-supplied hash that differs from these is refused
// rather than silently exercising a different tree.
const APPROVED_PAGE_SHA = '719cc0cef407b492544b1bff39537324b0672126df287bf7d5644a25b6fe81c1';
const APPROVED_MOBILE_PACKAGE_SHA = '484382c73929055cc4ecd9a83679f8bab72388dd8069f71a056b3bbc595c0078';
const APPROVED_LOCK_SHA = 'd57a87ca84985549fd53c69b1fe1d59db0b136036f2f7bf640d3b30c0a106624';
const ROOT_MANIFEST_SHA = 'e2bf8a40f36d435116326383be7fff376cb5fe126420583affceca76fa2c03c4';
// Reviewed dependencies that C5c must leave byte-identical. The page hash is supplied
// by Root through MB006_BACKGUARD_EXPECTED_PAGE_SHA and must equal the approved C5c hash.
const STABLE_SOURCES = {
  'packages/i18n/src/mobile-experience.ts': '6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380',
  'apps/mobile/src/api/learner-content.ts': '43ce2ad5d6519b5fab7e38867d1349b569d08b6153b74c87e5c96f11e24e1ae6',
  'apps/mobile/src/stores/learner-content.ts': '95cc92496db996242d91baed3301d76f985e4e3b9134e1e50c2b9ab8d41e4c61',
  'apps/mobile/src/stores/session.ts': 'd944c9e84617af5ad553d2fbc1fd0c07120ce790411dbe02603f9338333f8931',
  'apps/mobile/src/auth/navigation.ts': '7365fec07c55857445fdb1d87b60659734e9e94dc06cfb65afabcb3e8863a4b5',
};

function refuse(message) {
  console.error('REFUSED: ' + message + ' Nothing was started.');
  process.exit(2);
}
class SetupError extends Error {
  constructor(message, detail) { super(message); this.name = 'SetupError'; this.detail = detail; }
}
class SetupIncompleteError extends SetupError {
  constructor(message, detail) { super(message, detail); this.name = 'SetupIncompleteError'; }
}

function sha(rel) { return lib.sha256(rel); }

function dependencyBundleSha() {
  const h = crypto.createHash('sha256');
  for (const rel of DEPS) {
    h.update(rel); h.update('\0');
    h.update(fs.readFileSync(path.resolve(ROOT, rel)));
    h.update('\0');
  }
  return h.digest('hex');
}

function freezeAll() {
  return {
    sources: Object.fromEntries(f.sources.map(rel => [rel, sha(rel)])),
    dependencies: Object.fromEntries(DEPS.map(rel => [rel, sha(rel)])),
    rootManifest: sha(ROOT_MANIFEST),
    dependencyBundle: dependencyBundleSha(),
  };
}

function envHash(name) {
  const value = (process.env[name] || '').trim().toLowerCase();
  if (!value) refuse(name + ' is required: Root must pass the verified 64-hex C5c hash.');
  if (!HEX_RE.test(value)) refuse(name + ' must be exactly 64 lowercase hexadecimal characters.');
  return value;
}

function selectedCases(argv) {
  if (argv.length === 0) return [...CASES];
  if (argv.length === 2 && argv[0] === '--case' && CASES.includes(argv[1])) return [argv[1]];
  refuse('usage: node run.cjs [--case ' + CASES.join('|') + ']');
}

function gate(argv) {
  if (process.env.MB006_CONFIRM_BROWSER !== '1') {
    refuse('set MB006_CONFIRM_BROWSER=1 to run the prepared backguard suite.');
  }
  const run = (process.env.MB006_BACKGUARD_RUN || '').trim();
  if (!run) refuse('MB006_BACKGUARD_RUN is required and must be unique; runs are never overwritten.');
  if (!RUN_RE.test(run)) refuse('MB006_BACKGUARD_RUN must match /^[a-z0-9][a-z0-9-]{0,63}$/i.');
  const executor = (process.env.MB006_BACKGUARD_EXECUTOR || '').trim();
  if (!executor) refuse('MB006_BACKGUARD_EXECUTOR is required (1-80 chars from [A-Za-z0-9 ._-]).');
  if (!EXECUTOR_RE.test(executor)) refuse('MB006_BACKGUARD_EXECUTOR must be 1-80 chars from [A-Za-z0-9 ._-].');
  const cases = selectedCases(argv);
  const expectedPage = envHash('MB006_BACKGUARD_EXPECTED_PAGE_SHA');
  const expectedPackage = envHash('MB006_BACKGUARD_EXPECTED_PACKAGE_SHA');
  const expectedLock = envHash('MB006_BACKGUARD_EXPECTED_LOCK_SHA');
  if (expectedPage !== APPROVED_PAGE_SHA) {
    refuse('MB006_BACKGUARD_EXPECTED_PAGE_SHA is not the Root-approved C5c page hash.');
  }
  if (expectedPackage !== APPROVED_MOBILE_PACKAGE_SHA) {
    refuse('MB006_BACKGUARD_EXPECTED_PACKAGE_SHA must be the Root-approved apps/mobile/package.json hash.');
  }
  if (expectedLock !== APPROVED_LOCK_SHA) {
    refuse('MB006_BACKGUARD_EXPECTED_LOCK_SHA is not the Root-approved pnpm-lock.yaml hash.');
  }
  let actual;
  try { actual = freezeAll(); }
  catch (error) { refuse('could not hash the frozen sources/dependencies: ' + String(error.message || error)); }
  if (actual.sources[PAGE] !== expectedPage) {
    refuse('page hash does not match the Root-supplied C5c hash. actual=' + actual.sources[PAGE] + ' expected=' + expectedPage);
  }
  for (const [rel, expected] of Object.entries(STABLE_SOURCES)) {
    if (actual.sources[rel] !== expected) {
      refuse('reviewed dependency source drifted: ' + rel + ' actual=' + actual.sources[rel] + ' expected=' + expected);
    }
  }
  if (actual.dependencies['apps/mobile/package.json'] !== expectedPackage) {
    refuse('apps/mobile/package.json hash does not match MB006_BACKGUARD_EXPECTED_PACKAGE_SHA. actual=' + actual.dependencies['apps/mobile/package.json']);
  }
  if (actual.dependencies['pnpm-lock.yaml'] !== expectedLock) {
    refuse('pnpm-lock.yaml hash does not match MB006_BACKGUARD_EXPECTED_LOCK_SHA. actual=' + actual.dependencies['pnpm-lock.yaml']);
  }
  if (actual.rootManifest !== ROOT_MANIFEST_SHA) {
    refuse('root package.json drifted; C5c must leave the root manifest unchanged. actual=' + actual.rootManifest);
  }
  return {
    run, executor, cases,
    expected: {
      page: expectedPage, package: expectedPackage, lock: expectedLock,
      packagePath: 'apps/mobile/package.json', lockPath: 'pnpm-lock.yaml',
      rootManifest: ROOT_MANIFEST_SHA, rootManifestPath: ROOT_MANIFEST,
    },
    actual,
  };
}

function prepareRunDir(run) {
  const runs = path.resolve(__dirname, 'runs');
  const dir = path.resolve(runs, run);
  if (path.dirname(dir) !== runs) refuse('run directory resolved outside runs/: ' + dir);
  if (fs.existsSync(dir)) refuse('run directory already exists and is never overwritten: ' + dir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function makeReporter({ dir, run, executor, cases, expected, before }) {
  const report = {
    scope: 'MB006_BACKGUARD_SCOPED_EXECUTION_NOT_WHOLE_PAGE',
    preparedBy: 'DSH (test preparer; DSH did not execute this suite or launch a browser)',
    preparationArchive: {
      path: 'archive/pre-c5b-fix-20261020',
      runCjsSha256: '1f1520f47615950ad2968641112bc869bcb47527b6ab410ac042bba052cd3d34',
      readmeSha256: '836464c3ba61d06a2b5eee3c1401385732c026e66a2f32e2aca2e8e0bf9b22e6',
    },
    executedBy: executor,
    group: 'backguard',
    run,
    casesSelected: cases,
    startedAt: new Date().toISOString(),
    fixture: 'strict synthetic API transport via ../dsh-20261020-risk/fixture.cjs; real uni-app login, Vue Router guard, UI and navigation',
    native: 'NOT_RUN (no native/device capability in this H5 suite)',
    realBackend: 'NOT_RUN (no real backend, IAM, DB or external network is contacted)',
    projectRoot: ROOT,
    expected,
    approved: {
      page: APPROVED_PAGE_SHA,
      mobilePackage: APPROVED_MOBILE_PACKAGE_SHA,
      lock: APPROVED_LOCK_SHA,
      rootManifest: ROOT_MANIFEST_SHA,
    },
    dependencyFiles: DEPS,
    rootManifestPath: ROOT_MANIFEST,
    stableSourceExpectations: STABLE_SOURCES,
    sourceHashesBefore: before.sources,
    dependencyHashesBefore: before.dependencies,
    rootManifestBefore: before.rootManifest,
    dependencyBundleBefore: before.dependencyBundle,
    sourceHashesAfter: null,
    dependencyHashesAfter: null,
    rootManifestAfter: null,
    dependencyBundleAfter: null,
    sourceStable: null,
    dependenciesStable: null,
    rootManifestStable: null,
    cases: [],
    checks: [],
    notRun: [],
    setupFailures: [],
    uxFindings: [],
    observations: [],
    screenshots: [],
    screenshotFailures: [],
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
      setupFailed: report.setupFailures.length,
      setupIncomplete: report.cases.filter(c => c.outcome === 'SETUPINCOMPLETE').length,
      uxFindings: report.uxFindings.length,
      notRun: report.notRun.length,
      result: report.result,
    };
    fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(report, null, 2));
  }
  function check(name, ok, detail) {
    report.checks.push({ name, result: ok ? 'PASS' : 'FAIL', ...(detail === undefined ? {} : { detail }) });
    write();
    return ok;
  }
  function notRun(name, reason) { report.notRun.push({ name, reason }); write(); }
  function setupFail(name, reason, detail) {
    report.setupFailures.push({ case: name, reason, ...(detail === undefined ? {} : { detail }) });
    report.notRun.push({ name: name + '-scenario', reason: 'SETUP incomplete/failed: ' + reason });
    write();
  }
  function uxFinding(name, detail) { report.uxFindings.push({ case: name, ...detail }); write(); }
  function startCase(name, extra) {
    const item = { name, startedAt: new Date().toISOString(), ...(extra || {}) };
    report.cases.push(item); write(); return item;
  }
  function endCase(item, outcome, details) {
    Object.assign(item, { outcome, finishedAt: new Date().toISOString(), ...(details || {}) });
    write();
  }
  async function shot(page, name) {
    const file = path.join(dir, name + '.png');
    try {
      await page.screenshot({ path: file, fullPage: true });
      report.screenshots.push(name + '.png');
    } catch (error) {
      report.screenshotFailures.push({ name: name + '.png', message: String(error.message || error).slice(0, 300) });
    }
    write();
  }
  function observe(name, value) { report.observations.push({ name, at: new Date().toISOString(), ...value }); write(); }
  function fail(error) { report.failure = { message: String(error && error.message || error), stack: error && error.stack }; }
  function finish(extra) {
    Object.assign(report, extra || {});
    const failed = report.checks.filter(c => c.result === 'FAIL').length;
    const anySetup = report.setupFailures.length > 0;
    const anyIncomplete = report.cases.some(item => item.outcome === 'SETUPINCOMPLETE');
    const anyUx = report.uxFindings.length > 0;
    const anyNonPassCase = report.cases.some(item => item.outcome !== 'PASS');
    if (report.failure || failed > 0) report.result = 'FAIL';
    else if (report.cases.some(item => item.outcome === 'FAIL')) report.result = 'FAIL';
    else if (anyIncomplete) report.result = 'SETUPINCOMPLETE';
    else if (anySetup) report.result = 'SETUPFAILED';
    else if (anyUx) report.result = 'UX_FINDING_NOT_PASS';
    else if (anyNonPassCase) report.result = 'INCOMPLETE';
    else if (report.checks.length === 0) {
      report.result = 'FAIL';
      report.failure = { message: 'No executed checks were recorded; an empty run is not a pass.' };
    } else report.result = 'PASS_SCOPED_ACTUAL';
    report.completion = 'NOT_THE_WHOLE_PAGE';
    if (report.notRun.length > 0) report.caveat = 'Executed scoped checks only. notRun entries are untested or out-of-scope branches, not passes.';
    write();
    const manifest = {
      preparedBy: report.preparedBy,
      preparationArchive: report.preparationArchive,
      executedBy: report.executedBy,
      group: report.group,
      run: report.run,
      casesSelected: report.casesSelected,
      result: report.result,
      completion: report.completion,
      sourceHashesBefore: report.sourceHashesBefore,
      sourceHashesAfter: report.sourceHashesAfter,
      sourceStable: report.sourceStable,
      dependenciesStable: report.dependenciesStable,
      rootManifestBefore: report.rootManifestBefore,
      rootManifestAfter: report.rootManifestAfter,
      rootManifestStable: report.rootManifestStable,
      dependencyFiles: report.dependencyFiles,
      rootManifestPath: report.rootManifestPath,
      checks: report.checks.map(c => ({ name: c.name, result: c.result })),
      cases: report.cases.map(c => ({ name: c.name, outcome: c.outcome })),
      notRun: report.notRun,
      setupFailures: report.setupFailures,
      uxFindings: report.uxFindings,
      screenshots: report.screenshots,
      screenshotFailures: report.screenshotFailures,
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
  return { report, write, check, notRun, setupFail, uxFinding, startCase, endCase, shot, observe, fail, finish, dir };
}

let reporter = null;

// ── read-only observations ───────────────────────────────────────────────────
async function where(page) {
  try {
    return await page.evaluate(() => {
      const hash = location.hash;
      return {
        url: location.href,
        origin: location.origin,
        hash,
        path: hash.split('?')[0],
        ready: document.readyState,
        bodyLen: document.body ? document.body.innerText.length : 0,
      };
    });
  } catch (error) {
    return { url: null, origin: null, hash: null, path: null, error: String(error.message || error).slice(0, 240) };
  }
}

async function dialogFacts(page) {
  try {
    return await page.evaluate(() => {
      const all = [...document.querySelectorAll('#assessment-leave-confirmation')];
      const first = all[0];
      const button = (id) => {
        const el = document.getElementById(id);
        return el ? { text: (el.innerText || '').trim(), disabled: el.hasAttribute('disabled'), ariaDisabled: el.getAttribute('aria-disabled') } : null;
      };
      return {
        count: all.length,
        visible: !!first && first.getBoundingClientRect().width > 0 && first.getBoundingClientRect().height > 0,
        text: first ? (first.innerText || '').trim() : '',
        cancel: button('assessment-leave-cancel'),
        confirm: button('assessment-leave-confirm'),
        activeId: document.activeElement ? (document.activeElement.id || '') : '',
        ariaBusy: document.getElementById('assessment-page')?.getAttribute('aria-busy') ?? null,
      };
    });
  } catch (error) {
    return { count: 0, visible: false, error: String(error.message || error).slice(0, 240) };
  }
}

async function questionText(page) {
  try {
    return await page.evaluate(() => (document.getElementById('assessment-question')?.innerText || '').trim());
  } catch { return ''; }
}

async function snapshot(page, current) {
  const w = await where(page);
  const facts = await lib.facts(page).catch(() => null);
  const dialog = await dialogFacts(page);
  const question = await questionText(page);
  return {
    url: w.url, origin: w.origin, hash: w.hash, path: w.path, bodyLen: w.bodyLen,
    busy: facts ? facts.busy : null,
    present: facts ? facts.present : null,
    options: facts ? facts.options.map(o => ({ id: o.id, pressed: o.pressed, disabled: o.disabled, text: o.text })) : [],
    submitDisabled: facts && facts.submit ? facts.submit.disabled : null,
    overlay: facts ? facts.overlay : null,
    errorText: facts ? facts.errorText : null,
    activeId: facts && facts.active ? facts.active.id : null,
    focusVisible: facts && facts.active ? facts.active.focusVisible : null,
    dialog,
    questionText: question,
    counts: current ? { ...current.state.counts } : null,
    pending: current ? current.pending() : null,
  };
}

async function waitPrompt(page, timeout = 6000) {
  try {
    await page.locator('#assessment-leave-confirmation').first().waitFor({ state: 'visible', timeout });
    return true;
  } catch { return false; }
}

async function waitLeaveAssessment(page, timeout = 6000) {
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline) {
    last = await where(page);
    if (last.url === 'about:blank' || last.origin === 'null') return { left: true, blank: true, last };
    if (last.origin && last.origin !== BASE) return { left: true, external: true, last };
    if (last.path && last.path !== ASSESSMENT_PATH) return { left: true, last };
    await page.waitForTimeout(120).catch(() => {});
  }
  return { left: false, last };
}

// Do not route this through an awaited page.goBack(): the C5c guard may await the
// confirmation decision, so the caller must hold the promise and click the visible
// confirmation before settling the traversal.
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

function isAppDeparture(w) {
  return !!w && w.origin === BASE && typeof w.path === 'string' && w.path.startsWith('#/pages/') && w.path !== ASSESSMENT_PATH;
}

function isDocumentDeparture(w) {
  return !!w && (w.url === 'about:blank' || (w.origin && w.origin !== 'null' && w.origin !== BASE));
}

// While a Vue Router leave callback is pending, the address bar can already read the
// destination (for example #/pages/login/login) while the assessment DOM and the
// confirmation are still the visible, interactive surface. These helpers assert that
// visible surface and the kept draft, not the pending address-bar hash.
function visibleAssessment(s) {
  return !!s && s.present?.['assessment-page'] === true && s.present?.['assessment-question'] === true;
}
function keepsDraftA(s) {
  return !!s && s.options.find(o => o.id === 'assessment-option-A')?.pressed === 'true';
}

// Missing prompt is only setup-incomplete when real back left no observable trace. If the
// route/document left or the question/draft disappeared, that is a measured UX failure.
async function missingPromptResult(tag, current, page, { before, traversal, phase }) {
  const settled = await settle(traversal, 2500);
  const after = await snapshot(page, current);
  const stillVisible = visibleAssessment(after) && keepsDraftA(after);
  const pathChanged = !!after.path && after.path !== ASSESSMENT_PATH;
  const documentLeft = isDocumentDeparture(after);
  const departed = !stillVisible || pathChanged || documentLeft;
  reporter.observe(tag + '-' + phase + '-no-prompt', { before, after, traversal: settled, departed, stillVisible, pathChanged, documentLeft, nativeDialogs: current.dialogs ? current.dialogs.events : null });
  if (departed) {
    reporter.check(tag + '-' + phase + '-no-prompt-but-departed', false, {
      before, after, traversal: settled,
      note: 'measured UX failure: real back produced no confirmation while the actual route/document left or the question/draft was lost',
    });
    reporter.uxFinding(tag, {
      kind: 'missing-prompt-departure', phase, observed: after,
      note: 'real departure or cleared draft without the leave callback being reached; preserved as a measured UX failure, not setup-incomplete.',
    });
    await observeErrors(tag, current);
    return { outcome: 'FAIL', details: { after, missingPrompt: true, departed } };
  }
  throw new SetupIncompleteError('real back produced no confirmation and no observable route/document/draft change (no history or no observable back)', { before, after, traversal: settled, nativeDialogs: current.dialogs ? current.dialogs.events : null });
}

// A departure is not accepted on one sample: the login landing can bounce back to the
// assessment. Poll briefly and require the non-assessment route to hold.
async function departureStability(page, windowMs = 3000) {
  const samples = [];
  const deadline = Date.now() + windowMs;
  while (Date.now() < deadline) {
    await page.waitForTimeout(300).catch(() => {});
    const w = await where(page);
    samples.push({ path: w.path, url: w.url, origin: w.origin });
    if (w.path === ASSESSMENT_PATH) return { stable: false, returned: true, last: w, samples };
    if (isDocumentDeparture(w)) return { stable: false, document: true, last: w, samples };
  }
  return { stable: samples.length > 0, last: samples.at(-1), samples };
}

function checksFor(tag) { return reporter.report.checks.filter(c => c.name.startsWith(tag + '-')); }
function outcomeFor(tag) {
  const checks = checksFor(tag);
  return checks.length > 0 && checks.every(c => c.result === 'PASS') ? 'PASS' : 'FAIL';
}

// Explicit browser Dialog observation. No message text, headers, token or private data
// is recorded. alert/confirm/prompt are never broadly ignored: they are dismissed and
// recorded as unexpected. A beforeunload dialog is expected only for the repeat-native
// cases; there it is dismissed (repeat-back) or accepted (repeat-native-accept) on purpose.
function observeDialogs(page, tag, { beforeUnloadAction = 'dismiss', expectBeforeUnload = false } = {}) {
  const state = {
    events: [], unexpected: [], phase: 'initial', beforeUnloadAction, expectBeforeUnload,
  };
  async function handler(dialog) {
    const type = dialog.type();
    const planned = type === 'beforeunload' ? state.beforeUnloadAction : 'dismiss';
    const unexpected = type !== 'beforeunload' || !state.expectBeforeUnload;
    const event = {
      tag, type, plannedAction: planned, actualAction: null,
      phase: state.phase, unexpected, at: new Date().toISOString(),
    };
    try {
      if (planned === 'accept') await dialog.accept();
      else await dialog.dismiss();
      event.actualAction = planned;
    } catch (error) {
      event.actualAction = 'error';
      event.error = String(error && error.message || error).slice(0, 200);
    }
    state.events.push(event);
    if (unexpected) state.unexpected.push(event);
    reporter.observe(tag + '-native-dialog', event);
  }
  page.on('dialog', handler);
  state.setPhase = value => { state.phase = value; };
  state.setBeforeUnloadAction = value => { state.beforeUnloadAction = value; };
  state.detach = () => { try { page.off('dialog', handler); } catch { /* page may be gone */ } };
  return state;
}

async function startFlow(caseName, { select = true, beforeUnloadAction = 'dismiss', expectBeforeUnload = false } = {}) {
  let current;
  try {
    current = await f.fresh({ locale: 'zh-CN', theme: 'light', width: 390, height: 844 });
  } catch (error) {
    throw new SetupError('fresh real-login context did not reach the assessment entry: ' + String(error && error.message || error), { case: caseName });
  }
  const page = current.page;
  current.dialogs = observeDialogs(page, caseName, { beforeUnloadAction, expectBeforeUnload });
  try {
    await lib.waitPresent(page, 'assessment-guide', 10000);
    await lib.waitIdle(page, 10000);
    await reporter.shot(page, caseName + '-01-guide');
    if (current.state.counts.start !== 0) throw new SetupError('start request was already issued before pressing the real start button.', { counts: { ...current.state.counts } });
    await lib.pointerPress(page, '#assessment-start', { holdMs: 160 });
    await lib.waitPresent(page, 'assessment-question', 10000);
    await lib.waitIdle(page, 10000);
    if (current.state.counts.start !== 1) throw new SetupError('the real start button did not issue exactly one start request.', { counts: { ...current.state.counts } });
    if (select) {
      await lib.pointerPress(page, '#assessment-option-A', { holdMs: 160 });
      const facts = await lib.facts(page);
      const a = facts.options.find(option => option.id === 'assessment-option-A');
      if (!a || a.pressed !== 'true') throw new SetupError('the real pointer press did not select A.', { options: facts.options.map(o => ({ id: o.id, pressed: o.pressed })) });
      await reporter.shot(page, caseName + '-02-selected-A');
    }
    return current;
  } catch (error) {
    await current.close().catch(() => {});
    throw error;
  }
}

async function observeErrors(tag, current) {
  const errors = lib.caseErrors(f.report, current.state.id);
  const unexpected = f.report.unexpected.filter(item => item.id === current.state.id);
  const injected = (f.report.injectedFailures || []).filter(item => item.id === current.state.id);
  reporter.check(tag + '-no-page-errors', errors.pageErrors.length === 0, { pageErrors: errors.pageErrors });
  reporter.check(tag + '-no-unexcluded-console-errors', errors.consoleErrors.length === 0, {
    consoleErrors: errors.consoleErrors, consoleRaw: errors.consoleRaw, excluded: errors.excluded,
    note: errors.consoleExcluded > 0 ? 'only a fixture-injected status on the exact injected path may be excluded' : 'no exclusions are expected because this suite injects no failures',
  });
  reporter.check(tag + '-no-unknown-501', unexpected.length === 0, { unexpected });
  reporter.check(tag + '-no-unplanned-injections', injected.length === 0, { injectedFailures: injected, planned503: 'none; no 503 is injected by this suite' });
  reporter.check(tag + '-no-unexpected-native-dialogs', !current.dialogs || current.dialogs.unexpected.length === 0, {
    nativeDialogEvents: current.dialogs ? current.dialogs.events : [],
    policy: 'alert/confirm/prompt are recorded as unexpected and dismissed; beforeunload is expected only in repeat-native cases',
  });
  reporter.report.transport.push({
    case: tag,
    fixtureId: current.state.id,
    counts: { ...current.state.counts },
    nativeDialogs: current.dialogs ? current.dialogs.events : [],
    unexpected,
    injectedFailures: injected,
    pageErrors: errors.pageErrors,
    consoleErrors: errors.consoleErrors,
    consoleRaw: errors.consoleRaw,
    consoleExcluded: errors.consoleExcluded,
  });
}

async function cancelVisiblePrompt(page) {
  try {
    if (await page.locator('#assessment-leave-confirmation').count()) {
      await lib.pointerPress(page, '#assessment-leave-cancel', { holdMs: 0 });
      await lib.waitGone(page, 'assessment-leave-confirmation', 3000).catch(() => {});
    }
  } catch { /* best-effort cleanup only; the observed result is already recorded */ }
}

// ── cases ────────────────────────────────────────────────────────────────────
async function caseCancelConfirm() {
  const tag = 'cancel-confirm';
  const current = await startFlow(tag, { select: true });
  const page = current.page;
  try {
    const before = await snapshot(page, current);
    reporter.observe(tag + '-before-back', { before });
    reporter.check(tag + '-starts-on-question-with-A', before.present?.['assessment-question'] === true && before.options.find(o => o.id === 'assessment-option-A')?.pressed === 'true' && before.present?.['assessment-leave-confirmation'] === false, {
      path: before.path, pressed: before.options.map(o => [o.id, o.pressed]), dialog: before.dialog,
    });

    const traversal1 = beginBack(page);
    const prompted1 = await waitPrompt(page, 6000);
    if (!prompted1) {
      return await missingPromptResult(tag, current, page, { before, traversal: traversal1, phase: 'first-back' });
    }
    const pending1 = await snapshot(page, current);
    reporter.observe(tag + '-while-back-pending-before-cancel', { pending: pending1, note: 'URL/hash recorded raw; the pending address bar may already be the destination while the assessment surface and confirmation remain visible.' });
    reporter.check(tag + '-prompt-single-and-visible', pending1.dialog.count === 1 && pending1.dialog.visible === true, { dialog: pending1.dialog });
    reporter.check(tag + '-prompt-keeps-visible-assessment-root', visibleAssessment(pending1) && keepsDraftA(pending1) && pending1.dialog.count === 1, {
      present: pending1.present, pathRaw: pending1.path, urlRaw: pending1.url,
      note: 'visible assessment root + A draft + one confirmation; the pending address bar is recorded, not asserted',
    });
    reporter.check(tag + '-prompt-preserves-A-and-locks-options', pending1.options.find(o => o.id === 'assessment-option-A')?.pressed === 'true' && pending1.options.every(o => o.disabled === true), {
      pressed: pending1.options.map(o => [o.id, o.pressed]), disabled: pending1.options.map(o => [o.id, o.disabled]),
    });
    await reporter.shot(page, tag + '-03-prompt-pending');

    await lib.pointerPress(page, '#assessment-leave-cancel', { holdMs: 160 });
    await lib.waitGone(page, 'assessment-leave-confirmation', 4000);
    const cancelTraversal = await settle(traversal1, 4000);
    await page.waitForFunction(path => location.hash.split('?')[0] === path, ASSESSMENT_PATH, { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(250);
    const afterCancel = await snapshot(page, current);
    reporter.observe(tag + '-after-cancel', { afterCancel, traversal: cancelTraversal });
    reporter.check(tag + '-cancel-restores-assessment-url', afterCancel.path === ASSESSMENT_PATH && afterCancel.origin === BASE, { path: afterCancel.path, url: afterCancel.url, traversal: cancelTraversal });
    reporter.check(tag + '-cancel-keeps-same-question-and-A', afterCancel.questionText !== '' && afterCancel.questionText === before.questionText && afterCancel.options.find(o => o.id === 'assessment-option-A')?.pressed === 'true', {
      sameQuestion: afterCancel.questionText === before.questionText, pressed: afterCancel.options.map(o => [o.id, o.pressed]),
    });
    reporter.check(tag + '-cancel-zero-writes', afterCancel.counts.respond === 0 && afterCancel.counts.retest === 0 && afterCancel.counts.ensure === 0 && afterCancel.counts.start === 1, { counts: afterCancel.counts });
    reporter.check(tag + '-cancel-no-dialog-and-idle', afterCancel.dialog.count === 0 && afterCancel.busy !== 'true', { dialog: afterCancel.dialog, busy: afterCancel.busy });
    await reporter.shot(page, tag + '-04-after-cancel');

    const beforeSecond = await snapshot(page, current);
    reporter.observe(tag + '-before-second-back', { beforeSecond });
    const traversal2 = beginBack(page);
    const prompted2 = await waitPrompt(page, 6000);
    if (!prompted2) {
      await settle(traversal2, 2000);
      reporter.check(tag + '-second-back-prompts', false, { afterSecondBack: await snapshot(page, current) });
      await observeErrors(tag, current);
      return { outcome: 'FAIL', details: { reason: 'second physical back did not prompt' } };
    }
    const pending2 = await snapshot(page, current);
    reporter.observe(tag + '-while-second-back-pending-before-confirm', { pending2, note: 'URL/hash recorded only; no URL equality is asserted while the router callback is pending.' });
    reporter.check(tag + '-second-back-single-prompt', pending2.dialog.count === 1 && pending2.dialog.visible === true, { dialog: pending2.dialog });
    await reporter.shot(page, tag + '-05-second-prompt');

    await lib.pointerPress(page, '#assessment-leave-confirm', { holdMs: 160 });
    await lib.waitGone(page, 'assessment-leave-confirmation', 4000).catch(() => {});
    const confirmTraversal = await settle(traversal2, 8000);
    const departure = await waitLeaveAssessment(page, 7000);
    const stability = departure.left ? await departureStability(page) : null;
    const afterConfirm = await snapshot(page, current);
    const returnedToAssessment = afterConfirm.path === ASSESSMENT_PATH;
    reporter.observe(tag + '-after-confirm', { afterConfirm, traversal: confirmTraversal, departure, stability, returnedToAssessment });
    reporter.check(tag + '-confirm-actually-leaves-assessment', departure.left === true && stability?.stable === true && !returnedToAssessment && afterConfirm.dialog.count === 0, {
      path: afterConfirm.path, url: afterConfirm.url, dialog: afterConfirm.dialog, traversal: confirmTraversal, departure, stability,
    });
    reporter.check(tag + '-confirm-lands-on-app-entry', isAppDeparture({ origin: afterConfirm.origin, path: afterConfirm.path }), {
      path: afterConfirm.path, origin: afterConfirm.origin, note: 'the actual prior app entry is recorded, not forced to a guessed route',
    });
    reporter.check(tag + '-confirm-no-duplicate-prompt', afterConfirm.dialog.count === 0, { dialog: afterConfirm.dialog });
    if (isDocumentDeparture(afterConfirm)) {
      reporter.uxFinding(tag, { kind: 'document-departure', observed: afterConfirm, note: 'observed document departure is preserved as a UX finding; no external page was contacted.' });
    }
    await reporter.shot(page, tag + '-06-after-confirm');
    await observeErrors(tag, current);
    return { outcome: outcomeFor(tag), details: { afterCancel, afterConfirm, departure, traversal: confirmTraversal } };
  } finally {
    await current.close().catch(() => {});
  }
}

async function caseBusyBack() {
  const tag = 'busy-back';
  const current = await startFlow(tag, { select: true });
  const page = current.page;
  let released = false;
  try {
    current.hold('response');
    await lib.pointerPress(page, '#assessment-submit', { holdMs: 160 });
    await page.waitForFunction(() => document.getElementById('assessment-page')?.getAttribute('aria-busy') === 'true', null, { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
    const heldSnapshot = await snapshot(page, current);
    const held = heldSnapshot.busy === 'true' && heldSnapshot.pending.includes('response') && heldSnapshot.counts.respond === 1;
    if (!held) {
      current.releaseAll(); released = true;
      throw new SetupError('the response was never actually held; busy-back cannot be measured as a pass.', { held: heldSnapshot });
    }
    reporter.check(tag + '-response-really-held', true, { pending: heldSnapshot.pending, respond: heldSnapshot.counts.respond, busy: heldSnapshot.busy });
    reporter.observe(tag + '-held-before-back', { held: heldSnapshot });
    await reporter.shot(page, tag + '-03-response-held');

    const traversal = beginBack(page);
    const settled = await settle(traversal, 1800);
    await page.waitForTimeout(250);
    const during = await snapshot(page, current);
    reporter.observe(tag + '-after-physical-back-while-held', { during, traversal: settled });
    reporter.check(tag + '-back-stays-on-question', visibleAssessment(during) && keepsDraftA(during), { pathRaw: during.path, urlRaw: during.url, present: during.present, pressed: during.options.map(o => [o.id, o.pressed]) });
    reporter.check(tag + '-back-leaves-request-at-one', during.counts.respond === 1 && during.counts.start === 1, { counts: during.counts });
    reporter.check(tag + '-back-shows-no-confirmation', during.dialog.count === 0, { dialog: during.dialog });
    reporter.check(tag + '-back-keeps-busy-aria', during.busy === 'true', { busy: during.busy });
    await reporter.shot(page, tag + '-04-back-while-held');

    if (during.dialog.count > 0) await cancelVisiblePrompt(page);
    current.release('response'); released = true;
    await page.waitForFunction(() => document.getElementById('assessment-page')?.getAttribute('aria-busy') === 'false', null, { timeout: 8000 }).catch(() => {});
    await lib.waitIdle(page, 8000).catch(() => {});
    const after = await snapshot(page, current);
    const accepted = current.projection()?.acceptedSequence;
    reporter.observe(tag + '-after-release', { after, accepted, traversal: await settle(traversal, 1000) });
    reporter.check(tag + '-release-accepted-one', accepted === 1 && after.counts.respond === 1, { accepted, counts: after.counts });
    reporter.check(tag + '-release-returns-idle-question', after.busy === 'false' && after.present?.['assessment-question'] === true, { busy: after.busy, present: after.present });
    reporter.check(tag + '-release-no-confirmation', after.dialog.count === 0, { dialog: after.dialog });
    reporter.check(tag + '-release-no-extra-writes', after.counts.retest === 0 && after.counts.ensure === 0, { counts: after.counts });
    await reporter.shot(page, tag + '-05-after-release');
    await observeErrors(tag, current);
    return { outcome: outcomeFor(tag), details: { held: heldSnapshot, during, after, accepted } };
  } finally {
    if (!released) {
      current.releaseAll();
      released = true;
    }
    await current.close().catch(() => {});
  }
}

function nativeBeforeUnload(current) {
  return (current.dialogs ? current.dialogs.events : []).filter(event => event.type === 'beforeunload');
}

function nativeDialogSummary(current) {
  return current.dialogs ? { events: current.dialogs.events, unexpected: current.dialogs.unexpected, policy: { beforeUnloadAction: current.dialogs.beforeUnloadAction, expectBeforeUnload: current.dialogs.expectBeforeUnload } } : null;
}

async function runRepeatDismiss(tag, finalAction) {
  const current = await startFlow(tag, { select: true, beforeUnloadAction: 'dismiss', expectBeforeUnload: true });
  const page = current.page;
  const dialogs = current.dialogs;
  try {
    const before = await snapshot(page, current);
    reporter.observe(tag + '-before-first-back', { before, nativeDialogs: nativeDialogSummary(current) });
    dialogs.setPhase('first-back');
    const traversal1 = beginBack(page);
    const prompted = await waitPrompt(page, 6000);
    if (!prompted) {
      const missing = await missingPromptResult(tag, current, page, { before, traversal: traversal1, phase: 'first-back' });
      return missing;
    }
    const first = await snapshot(page, current);
    const firstNative = nativeBeforeUnload(current);
    reporter.observe(tag + '-first-prompt-visible', {
      phase: 'first-back', first, nativeDialogs: nativeDialogSummary(current), traversal1: await settle(traversal1, 1200),
      note: 'first SPA pop: custom prompt only; no native beforeunload is expected or awaited here.',
    });
    reporter.check(tag + '-first-spa-no-native-beforeunload', firstNative.length === 0, {
      events: firstNative, phase: 'first-back',
      note: 'ordinary beforeunload protection must not trigger on the first SPA pop',
    });
    reporter.check(tag + '-first-prompt-single-visible-root-draft', visibleAssessment(first) && keepsDraftA(first) && first.dialog.count === 1 && first.dialog.visible === true, {
      present: first.present, pathRaw: first.path, urlRaw: first.url, activeId: first.activeId, focusVisible: first.focusVisible, dialog: first.dialog,
    });
    await reporter.shot(page, tag + '-03-first-prompt');

    const traversalStates = {};
    dialogs.setPhase('second-back');
    const traversal2 = beginBack(page);
    for (let index = 0; index < 30 && nativeBeforeUnload(current).length === 0; index++) await page.waitForTimeout(100).catch(() => {});
    const afterSecond = await snapshot(page, current);
    const secondNative = nativeBeforeUnload(current).filter(event => event.phase === 'second-back');
    traversalStates.second = await settle(traversal2, 1500);
    reporter.observe(tag + '-after-second-physical-back-while-prompt-open', { afterSecond, traversal2: traversalStates.second, nativeDialogs: nativeDialogSummary(current) });
    if (secondNative.length === 0) {
      const departed = isDocumentDeparture(afterSecond) || !visibleAssessment(afterSecond) || !keepsDraftA(afterSecond) || afterSecond.dialog.count !== 1;
      if (departed) {
        reporter.check(tag + '-second-back-no-native-but-departed', false, { afterSecond, nativeDialogs: nativeDialogSummary(current) });
        reporter.uxFinding(tag, { kind: 'second-back-missing-native-departure', observed: afterSecond, note: 'second physical back had no observed native beforeunload but did leave/clear the visible assessment; measured UX failure, not setup.' });
        await observeErrors(tag, current);
        return { outcome: 'FAIL', details: { afterSecond, traversalStates, nativeDialogs: nativeDialogSummary(current) } };
      }
      throw new SetupIncompleteError('no native beforeunload and no observed second traversal branch; setup incomplete rather than empty PASS', { afterSecond, traversalStates, nativeDialogs: nativeDialogSummary(current) });
    }
    reporter.check(tag + '-second-back-native-beforeunload-observed', secondNative.length >= 1, { events: secondNative, phase: 'second-back' });
    reporter.check(tag + '-second-back-native-beforeunload-dismissed', secondNative.every(event => event.actualAction === 'dismiss'), { events: secondNative });
    if (isDocumentDeparture(afterSecond)) {
      await reporter.shot(page, tag + '-04-document-departure');
      reporter.uxFinding(tag, { kind: 'second-back-document-departure', observed: afterSecond, note: 'genuine UX departure on second SPA back with the native dialog dismissed; not waived.' });
      await settle(traversal1, 1000); await settle(traversal2, 1000);
      await observeErrors(tag, current);
      return { outcome: 'UX_FINDING', details: { afterSecond, traversalStates, nativeDialogs: nativeDialogSummary(current) } };
    }
    reporter.check(tag + '-second-back-visible-root-draft-prompt', visibleAssessment(afterSecond) && keepsDraftA(afterSecond) && afterSecond.dialog.count === 1, {
      present: afterSecond.present, pathRaw: afterSecond.path, urlRaw: afterSecond.url, activeId: afterSecond.activeId, dialog: afterSecond.dialog,
      note: 'old pending traversal state is recorded, not used to waive a genuine UX departure',
    });
    await reporter.shot(page, tag + '-04-second-back');

    dialogs.setPhase('third-back');
    const traversal3 = beginBack(page);
    await page.waitForTimeout(800);
    const afterThird = await snapshot(page, current);
    traversalStates.third = await settle(traversal3, 1500);
    reporter.observe(tag + '-after-third-physical-back-while-prompt-open', { afterThird, traversal3: traversalStates.third, nativeDialogs: nativeDialogSummary(current) });
    if (isDocumentDeparture(afterThird)) {
      await reporter.shot(page, tag + '-05-document-departure');
      reporter.uxFinding(tag, { kind: 'third-back-document-departure', observed: afterThird, note: 'genuine UX departure on third SPA back with the native dialog dismissed; not waived.' });
      await settle(traversal1, 1000); await settle(traversal2, 1000); await settle(traversal3, 1000);
      await observeErrors(tag, current);
      return { outcome: 'UX_FINDING', details: { afterThird, traversalStates, nativeDialogs: nativeDialogSummary(current) } };
    }
    reporter.check(tag + '-third-back-visible-root-draft-prompt', visibleAssessment(afterThird) && keepsDraftA(afterThird) && afterThird.dialog.count === 1, {
      present: afterThird.present, pathRaw: afterThird.path, urlRaw: afterThird.url, activeId: afterThird.activeId, dialog: afterThird.dialog,
    });
    await reporter.shot(page, tag + '-05-third-back');

    dialogs.setPhase('forward');
    const forward = (() => {
      try {
        return page.goForward({ waitUntil: 'commit', timeout: 2500 })
          .then(result => ({ state: 'resolved', response: !!result }))
          .catch(error => ({ state: 'rejected', message: String(error && error.message || error).slice(0, 300) }));
      } catch (error) { return Promise.resolve({ state: 'sync-rejected', message: String(error && error.message || error).slice(0, 300) }); }
    })();
    const forwardSettled = await settle(forward, 2800);
    const afterForward = await snapshot(page, current);
    reporter.observe(tag + '-forward-attempt', { afterForward, forward: forwardSettled, nativeDialogs: nativeDialogSummary(current) });
    if (isDocumentDeparture(afterForward)) {
      await reporter.shot(page, tag + '-06-forward-document-departure');
      reporter.uxFinding(tag, { kind: 'forward-document-departure', observed: afterForward, note: 'genuine UX departure on forward while the custom prompt was open; not waived.' });
      await settle(traversal1, 1000); await settle(traversal2, 1000); await settle(traversal3, 1000); await settle(forward, 1000);
      await observeErrors(tag, current);
      return { outcome: 'UX_FINDING', details: { afterForward, traversalStates, nativeDialogs: nativeDialogSummary(current) } };
    }
    const forwardPromptOk = finalAction === 'cancel' ? afterForward.dialog.count === 1 : afterForward.dialog.count <= 1;
    reporter.check(tag + '-forward-visible-root-draft-prompt', visibleAssessment(afterForward) && keepsDraftA(afterForward) && forwardPromptOk, {
      present: afterForward.present, pathRaw: afterForward.path, urlRaw: afterForward.url, activeId: afterForward.activeId, dialog: afterForward.dialog,
      note: 'forward must not bypass the prompt; old pending traversal/cannot-navigate facts are recorded',
    });
    await reporter.shot(page, tag + '-06-after-forward');

    if (finalAction === 'confirm') {
      return await finishRepeatConfirm(tag, current, page, dialogs, {
        first, afterSecond, afterThird, afterForward, traversal1, traversal2, traversal3, forward, traversalStates,
      });
    }

    dialogs.setPhase('custom-cancel');
    if (await page.locator('#assessment-leave-confirmation').count()) {
      await lib.pointerPress(page, '#assessment-leave-cancel', { holdMs: 160 });
      await lib.waitGone(page, 'assessment-leave-confirmation', 4000).catch(() => {});
    }
    await settle(traversal1, 3000); await settle(traversal2, 3000); await settle(traversal3, 3000);
    await settle(forward, 1000);
    await page.waitForFunction(path => location.hash.split('?')[0] === path, ASSESSMENT_PATH, { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);
    const afterCancel = await snapshot(page, current);
    reporter.observe(tag + '-after-custom-cancel', { afterCancel, nativeDialogs: nativeDialogSummary(current) });
    reporter.check(tag + '-custom-cancel-restores-assessment-url', afterCancel.path === ASSESSMENT_PATH, { path: afterCancel.path, url: afterCancel.url });
    reporter.check(tag + '-custom-cancel-preserves-A', keepsDraftA(afterCancel), { pressed: afterCancel.options.map(o => [o.id, o.pressed]) });
    reporter.check(tag + '-custom-cancel-zero-writes', afterCancel.counts.respond === 0 && afterCancel.counts.retest === 0 && afterCancel.counts.ensure === 0, { counts: afterCancel.counts });
    reporter.check(tag + '-custom-cancel-no-prompt', afterCancel.dialog.count === 0, { dialog: afterCancel.dialog });
    await reporter.shot(page, tag + '-07-after-custom-cancel');
    await observeErrors(tag, current);
    return { outcome: outcomeFor(tag), details: { first, afterSecond, afterThird, afterForward, afterCancel, traversalStates, nativeDialogs: nativeDialogSummary(current) } };
  } finally {
    dialogs.detach();
    await current.close().catch(() => {});
  }
}

async function finishRepeatConfirm(tag, current, page, dialogs, context) {
  const { first, afterSecond, afterThird, afterForward, traversal1, traversal2, traversal3, forward, traversalStates } = context;
  let afterDecision;
  const promptVisible = afterForward.dialog.count === 1;
  reporter.observe(tag + '-confirm-branch-after-forward', {
    promptVisible, pathRaw: afterForward.path, urlRaw: afterForward.url,
    pressed: afterForward.options.map(o => [o.id, o.pressed]), activeId: afterForward.activeId,
    note: 'branch chosen after forward; any pending address bar is raw and not asserted before the decision.',
  });
  reporter.check(tag + '-after-forward-choice-and-root', visibleAssessment(afterForward) && keepsDraftA(afterForward), {
    present: afterForward.present, pathRaw: afterForward.path, pressed: afterForward.options.map(o => [o.id, o.pressed]),
  });

  if (promptVisible) {
    dialogs.setPhase('custom-confirm-after-forward');
    const beforeConfirm = await snapshot(page, current);
    reporter.observe(tag + '-before-custom-confirm', { beforeConfirm, nativeDialogs: nativeDialogSummary(current) });
    await lib.pointerPress(page, '#assessment-leave-confirm', { holdMs: 160 });
    await lib.waitGone(page, 'assessment-leave-confirmation', 4000).catch(() => {});
    await settle(traversal1, 3000); await settle(traversal2, 3000); await settle(traversal3, 3000); await settle(forward, 1000);
    const departure = await waitLeaveAssessment(page, 7000);
    const stability = departure.left ? await departureStability(page) : null;
    afterDecision = await snapshot(page, current);
    reporter.observe(tag + '-after-custom-confirm', { afterDecision, departure, stability, nativeDialogs: nativeDialogSummary(current) });
    reporter.check(tag + '-confirm-really-leaves-app-entry-once', departure.left === true && stability?.stable === true && isAppDeparture({ origin: afterDecision.origin, path: afterDecision.path }) && afterDecision.dialog.count === 0, {
      path: afterDecision.path, url: afterDecision.url, departure, stability, dialog: afterDecision.dialog,
    });
    reporter.check(tag + '-confirm-zero-writes', afterDecision.counts.respond === 0 && afterDecision.counts.retest === 0 && afterDecision.counts.ensure === 0, { counts: afterDecision.counts });
    reporter.check(tag + '-confirm-no-phantom-prompt-while-unchanged', afterDecision.dialog.count === 0 && afterDecision.path !== ASSESSMENT_PATH, {
      path: afterDecision.path, dialog: afterDecision.dialog,
      note: 'closing the prompt without actually leaving is not accepted',
    });
    await reporter.shot(page, tag + '-07-after-custom-confirm');
  } else {
    afterDecision = await snapshot(page, current);
    reporter.observe(tag + '-after-forward-auto-cancel', { afterDecision, nativeDialogs: nativeDialogSummary(current) });
    reporter.check(tag + '-auto-cancel-keeps-choice-and-assessment-url', afterDecision.origin === BASE && afterDecision.path === ASSESSMENT_PATH && visibleAssessment(afterDecision) && keepsDraftA(afterDecision) && afterDecision.dialog.count === 0, {
      path: afterDecision.path, url: afterDecision.url, present: afterDecision.present, pressed: afterDecision.options.map(o => [o.id, o.pressed]), dialog: afterDecision.dialog,
    });

    dialogs.setPhase('fresh-back-after-auto-cancel');
    const fresh = beginBack(page);
    const prompted = await waitPrompt(page, 6000);
    if (!prompted) {
      return await missingPromptResult(tag, current, page, { before: afterDecision, traversal: fresh, phase: 'fresh-back-after-auto-cancel' });
    }
    const freshPrompt = await snapshot(page, current);
    reporter.observe(tag + '-fresh-back-prompt', { freshPrompt, traversal: await settle(fresh, 1200), nativeDialogs: nativeDialogSummary(current) });
    reporter.check(tag + '-fresh-back-prompt-visible-root-draft', visibleAssessment(freshPrompt) && keepsDraftA(freshPrompt) && freshPrompt.dialog.count === 1 && freshPrompt.dialog.visible === true, {
      present: freshPrompt.present, pathRaw: freshPrompt.path, urlRaw: freshPrompt.url, activeId: freshPrompt.activeId, dialog: freshPrompt.dialog,
    });
    await lib.pointerPress(page, '#assessment-leave-confirm', { holdMs: 160 });
    await lib.waitGone(page, 'assessment-leave-confirmation', 4000).catch(() => {});
    await settle(fresh, 8000);
    const departure = await waitLeaveAssessment(page, 7000);
    const stability = departure.left ? await departureStability(page) : null;
    afterDecision = await snapshot(page, current);
    reporter.observe(tag + '-after-fresh-back-confirm', { afterDecision, departure, stability, nativeDialogs: nativeDialogSummary(current) });
    reporter.check(tag + '-fresh-back-confirm-really-leaves-app-entry', departure.left === true && stability?.stable === true && isAppDeparture({ origin: afterDecision.origin, path: afterDecision.path }) && afterDecision.dialog.count === 0, {
      path: afterDecision.path, url: afterDecision.url, departure, stability, dialog: afterDecision.dialog,
    });
    reporter.check(tag + '-fresh-back-confirm-zero-writes', afterDecision.counts.respond === 0 && afterDecision.counts.retest === 0 && afterDecision.counts.ensure === 0, { counts: afterDecision.counts });
    reporter.check(tag + '-fresh-back-confirm-no-phantom-prompt', afterDecision.dialog.count === 0 && afterDecision.path !== ASSESSMENT_PATH, {
      path: afterDecision.path, dialog: afterDecision.dialog,
    });
    await reporter.shot(page, tag + '-08-after-fresh-back-confirm');
  }
  await observeErrors(tag, current);
  return { outcome: outcomeFor(tag), details: { first, afterSecond, afterThird, afterForward, afterDecision, traversalStates, nativeDialogs: nativeDialogSummary(current) } };
}

async function caseRepeatBack() { return await runRepeatDismiss('repeat-back', 'cancel'); }
async function caseRepeatBackConfirm() { return await runRepeatDismiss('repeat-back-confirm', 'confirm'); }

async function caseRepeatNativeAccept() {
  const tag = 'repeat-native-accept';
  const current = await startFlow(tag, { select: true, beforeUnloadAction: 'accept', expectBeforeUnload: true });
  const page = current.page;
  const dialogs = current.dialogs;
  let traversal1 = null, traversal2 = null;
  try {
    const before = await snapshot(page, current);
    reporter.observe(tag + '-before-native-accept', { before, nativeDialogs: nativeDialogSummary(current) });

    // First history back is the ordinary SPA pop: it must open the custom prompt and
    // must NOT cross the document, so no native beforeunload should be accepted here.
    dialogs.setPhase('first-spa-back');
    traversal1 = beginBack(page);
    const prompted = await waitPrompt(page, 6000);
    if (!prompted) {
      // A first back that left without the custom prompt is an actual UX failure, not
      // a setup waiver. missingPromptResult keeps the measured-FAIL vs setup split.
      const missing = await missingPromptResult(tag, current, page, { before, traversal: traversal1, phase: 'first-spa-back' });
      return missing;
    }
    const first = await snapshot(page, current);
    const firstNative = nativeBeforeUnload(current);
    reporter.observe(tag + '-first-spa-prompt-visible', {
      phase: 'first-spa-prompt-visible', first, nativeDialogs: nativeDialogSummary(current),
      traversal1: await settle(traversal1, 1200),
      note: 'first SPA pop must show the custom prompt; no native beforeunload should fire on this pop.',
    });
    reporter.check(tag + '-first-spa-prompt-visible-root-draft', visibleAssessment(first) && keepsDraftA(first) && first.dialog.count === 1 && first.dialog.visible === true, {
      present: first.present, pathRaw: first.path, urlRaw: first.url, activeId: first.activeId, focusVisible: first.focusVisible, dialog: first.dialog,
    });
    reporter.check(tag + '-first-spa-no-native-beforeunload', firstNative.length === 0, {
      events: firstNative, phase: 'first-spa-back',
      note: 'ordinary beforeunload protection must not trigger on the first SPA pop',
    });
    await reporter.shot(page, tag + '-03-first-spa-prompt');

    // Only the second physical back crosses the document and triggers the native
    // beforeunload; the explicit logger accepts it on purpose.
    dialogs.setPhase('native-accept-second-back');
    traversal2 = beginBack(page);
    for (let index = 0; index < 60 && nativeBeforeUnload(current).length === 0; index++) await page.waitForTimeout(100).catch(() => {});
    const departure = await waitLeaveAssessment(page, 5000);
    await page.waitForTimeout(400).catch(() => {});
    const after = await snapshot(page, current);
    const events = nativeBeforeUnload(current).filter(event => event.phase === 'native-accept-second-back');
    reporter.observe(tag + '-after-native-accept-second-back', {
      phase: 'native-accept-second-back', after, departure,
      traversal2: await settle(traversal2, 1500), nativeDialogs: nativeDialogSummary(current),
      note: 'browser-native beforeunload acceptance on the second back is intentional here and is not nativeApp acceptance.',
    });
    reporter.check(tag + '-native-beforeunload-observed', events.length >= 1, { events: nativeDialogSummary(current) });
    if (events.length === 0) {
      throw new SetupIncompleteError('no native beforeunload dialog was observed on the second back; the intentional accept branch cannot be claimed', { nativeDialogs: nativeDialogSummary(current), after, departure });
    }
    reporter.check(tag + '-native-beforeunload-accepted', events.every(event => event.actualAction === 'accept'), { events });
    reporter.check(tag + '-no-unexpected-native-dialogs', current.dialogs.unexpected.length === 0, { nativeDialogs: nativeDialogSummary(current) });
    reporter.check(tag + '-intentional-document-departure', isDocumentDeparture(after) || after.url === 'about:blank', {
      path: after.path, url: after.url, departure, note: 'intentional accept must produce an actual document departure, not an app-route ambiguity',
    });
    reporter.check(tag + '-departure-zero-writes', after.counts.respond === 0 && after.counts.retest === 0 && after.counts.ensure === 0 && after.counts.start === 1, { counts: after.counts });
    reporter.check(tag + '-browser-warning-not-native-app', true, { note: 'this is a browser-native beforeunload acceptance observation, not nativeApp acceptance' });
    await reporter.shot(page, tag + '-04-after-native-accept');
    await observeErrors(tag, current);
    return { outcome: outcomeFor(tag), details: { first, after, departure, nativeDialogs: nativeDialogSummary(current) } };
  } finally {
    if (traversal1) await settle(traversal1, 1000);
    if (traversal2) await settle(traversal2, 1000);
    dialogs.detach();
    await current.close().catch(() => {});
  }
}

async function caseCleanBack() {
  const tag = 'clean-back';
  const current = await startFlow(tag, { select: false });
  const page = current.page;
  try {
    const before = await snapshot(page, current);
    reporter.observe(tag + '-before-back', { before });
    reporter.check(tag + '-no-selection-before-back', before.options.every(o => o.pressed === 'false') && before.submitDisabled === true, { pressed: before.options.map(o => [o.id, o.pressed]), submitDisabled: before.submitDisabled });
    await reporter.shot(page, tag + '-03-no-selection');

    const traversal = beginBack(page);
    const prompted = await waitPrompt(page, 4000);
    if (prompted) {
      const pending = await snapshot(page, current);
      reporter.observe(tag + '-unexpected-prompt', { pending });
      reporter.check(tag + '-clean-back-shows-no-prompt', false, { path: pending.path, dialog: pending.dialog });
      await cancelVisiblePrompt(page);
      await settle(traversal, 3000);
      const after = await snapshot(page, current);
      await reporter.shot(page, tag + '-04-after-cancel');
      await observeErrors(tag, current);
      return { outcome: 'FAIL', details: { after, unexpectedPrompt: true } };
    }
    const settled = await settle(traversal, 7000);
    const departure = await waitLeaveAssessment(page, 7000);
    const stability = departure.left ? await departureStability(page) : null;
    const after = await snapshot(page, current);
    reporter.observe(tag + '-after-clean-back', { after, traversal: settled, departure, stability, note: 'no URL equality is asserted before the traversal settles.' });
    reporter.check(tag + '-clean-back-no-prompt', after.dialog.count === 0, { dialog: after.dialog });
    reporter.check(tag + '-clean-back-actually-leaves-assessment', departure.left === true && stability?.stable === true && after.path !== ASSESSMENT_PATH && after.dialog.count === 0, { path: after.path, url: after.url, traversal: settled, departure, stability });
    reporter.check(tag + '-clean-back-lands-on-app-entry', isAppDeparture({ origin: after.origin, path: after.path }), { path: after.path, origin: after.origin, note: 'the actual prior app entry is recorded, not forced to a guessed route' });
    reporter.check(tag + '-clean-back-zero-writes', after.counts.respond === 0 && after.counts.retest === 0 && after.counts.ensure === 0 && after.counts.start === 1, { counts: after.counts });
    if (isDocumentDeparture(after)) {
      reporter.uxFinding(tag, { kind: 'document-departure', observed: after, note: 'clean back left the document instead of an app entry; preserved as a UX finding, no external page contacted.' });
    }
    await reporter.shot(page, tag + '-04-after-clean-back');
    await observeErrors(tag, current);
    return { outcome: outcomeFor(tag), details: { after, departure, traversal: settled } };
  } finally {
    await current.close().catch(() => {});
  }
}

const CASE_FUNCTIONS = {
  'cancel-confirm': caseCancelConfirm,
  'busy-back': caseBusyBack,
  'repeat-back': caseRepeatBack,
  'repeat-back-confirm': caseRepeatBackConfirm,
  'repeat-native-accept': caseRepeatNativeAccept,
  'clean-back': caseCleanBack,
};

async function runCase(name) {
  const item = reporter.startCase(name, {});
  let outcome = 'FAIL';
  let details = {};
  try {
    const result = await CASE_FUNCTIONS[name]();
    outcome = result.outcome;
    details = result.details || {};
  } catch (error) {
    if (error instanceof SetupIncompleteError) {
      reporter.setupFail(name, error.message, error.detail);
      outcome = 'SETUPINCOMPLETE';
      details = { setupIncomplete: error.message, detail: error.detail };
    } else if (error instanceof SetupError) {
      reporter.setupFail(name, error.message, error.detail);
      outcome = 'SETUPFAILED';
      details = { setupError: error.message, detail: error.detail };
    } else {
      reporter.check(name + '-unexpected-error', false, { message: String(error && error.message || error), stack: error && error.stack });
      outcome = 'FAIL';
      details = { error: String(error && error.message || error) };
    }
  } finally {
    reporter.endCase(item, outcome, details);
  }
  return outcome;
}

async function main() {
  const gateResult = gate(process.argv.slice(2));
  const before = gateResult.actual;
  try {
    f.freeze(Object.fromEntries(f.sources.map(rel => [rel, before.sources[rel]])));
  } catch (error) {
    refuse('frozen sources changed between the pre-launch gate and fixture freeze: ' + String(error && error.message || error));
  }
  const dir = prepareRunDir(gateResult.run);
  reporter = makeReporter({
    dir, run: gateResult.run, executor: gateResult.executor, cases: gateResult.cases,
    expected: gateResult.expected, before,
  });
  reporter.notRun('native-android-back', 'H5 browser execution only; native/Android back and device WebView behavior are not exercised by this suite.');
  reporter.notRun('real-backend', 'The transport is the strict synthetic fixture only; real IAM, DB, network and service behavior are not exercised.');
  reporter.notRun('settings-home-own-writes', 'The leave cases do not exercise settings/home write features; only real navigation targets are observed.');
  reporter.report.fixtureReportScope = f.report.scope;
  let launched = false;
  try {
    await f.init();
    launched = true;
    for (const name of gateResult.cases) {
      await runCase(name);
    }
  } catch (error) {
    reporter.fail(error);
  } finally {
    try {
      await f.close();
      reporter.report.closed = true;
    } catch (error) {
      reporter.report.closed = false;
      reporter.fail(error);
    }
    let after;
    try { after = freezeAll(); }
    catch (error) {
      after = { sources: {}, dependencies: {}, rootManifest: null, dependencyBundle: null };
      reporter.fail(error);
    }
    reporter.report.sourceHashesAfter = after.sources;
    reporter.report.dependencyHashesAfter = after.dependencies;
    reporter.report.rootManifestAfter = after.rootManifest;
    reporter.report.dependencyBundleAfter = after.dependencyBundle;
    reporter.report.sourceStable = Object.keys(before.sources).every(rel => after.sources[rel] === before.sources[rel]);
    reporter.report.dependenciesStable = Object.keys(before.dependencies).every(rel => after.dependencies[rel] === before.dependencies[rel]);
    reporter.report.rootManifestStable = before.rootManifest === after.rootManifest;
    reporter.report.browserLaunched = launched;
    reporter.check('source-stable-during-run', reporter.report.sourceStable === true, {
      before: before.sources, after: after.sources,
    });
    reporter.check('dependencies-stable-during-run', reporter.report.dependenciesStable === true, {
      before: before.dependencies, after: after.dependencies,
    });
    reporter.check('root-manifest-stable-during-run', reporter.report.rootManifestStable === true, {
      path: ROOT_MANIFEST, before: before.rootManifest, after: after.rootManifest,
    });
    reporter.check('browser-and-all-contexts-closed', reporter.report.closed === true, { closed: reporter.report.closed });
    reporter.check('executed-check-count-nonzero', reporter.report.checks.length > 0, { checks: reporter.report.checks.length });
    const report = reporter.finish();
    process.exitCode = report.result === 'PASS_SCOPED_ACTUAL' ? 0
      : (report.result === 'SETUPFAILED' || report.result === 'SETUPINCOMPLETE') ? 2
        : 1;
    console.log(JSON.stringify({
      group: report.group, run: report.run, executedBy: report.executedBy,
      result: report.result, completion: report.completion, summary: report.summary,
      setupFailures: report.setupFailures, uxFindings: report.uxFindings,
      notRun: report.notRun.map(item => item.name), failure: report.failure,
      results: path.join(dir, 'results.json'),
    }, null, 2));
  }
}

main().catch(error => {
  console.error('UNEXPECTED: ' + String(error && error.stack || error));
  process.exitCode = 1;
});
