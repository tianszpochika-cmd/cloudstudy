// MB006 / C8 font audit — PREPARED ONLY. DSH launched no browser and claims no PASS.
// Scope: assessment guide / selected / report; zh-CN + en-US at 390x844 light.
// Reuses dsh-20261021-navigation/scripts/fixture.nav.cjs (real login + real UI +
// synthetic transport). No auth/store/guard/storage injection, no new dependency.
// Declared values: read-only getComputedStyle. Actual rendered family: only the
// public Playwright CDP CSS.getPlatformFontsForNode result. No CDP => NOT_RUN;
// a CSS family is never reported as the used font.
// Env: MB006_FONT_CONFIRM_BROWSER=1, MB006_FONT_EXPECTED_PAGE_SHA=<64 lowercase
// hex, no default>; optional MB006_FONT_RUN_ID, MB006_FONT_EXECUTOR (recorded only).
// Exit: 0 PASS | 1 FAIL | 2 setup refusal | 3 NOT_RUN/WARN (never PASS).
'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const f = require('../../dsh-20261021-navigation/scripts/fixture.nav.cjs');
const PAGE = f.PAGE, LOCALES = ['zh-CN', 'en-US'];
const FIXED = {
  'packages/i18n/src/mobile-experience.ts': '6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380',
  'apps/mobile/src/api/learner-content.ts': '43ce2ad5d6519b5fab7e38867d1349b569d08b6153b74c87e5c96f11e24e1ae6',
  'apps/mobile/src/stores/learner-content.ts': '95cc92496db996242d91baed3301d76f985e4e3b9134e1e50c2b9ab8d41e4c61',
  'apps/mobile/src/stores/session.ts': 'd944c9e84617af5ad553d2fbc1fd0c07120ce790411dbe02603f9338333f8931',
  'apps/mobile/src/auth/navigation.ts': '7365fec07c55857445fdb1d87b60659734e9e94dc06cfb65afabcb3e8863a4b5',
  'apps/mobile/src/platform/uni-runtime.ts': 'fcbeba8626d8364af0ae96db64a05fcff9a3bb2b46a7d8fbcba21507ef609751',
  'apps/mobile/src/uni.scss': '0bd56842fc5baebd8767e721f2d938986e293d1d87bfc74bb087b3c228f638d7',
};
const DEPS = {
  'apps/mobile/package.json': '484382c73929055cc4ecd9a83679f8bab72388dd8069f71a056b3bbc595c0078',
  'pnpm-lock.yaml': 'd57a87ca84985549fd53c69b1fe1d59db0b136036f2f7bf640d3b30c0a106624',
};
const STATES = {
  guide: { container: '#assessment-guide', body: '#assessment-guide .assessment-description', button: '#assessment-start' },
  selected: { container: '#assessment-question', body: '#assessment-option-A .assessment-option-text', button: '#assessment-submit' },
  report: { container: '#assessment-report', body: '#assessment-report .assessment-description', button: '#assessment-today' },
};
const checks = [], states = [];
let OUT = null, shotNo = 0;
const refuse = m => { console.error('REFUSED (setup, exit 2): ' + m + ' Nothing was started.'); process.exit(2); };
const check = (name, result, detail) => checks.push({ name, result, ...(detail ? { detail } : {}) });
const probe = () => new Promise(resolve => {
  const request = http.get(f.BASE, response => { response.resume(); resolve(response.statusCode || 0); });
  request.on('error', () => resolve(0));
  request.setTimeout(3000, () => { request.destroy(); resolve(0); });
});
// Page-side, read-only. No DOM writes, storage, token, component or store access.
function collectSamples(spec) {
  const keys = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight'];
  const style = el => { const s = getComputedStyle(el); return Object.fromEntries(keys.map(k => [k, s[k]])); };
  const node = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  const info = el => {
    if (!el) return { present: false, visible: false, style: null, familyChain: [] };
    const chain = []; let p = el.parentElement;
    for (let i = 1; p && i <= 4; i++, p = p.parentElement) chain.push({ level: i, node: node(p), ...style(p) });
    return { present: true, visible: el.getClientRects().length > 0 && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0, text: (el.textContent || '').trim().slice(0, 120), style: style(el), familyChain: chain };
  };
  const out = {};
  for (const [key, selector] of Object.entries(spec)) out[key] = { selector, ...info(document.querySelector(selector)) };
  const host = document.querySelector(spec.button);
  if (!out.buttonText.present && host) out.buttonText = { selector: spec.buttonText, present: false, visible: false, directText: true, text: (host.textContent || '').trim().slice(0, 120), style: out.button.style, styleSource: 'button host (direct text node inherits; no separate element box)', familyChain: out.button.familyChain };
  return out;
}
async function usedFonts(page, targets) {
  let session;
  try {
    session = await page.context().newCDPSession(page);
    await session.send('DOM.enable'); await session.send('CSS.enable');
  } catch (error) { return { status: 'NOT_RUN', reason: 'CDP unavailable: ' + String(error.message || error), samples: {} }; }
  try {
    const doc = await session.send('DOM.getDocument', { depth: -1, pierce: false }), samples = {};
    for (const [key, selector] of Object.entries(targets)) {
      try {
        const found = await session.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector });
        if (!found.nodeId) { samples[key] = { status: 'NOT_RUN', reason: 'selector not found', selector, fonts: [] }; continue; }
        const result = await session.send('CSS.getPlatformFontsForNode', { nodeId: found.nodeId });
        samples[key] = { status: 'PASS', selector, fonts: (result.fonts || []).map(x => ({ familyName: x.familyName, postScriptName: x.postScriptName, glyphCount: x.glyphCount, isCustomFont: x.isCustomFont })) };
      } catch (error) { samples[key] = { status: 'NOT_RUN', reason: String(error.message || error), selector, fonts: [] }; }
    }
    return { status: 'PASS', samples };
  } catch (error) { return { status: 'NOT_RUN', reason: String(error.message || error), samples: {} }; }
  finally { await session.detach().catch(() => {}); }
}
async function captureState(item, locale, name) {
  const state = STATES[name];
  const spec = { root: '#assessment-page', h1: '#assessment-title', body: state.body, bodySpan: state.body + ' > span', button: state.button, buttonText: state.button + ' span' };
  const shown = await item.page.evaluate(sel => { const el = document.querySelector(sel); return !!el && el.getClientRects().length > 0 && (el.offsetWidth > 0 || el.offsetHeight > 0); }, state.container);
  if (!shown) throw new Error(locale + '/' + name + ': state container not visible (' + state.container + ')');
  const samples = await item.page.evaluate(collectSamples, spec);
  const textNode = samples.bodySpan.present ? spec.bodySpan : spec.body;
  const buttonNode = samples.buttonText.present ? spec.buttonText : spec.button;
  const cdp = await usedFonts(item.page, {
    root: spec.root, h1: spec.h1 + ' > span', body: textNode, bodySpan: textNode,
    button: buttonNode, buttonText: buttonNode,
  });
  if (!samples.bodySpan.present) cdp.samples.bodySpan = { status: 'NOT_RUN', reason: 'inner span not present; host-only is not inner-span evidence', fonts: [] };
  if (samples.buttonText.directText && cdp.samples.buttonText) cdp.samples.buttonText.note = 'direct text node under uni-button; CDP queried host';
  await item.page.evaluate(() => scrollTo(0, 0));
  const shot = String(++shotNo).padStart(2, '0') + '-' + locale + '-' + name + '.png';
  await item.page.screenshot({ path: path.join(OUT, shot), fullPage: true });
  const entry = { locale, state: name, url: item.page.url(), lang: await item.page.evaluate(() => document.documentElement.lang || null), screenshot: shot, samples, cdp, counts: { ...item.state.counts } };
  states.push(entry);
  if (name === 'report') check('ten-responses-' + locale, item.state.counts.respond === 10 ? 'PASS' : 'FAIL', { respond: item.state.counts.respond, accepted: item.projection()?.acceptedSequence ?? null });
  const missing = ['root', 'h1', 'body', 'bodySpan', 'button'].filter(k => !samples[k] || !samples[k].present || !samples[k].visible);
  check('selectors-visible-' + locale + '-' + name, missing.length ? 'FAIL' : 'PASS', { missing, note: 'only present+visible selectors are sampled; buttonText may be a direct text node' });
  const cdpMissing = ['h1', 'body', 'bodySpan', 'button', 'buttonText'].filter(k => cdp.samples[k]?.status !== 'PASS' || !(cdp.samples[k].fonts || []).some(x => x.glyphCount > 0));
  if (cdp.samples.root?.status !== 'PASS') cdpMissing.push('root');
  check('cdp-used-fonts-' + locale + '-' + name, cdp.status === 'PASS' && !cdpMissing.length ? 'PASS' : 'NOT_RUN', { cdpStatus: cdp.status, reason: cdp.reason || null, missing: cdpMissing, note: 'used fonts are CSS.getPlatformFontsForNode results only' });
  return entry;
}
(async () => {
  if (process.env.MB006_FONT_CONFIRM_BROWSER !== '1') refuse('set MB006_FONT_CONFIRM_BROWSER=1 to launch this prepared real-H5 font audit.');
  const PAGE_SHA = String(process.env.MB006_FONT_EXPECTED_PAGE_SHA || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(PAGE_SHA)) refuse('MB006_FONT_EXPECTED_PAGE_SHA must be an explicit 64-lowercase-hex Root-approved page hash; no default and no auto-accept.');
  for (const [rel, want] of Object.entries({ ...FIXED, ...DEPS })) { const got = f.hash(rel); if (got !== want) refuse('hash mismatch ' + rel + ': expected ' + want + ' got ' + got + '.'); }
  const actualPage = f.hash(PAGE);
  if (actualPage !== PAGE_SHA) refuse('page hash mismatch ' + PAGE + ': expected ' + PAGE_SHA + ' got ' + actualPage + '.');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  const runId = String(process.env.MB006_FONT_RUN_ID || ('font-' + stamp)).trim();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(runId)) refuse('MB006_FONT_RUN_ID must be one safe path segment.');
  const runsRoot = path.resolve(__dirname, '..', 'runs');
  OUT = path.resolve(runsRoot, runId);
  if (path.dirname(OUT) !== runsRoot) refuse('run directory escaped runs/.');
  if (fs.existsSync(OUT)) refuse('run directory already exists: ' + path.relative(runsRoot, OUT) + '; refusing to overwrite prior results or screenshots.');
  if (!(await probe())) refuse('no dev server answering ' + f.BASE + ' on the fixed mobile H5 port.');
  const before = f.hashes(), depsBefore = Object.fromEntries(Object.keys(DEPS).map(rel => [rel, f.hash(rel)]));
  try { f.freeze({ ...FIXED, [PAGE]: PAGE_SHA }); } catch (error) { refuse('guard freeze failed: ' + error.message); }
  let browser, closed = false, failure = null, envInfo = null;
  try { browser = await f.init(); } catch (error) { refuse('browser launch failed (setup): ' + error.message); }
  envInfo = { browser: browser.browserType().name(), version: browser.version(), executablePath: browser.browserType().executablePath(), headless: true, platform: process.platform, arch: process.arch };
  try { fs.mkdirSync(runsRoot, { recursive: true }); fs.mkdirSync(OUT); }
  catch (error) { await f.close().catch(() => {}); refuse('run directory could not be created exclusively: ' + error.message); }
  try {
    for (const locale of LOCALES) {
      const item = await f.fresh({ locale, theme: 'light', width: 390, height: 844, colorScheme: 'light', case: 'font-audit' });
      try {
        const page = item.page;
        await page.locator('#assessment-guide').waitFor();
        await page.locator('#assessment-page[aria-busy=false]').waitFor();
        await captureState(item, locale, 'guide');
        await page.locator('#assessment-start').click();
        await page.locator('#assessment-question').waitFor();
        await page.locator('#assessment-page[aria-busy=false]').waitFor();
        await page.locator('#assessment-option-A').click();
        await page.waitForFunction(() => document.querySelector('#assessment-option-A')?.getAttribute('aria-pressed') === 'true');
        await captureState(item, locale, 'selected');
        for (let n = 1; n <= 10; n++) {
          if (n > 1) await page.locator('#assessment-option-A').click();
          await page.locator('#assessment-submit').click();
          if (n < 10) {
            await page.waitForFunction(expected => document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') === String(expected), n);
            await page.locator('#assessment-page[aria-busy=false]').waitFor();
          } else await page.locator('#assessment-report').waitFor();
        }
        await page.locator('#assessment-page[aria-busy=false]').waitFor();
        await captureState(item, locale, 'report');
      } finally { await item.close(); }
    }
  } catch (error) {
    failure = { message: error.message, stack: error.stack };
    check('flow-completed-without-exception', 'FAIL', failure);
  } finally {
    try { await f.close(); closed = true; } catch (error) { failure = failure || { message: 'close failed: ' + error.message }; }
  }
  check('browser-closed-cleanly', closed ? 'PASS' : 'FAIL', { closed, failure });
  const after = f.hashes(), depsAfter = Object.fromEntries(Object.keys(DEPS).map(rel => [rel, f.hash(rel)]));
  check('source-and-dependency-hashes-stable', JSON.stringify(before) === JSON.stringify(after) && JSON.stringify(depsBefore) === JSON.stringify(depsAfter) ? 'PASS' : 'FAIL', { before, after, depsBefore, depsAfter });
  check('no-unexpected-api-route', f.report.unexpected.length === 0 ? 'PASS' : 'FAIL', { unexpected: f.report.unexpected, rule: 'unknown path => 501 + FAIL' });
  check('no-page-errors', f.report.pageErrors.length === 0 ? 'PASS' : 'FAIL', { pageErrors: f.report.pageErrors });
  check('no-console-errors', f.report.consoleErrors.length === 0 ? 'PASS' : 'FAIL', { consoleErrors: f.report.consoleErrors });
  check('console-warnings-recorded', f.report.consoleWarnings.length === 0 ? 'PASS' : 'WARN', { count: f.report.consoleWarnings.length, warnings: f.report.consoleWarnings.slice(0, 20), note: 'not dropped; WARN blocks a clean PASS and is not a font failure' });
  const expected = LOCALES.flatMap(locale => ['guide', 'selected', 'report'].map(name => locale + '/' + name));
  const captured = states.map(s => s.locale + '/' + s.state), missingStates = expected.filter(x => !captured.includes(x));
  check('all-expected-states-captured', !missingStates.length && captured.length === expected.length ? 'PASS' : 'FAIL', { expected, captured, missing: missingStates });
  const fail = checks.some(c => c.result === 'FAIL'), notRun = checks.some(c => c.result === 'NOT_RUN'), warn = checks.some(c => c.result === 'WARN');
  const result = fail ? 'FAIL' : notRun ? 'NOT_RUN' : warn ? 'WARN' : 'PASS';
  const payload = {
    scope: 'MB006_C8_FONT_AUDIT_SYNTHETIC_UI', preparedBy: 'DSH author session (prepared, not executed)', runBy: process.env.MB006_FONT_EXECUTOR || null,
    preparedAt: '2026-10-21', run: runId, at: new Date().toISOString(), page: { file: PAGE, expectedShaFromEnv: PAGE_SHA, pageHashDefaulted: false, actualSha: before[PAGE] },
    browser: envInfo, viewport: { width: 390, height: 844, theme: 'light', colorScheme: 'light' }, states, checks,
    report: f.report, consoleWarnings: f.report.consoleWarnings, sourceHashesBefore: before, sourceHashesAfter: after, dependenciesBefore: depsBefore, dependenciesAfter: depsAfter,
    closed, failure, result, exitCode: result === 'PASS' ? 0 : result === 'FAIL' ? 1 : 3,
    note: 'Computed fontFamily/fontSize/fontWeight/lineHeight are declarations. Actual rendered family is only the CDP CSS.getPlatformFontsForNode result; no fallback when CDP is unavailable.',
  };
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({ run: runId, runDirectory: path.relative(path.resolve(__dirname, '..'), OUT).split(path.sep).join('/'), result, checks: checks.length, failed: checks.filter(c => c.result === 'FAIL').map(c => c.name), notRun: checks.filter(c => c.result === 'NOT_RUN').map(c => c.name), warn: checks.filter(c => c.result === 'WARN').map(c => c.name), states: captured }, null, 2));
  process.exitCode = payload.exitCode;
})();
