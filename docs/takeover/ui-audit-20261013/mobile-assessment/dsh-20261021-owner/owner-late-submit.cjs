// PREPARED ONLY — DSH did not execute this case and launched no browser.
// Root runs it in the review environment after reviewing the gate and freeze.
//
// Case owner-late-submit (independent process, independent context):
//   A real login -> guide -> real Start -> question -> real select A -> hold the
//   response -> real Submit (busy) -> synthetic principalStatus=401 and
//   refreshStatus=401 -> real browser Back. The existing public hash guard vetoes the
//   busy leave and the rollback re-enters the existing IAM revalidation. If that
//   reaches a stable real login, the synthetic IAM subject is switched to B and the
//   normal login form is used. Then the old A response is released and B's DOM/route/
//   focus are checked for stale A question/report/error/navigation and extra writes.
//   If the public busy surface does not construct the login precondition, the case
//   records NOT_CONSTRUCTED/SETUP_INCOMPLETE and exits 2; it never guesses a product
//   FAIL from an unconstructed branch.
//
// No store/session/token/storage/JWT/guard/onShow/history hook is injected. The only
// injections are the synthetic API status flags and the explicit transport hold. The
// late A response is a UI leak check, not a backend owner-authorization proof.
'use strict';
const L = require('./owner-lib.cjs');
const f = require('./fixture.cjs');

process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({ unhandledRejection: String(reason && reason.message || reason), stack: reason && reason.stack }, null, 2));
  if (process.exitCode !== 1) process.exitCode = 2;
});

const CASE = 'owner-late-submit';
const B_SUBJECT = 'ui-mb006-owner-b-late-submit';
const LOGIN = '#/pages/login/login';
const ASSESSMENT = '#/pages/assessment/assessment';
const ONBOARDING = '#/pages/onboarding/onboarding';

async function loginVisible(page) {
  return page.locator('#mobile-login-identifier').isVisible().catch(() => false);
}

async function reachAssessment(page, reporter, tag) {
  const hash = await L.waitRouteStable(page, h => h === ASSESSMENT, 900, 15000);
  if (!hash) reporter.setup(tag + '-assessment-route', 'The real UI did not reach a stable assessment route.');
  await L.waitPresent(page, 'assessment-page', 10000);
  const arrived = await L.facts(page);
  if (arrived.present['assessment-question'] || arrived.present['assessment-report'] || arrived.present['assessment-skipped']) {
    reporter.product(CASE + '-b-assessment-stale-question-report', false, {
      route: arrived.route, present: arrived.present, active: arrived.active, bodyText: arrived.bodyText.slice(0, 300),
    });
  }
  await L.waitPresent(page, 'assessment-guide', 12000);
  await L.waitIdle(page, 12000);
}

// After the real B login the existing returnTo may be assessment or onboarding. If it
// is the onboarding "setup saved" step, its real primary button is the normal route to
// assessment; any other step is not constructed for this case.
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
      cursor: 'real A login/start/select/submit; transport-held response; real browser back; existing guard/IAM revalidation; real B login',
    });
    let outcome = 'FAIL';
    try {
      // 1. A guide
      await L.waitPresent(page, 'assessment-page', 10000);
      await L.waitPresent(page, 'assessment-guide', 12000);
      await L.waitIdle(page, 12000);
      const guide = await reporter.capture(page, '01-a-guide', current);
      reporter.check(CASE + '-a-guide-without-start', guide.present['assessment-guide'] === true && guide.present['assessment-question'] === false && guide.counts.start === 0, {
        route: guide.route, present: guide.present, counts: guide.counts,
      });

      // 2. Real Start -> question
      await L.pointerPress(page, '#assessment-start');
      await L.waitPresent(page, 'assessment-question', 12000);
      await L.waitIdle(page, 12000);
      const question = await reporter.capture(page, '02-a-question', current);
      const aStem = question.stem;
      reporter.check(CASE + '-a-question-four-options', question.present['assessment-question'] === true && question.options.length === 4 && question.counts.start === 1, {
        route: question.route, options: question.options.map(o => o.id), counts: question.counts, stem: aStem,
      });
      if (!aStem) reporter.setup(CASE + '-a-question-stem', 'The first synthetic question did not expose a stem to compare later.');
      const aSessionId = current.state.activeSessionId;
      if (!aSessionId) reporter.setup(CASE + '-a-session-id', 'The synthetic A placement session id was not available for the receipt-path check.');
      const oldResponsePath = `/api/v1/assessment/placement/sessions/${encodeURIComponent(aSessionId)}/responses`;

      // 3. Real select A
      await L.pointerPress(page, '#assessment-option-A');
      const selected = await reporter.capture(page, '03-a-selected-a', current);
      const pressedA = selected.options.find(option => option.id === 'assessment-option-A')?.pressed;
      if (pressedA !== 'true') reporter.setup(CASE + '-a-select', 'The real pointer press did not select A.', { pressed: selected.options.map(o => [o.id, o.pressed]) });

      // 4. Hold the response and submit for real
      current.hold('response');
      await L.pointerPress(page, '#assessment-submit');
      const pendingSeen = await L.waitNode(() => current.pending().includes('response') && current.state.counts.respond === 1, 8000);
      await page.waitForFunction(() => document.getElementById('assessment-page')?.getAttribute('aria-busy') === 'true', null, { timeout: 5000 }).catch(() => undefined);
      const held = await reporter.capture(page, '04-a-submit-held-busy', current);
      if (!pendingSeen || held.busy !== 'true') {
        current.releaseAll();
        reporter.setup(CASE + '-a-submit-held', 'The response was not actually held with assessment busy; the late-response precondition was not constructed.', {
          counts: held.counts, pending: held.pending, busy: held.busy,
        });
      }
      reporter.check(CASE + '-a-submit-held-one-write', held.busy === 'true' && held.counts.respond === 1 && held.counts.start === 1, {
        counts: held.counts, pending: held.pending, busy: held.busy,
      });

      // 5. Synthetic IAM status flags only (no app-state hook)
      current.state.principalStatus = 401;
      current.state.refreshStatus = 401;
      const principalBefore = current.state.counts.principal;
      const refreshBefore = current.state.counts.refresh;
      const armed = await reporter.capture(page, '05-a-iam-401-armed', current);
      reporter.check(CASE + '-a-iam-401-armed-without-request', armed.counts.principal === principalBefore && armed.counts.refresh === refreshBefore, {
        counts: armed.counts, principalBefore, refreshBefore, note: 'status flags are visible only to the next synthetic IAM responses',
      });

      // 6. Real browser Back. Never await the traversal to settlement; observe it.
      const back = L.beginBack(page);
      const backSettled = await L.settle(back, 2500);
      const sawRevalidation = await L.waitNode(() => current.state.counts.principal > principalBefore || current.state.counts.refresh > refreshBefore, 12000);
      const loginHash = await L.waitRouteStable(page, h => h.startsWith(LOGIN), 900, 15000);
      const afterBack = await reporter.capture(page, '06-after-real-back', current);
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

      // 7. Real login surface, no stale A question/report/error and no new A write
      const formReady = await page.locator('#mobile-login-identifier').waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
      if (!formReady) {
        const stuck = await reporter.capture(page, '07-a-login-form-not-rendered', current);
        reporter.setup(CASE + '-login-form-not-rendered', 'A stable login route was observed but the real login form did not render; this is setup incomplete, not a product PASS/FAIL.', {
          route: stuck.route, counts: stuck.counts, present: stuck.present, pending: stuck.pending,
        });
      }
      const onLogin = await loginVisible(page);
      const login = await reporter.capture(page, '07-a-real-login', current);
      reporter.check(CASE + '-login-reached', onLogin && login.route.startsWith(LOGIN) && login.present['assessment-question'] === false && login.present['assessment-report'] === false, {
        route: login.route, loginVisible: onLogin, present: login.present,
      });
      reporter.check(CASE + '-login-no-old-question-report-error', login.present['assessment-question'] === false && login.present['assessment-report'] === false && login.present['assessment-skipped'] === false && login.errorText === '', {
        present: login.present, errorText: login.errorText,
      });
      reporter.check(CASE + '-login-a-write-still-one', login.counts.respond === 1 && login.counts.start === 1 && login.counts.retest === 0 && login.counts.ensure === 0, {
        counts: login.counts,
      });

      // 8. Switch the synthetic IAM subject and use the real B login form
      current.state.subject = B_SUBJECT;
      current.state.principalStatus = 200;
      current.state.refreshStatus = 200;
      try {
        await current.login(B_SUBJECT);
      } catch (error) {
        reporter.setup(CASE + '-b-real-login-form', 'The real B login form did not leave the login route: ' + String(error && error.message || error), { counts: L.countsOf(current) });
      }
      const landing = await reporter.capture(page, '08-b-login-landing', current);
      await bReachGuide(page, reporter);
      const bGuide = await reporter.capture(page, '09-b-guide-before-release', current);
      reporter.product(CASE + '-b-guide-has-no-a-question-report', bGuide.present['assessment-guide'] === true && bGuide.present['assessment-question'] === false && bGuide.present['assessment-report'] === false && bGuide.present['assessment-skipped'] === false && bGuide.errorText === '', {
        route: bGuide.route, present: bGuide.present, errorText: bGuide.errorText, bodyText: bGuide.bodyText.slice(0, 300),
      });
      reporter.product(CASE + '-b-guide-has-no-a-stem', !bGuide.bodyText.includes(aStem), { aStem, bodyText: bGuide.bodyText.slice(0, 300) });
      reporter.check(CASE + '-b-zero-start-one-a-write', bGuide.counts.start === 1 && bGuide.counts.respond === 1 && bGuide.counts.retest === 0 && bGuide.counts.ensure === 0, {
        counts: bGuide.counts, note: 'start=1 is A; B has issued no start',
      });

      // 9. Release the old A response and wait for a real browser HTTP receipt, not
      // just the empty hold queue (the queue is removed before route.fulfill).
      const beforeRelease = L.countsOf(current);
      const beforeReceipt = current.httpResponses().filter(entry => entry.path === oldResponsePath && entry.method === 'POST').length;
      const beforeFulfill = current.fulfillResults().filter(entry => entry.path === oldResponsePath && entry.method === 'POST').length;
      current.release('response');
      const released = await L.waitNode(() => !current.pending().includes('response'), 15000);
      const receiptSeen = await L.waitNode(() => {
        const receipts = current.httpResponses();
        return receipts.filter(entry => entry.path === oldResponsePath && entry.method === 'POST').length > beforeReceipt
          || receipts.some(entry => entry.path === oldResponsePath && entry.method === 'POST' && entry.requestFailed);
      }, 15000);
      await L.waitNode(() => current.fulfillResults().filter(entry => entry.path === oldResponsePath && entry.method === 'POST').length > beforeFulfill, 5000);
      await page.waitForTimeout(300);
      await L.waitIdle(page, 5000).catch(() => undefined);
      const final = await reporter.capture(page, '10-b-after-old-a-response', current);
      if (!released) reporter.setup(CASE + '-a-response-release', 'The held A response was not observed to settle after release.');
      const hold = current.holds().filter(entry => entry.kind === 'response').at(-1) || null;
      const receipts = current.httpResponses().filter(entry => entry.path === oldResponsePath && entry.method === 'POST').slice(beforeReceipt);
      const fulfills = current.fulfillResults().filter(entry => entry.path === oldResponsePath && entry.method === 'POST').slice(beforeFulfill);
      const receipt = receipts.find(entry => !entry.requestFailed && entry.status >= 200 && entry.status < 300) || null;
      const fulfill = fulfills.filter(entry => entry.ok && entry.status >= 200 && entry.status < 300).at(-1) || null;
      const requestFailed = receipts.some(entry => entry.requestFailed);
      const fulfillErrors = f.report.fulfillErrors.filter(entry => entry.id === current.state.id);
      const oldFulfillErrors = fulfillErrors.filter(entry => entry.path === oldResponsePath && entry.method === 'POST');
      reporter.report.latePacket = {
        oldResponsePath, beforeReceipt, beforeFulfill, receiptSeen, receipts, fulfills, receipt, fulfill, requestFailed, hold, fulfillErrors, oldFulfillErrors,
        received: Boolean(receipt && fulfill && oldFulfillErrors.length === 0 && !requestFailed),
      };
      if (!receipt || !fulfill || oldFulfillErrors.length > 0 || requestFailed) {
        reporter.setup(CASE + '-late-receipt-NOT_CONSTRUCTED', 'No actual browser HTTP response and successful route.fulfill were observed for the old A POST, or the request failed/was canceled, or its fulfill failed. The late callback branch is NOT_CONSTRUCTED; the empty hold queue alone is not a late-packet PASS.', reporter.report.latePacket);
      }
      reporter.check(CASE + '-late-receipt-observed', Boolean(receipt && fulfill && oldFulfillErrors.length === 0 && !requestFailed), {
        receipt, fulfill, receiptSeen, released, hold, requestFailed, oldFulfillErrors,
      });
      reporter.product(CASE + '-b-dom-route-focus-not-overwritten', final.route === ASSESSMENT && final.present['assessment-guide'] === true && final.present['assessment-question'] === false && final.present['assessment-report'] === false && final.present['assessment-skipped'] === false && final.errorText === '' && !final.bodyText.includes(aStem), {
        route: final.route, present: final.present, errorText: final.errorText, bodyText: final.bodyText.slice(0, 300), active: final.active,
      });
      reporter.product(CASE + '-no-new-respond-retest-ensure-after-release', final.counts.respond === beforeRelease.respond && final.counts.respond === 1 && final.counts.retest === 0 && final.counts.ensure === 0 && final.counts.start === 1, {
        beforeRelease, afterRelease: final.counts,
      });
      reporter.check(CASE + '-b-focus-not-on-old-question-control', !final.active || !/^assessment-option-|assessment-submit|assessment-reload-answer/.test(final.active.id), {
        active: final.active,
      });
      const stable = await L.waitRouteStable(page, h => h === ASSESSMENT, 700, 5000);
      reporter.check(CASE + '-no-illegal-navigation-after-release', stable !== null, { route: final.route, stable });

      // 10. Strict transport/error audit (warnings are recorded verbatim, not waived)
      const errors = await L.auditTransport(reporter, current, CASE);
      current.audited = true;
      reporter.check(CASE + '-iam-revalidation-observed', sawRevalidation && current.state.counts.principal > principalBefore, {
        principalBefore, principalAfter: current.state.counts.principal, refreshBefore, refreshAfter: current.state.counts.refresh,
      });
      reporter.check(CASE + '-b-login-transport-count', current.state.counts.login === 2, { counts: current.state.counts, note: 'A initial login + B real login' });
      reporter.check(CASE + '-warnings-recorded-not-waived', errors.warnings.length === reporter.report.consoleWarnings.filter(w => w.case === CASE).length, {
        warnings: errors.warnings,
      });
      reporter.limitation(CASE + '-backend-owner-authorization', 'This case checks B UI/DOM/route/focus and write counts only. It does not prove backend owner authorization, real IAM, real DB or native behavior.');
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
