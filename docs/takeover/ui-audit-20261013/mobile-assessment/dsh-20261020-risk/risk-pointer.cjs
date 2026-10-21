// Group 2 — real pointer (0/160ms at the old center), drag-out, and CDP-native
// touch end vs touchCancel. PREPARED ONLY; not run by DSH.
// The 1px global :active translateY allowance is measured from getBoundingClientRect
// before/during the press; the check is |deltaY| <= 1.01px AND the pre-press center
// still inside the shifted rect AND the request/selection result unchanged.
//
// Run (Root review environment only):
//   $env:MB006_CONFIRM_BROWSER='1'
//   $env:MB006_RISK_RUN='codex-review-pointer-1'
//   node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-risk/risk-pointer.cjs
'use strict';
const lib = require('./risk-lib.cjs');
const f = require('./fixture.cjs');

lib.execute({ group: 'pointer', fixture: f }, async ({ reporter }) => {
  // ── P1: mouse pointer, 0ms and 160ms at the element's own center ────────────
  const p1 = reporter.startCase('P1-pointer-mouse-0-160', { cursor: 'real mouse.down/up at the element center; DOM .click() is not used' });
  let current = await f.fresh({ locale: 'zh-CN', theme: 'light', width: 390, height: 844 });
  let page = current.page;
  const checks1 = [];
  const record1 = (name, ok, detail) => { reporter.check(name, ok, detail); checks1.push(name); };
  try {
    await lib.waitPresent(page, 'assessment-guide');
    await lib.waitIdle(page);
    let facts = await lib.facts(page);
    const route1 = await reporter.route(page, 'P1-guide');
    record1('P1-page-identity-guide', facts.root === true && route1 === '#/pages/assessment/assessment' && facts.bodyLen > 0 && facts.overlay === false, { route: route1, root: facts.root, bodyLen: facts.bodyLen, overlay: facts.overlay });
    await reporter.shot(page, 'p1-01-guide');

    const startPress = await lib.pointerPress(page, '#assessment-start', { holdMs: 160 });
    await lib.waitPresent(page, 'assessment-question');
    await lib.waitIdle(page);
    record1('P1-pointer-start-160-single-write', current.state.counts.start === 1, { start: current.state.counts.start, press: { translateY: startPress.translateY, oldCenterInside: startPress.oldCenterInside } });
    facts = await lib.facts(page);
    record1('P1-question-option-count-exact', facts.options.length === 4, { count: facts.options.length, ids: facts.options.map(option => option.id) });

    // 0ms press selects A once; no request.
    const aPress = await lib.pointerPress(page, '#assessment-option-A', { holdMs: 0 });
    facts = await lib.facts(page);
    record1('P1-pointer-option-0ms-selects-once', facts.options.find(option => option.id === 'assessment-option-A')?.pressed === 'true' && current.state.counts.respond === 0, { pressed: facts.options.map(option => [option.id, option.pressed]), respond: current.state.counts.respond, translateY: aPress.translateY });

    // 160ms press on B; measure the :active shift and the legacy center hit.
    const bPress = await lib.pointerPress(page, '#assessment-option-B', { holdMs: 160 });
    facts = await lib.facts(page);
    const bSelected = facts.options.find(option => option.id === 'assessment-option-B')?.pressed === 'true';
    const aCleared = facts.options.find(option => option.id === 'assessment-option-A')?.pressed === 'false';
    record1('P1-pointer-option-160-selects-once', bSelected === true && aCleared === true && current.state.counts.respond === 0, { pressed: facts.options.map(option => [option.id, option.pressed]), respond: current.state.counts.respond });
    record1('P1-active-translate-within-1px', Math.abs(bPress.translateY) <= 1.01, { translateY: bPress.translateY, before: bPress.before, during: bPress.during, transformDuring: bPress.during.transform });
    record1('P1-legacy-center-still-hits', bPress.oldCenterInside === true && bSelected === true, { center: { x: bPress.cx, y: bPress.cy }, during: bPress.during, oldCenterInside: bPress.oldCenterInside });

    // Submit at 160ms while the response is held: exactly one write.
    current.state.responseDelay = true;
    const submitPress = await lib.pointerPress(page, '#assessment-submit', { holdMs: 160 });
    await page.waitForTimeout(300);
    facts = await lib.facts(page);
    const firstSubmit = current.state.counts.respond === 1;
    record1('P1-pointer-submit-160-single-write', firstSubmit === true && facts.busy === 'true', { respond: current.state.counts.respond, busy: facts.busy, translateY: submitPress.translateY });
    record1('P1-submit-active-translate-within-1px', Math.abs(submitPress.translateY) <= 1.01 && submitPress.oldCenterInside === true, { translateY: submitPress.translateY, oldCenterInside: submitPress.oldCenterInside });
    await reporter.shot(page, 'p1-02-submit-busy');
    await lib.pointerPress(page, '#assessment-submit', { holdMs: 0 });
    await page.waitForTimeout(200);
    record1('P1-busy-blocks-second-pointer-submit', current.state.counts.respond === 1, { respond: current.state.counts.respond });
    current.release('response');
    await page.waitForFunction(() => document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') === '1', null, { timeout: 8000 });
    await lib.waitIdle(page);
    record1('P1-one-write-one-checkpoint', current.projection()?.acceptedSequence === 1, { accepted: current.projection()?.acceptedSequence, respond: current.state.counts.respond });

    // 503 submit keeps the page selection, then a real pointer readback reads the
    // same server checkpoint and never starts a new session.
    await lib.pointerPress(page, '#assessment-option-A', { holdMs: 160 });
    current.state.responseError = true;
    await lib.pointerPress(page, '#assessment-submit', { holdMs: 160 });
    await lib.waitPresent(page, 'assessment-error');
    await lib.waitIdle(page);
    const afterFail = await lib.facts(page);
    const respondAfterFail = current.state.counts.respond;
    record1('P1-submit-503-preserves-selection-and-error', afterFail.options.find(option => option.id === 'assessment-option-A')?.pressed === 'true' && afterFail.errorText.length > 0 && respondAfterFail === 2, { pressed: afterFail.options.map(option => [option.id, option.pressed]), errorText: afterFail.errorText, respond: respondAfterFail });
    current.state.responseError = false;
    const getBefore = current.state.counts.placementGet;
    await lib.pointerPress(page, '#assessment-reload-answer', { holdMs: 0 });
    await lib.waitIdle(page);
    await page.waitForTimeout(200);
    const afterReadback = await lib.facts(page);
    record1('P1-readback-same-session-no-new-start', current.state.counts.placementGet === getBefore + 1 && current.state.counts.start === 1 && current.state.counts.respond === 2, { placementGet: current.state.counts.placementGet, start: current.state.counts.start, respond: current.state.counts.respond });
    record1('P1-readback-keeps-same-question-and-selection', afterReadback.options.find(option => option.id === 'assessment-option-A')?.pressed === 'true' && afterReadback.present['assessment-question'] === true, { pressed: afterReadback.options.map(option => [option.id, option.pressed]) });
    await reporter.shot(page, 'p1-03-readback-same-question');

    // Drag from the option center to outside the element: no click, no write.
    const drag = await lib.dragAway(page, '#assessment-option-C');
    await page.waitForTimeout(200);
    const afterDrag = await lib.facts(page);
    record1('P1-drag-out-no-selection-or-write', afterDrag.options.find(option => option.id === 'assessment-option-C')?.pressed === 'false' && afterDrag.options.find(option => option.id === 'assessment-option-A')?.pressed === 'true' && current.state.counts.respond === 2, { drag, pressed: afterDrag.options.map(option => [option.id, option.pressed]), respond: current.state.counts.respond });

    const errors1 = lib.caseErrors(f.report, current.state.id);
    record1('P1-no-page-or-console-errors', errors1.pageErrors.length === 0 && errors1.consoleErrors.length === 0, errors1);
    record1('P1-no-unexpected-api', f.report.unexpected.length === 0, { unexpected: f.report.unexpected });
    record1('P1-exact-counts', current.state.counts.start === 1 && current.state.counts.respond === 2 && current.state.counts.retest === 0, { counts: { ...current.state.counts } });
    reporter.endCase(p1, checks1.every(name => reporter.report.checks.find(check => check.name === name)?.result === 'PASS') ? 'PASS' : 'FAIL', { route: route1, counts: { ...current.state.counts } });
  } finally {
    await current.close();
  }

  // ── P2: CDP-native touch, touchEnd vs touchCancel ───────────────────────────
  const p2 = reporter.startCase('P2-cdp-touch-end-vs-cancel', { cursor: 'Input.dispatchTouchEvent touchStart/touchEnd/touchCancel; no synthetic dispatchEvent' });
  current = await f.fresh({ locale: 'zh-CN', theme: 'light', width: 390, height: 844, hasTouch: true });
  page = current.page;
  const checks2 = [];
  const record2 = (name, ok, detail) => { reporter.check(name, ok, detail); checks2.push(name); };
  try {
    await lib.waitPresent(page, 'assessment-guide');
    await lib.waitIdle(page);
    const route2 = await reporter.route(page, 'P2-guide');
    let facts = await lib.facts(page);
    record2('P2-page-identity-guide', facts.root === true && route2 === '#/pages/assessment/assessment' && facts.bodyLen > 0 && facts.overlay === false, { route: route2, bodyLen: facts.bodyLen, overlay: facts.overlay });

    let tap = null;
    try {
      tap = await lib.touchAt(page, '#assessment-start', 'end');
    } catch (error) {
      reporter.notRun('P2-cdp-touch-capability', 'CDP Input.dispatchTouchEvent was not available in this environment: ' + error.message);
      reporter.endCase(p2, 'NOT_RUN', { note: 'CDP touch unavailable; no touch result is claimed.' });
      return;
    }
    let touchActivated = true;
    try { await lib.waitPresent(page, 'assessment-question', 6000); } catch { touchActivated = false; }
    if (!touchActivated) {
      record2('P2-touch-end-start-single-write', false, { start: current.state.counts.start, tap, note: 'touchEnd at the start button center did not open the question' });
      reporter.notRun('P2-remaining-touch-cases', 'touchEnd did not activate the uni-button, so later touch measurements were skipped rather than fabricated.');
      reporter.endCase(p2, 'FAIL', { note: 'touchEnd start did not activate; remaining touch branches not run.' });
      return;
    }
    await lib.waitIdle(page);
    facts = await lib.facts(page);
    record2('P2-touch-end-start-single-write', current.state.counts.start === 1 && facts.present['assessment-question'] === true, { start: current.state.counts.start, tap, question: facts.present['assessment-question'] });
    record2('P2-touch-end-does-not-double-select', facts.options.every(option => option.pressed === 'false'), { pressed: facts.options.map(option => option.pressed) });

    const cancelAt = await lib.touchAt(page, '#assessment-option-A', 'cancel');
    await page.waitForTimeout(300);
    facts = await lib.facts(page);
    record2('P2-touch-cancel-does-not-select', facts.options.find(option => option.id === 'assessment-option-A')?.pressed === 'false' && current.state.counts.respond === 0, { cancelAt, pressed: facts.options.map(option => [option.id, option.pressed]), respond: current.state.counts.respond });

    const endAt = await lib.touchAt(page, '#assessment-option-A', 'end');
    await page.waitForTimeout(300);
    facts = await lib.facts(page);
    record2('P2-touch-end-selects-once', facts.options.find(option => option.id === 'assessment-option-A')?.pressed === 'true' && current.state.counts.respond === 0, { endAt, pressed: facts.options.map(option => [option.id, option.pressed]), respond: current.state.counts.respond });

    current.state.responseDelay = true;
    const submitTap = await lib.touchAt(page, '#assessment-submit', 'end');
    await page.waitForTimeout(400);
    facts = await lib.facts(page);
    record2('P2-touch-submit-single-write', current.state.counts.respond === 1 && facts.busy === 'true', { submitTap, respond: current.state.counts.respond, busy: facts.busy });
    await lib.touchAt(page, '#assessment-submit', 'cancel');
    await page.waitForTimeout(250);
    record2('P2-touch-cancel-on-busy-no-extra-write', current.state.counts.respond === 1, { respond: current.state.counts.respond });
    await reporter.shot(page, 'p2-01-touch-submit-held');
    current.release('response');
    await page.waitForFunction(() => document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') === '1', null, { timeout: 8000 });
    await lib.waitIdle(page);

    const errors2 = lib.caseErrors(f.report, current.state.id);
    record2('P2-no-page-or-console-errors', errors2.pageErrors.length === 0 && errors2.consoleErrors.length === 0, errors2);
    record2('P2-no-unexpected-api', f.report.unexpected.length === 0, { unexpected: f.report.unexpected });
    record2('P2-exact-counts', current.state.counts.start === 1 && current.state.counts.respond === 1, { counts: { ...current.state.counts } });
    reporter.endCase(p2, checks2.every(name => reporter.report.checks.find(check => check.name === name)?.result === 'PASS') ? 'PASS' : 'FAIL', { route: route2, counts: { ...current.state.counts } });
  } finally {
    await current.close();
  }
});
