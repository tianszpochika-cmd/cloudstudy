// Focused cross-page keyboard concern: actual primary-button Enter/Space only.
// Empty fields, all APIs intercepted. Record no request bodies/headers/storage.
const { chromium } = require('playwright'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../../../../..'), BASE = 'http://127.0.0.1:18183';
const hashes = () => Object.fromEntries(['apps/mobile/src/pages/reset-password/reset-password.vue', 'apps/mobile/src/platform/pointer-feedback.ts'].map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex')]));
const expected = { 'apps/mobile/src/pages/reset-password/reset-password.vue': 'c9a6da864e9ce8933cb5a42b6743ff99551fa433eafe701ea470c760d88cc936', 'apps/mobile/src/platform/pointer-feedback.ts': '6464f4c1712b5a0f2fd4ab01d451d5bb6ffaa13bde486826a424511059ef6425' };
const report = { at: new Date().toISOString(), scope: 'INDEPENDENT_MB003_C9A6_PRIMARY_BUTTON_EMPTY_AND_VALID_REAL_KEYBOARD', expectedConsoleErrors:0,unexpectedConsoleErrors:0, sourceHashesBefore: hashes(), expectedHashes: expected, cases: [], requests: [], pageErrors: [] };
const save = () => fs.writeFileSync(path.join(__dirname, 'button-keyboard-results.json'), JSON.stringify(report, null, 2)); let browser;
(async () => {
  if (JSON.stringify(report.sourceHashesBefore) !== JSON.stringify(expected)) throw new Error('Current source hash mismatch');
  browser = await chromium.launch();
  for (const confirm of [false, true]) for (const valid of [false, true]) for (const key of ['Enter', 'Space']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); let apiCalls = 0;
    await context.route('**/api/v1/**', async route => { const req = route.request(), u = new URL(req.url()); report.requests.push({ method: req.method(), origin: u.origin, path: u.pathname }); if (req.method() !== 'OPTIONS') apiCalls++; await route.fulfill({ status: req.method() === 'OPTIONS' ? 204 : 503, headers:{'content-type':'application/json','access-control-allow-origin':BASE,'access-control-allow-credentials':'true'}, body: req.method() === 'OPTIONS' ? '' : JSON.stringify({ code: 'SERVICE_UNAVAILABLE' }) }); });
    const p = await context.newPage(); p.on('pageerror', e => report.pageErrors.push(e.name));p.on('console',m=>{if(m.type()==='error'){if(/Failed to load resource.*503/.test(m.text()))report.expectedConsoleErrors++;else report.unexpectedConsoleErrors++;}}); await p.goto(`${BASE}/#/pages/reset-password/reset-password?theme=light&uiLocale=zh-CN`, { waitUntil: 'networkidle' }); await p.locator('#mobile-reset-identifier').waitFor();
    if (confirm) { await p.locator('.reset-step-button').click(); await p.locator('#mobile-reset-newPassword').waitFor(); }
    if (valid) {
      await p.locator('#mobile-reset-identifier').fill('independent-keyboard-valid-account');
      if (confirm) { await p.locator('#mobile-reset-token').fill('independent-keyboard-fixture-'.padEnd(32,'x')); await p.locator('#mobile-reset-newPassword').fill('independent-keyboard-synthetic-password'); }
    }
    await p.locator('.reset-submit').focus();
    const before = await p.evaluate(() => ({ focusClass: document.activeElement.className, focusId: document.activeElement.id }));
    await p.evaluate(() => { window.__keyboardTrace = []; for (const type of ['keydown', 'keyup', 'click', 'focusin']) document.addEventListener(type, e => window.__keyboardTrace.push({ type, key: e.key ?? null, targetId: e.target.id ?? null, targetClass: typeof e.target.className === 'string' ? e.target.className : null, trusted: e.isTrusted, focusId: document.activeElement.id }), true); });
    await p.keyboard.press(key); if(valid)await p.locator('.reset-server-error').waitFor();else await p.waitForFunction(()=>document.getElementById('mobile-reset-identifier').getAttribute('aria-invalid')==='true'); await p.waitForTimeout(100);
    const after = await p.evaluate(() => ({ focusId: document.activeElement.id, identifierInvalid: document.getElementById('mobile-reset-identifier').getAttribute('aria-invalid'), identifierErrorVisible: !!document.querySelector('#mobile-reset-identifier-error') && getComputedStyle(document.querySelector('#mobile-reset-identifier-error')).visibility === 'visible', route: location.hash.split('?')[0], trace: window.__keyboardTrace }));
    const entry = { test: 'primary-button-real-key', step: confirm ? 'confirm' : 'request', mode:valid?'valid':'empty', key, before, after, apiCalls, result: (valid ? apiCalls===1 : after.focusId === 'mobile-reset-identifier' && after.identifierInvalid === 'true' && after.identifierErrorVisible && apiCalls === 0) ? 'PASS' : 'FAIL' }; report.cases.push(entry); save(); await p.screenshot({ path: path.join(__dirname, `keyboard-${entry.mode}-${entry.step}-${key}.png`), fullPage: true, mask: confirm ? [p.locator('#mobile-reset-token'),p.locator('#mobile-reset-newPassword')] : [] }); await context.close();
  }
  report.sourceHashesAfter = hashes(); report.result = report.cases.every(c => c.result === 'PASS') && JSON.stringify(report.sourceHashesAfter) === JSON.stringify(expected) && !report.pageErrors.length && report.unexpectedConsoleErrors===0 ? 'KEYBOARD_SCOPE_PASS' : 'FAIL'; save(); console.log(JSON.stringify({ result: report.result, cases: report.cases.map(c => ({ step: c.step, mode:c.mode, key: c.key, focus: c.after.focusId, apiCalls: c.apiCalls, result: c.result })) }));
})().catch(e => { report.result = 'FAIL'; report.failure = { name: e.name, message: e.message }; save(); console.error(e.message); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); });
