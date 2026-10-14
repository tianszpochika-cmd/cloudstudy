// Read-only related-page diagnostic, actual empty primary Enter/Space only.
// All APIs intercepted; no body/header/token/cookie/storage access.
const { chromium } = require('playwright'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../../../../..'), BASE = 'http://127.0.0.1:18183', SOURCE = 'apps/mobile/src/pages/login/login.vue';
const hash = () => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, SOURCE))).digest('hex');
const expected = 'da5ad20851a4158ea0e23918adb27f1bcc7047ae67778add321aa8d397bb58be';
const report = { at: new Date().toISOString(), scope: 'READ_ONLY_MB001_RELATED_PRIMARY_EMPTY_KEYBOARD_DIAGNOSTIC', sourceHashBefore: hash(), cases: [], requests: [], pageErrors: [] };
const save = () => fs.writeFileSync(path.join(__dirname, 'button-keyboard-results.json'), JSON.stringify(report, null, 2)); let browser;
(async () => {
  if (report.sourceHashBefore !== expected) throw new Error('Current login source hash mismatch'); browser = await chromium.launch();
  for (const key of ['Enter', 'Space']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); let apiCalls = 0;
    await context.route('**/api/v1/**', async route => { const req = route.request(), u = new URL(req.url()); report.requests.push({ method: req.method(), origin: u.origin, path: u.pathname }); if (req.method() !== 'OPTIONS') apiCalls++; await route.fulfill({ status: req.method() === 'OPTIONS' ? 204 : 503, contentType: 'application/json', body: req.method() === 'OPTIONS' ? '' : JSON.stringify({ code: 'SERVICE_UNAVAILABLE' }) }); });
    const p = await context.newPage(); p.on('pageerror', e => report.pageErrors.push(e.name)); await p.goto(`${BASE}/#/pages/login/login?theme=light&uiLocale=zh-CN`, { waitUntil: 'networkidle' }); await p.locator('#mobile-login-identifier').waitFor();
    await p.locator('.login-submit').focus(); const before = await p.evaluate(() => ({ focusClass: document.activeElement.className, focusId: document.activeElement.id }));
    await p.evaluate(() => { window.__keyboardTrace = []; for (const type of ['keydown', 'keyup', 'click', 'focusin']) document.addEventListener(type, e => window.__keyboardTrace.push({ type, key: e.key ?? null, targetId: e.target.id ?? null, targetClass: typeof e.target.className === 'string' ? e.target.className : null, trusted: e.isTrusted, focusId: document.activeElement.id }), true); });
    await p.keyboard.press(key); await p.waitForTimeout(100); const after = await p.evaluate(() => ({ focusId: document.activeElement.id, identifierInvalid: document.getElementById('mobile-login-identifier').getAttribute('aria-invalid'), errorVisible: !!document.querySelector('.login-error[role=alert]') && getComputedStyle(document.querySelector('.login-error[role=alert]')).visibility === 'visible', route: location.hash.split('?')[0], trace: window.__keyboardTrace }));
    const entry = { test: 'empty-primary-button-real-key', key, before, after, apiCalls, result: after.focusId === 'mobile-login-identifier' && after.identifierInvalid === 'true' && after.errorVisible && apiCalls === 0 ? 'PASS' : 'FAIL' }; report.cases.push(entry); save(); await p.screenshot({ path: path.join(__dirname, `keyboard-empty-${key}.png`), fullPage: true }); await context.close();
  }
  report.sourceHashAfter = hash(); report.result = report.cases.every(c => c.result === 'PASS') && report.sourceHashAfter === expected && !report.pageErrors.length ? 'KEYBOARD_DIAGNOSTIC_PASS' : 'FAIL'; save(); console.log(JSON.stringify({ result: report.result, cases: report.cases.map(c => ({ key: c.key, focus: c.after.focusId, apiCalls: c.apiCalls, result: c.result })) }));
})().catch(e => { report.result = 'FAIL'; report.failure = { name: e.name, message: e.message }; save(); console.error(e.message); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); });
