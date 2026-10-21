// PREPARED ONLY — DSH did not execute this case and launched no browser.
// Root runs it in the review environment after reviewing the gate and freeze.
//
// Case owner-late-read (independent process, independent context):
//   A real login -> guide -> real Start -> question (no selection) -> real Settings ->
//   hold the placement GET -> real browser Back to assessment (entry read is busy) ->
//   synthetic principalStatus=401 and refreshStatus=401 -> real browser Back again.
//   The existing public hash guard vetoes the busy leave and the rollback re-enters
//   the existing IAM revalidation. If that reaches a stable real login, the synthetic
//   IAM subject is switched to B and the normal login form is used. Then the old A GET
//   is released and B's DOM/route/focus are checked for stale A question/report/error/
//   navigation and zero new start or writes.
//   If the public busy surface does not construct the login precondition, the case
//   records NOT_CONSTRUCTED/SETUP_INCOMPLETE and exits 2; no unexecuted assertion is
//   reported as PASS.
//
// No store/session/token/storage/JWT/guard/onShow/history hook is injected. The only
// injections are the synthetic API status flags and the explicit transport hold.
'use strict';
const L = require('./owner-lib.cjs');
const f = require('./fixture.cjs');

process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({ unhandledRejection: String(reason && reason.message || reason), stack: reason && reason.stack }, null, 2));
  if (process.exitCode !== 1) process.exitCode = 2;
});

const CASE = 'owner-late-read';
const B_SUBJECT = 'ui-mb006-owner-b-late-read';
const LOGIN = '#/pages/login/login';
const ASSESSMENT = '#/pages/assessment/assessment';
const ONBOARDING = '#/pages/onboarding/onboarding';
const SETTINGS = '#/pages/settings/settings';

async function loginVisible(page) {
  return page.locator('#mobile-login-identifier').isVisible().catch(() => false);
}

async function reachAssessment(page, reporter, tag) {
  const hash = await L.waitRouteStable(page, h => h === ASSESSMENT, 900, 15000);
  if (!hash) reporter.setup(tag + '-assessment-route', 'The real UI did not reach a stable assessment route.');
  await L.waitPresent(page, 'assessment-page', 10000);
  await L.waitPresent(page, 'assessment-guide', 12000);
  await L.waitIdle(page, 12000);
}

async function bReachGuide(page, reporter) {
  const landingHash = await L.waitRouteStable(page, h => h === ASSESSMENT || h === ONBOARDING, 900, 15000);
  if (!landingHash) reporter.setup(CASE + '-b-landing-route', 'Real B login did not reach a stable assessment/onboarding route.');
  if (landingHash === ONBOARDING) {
    const primary = page.locator('.onboarding-primary').first();
    if (!(await primary.isVisible().catch(() => false))) reporter.setup(CASE + '-b-onboarding-primary', 'B onboarding did not expose the real primary control.');
    const primaryText = (await primary.innerText().catch(() => '')).trim();
    if (!/开始定级|Start placement/.test(primaryText)) {
      reporter.setup(CASE + '-b-onboarding-step', 'B onboarding exposed a step other than the saved-setup/assessment step.', { primaryText });
    }
    await page.waitForFunction(() => {
      const button = document.querySelector('.onboarding-primary');
      return !!button && !button.hasAttribute('disabled') && button.getAttribute('aria-disabled') !== 'true';
    }, null, { timeout: 10000 }).catch(() => undefined);
    await L.pointerPress(page, '.onboarding-primary');
    const reached = await L.waitRouteStable(page, h => h === ASSESSMENT, 900, 15000);
    if (!reached) reporter.setup(CASE + '-b-onboarding-to-assessment', 'The real onboarding primary control did not reach a stable assessment route.', { primaryText });
  }
  await reachAssessment(page, reporter, CASE + '-b');
}

(async () => {
  const result = await L.execute({ group: CASE, fixture: f }, async ({ reporter }) => {
    const current = await f.fresh();
    const page = current.page;
    const dialogs = L.observeDialogs(page, CASE);
    current.dialogs = dialogs;
    current.audited = false;
    const item = reporter.startCase(CASE, {
      cursor: 'real A login/start; real settings; transport-held placement GET; real browser back; existing guard/IAM revalidation; real B login',
    });
    let outcome = 'FAIL';
    try {
      // 1. A guide -> real Start -> question; no selection is made.
      await L.waitPresent(page, 'assessment-page', 10000);
      await L.waitPresent(page, 'assessment-guide', 12000);
      await L.waitIdle(page, 12000);
      const guide = await reporter.capture(page, '01-a-guide', current);
      reporter.check(CASE + '-a-guide-without-start', guide.present['assessment-guide'] === true && guide.counts.start === 0, { route: guide.route, present: guide.present, counts: guide.counts });
      await L.pointerPress(page, '#assessment-start');
      await L.waitPresent(page, 'assessment-question', 12000);
      await L.waitIdle(page, 12000);
      const question = await reporter.capture(page, '02-a-question-unsent', current);
      const aStem = question.stem;
      reporter.check(CASE + '-a-question-no-selection', question.present['assessment-question'] === true && question.options.every(option => option.pressed !== 'true') && question.counts.start === 1, {
        route: question.route, pressed: question.options.map(o => [o.id, o.pressed]), counts: question.counts, stem: aStem,
      });
      if (!aStem) reporter.setup(CASE + '-a-question-stem', 'The first synthetic question did not expose a stem to compare later.');

      // 2. Real Settings navigation (no selection, so no leave confirmation).
      await L.pointerPress(page, '#assessment-settings');
      const settingsHash = await L.waitRouteStable(page, h => h === SETTINGS, 900, 12000);
      const settings = await reporter.capture(page, '03-a-settings', current);
      if (!settingsHash) reporter.setup(CASE + '-a-settings-route', 'The real settings header did not reach a stable settings route.', { route: settings.route, counts: settings.counts });
      reporter.check(CASE + '-a-settings-reached', settings.route === SETTINGS, { route: settings.route, counts: settings.counts });

      // 3. Hold the placement GET, then real browser Back into assessment.
      current.hold('get');
      const beforeBack = await reporter.capture(page, '04-settings-before-back', current);
      const backToAssessment = L.beginBack(page);
      const backToAssessmentSettled = await L.settle(backToAssessment, 2500);
      const returnedHash = await L.waitRouteStable(page, h => h === ASSESSMENT, 900, 15000);
      const getSeen = await L.waitNode(() => current.state.counts.placementGet >= 1 && current.pending().includes('get'), 12000);
      await page.waitForFunction(() => document.getElementById('assessment-page')?.getAttribute('aria-busy') === 'true', null, { timeout: 5000 }).catch(() => undefined);
      const held = await reporter.capture(page, '05-a-read-held-busy', current);
      reporter.report.readReturn = { promise: backToAssessmentSettled, stableRoute: returnedHash, getSeen, counts: held.counts, pending: held.pending };
      if (!returnedHash || !getSeen || held.busy !== 'true') {
        current.releaseAll();
        reporter.setup(CASE + '-a-read-held', 'The real history return did not hold the placement GET with the assessment read busy; the late-GET precondition was not constructed.', {
          route: held.route, counts: held.counts, pending: held.pending, busy: held.busy, getSeen, returnedHash,
        });
      }
      reporter.check(CASE + '-a-read-held-one-get-no-start', held.counts.placementGet === 1 && held.counts.start === 1 && held.counts.respond === 0, {
        counts: held.counts, pending: held.pending, busy: held.busy,
      });

      // 4. Synthetic IAM status flags only (no app-state hook)
      current.state.principalStatus = 401;
      current.state.refreshStatus = 401;
      const principalBefore = current.state.counts.principal;
      const refreshBefore = current.state.counts.refresh;
      const armed = await reporter.capture(page, '06-a-iam-401-armed', current);
      reporter.check(CASE + '-a-iam-401-armed-without-request', armed.counts.principal === principalBefore && armed.counts.refresh === refreshBefore, {
        counts: armed.counts, principalBefore, refreshBefore, note: 'status flags are visible only to the next synthetic IAM responses',
      });

      // 5. Real browser Back again while the read is busy.
      const back = L.beginBack(page);
      const backSettled = await L.settle(back, 2500);
      const sawRevalidation = await L.waitNode(() => current.state.counts.principal > principalBefore || current.state.counts.refresh > refreshBefore, 12000);
      const loginHash = await L.waitRouteStable(page, h => h.startsWith(LOGIN), 900, 15000);
      const afterBack = await reporter.capture(page, '07-after-real-back', current);
      reporter.report.backTraversal = { promise: backSettled, sawRevalidation, stableRoute: loginHash, counts: afterBack.counts, pending: afterBack.pending };
      if (!loginHash) {
        reporter.setup(CASE + '-login-NOT_CONSTRUCTED', 'Real browser back + existing hash guard did not reach a stable login surface; the 401 login precondition is NOT_CONSTRUCTED, not a product FAIL.', {
          route: afterBack.route, counts: afterBack.counts, busy: afterBack.busy, present: afterBack.present, pending: afterBack.pending, sawRevalidation, traversal: backSettled,
        });
      }
      if (!sawRevalidation) {
        reporter.setup(CASE + '-iam-revalidation-not-observed', 'No principal/refresh transport call was observed after real back + rollback; the IAM revalidation branch is NOT_CONSTRUCTED.', {
          counts: afterBack.counts, principalBefore, refreshBefore, route: afterBack.route, traversal: backSettled,
        });
      }

      // 6. Real login surface, no stale A question/report/error and no new write
      const formReady = await page.locator('#mobile-login-identifier').waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
      if (!formReady) {
        const stuck = await reporter.capture(page, '08-a-login-form-not-rendered', current);
        reporter.setup(CASE + '-login-form-not-rendered', 'A stable login route was observed but the real login form did not render; this is setup incomplete, not a product PASS/FAIL.', {
          route: stuck.route, counts: stuck.counts, present: stuck.present, pending: stuck.pending,
        });
      }
      const onLogin = await loginVisible(page);
      const login = await reporter.capture(page, '08-a-real-login', current);
      reporter.check(CASE + '-login-reached', onLogin && login.route.startsWith(LOGIN) && login.present['assessment-question'] === false && login.present['assessment-report'] === false, {
        route: login.route, loginVisible: onLogin, present: login.present,
      });
      reporter.check(CASE + '-login-no-old-question-report-error', login.present['assessment-question'] === false && login.present['assessment-report'] === false && login.present['assessment-skipped'] === false && login.errorText === '', {
        present: login.present, errorText: login.errorText,
      });
      reporter.check(CASE + '-login-read-count-still-one', login.counts.placementGet === 1 && login.counts.start === 1 && login.counts.respond === 0 && login.counts.retest === 0 && login.counts.ensure === 0, {
        counts: login.counts,
      });

      // 7. Switch the synthetic IAM subject and use the real B login form
      current.state.subject = B_SUBJECT;
      current.state.principalStatus = 200;
      current.state.refreshStatus = 200;
      try {
        await current.login(B_SUBJECT);
      } catch (error) {
        reporter.setup(CASE + '-b-real-login-form', 'The real B login form did not leave the login route: ' + String(error && error.message || error), { counts: L.countsOf(current) });
      }
      const landing = await reporter.capture(page, '09-b-login-landing', current);
      await bReachGuide(page, reporter);
      const bGuide = await reporter.capture(page, '10-b-guide-before-release', current);
      reporter.product(CASE + '-b-guide-has-no-a-question-report', bGuide.present['assessment-guide'] === true && bGuide.present['assessment-question'] === false && bGuide.present['assessment-report'] === false && bGuide.present['assessment-skipped'] === false && bGuide.errorText === '', {
        route: bGuide.route, present: bGuide.present, errorText: bGuide.errorText, bodyText: bGuide.bodyText.slice(0, 300),
      });
      reporter.product(CASE + '-b-guide-has-no-a-stem', !bGuide.bodyText.includes(aStem), { aStem, bodyText: bGuide.bodyText.slice(0, 300) });
      reporter.check(CASE + '-b-zero-start-zero-write', bGuide.counts.start === 1 && bGuide.counts.respond === 0 && bGuide.counts.retest === 0 && bGuide.counts.ensure === 0 && bGuide.counts.placementGet === 1, {
        counts: bGuide.counts, note: 'start=1 and placementGet=1 are A; B has issued no start and no new placement read',
      });

      // 8. Release the old A GET and wait for the actual late packet
      const beforeRelease = L.countsOf(current);
      current.release('get');
      const released = await L.waitNode(() => !current.pending().includes('get'), 15000);
      await page.waitForTimeout(1000);
      await L.waitIdle(page, 5000).catch(() => undefined);
      const final = await reporter.capture(page, '11-b-after-old-a-get', current);
      if (!released) reporter.setup(CASE + '-a-get-release', 'The held A GET was not observed to settle after release.');
      const hold = current.holds().filter(entry => entry.kind === 'get').at(-1) || null;
      const fulfillErrors = f.report.fulfillErrors.filter(entry => entry.id === current.state.id);
      reporter.report.latePacket = { hold, fulfillErrors, deliverable: !!hold && hold.heldMs !== null && hold.heldMs <= 8000 && fulfillErrors.length === 0 };
      if (!reporter.report.latePacket.deliverable) {
        reporter.setup(CASE + '-late-packet-NOT_CONSTRUCTED', 'The held A GET outlived the app 8s client timeout or its route handle was gone, so the actual late packet was not delivered; post-release assertions are NOT_CONSTRUCTED, not a product FAIL.', reporter.report.latePacket);
      }
      reporter.product(CASE + '-b-dom-route-focus-not-overwritten', final.route === ASSESSMENT && final.present['assessment-guide'] === true && final.present['assessment-question'] === false && final.present['assessment-report'] === false && final.present['assessment-skipped'] === false && final.errorText === '' && !final.bodyText.includes(aStem), {
        route: final.route, present: final.present, errorText: final.errorText, bodyText: final.bodyText.slice(0, 300), active: final.active,
      });
      reporter.product(CASE + '-no-new-start-or-write-after-release', final.counts.placementGet === beforeRelease.placementGet && final.counts.placementGet === 1 && final.counts.start === 1 && final.counts.respond === 0 && final.counts.retest === 0 && final.counts.ensure === 0, {
        beforeRelease, afterRelease: final.counts,
      });
      reporter.check(CASE + '-b-focus-not-on-old-question-control', !final.active || !/^assessment-option-|assessment-submit|assessment-reload-answer/.test(final.active.id), {
        active: final.active,
      });
      const stable = await L.waitRouteStable(page, h => h === ASSESSMENT, 700, 5000);
      reporter.check(CASE + '-no-illegal-navigation-after-release', stable !== null, { route: final.route, stable });

      // 9. Strict transport/error audit; warnings stay verbatim (known settings warning
      // is neither attributed to assessment nor silently dropped).
      const errors = await L.auditTransport(reporter, current, CASE);
      current.audited = true;
      const settingsWarnings = errors.warnings.filter(warning => /Do not nest other components in text/i.test(warning.message || ''));
      reporter.report.settingsWarnings = settingsWarnings.map(warning => ({
        message: warning.message,
        path: warning.path,
        note: 'known settings text-in-AppIcon warning observed while settings was the real route; recorded verbatim, not waived and not attributed to assessment',
      }));
      reporter.check(CASE + '-iam-revalidation-observed', sawRevalidation && current.state.counts.principal > principalBefore, {
        principalBefore, principalAfter: current.state.counts.principal, refreshBefore, refreshAfter: current.state.counts.refresh,
      });
      reporter.check(CASE + '-b-login-transport-count', current.state.counts.login === 2, { counts: current.state.counts, note: 'A initial login + B real login' });
      reporter.check(CASE + '-warnings-recorded-not-waived', errors.warnings.length === reporter.report.consoleWarnings.filter(w => w.case === CASE).length, {
        warnings: errors.warnings, settingsWarnings: reporter.report.settingsWarnings,
      });
      reporter.limitation(CASE + '-backend-owner-authorization', 'This case checks B UI/DOM/route/focus and request counts only. It does not prove backend owner authorization, real IAM, real DB or native behavior.');
      outcome = 'PASS';
    } catch (error) {
      outcome = error instanceof L.SetupIncomplete ? 'BLOCKED_SETUP' : 'FAIL';
      throw error;
    } finally {
      current.releaseAll();
      if (!current.audited) {
        try { await L.auditTransport(reporter, current, CASE); current.audited = true; } catch { /* evidence already recorded above */ }
      }
      dialogs.detach();
      reporter.endCase(item, outcome, { counts: L.countsOf(current), pending: current.pending(), routes: reporter.report.routes.slice(-12) });
      await current.close().catch(() => undefined);
    }
  });
  process.exitCode = result.code;
  console.log(JSON.stringify({
    case: CASE, exitCode: result.code, result: result.report.result, summary: result.report.summary,
    notRun: result.report.notRun, setupFailures: result.report.setupFailures, failure: result.report.failure,
  }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({ case: CASE, harnessFatal: String(error && error.message || error), stack: error && error.stack }, null, 2));
  process.exitCode = 2;
});
