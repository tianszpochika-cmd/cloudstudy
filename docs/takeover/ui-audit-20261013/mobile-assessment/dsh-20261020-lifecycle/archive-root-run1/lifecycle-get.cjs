// PREPARED ONLY — not executed by DSH. Root review environment runs it.
//
// Cases (each independently selectable):
//   same-owner-stale-get   held GET1 (Q1) -> history -> GET2 -> real submit to Q2 ->
//                          release old GET1 -> measure whether Q2 progress/session stays.
//   hidden-stale-get       release old GET1 while the assessment page is truly hidden
//                          (settings route); measure no crash / no hidden commit.
//   cross-owner-late-get   held owner1 GET1 -> real profile logout -> real login form
//                          for synthetic owner2 -> release old GET1 -> measure no leak.
//   dirty-history-back     unsent selection -> physical browser back -> measure whether
//                          the draft is blocked/confirmed or silently lost.
//
// Run (Root review environment only):
//   $env:MB006_CONFIRM_BROWSER='1'
//   $env:MB006_LIFECYCLE_RUN='root-review-lifecycle-1'
//   $env:MB006_LIFECYCLE_EXECUTOR='codex-review'
//   node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-lifecycle/lifecycle-get.cjs --case same-owner-stale-get
// Without --case all four cases run into separate runs/<run>/<case>/ directories.
//
// Exit: 0 only executed scoped PASS; 1 measured product assertion FAIL; 2 refusal /
// setup incomplete / NOT_RUN. The suspected stale-GET overwrite is NOT prelabelled.
'use strict';
const L = require('./lifecycle-lib.cjs');
const f = require('./fixture.cjs');

const CASES = ['same-owner-stale-get', 'hidden-stale-get', 'cross-owner-late-get', 'dirty-history-back'];
const arg = process.argv.slice(2);
let selected = CASES;
const caseArg = arg.find(a => a === '--case' || a.startsWith('--case='));
if (caseArg) {
  const name = caseArg.includes('=') ? caseArg.split('=')[1] : arg[arg.indexOf('--case') + 1];
  if (!CASES.includes(name)) L.refuse('--case must be one of: ' + CASES.join(', '));
  selected = [name];
}

const EXPECTED_DIRTY_BACK = 'assessment.vue onBackPress: when selectedKey && question, requestLeave("back") and return true (confirmation); browser URL history is not assumed to be onBackPress.';

async function openQuestion(page, reporter) {
  try {
    await L.waitPresent(page, 'assessment-guide');
    await L.waitIdle(page);
    await L.pointerPress(page, '#assessment-start');
    await L.waitPresent(page, 'assessment-question');
    await L.waitIdle(page);
  } catch (error) {
    reporter.setup('open-question', 'Could not reach the first question through the normal guide button: ' + error.message);
  }
  const facts = await L.facts(page);
  if (facts.present['assessment-question'] !== true || facts.options.length !== 4) {
    reporter.setup('first-question-shape', 'Question page did not present four options.', facts);
  }
  return facts;
}

async function toSettings(page, reporter) {
  try {
    await L.pointerPress(page, '#assessment-settings');
    await L.waitRoute(page, '#/pages/settings/settings');
  } catch (error) {
    reporter.setup('settings-route', 'Actual settings header navigation did not reach the settings route: ' + error.message);
  }
  return reporter.route(page, 'settings');
}

async function holdGet1(page, current, reporter) {
  const before = current.state.counts.placementGet;
  current.state.getDelay = true;
  try { await page.goBack(); await L.waitRoute(page, '#/pages/assessment/assessment'); }
  catch (error) { reporter.setup('history-back-to-assessment', 'Physical browser back from settings did not return to assessment: ' + error.message, { counts: { ...current.state.counts } }); }
  const held = await L.waitNode(() => current.state.counts.placementGet >= before + 1 && current.state.pending().includes('get'), 10000);
  if (!held) reporter.setup('get1-held', 'The first GET was not observed as held after the history return.', { counts: { ...current.state.counts }, pending: current.state.pending() });
  reporter.check('setup-get1-held', true, { placementGet: current.state.counts.placementGet, pending: current.state.pending(), route: await reporter.route(page, 'get1-held') });
  return before;
}

async function forwardToSettings(page, reporter) {
  try { await page.goForward(); await L.waitRoute(page, '#/pages/settings/settings'); }
  catch (error) { reporter.setup('history-forward-settings', 'Physical history forward did not reach settings: ' + error.message); }
}

async function backForGet2(page, current, reporter) {
  current.state.getDelay = 0; // GET1 stays held; only GET2 is allowed to finish
  try { await page.goBack(); await L.waitRoute(page, '#/pages/assessment/assessment'); await L.waitPresent(page, 'assessment-question'); await L.waitIdle(page); }
  catch (error) { reporter.setup('get2-completed', 'Second history return / GET2 did not reach an idle question: ' + error.message, { counts: { ...current.state.counts } }); }
  return L.facts(page);
}

async function selectAndSubmit(page, reporter) {
  await L.pointerPress(page, '#assessment-option-A');
  const selected = await L.facts(page);
  if (selected.options.find(o => o.id === 'assessment-option-A')?.pressed !== 'true') {
    reporter.setup('select-A', 'Real pointer did not set aria-pressed on option A.', selected.options);
  }
  await L.pointerPress(page, '#assessment-submit');
  try {
    await page.waitForFunction(() => document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') === '1', null, { timeout: 12000 });
    await L.waitIdle(page);
  } catch (error) {
    reporter.setup('submit-to-q2', 'Submit did not reach the next question (acceptedSequence 1): ' + error.message, { counts: { ...current.state.counts } });
  }
  return L.facts(page);
}

function q2Kept(facts) {
  // Deliberately does not compare the completed-count copy: the review server may
  // still serve a stale i18n module. The lifecycle fact is question identity + aria value.
  return facts.present['assessment-question'] === true
    && facts.valuenow === '1'
    && Array.isArray(facts.meta) && facts.meta[0]?.startsWith('第 2 题')
    && /Synthetic item 2/.test(facts.stem || '');
}

async function sameOwner() {
  return L.execute({ group: 'same-owner-stale-get', fixture: f }, async ({ reporter }) => {
    const current = await f.fresh();
    const page = current.page;
    const item = reporter.startCase('same-owner-stale-get', { cursor: 'real login/guard, real header navigation, physical history, real pointer select+submit, synthetic transport holds only' });
    let outcome = 'FAIL';
    try {
      await openQuestion(page, reporter);
      await toSettings(page, reporter);
      const getBefore = await holdGet1(page, current, reporter);
      await reporter.shot(page, '01-get1-held');
      await forwardToSettings(page, reporter);
      const beforeQ2 = current.state.counts.placementGet;
      const q1 = await backForGet2(page, current, reporter);
      reporter.check('setup-get2-completed', current.state.counts.placementGet === beforeQ2 + 1 && q1.valuenow === '0', { placementGet: current.state.counts.placementGet, valuenow: q1.valuenow, meta: q1.meta });
      const q2 = await selectAndSubmit(page, reporter);
      reporter.check('setup-q2-before-release', q2Kept(q2), { meta: q2.meta, valuenow: q2.valuenow, stem: q2.stem, counts: { ...current.state.counts } });
      await reporter.shot(page, '02-q2-before-release');
      current.release('get');
      await L.waitNode(() => !current.state.pending().includes('get'), 10000);
      await page.waitForTimeout(700);
      await L.waitIdle(page, 3000).catch(() => {});
      const after = await L.facts(page);
      await reporter.shot(page, '03-after-old-get1-release');
      reporter.product('same-owner-old-get1-does-not-overwrite-q2', q2Kept(after), { before: { meta: q2.meta, valuenow: q2.valuenow, stem: q2.stem }, after: { meta: after.meta, valuenow: after.valuenow, stem: after.stem }, counts: { ...current.state.counts } });
      reporter.check('same-owner-no-extra-start', current.state.counts.start === 1, { start: current.state.counts.start });
      reporter.check('same-owner-exact-counts', current.state.counts.placementGet === getBefore + 2 && current.state.counts.respond === 1, { counts: { ...current.state.counts } });
      const errors = L.caseErrors(f.report, current.state.id);
      reporter.product('same-owner-no-page-or-console-errors', errors.pageErrors.length === 0 && errors.consoleErrors.length === 0, errors);
      reporter.check('same-owner-no-unexpected-api', f.report.unexpected.filter(u => u.id === current.state.id).length === 0, { unexpected: f.report.unexpected, targetReads: f.report.targetReads });
      outcome = 'PASS';
    } catch (error) {
      outcome = error instanceof L.SetupIncomplete ? 'BLOCKED_SETUP' : 'FAIL';
      throw error;
    } finally {
      reporter.endCase(item, outcome, { counts: { ...current.state.counts }, routes: reporter.report.routes.slice(-8) });
      await current.close().catch(() => {});
    }
  });
}

async function hiddenStale() {
  return L.execute({ group: 'hidden-stale-get', fixture: f }, async ({ reporter }) => {
    const current = await f.fresh();
    const page = current.page;
    const item = reporter.startCase('hidden-stale-get', { cursor: 'same hold path; release while settings is the actual visible route' });
    let outcome = 'FAIL';
    try {
      await openQuestion(page, reporter);
      await toSettings(page, reporter);
      await holdGet1(page, current, reporter);
      await forwardToSettings(page, reporter);
      current.release('get');
      await L.waitNode(() => !current.state.pending().includes('get'), 10000);
      await page.waitForTimeout(700);
      const hidden = await L.facts(page);
      const hiddenRoute = await reporter.route(page, 'hidden-release');
      reporter.check('hidden-route-still-settings', hiddenRoute === '#/pages/settings/settings' && hidden.overlay === false, { route: hiddenRoute, overlay: hidden.overlay });
      reporter.check('hidden-release-no-pageerror', f.report.pageErrors.filter(e => e.id === current.state.id).length === 0, { pageErrors: f.report.pageErrors });
      await reporter.shot(page, '01-hidden-release-settings');
      current.state.getDelay = 0;
      try { await page.goBack(); await L.waitRoute(page, '#/pages/assessment/assessment'); await L.waitPresent(page, 'assessment-question'); await L.waitIdle(page); }
      catch (error) { reporter.setup('return-after-hidden-release', 'Return after hidden release did not reach the question: ' + error.message, { counts: { ...current.state.counts } }); }
      const returned = await L.facts(page);
      reporter.check('return-after-hidden-release-q1-zero', returned.valuenow === '0' && returned.meta?.[0]?.startsWith('第 1 题'), { meta: returned.meta, valuenow: returned.valuenow, counts: { ...current.state.counts } });
      const errors = L.caseErrors(f.report, current.state.id);
      reporter.product('hidden-release-no-page-or-console-errors', errors.pageErrors.length === 0 && errors.consoleErrors.length === 0, errors);
      outcome = 'PASS';
    } catch (error) {
      outcome = error instanceof L.SetupIncomplete ? 'BLOCKED_SETUP' : 'FAIL';
      throw error;
    } finally {
      reporter.endCase(item, outcome, { counts: { ...current.state.counts } });
      await current.close().catch(() => {});
    }
  });
}

async function crossOwner() {
  return L.execute({ group: 'cross-owner-late-get', fixture: f }, async ({ reporter }) => {
    const current = await f.fresh();
    const page = current.page;
    const item = reporter.startCase('cross-owner-late-get', { cursor: 'real profile logout UI + real login fields; only the fixture synthetic server identity changes' });
    let outcome = 'FAIL';
    try {
      await openQuestion(page, reporter);
      await toSettings(page, reporter);
      await holdGet1(page, current, reporter);
      await forwardToSettings(page, reporter);
      // Profile is a real tab route; no app store/guard/lifecycle call is made here.
      try { await page.goto(`${f.BASE}/#/pages/profile/profile`); await L.waitRoute(page, '#/pages/profile/profile'); }
      catch (error) { reporter.setup('profile-route', 'Actual profile route was not reachable: ' + error.message); }
      const logout = page.getByText('退出登录', { exact: true }).first();
      try { await logout.waitFor({ state: 'visible', timeout: 8000 }); await logout.click(); await L.waitRoute(page, '#/pages/login/login', 12000); }
      catch (error) { reporter.setup('profile-logout-ui', 'Real profile logout button/login route was not reachable: ' + error.message, { counts: { ...current.state.counts } }); }
      const owner2 = `ui-mb006-lifecycle-owner2-${current.state.id}`;
      try { await current.login(owner2); }
      catch (error) { reporter.setup('owner2-login', 'Second synthetic-owner login form did not complete: ' + error.message, { counts: { ...current.state.counts } }); }
      await page.goto(`${f.BASE}/#/pages/assessment/assessment`);
      try { await L.waitRoute(page, '#/pages/assessment/assessment'); await page.waitForTimeout(900); await L.waitIdle(page, 5000).catch(() => {}); }
      catch (error) { reporter.setup('owner2-assessment-route', 'Owner2 assessment route not reached: ' + error.message); }
      const before = await L.facts(page);
      current.release('get');
      await L.waitNode(() => !current.state.pending().includes('get'), 10000);
      await page.waitForTimeout(900);
      const after = await L.facts(page);
      await reporter.shot(page, '01-owner2-after-owner1-get-release');
      const leaked = after.present['assessment-question'] === true && (after.valuenow === '0' || /Synthetic item 1|Choose the phrase/.test(after.stem || ''));
      reporter.product('cross-owner-no-owner1-question-or-progress', !leaked, { before: { route: before.route, meta: before.meta, valuenow: before.valuenow, stem: before.stem }, after: { route: after.route, meta: after.meta, valuenow: after.valuenow, stem: after.stem }, counts: { ...current.state.counts } });
      reporter.check('cross-owner-login-logout-counts', current.state.counts.login === 2 && current.state.counts.logout === 1 && current.state.counts.start === 1, { counts: { ...current.state.counts } });
      const errors = L.caseErrors(f.report, current.state.id);
      reporter.product('cross-owner-no-page-or-console-errors', errors.pageErrors.length === 0 && errors.consoleErrors.length === 0, errors);
      outcome = 'PASS';
    } catch (error) {
      outcome = error instanceof L.SetupIncomplete ? 'BLOCKED_SETUP' : 'FAIL';
      throw error;
    } finally {
      reporter.endCase(item, outcome, { counts: { ...current.state.counts } });
      await current.close().catch(() => {});
    }
  });
}

async function dirtyBack() {
  return L.execute({ group: 'dirty-history-back', fixture: f }, async ({ reporter }) => {
    const current = await f.fresh();
    const page = current.page;
    const item = reporter.startCase('dirty-history-back', { cursor: 'physical browser back with an unsent selection; expected source reading recorded, not assumed' });
    let outcome = 'FAIL';
    try {
      await openQuestion(page, reporter);
      await L.pointerPress(page, '#assessment-option-A');
      const selected = await L.facts(page);
      if (selected.options.find(o => o.id === 'assessment-option-A')?.pressed !== 'true') reporter.setup('dirty-select-A', 'Could not create the unsent draft selection.');
      await reporter.shot(page, '01-before-dirty-back');
      await page.goBack();
      await page.waitForTimeout(900);
      const after = await L.facts(page);
      const route = await reporter.route(page, 'after-dirty-back');
      await reporter.shot(page, '02-after-dirty-back');
      const confirmation = after.present['assessment-leave-confirmation'] === true;
      const stillAssessment = route === '#/pages/assessment/assessment';
      const draftKept = after.options.find(o => o.id === 'assessment-option-A')?.pressed === 'true';
      if (stillAssessment && confirmation) {
        reporter.check('dirty-back-blocks-or-confirms', true, { expected: EXPECTED_DIRTY_BACK, actual: { route, confirmation, draftKept } });
        outcome = 'PASS';
      } else if (!stillAssessment) {
        // Browser history left the page: onBackPress is not assumed to be the trigger,
        // so this is an unverified branch (setup/incomplete), not a product failure.
        reporter.notRun('dirty-back-route-left-browser-history', 'Physical browser back left the assessment route; onBackPress was not reached, so this browser-history branch is recorded as NOT_RUN rather than a product verdict.', { expected: EXPECTED_DIRTY_BACK, actual: { route, confirmation, draftKept } });
        outcome = 'BLOCKED_SETUP';
      } else if (!draftKept) {
        reporter.product('dirty-back-does-not-silently-clear-draft', false, { expected: EXPECTED_DIRTY_BACK, actual: { route, confirmation, draftKept } });
      } else {
        reporter.notRun('dirty-back-no-observable-navigation', 'Browser back did not change the route, show confirmation, or clear the draft; no product verdict can be drawn from this browser history state.', { route, confirmation, draftKept });
        outcome = 'BLOCKED_SETUP';
      }
      reporter.check('dirty-back-no-page-or-console-errors', L.caseErrors(f.report, current.state.id).pageErrors.length === 0, { pageErrors: f.report.pageErrors });
    } catch (error) {
      outcome = error instanceof L.SetupIncomplete ? 'BLOCKED_SETUP' : 'FAIL';
      throw error;
    } finally {
      reporter.endCase(item, outcome, { counts: { ...current.state.counts } });
      await current.close().catch(() => {});
    }
  });
}

const RUNNERS = {
  'same-owner-stale-get': sameOwner,
  'hidden-stale-get': hiddenStale,
  'cross-owner-late-get': crossOwner,
  'dirty-history-back': dirtyBack,
};

(async () => {
  let worst = 0;
  for (const name of selected) {
    const { code, report } = await RUNNERS[name]();
    console.log(JSON.stringify({ case: name, result: report.result, summary: report.summary, notRun: report.notRun, setupFailures: report.setupFailures, failure: report.failure }, null, 2));
    if (code === 1) worst = 1;
    else if (code === 2 && worst === 0) worst = 2;
  }
  process.exitCode = worst;
})();
