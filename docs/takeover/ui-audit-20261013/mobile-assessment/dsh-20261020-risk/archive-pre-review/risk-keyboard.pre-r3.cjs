// Group 1 — real keyboard / focus-visible risk suite. PREPARED ONLY; not run by DSH.
// Every check is measured from live DOM state and real key events. No check is
// pre-declared PASS: apps/mobile/src/platform/experience.ts already installs a
// document-level Enter/Space bridge for UNI-BUTTON (installMobileKeyboard, called
// from main.ts), so activation is expected to be possible but is still measured.
// If Enter/Space has no effect, the check records FAIL and the setup falls back to
// a recorded pointer press so the remaining keyboard measurements are collected.
//
// Run (Root review environment only; 18183 already served by the Root-managed dev service):
//   $env:MB006_CONFIRM_BROWSER='1'
//   $env:MB006_RISK_RUN='codex-review-kbd-1'
//   $env:MB006_RISK_EXECUTOR='codex-review'
//   node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261020-risk/risk-keyboard.cjs
'use strict';
const lib = require('./risk-lib.cjs');
const f = require('./fixture.cjs');

lib.execute({ group: 'keyboard', fixture: f }, async ({ reporter }) => {
  const run = reporter.startCase('K1-keyboard-guide-question', { cursor: 'real Tab / Shift+Tab / Enter / Space only; pointer fallback is recorded, never counted as a keyboard pass' });
  let current = await f.fresh({ locale: 'zh-CN', theme: 'light', width: 390, height: 844 });
  const page = current.page;
  const caseChecks = [];
  const record = (name, ok, detail) => { reporter.check(name, ok, detail); caseChecks.push(name); };
  try {
    await lib.waitPresent(page, 'assessment-guide');
    await lib.waitIdle(page);
    let facts = await lib.facts(page);
    const route = await reporter.route(page, 'K1-guide');
    record('K1-page-identity-guide', facts.root === true && route === '#/pages/assessment/assessment' && facts.bodyLen > 0 && facts.overlay === false, { route, root: facts.root, bodyLen: facts.bodyLen, overlay: facts.overlay });
    record('K1-guide-start-count-zero', current.state.counts.start === 0, { start: current.state.counts.start });
    await reporter.shot(page, 'k1-01-guide');

    // Real Tab walk. uni-button is a custom element with tabindex="0"; focus and
    // :focus-visible are measured, not inferred from CSS source.
    await lib.blurActive(page);
    const order = await lib.focusWalk(page, 12);
    record('K1-tab-walk-nonempty', order.length === 12 && order.filter(item => item.id).length >= 1, { order });
    const focused = order.filter(item => item.id);
    const required = ['assessment-back', 'assessment-settings', 'assessment-start', 'assessment-home'];
    record('K1-tab-reaches-guide-controls', required.every(id => focused.some(item => item.id === id)), { focusedIds: focused.map(item => item.id), required, order });
    record('K1-focus-visible-matches', focused.length > 0 && focused.every(item => item.focusVisible === true), { focused });
    const indicator = focused.map(item => ({ id: item.id, outlineStyle: item.outlineStyle, outlineWidth: item.outlineWidth, boxShadow: item.boxShadow }));
    record('K1-focus-indicator-visible', indicator.length > 0 && indicator.every(item => (item.outlineStyle !== 'none' && parseFloat(item.outlineWidth) >= 1) || item.boxShadow !== 'none'), { indicator });

    const reverse = await lib.focusWalk(page, 2, { reverse: true });
    record('K1-shift-tab-reverses-without-loss', reverse.length === 2 && reverse.every(item => item.tag !== 'body' && item.focusVisible === true), { reverse });

    // Start via keyboard, exactly one start write.
    await lib.blurActive(page);
    const startFocus = await lib.focusById(page, 'assessment-start', { maxTabs: 24 });
    record('K1-start-focusable-by-tab', startFocus.found === true, { steps: startFocus.steps, seen: startFocus.seen });
    const startBefore = current.state.counts.start;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    facts = await lib.facts(page);
    const keyboardStart = current.state.counts.start === startBefore + 1 && facts.present['assessment-question'] === true;
    record('K1-enter-start-single-write', keyboardStart, { before: startBefore, after: current.state.counts.start, guide: facts.present['assessment-guide'], question: facts.present['assessment-question'] });
    if (!keyboardStart) {
      (reporter.report.fallbacks ||= []).push({ case: 'K1', reason: 'Enter on #assessment-start did not activate the uni-button (no click synthesized)', action: 'pointer Press 160ms used only as setup' });
      await lib.pointerPress(page, '#assessment-start', { holdMs: 160 });
    }
    await lib.waitPresent(page, 'assessment-question');
    await lib.waitIdle(page);
    facts = await lib.facts(page);
    record('K1-question-has-four-unselected-options', facts.options.length === 4 && facts.options.every(option => option.pressed === 'false'), { count: facts.options.length, pressed: facts.options.map(option => option.pressed) });
    record('K1-submit-disabled-before-selection', facts.submit?.disabled === true && facts.submit?.ariaDisabled === 'true', { submit: facts.submit });
    record('K1-no-write-before-selection', current.state.counts.respond === 0, { respond: current.state.counts.respond });

    // Enter on option A: exactly one selection, no write, second Enter must not toggle off.
    await lib.blurActive(page);
    const focusA = await lib.focusById(page, 'assessment-option-A', { maxTabs: 24 });
    record('K1-option-A-focusable-by-tab', focusA.found === true, { steps: focusA.steps });
    const respondBefore = current.state.counts.respond;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    facts = await lib.facts(page);
    const aPressed = facts.options.find(option => option.id === 'assessment-option-A')?.pressed === 'true';
    record('K1-enter-selects-option-A-once', aPressed === true && current.state.counts.respond === respondBefore, { pressed: facts.options.map(option => [option.id, option.pressed]), respond: current.state.counts.respond });
    if (!aPressed) {
      (reporter.report.fallbacks ||= []).push({ case: 'K1', reason: 'Enter on #assessment-option-A did not change aria-pressed', action: 'pointer press used only as setup' });
      await lib.pointerPress(page, '#assessment-option-A', { holdMs: 160 });
    }
    facts = await lib.facts(page);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const afterSecondEnter = await lib.facts(page);
    record('K1-second-enter-does-not-toggle-or-write', afterSecondEnter.options.find(option => option.id === 'assessment-option-A')?.pressed === 'true' && current.state.counts.respond === respondBefore, { pressed: afterSecondEnter.options.map(option => [option.id, option.pressed]), respond: current.state.counts.respond, establishedBy: aPressed ? 'keyboard' : 'pointer fallback (recorded, not a keyboard pass)' });
    await reporter.shot(page, 'k1-02-enter-selected');

    // Space on option B: switches selection once, no write, and the page scroll is recorded.
    await lib.blurActive(page);
    const focusB = await lib.focusById(page, 'assessment-option-B', { maxTabs: 12 });
    record('K1-option-B-focusable-by-tab', focusB.found === true, { steps: focusB.steps });
    const scrollBefore = (await lib.facts(page)).scrollY;
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    facts = await lib.facts(page);
    const bPressed = facts.options.find(option => option.id === 'assessment-option-B')?.pressed === 'true';
    const aCleared = facts.options.find(option => option.id === 'assessment-option-A')?.pressed === 'false';
    record('K1-space-selects-option-B-once', bPressed === true && aCleared === true && current.state.counts.respond === respondBefore, { pressed: facts.options.map(option => [option.id, option.pressed]), respond: current.state.counts.respond, scrollBefore, scrollAfter: facts.scrollY });
    if (!bPressed) {
      (reporter.report.fallbacks ||= []).push({ case: 'K1', reason: 'Space on #assessment-option-B did not change aria-pressed', action: 'pointer press used only as setup' });
      await lib.pointerPress(page, '#assessment-option-B', { holdMs: 160 });
    }

    // Keyboard primary action while the synthetic response is held: exactly one write.
    await lib.blurActive(page);
    const focusSubmit = await lib.focusById(page, 'assessment-submit', { maxTabs: 12 });
    record('K1-submit-focusable-by-tab', focusSubmit.found === true, { steps: focusSubmit.steps });
    current.state.responseDelay = true;
    const respondBeforeSubmit = current.state.counts.respond;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    let busyFacts = await lib.facts(page);
    const firstWrite = current.state.counts.respond === respondBeforeSubmit + 1;
    record('K1-enter-submit-single-write', firstWrite, { before: respondBeforeSubmit, after: current.state.counts.respond, busy: busyFacts.busy });
    if (!firstWrite) {
      (reporter.report.fallbacks ||= []).push({ case: 'K1', reason: 'Enter on #assessment-submit did not create a response request', action: 'pointer press used only as setup; repeat-keyboard checks still run' });
      await lib.pointerPress(page, '#assessment-submit', { holdMs: 160 });
    }
    await page.waitForTimeout(200);
    busyFacts = await lib.facts(page);
    record('K1-busy-state-visible-while-held', busyFacts.busy === 'true' && busyFacts.submit?.disabled === true, { busy: busyFacts.busy, submit: busyFacts.submit });
    const writesAfterFirst = current.state.counts.respond;
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    record('K1-busy-blocks-repeat-keyboard-submit', current.state.counts.respond === writesAfterFirst, { writesAfterFirst, after: current.state.counts.respond, firstWrite: firstWrite ? 'keyboard' : 'pointer fallback (recorded, not a keyboard pass)' });
    await lib.pointerPress(page, '#assessment-option-C', { holdMs: 0 });
    const locked = await lib.facts(page);
    record('K1-busy-locks-selection', locked.options.find(option => option.id === 'assessment-option-C')?.pressed === 'false' && locked.options.filter(option => option.pressed === 'true').length === 1, { pressed: locked.options.map(option => [option.id, option.pressed]) });
    await reporter.shot(page, 'k1-03-busy-submit');
    current.release('response');
    await page.waitForFunction(() => document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') === '1', null, { timeout: 8000 });
    await lib.waitIdle(page);
    const next = await lib.facts(page);
    const accepted = current.projection()?.acceptedSequence;
    record('K1-one-write-advances-one-checkpoint', accepted === 1 && next.options.length === 4, { accepted, progress: next.present['assessment-question'] });
    record('K1-new-question-clears-selection', next.options.length === 4 && next.options.every(option => option.pressed === 'false') && next.submit?.disabled === true, { pressed: next.options.map(option => option.pressed), submit: next.submit?.disabled });
    record('K1-new-question-focus-not-on-disabled-submit', !(next.active?.id === 'assessment-submit' && next.active?.disabled === true), { active: next.active });
    await reporter.shot(page, 'k1-04-next-question');

    const errors = lib.caseErrors(f.report, current.state.id);
    record('K1-no-page-or-console-errors', errors.pageErrors.length === 0 && errors.consoleErrors.length === 0, errors);
    record('K1-no-unexpected-api', f.report.unexpected.length === 0, { unexpected: f.report.unexpected });
    record('K1-exact-write-counts', current.state.counts.start === 1 && current.state.counts.respond === 1, { counts: { ...current.state.counts } });
    reporter.endCase(run, caseChecks.every(name => reporter.report.checks.find(check => check.name === name)?.result === 'PASS') ? 'PASS' : 'FAIL', { route, counts: { ...current.state.counts }, keyboardStart, enterSelects: aPressed, spaceSelects: bPressed, keyboardSubmit: firstWrite });
  } finally {
    await current.close();
  }
});
