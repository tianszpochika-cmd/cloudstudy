// C2 independent re-verification: en-US dark 320x568, CSS text 200%.
// Covers guide H1, question H1, and result H1 after 10 real submits.
// Frozen at the C2 source hashes (page d1b501e3..., i18n 44e4c857...).
const f = require('./fixture.cjs');
const { scale, collect } = require('./dom-lib.cjs');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const OUT = path.resolve(__dirname, '..', 'runs', 'c2-text200');
fs.mkdirSync(OUT, { recursive: true });
const PAGE = 'apps/mobile/src/pages/assessment/assessment.vue';
const I18N = 'packages/i18n/src/mobile-experience.ts';
const C2_PAGE = 'd1b501e33b313679bd5c90dd8fcda8e9a5a6b790856a444b01e915523827366a';
const C2_I18N = '44e4c857868f8be2bac17f7da86f43c9ea0d03eaaadd3a3f154414d02f129c64';

const report = {
  at: new Date().toISOString(),
  scope: 'MB006_C2_EN_DARK_320x568_CSS_TEXT200_TITLE_REVERIFY',
  label: 'C2 (page d1b501e3 / i18n 44e4c857)',
  textScale: 'CSS text scaling only (2x computed font-size); browser zoom and native scaling are separate and NOT_RUN',
  sourceHashesBefore: f.hashes(),
  checks: [],
  states: [],
};
let current;
const save = () => fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ ...report, transport: f.report }, null, 2));
function check(name, result, detail) { report.checks.push({ name, result, ...(detail ? { detail } : {}) }); save(); }
function stateResult(facts) {
  const h1Split = facts.splitWords.filter((w) => w.id === 'assessment-title');
  return { h1Split, otherSplit: facts.splitWords.filter((w) => w.id !== 'assessment-title'), pass: h1Split.length === 0 && !facts.overflow };
}
async function capture(name) {
  f.frozen();
  const facts = await collect(current.page);
  const judged = stateResult(facts);
  const counts = { ...current.state.counts };
  await current.page.evaluate(() => scrollTo(0, 0));
  await current.page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });
  report.states.push({ name, facts, judged, counts, result: judged.pass ? 'PASS' : 'FAIL' });
  save();
  return judged;
}

(async () => {
  try {
    assert.equal(report.sourceHashesBefore[PAGE], C2_PAGE, 'page hash is not the frozen C2 candidate');
    assert.equal(report.sourceHashesBefore[I18N], C2_I18N, 'i18n hash is not the frozen C2 candidate');
    f.freeze(report.sourceHashesBefore);
    save();
    await f.init();

    current = await f.fresh({ locale: 'en-US', theme: 'dark', width: 320, height: 568 });
    await current.page.locator('#assessment-guide').waitFor();
    await current.page.locator('#assessment-page[aria-busy=false]').waitFor();
    await scale(current.page, 2);
    let j = await capture('01-guide-css200-en-dark-320');
    check('guide-h1-readable-at-200', j.pass ? 'PASS' : 'FAIL', { h1Split: j.h1Split.map((w) => w.word), overflow: null });
    check('guide-heading-is-Level-check', (await current.page.locator('#assessment-title').innerText()).trim() === 'Level check' ? 'PASS' : 'FAIL');
    await scale(current.page, 0);

    await current.page.locator('#assessment-start').click();
    await current.page.locator('#assessment-question').waitFor();
    await current.page.locator('#assessment-page[aria-busy=false]').waitFor();
    await current.page.locator('#assessment-option-A').click();
    await scale(current.page, 2);
    j = await capture('02-question-css200-en-dark-320');
    check('question-h1-readable-at-200', j.pass ? 'PASS' : 'FAIL', { h1Split: j.h1Split.map((w) => w.word) });
    check('question-heading-is-Level-check', (await current.page.locator('#assessment-title').innerText()).trim() === 'Level check' ? 'PASS' : 'FAIL');
    await scale(current.page, 0);

    for (let n = 1; n <= 10; n++) {
      if (n > 1) await current.page.locator('#assessment-option-A').click();
      await current.page.locator('#assessment-submit').click();
      if (n < 10) {
        await current.page.waitForFunction((expected) => {
          const bar = document.querySelector('[role=progressbar]');
          const root = document.getElementById('assessment-page');
          return !!bar && bar.getAttribute('aria-valuenow') === String(expected) && root?.getAttribute('aria-busy') === 'false';
        }, n);
      } else {
        await current.page.locator('#assessment-report').waitFor();
        await current.page.locator('#assessment-page[aria-busy=false]').waitFor();
      }
    }
    check('ten-real-submits-produced-report', current.state.counts.respond === 10 && current.state.counts.start === 1 && current.state.counts.ensure === 1 ? 'PASS' : 'FAIL', { ...current.state.counts });

    await scale(current.page, 2);
    j = await capture('03-result-css200-en-dark-320');
    check('result-h1-readable-at-200', j.pass ? 'PASS' : 'FAIL', { h1Split: j.h1Split.map((w) => w.word) });
    check('result-heading-is-Your-result', (await current.page.locator('#assessment-title').innerText()).trim() === 'Your result' ? 'PASS' : 'FAIL');
    await scale(current.page, 0);
    await current.page.screenshot({ path: path.join(OUT, '04-result-100-en-dark-320.png'), fullPage: true });
    report.states.push({ name: '04-result-100-en-dark-320', note: '100% for readability reference only' });
    save();

    check('no-unexpected-api', f.report.unexpected.length === 0 ? 'PASS' : 'FAIL', { unexpected: f.report.unexpected });
    check('no-page-errors', f.report.pageErrors.length === 0 ? 'PASS' : 'FAIL', { pageErrors: f.report.pageErrors });
    const allH1Pass = report.states.filter((s) => s.judged).every((s) => s.judged.pass);
    check('all-three-h1-states-pass', allH1Pass ? 'PASS' : 'FAIL');
    report.result = report.checks.every((c) => c.result === 'PASS') ? 'PASS' : 'FAIL';
    report.completed = true;
  } catch (error) {
    report.failure = { message: error.message, stack: error.stack };
    report.result = 'FAIL';
    try { if (current) await capture('FAIL-current'); } catch (captureError) { report.captureFailure = captureError.message; }
    process.exitCode = 1;
  } finally {
    await f.close();
    report.closed = true;
    report.sourceHashesAfter = f.hashes();
    report.sourceStable = JSON.stringify(report.sourceHashesBefore) === JSON.stringify(report.sourceHashesAfter);
    save();
  }
  console.log(JSON.stringify({ result: report.result, checks: report.checks, states: report.states.map((s) => ({ name: s.name, result: s.result, h1: s.facts?.h1, splitWords: s.facts?.splitWords.map((w) => w.word), progress: s.facts?.progress, metaText: s.facts?.metaText, receivedText: s.facts?.receivedText })) }, null, 2));
})();
