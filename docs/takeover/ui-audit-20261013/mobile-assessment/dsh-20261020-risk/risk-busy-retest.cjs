// Group 4 — held response / busy stability / real double press, retest confirm &
// cancel & 503 & success, plan-ensure 503 honesty, and repeated readback failure.
// PREPARED ONLY; not run by DSH.
//
// Run (Root review environment only):
//   $env:MB006_CONFIRM_BROWSER='1'
//   $env:MB006_RISK_RUN='codex-review-busy-1'
//   node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-risk/risk-busy-retest.cjs
'use strict';
const lib = require('./risk-lib.cjs');
const f = require('./fixture.cjs');

const RAW_KEY = /mobile\.assessment\.|assessment\.[A-Za-z]+|\{(?:count|total|current|score|full)\}/;

lib.execute({ group: 'busy-retest', fixture: f }, async ({ reporter }) => {
  // ── B1: ten real submits; plan ensure 503 on the last; retest confirm/cancel/503/success
  const b1 = reporter.startCase('B1-plan-ensure-and-retest', { cursor: 'real pointer submits; ensure/retest 503 injected through fixture state only' });
  let current = await f.fresh({ locale: 'zh-CN', theme: 'light', width: 390, height: 844 });
  let page = current.page;
  const c1 = [];
  const r1 = (name, ok, detail) => { reporter.check(name, ok, detail); c1.push(name); };
  try {
    await lib.waitPresent(page, 'assessment-guide');
    await lib.waitIdle(page);
    await lib.pointerPress(page, '#assessment-start', { holdMs: 160 });
    await lib.waitPresent(page, 'assessment-question');
    await lib.waitIdle(page);
    const route1 = await reporter.route(page, 'B1-question');
    let facts = await lib.facts(page);
    r1('B1-page-identity-question', facts.root === true && route1 === '#/pages/assessment/assessment' && facts.bodyLen > 0 && facts.overlay === false, { route: route1, bodyLen: facts.bodyLen, overlay: facts.overlay });

    for (let n = 1; n <= 10; n++) {
      await lib.pointerPress(page, '#assessment-option-A', { holdMs: n === 1 || n === 10 ? 160 : 0 });
      if (n === 10) current.state.ensureError = true; // last real report triggers plans:ensure -> 503
      await lib.pointerPress(page, '#assessment-submit', { holdMs: n === 1 ? 160 : 0 });
      if (n < 10) {
        await page.waitForFunction((expected) => document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') === String(expected), n, { timeout: 8000 });
        await lib.waitIdle(page);
      } else {
        await lib.waitPresent(page, 'assessment-report', 10000);
        await lib.waitIdle(page);
      }
    }
    await page.waitForTimeout(300);
    facts = await lib.facts(page);
    const reportText = await page.locator('#assessment-report').innerText();
    const routeReport = await reporter.route(page, 'B1-report');
    r1('B1-ten-submits-one-report-real-facts', current.state.counts.respond === 10 && /A2/.test(reportText) && /70/.test(reportText) && /7/.test(reportText) && /10/.test(reportText), { respond: current.state.counts.respond, reportText });
    r1('B1-ensure-503-called-once', current.state.counts.ensure === 1, { ensure: current.state.counts.ensure });
    const notice = await page.locator('#assessment-report .assessment-error').innerText().catch(() => '');
    const planPendingVisible = await page.getByText('正在确认学习计划', { exact: false }).count();
    r1('B1-plan-ensure-503-shows-honest-notice-not-fake-success', notice.trim().length > 0 && RAW_KEY.test(notice) === false && planPendingVisible === 0, { notice, planPendingVisible, rawKey: RAW_KEY.test(notice) });
    const planTodayCalls = f.report.requests.filter(item => item.id === current.state.id && item.path === '/api/v1/learning/today').length;
    r1('B1-plan-ensure-503-no-plan-success-path', planTodayCalls === 0, { planTodayCalls, ensure: current.state.counts.ensure });
    await reporter.shot(page, 'b1-01-report-plan-notice');

    // retest: ask shows confirmation with zero retest write and the old report still visible
    await lib.pointerPress(page, '#assessment-retest', { holdMs: 160 });
    await lib.waitPresent(page, 'assessment-retest-confirmation');
    facts = await lib.facts(page);
    r1('B1-retest-ask-zero-write-keeps-report', current.state.counts.retest === 0 && facts.present['assessment-report'] === true, { retest: current.state.counts.retest, report: facts.present['assessment-report'] });
    await lib.pointerPress(page, '#assessment-retest-cancel', { holdMs: 0 });
    await lib.waitGone(page, 'assessment-retest-confirmation');
    r1('B1-retest-cancel-zero-write-keeps-report', current.state.counts.retest === 0 && (await page.locator('#assessment-report').count()) === 1, { retest: current.state.counts.retest });

    await lib.pointerPress(page, '#assessment-retest', { holdMs: 0 });
    await lib.waitPresent(page, 'assessment-retest-confirmation');
    current.state.retestError = true;
    await lib.pointerPress(page, '#assessment-retest-confirm', { holdMs: 160 });
    await lib.waitPresent(page, 'assessment-error', 10000);
    await lib.waitIdle(page);
    const retestFailedText = await page.locator('#assessment-error').innerText();
    const oldReportStill = await page.locator('#assessment-report').innerText();
    r1('B1-retest-503-keeps-old-report-and-error', current.state.counts.retest === 1 && /A2/.test(oldReportStill) && retestFailedText.trim().length > 0, { retest: current.state.counts.retest, retestFailedText, oldReport: oldReportStill });
    await reporter.shot(page, 'b1-02-retest-503-old-report');

    const oldSession = current.state.activeSessionId;
    current.state.retestError = false;
    await lib.pointerPress(page, '#assessment-retest-confirm', { holdMs: 160 });
    await page.waitForFunction(() => document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') === '0' && !document.getElementById('assessment-report'), null, { timeout: 10000 });
    await lib.waitIdle(page);
    const newQuestion = await lib.facts(page);
    r1('B1-retest-success-new-session-first-item', current.state.counts.retest === 2 && current.state.activeSessionId !== oldSession && newQuestion.present['assessment-question'] === true && current.projection()?.acceptedSequence === 0, { retest: current.state.counts.retest, oldSession, newSession: current.state.activeSessionId, accepted: current.projection()?.acceptedSequence });
    r1('B1-retest-success-clears-selection', newQuestion.options.length === 4 && newQuestion.options.every(option => option.pressed === 'false') && newQuestion.submit?.disabled === true, { pressed: newQuestion.options.map(option => option.pressed) });
    await reporter.shot(page, 'b1-03-retest-new-session');

    const errors1 = lib.caseErrors(f.report, current.state.id);
    r1('B1-no-page-or-console-errors', errors1.pageErrors.length === 0 && errors1.consoleErrors.length === 0, errors1);
    r1('B1-no-unexpected-api', f.report.unexpected.length === 0, { unexpected: f.report.unexpected });
    r1('B1-exact-counts', current.state.counts.start === 1 && current.state.counts.respond === 10 && current.state.counts.ensure === 1 && current.state.counts.retest === 2, { counts: { ...current.state.counts } });
    reporter.endCase(b1, c1.every(name => reporter.report.checks.find(check => check.name === name)?.result === 'PASS') ? 'PASS' : 'FAIL', { counts: { ...current.state.counts }, route: routeReport });
  } finally {
    await current.close();
  }

  // ── B2: held response — busy stays stable, a real double press writes once
  const b2 = reporter.startCase('B2-held-busy-double-press', { cursor: 'two real pointer presses while the response is held; busy read at two times' });
  current = await f.fresh({ locale: 'zh-CN', theme: 'light', width: 390, height: 844 });
  page = current.page;
  const c2 = [];
  const r2 = (name, ok, detail) => { reporter.check(name, ok, detail); c2.push(name); };
  try {
    await lib.waitPresent(page, 'assessment-guide');
    await lib.waitIdle(page);
    await lib.pointerPress(page, '#assessment-start', { holdMs: 0 });
    await lib.waitPresent(page, 'assessment-question');
    await lib.waitIdle(page);
    await lib.pointerPress(page, '#assessment-option-A', { holdMs: 160 });
    current.state.responseDelay = true;
    await lib.pointerPress(page, '#assessment-submit', { holdMs: 0 });
    await page.waitForTimeout(250);
    const held0 = await lib.facts(page);
    await page.waitForTimeout(1200);
    const held1 = await lib.facts(page);
    r2('B2-busy-stable-while-held', held0.busy === 'true' && held1.busy === 'true' && held0.submit?.disabled === true && held1.submit?.disabled === true, { at0: held0.busy, at1200: held1.busy, submit0: held0.submit?.disabled, submit1200: held1.submit?.disabled });
    r2('B2-first-press-single-write', current.state.counts.respond === 1, { respond: current.state.counts.respond });
    await lib.pointerPress(page, '#assessment-submit', { holdMs: 0 });
    await lib.pointerPress(page, '#assessment-submit', { holdMs: 0 });
    await page.waitForTimeout(250);
    r2('B2-real-double-press-no-double-write', current.state.counts.respond === 1, { respond: current.state.counts.respond });
    await lib.pointerPress(page, '#assessment-option-C', { holdMs: 0 });
    const heldOptions = await lib.facts(page);
    r2('B2-busy-locks-options', heldOptions.options.find(option => option.id === 'assessment-option-A')?.pressed === 'true' && heldOptions.options.find(option => option.id === 'assessment-option-C')?.pressed === 'false', { pressed: heldOptions.options.map(option => [option.id, option.pressed]) });
    await reporter.shot(page, 'b2-01-held-double-press');
    current.release('response');
    await page.waitForFunction(() => document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') === '1', null, { timeout: 8000 });
    await lib.waitIdle(page);
    const after = await lib.facts(page);
    r2('B2-release-advances-exactly-one-checkpoint', current.projection()?.acceptedSequence === 1 && after.options.every(option => option.pressed === 'false'), { accepted: current.projection()?.acceptedSequence, pressed: after.options.map(option => option.pressed) });
    const errors2 = lib.caseErrors(f.report, current.state.id);
    r2('B2-no-page-or-console-errors', errors2.pageErrors.length === 0 && errors2.consoleErrors.length === 0, errors2);
    r2('B2-no-unexpected-api', f.report.unexpected.length === 0, { unexpected: f.report.unexpected });
    r2('B2-exact-counts', current.state.counts.start === 1 && current.state.counts.respond === 1, { counts: { ...current.state.counts } });
    reporter.endCase(b2, c2.every(name => reporter.report.checks.find(check => check.name === name)?.result === 'PASS') ? 'PASS' : 'FAIL', { counts: { ...current.state.counts } });
  } finally {
    await current.close();
  }

  // ── B3: submit 503, then repeated readback failures never start a new session
  const b3 = reporter.startCase('B3-readback-repeated-failure', { cursor: 'real pointer submit/reload; GET 503 injected twice before recovery' });
  current = await f.fresh({ locale: 'zh-CN', theme: 'light', width: 390, height: 844 });
  page = current.page;
  const c3 = [];
  const r3 = (name, ok, detail) => { reporter.check(name, ok, detail); c3.push(name); };
  try {
    await lib.waitPresent(page, 'assessment-guide');
    await lib.waitIdle(page);
    await lib.pointerPress(page, '#assessment-start', { holdMs: 160 });
    await lib.waitPresent(page, 'assessment-question');
    await lib.waitIdle(page);
    await lib.pointerPress(page, '#assessment-option-A', { holdMs: 0 });
    const sessionBefore = current.state.activeSessionId;
    current.state.responseError = true;
    await lib.pointerPress(page, '#assessment-submit', { holdMs: 160 });
    await lib.waitPresent(page, 'assessment-error');
    await lib.waitIdle(page);
    const failed = await lib.facts(page);
    r3('B3-submit-503-keeps-selection-no-checkpoint', current.state.counts.respond === 1 && current.projection()?.acceptedSequence === 0 && failed.options.find(option => option.id === 'assessment-option-A')?.pressed === 'true' && RAW_KEY.test(failed.errorText) === false, { respond: current.state.counts.respond, accepted: current.projection()?.acceptedSequence, errorText: failed.errorText });

    current.state.responseError = false;
    current.state.getError = true;
    await lib.pointerPress(page, '#assessment-reload-answer', { holdMs: 0 });
    await lib.waitIdle(page);
    await page.waitForTimeout(200);
    const afterFail1 = await lib.facts(page);
    await lib.pointerPress(page, '#assessment-reload, #assessment-reload-answer', { holdMs: 0 });
    await lib.waitIdle(page);
    await page.waitForTimeout(200);
    const afterFail2 = await lib.facts(page);
    r3('B3-two-readback-503-no-new-start-no-question', current.state.counts.placementGet === 2 && current.state.counts.start === 1 && afterFail2.present['assessment-question'] === false && afterFail2.present['assessment-report'] === false, { placementGet: current.state.counts.placementGet, start: current.state.counts.start, question: afterFail2.present['assessment-question'], report: afterFail2.present['assessment-report'] });
    const sessionGets = f.report.requests.filter(item => item.id === current.state.id && item.method === 'GET' && item.path.includes('/assessment/placement/sessions/' + sessionBefore)).length;
    r3('B3-readback-failure-human-notice-no-raw-keys', afterFail2.bodyLen > 0 && RAW_KEY.test(afterFail2.bodyText) === false, { bodyLen: afterFail2.bodyLen, errorText: afterFail2.errorText });
    r3('B3-readback-failure-keeps-server-session-pointer', current.state.activeSessionId === sessionBefore && sessionGets >= 2, { before: sessionBefore, after: current.state.activeSessionId, sessionGets });
    await reporter.shot(page, 'b3-01-readback-failure');

    current.state.getError = false;
    await lib.pointerPress(page, '#assessment-reload, #assessment-reload-answer', { holdMs: 0 });
    await lib.waitPresent(page, 'assessment-question');
    await lib.waitIdle(page);
    const recovered = await lib.facts(page);
    r3('B3-readback-recovers-same-session-first-question', current.state.counts.start === 1 && current.state.counts.placementGet === 3 && current.projection()?.acceptedSequence === 0 && recovered.options.length === 4 && recovered.present['assessment-report'] === false, { start: current.state.counts.start, placementGet: current.state.counts.placementGet, accepted: current.projection()?.acceptedSequence, options: recovered.options.length });
    await reporter.shot(page, 'b3-02-readback-recovered');

    const errors3 = lib.caseErrors(f.report, current.state.id);
    r3('B3-no-page-or-console-errors', errors3.pageErrors.length === 0 && errors3.consoleErrors.length === 0, errors3);
    r3('B3-no-unexpected-api', f.report.unexpected.length === 0, { unexpected: f.report.unexpected });
    r3('B3-exact-counts', current.state.counts.start === 1 && current.state.counts.respond === 1 && current.state.counts.retest === 0, { counts: { ...current.state.counts } });
    reporter.endCase(b3, c3.every(name => reporter.report.checks.find(check => check.name === name)?.result === 'PASS') ? 'PASS' : 'FAIL', { counts: { ...current.state.counts } });
  } finally {
    await current.close();
  }
});
