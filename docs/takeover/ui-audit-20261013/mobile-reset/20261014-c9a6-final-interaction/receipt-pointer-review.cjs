// Independent current-source UI evidence. Every API is synthetic and intercepted.
// Record only route metadata, booleans, lengths and public UI geometry. Never read
// request bodies/headers, credentials, cookie/storage values or code-bearing URLs.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../../../../..'), OUT = __dirname, BASE = 'http://127.0.0.1:18183';
const expected = {
  'apps/mobile/src/pages/reset-password/reset-password.vue': 'c9a6da864e9ce8933cb5a42b6743ff99551fa433eafe701ea470c760d88cc936',
  'apps/mobile/src/platform/pointer-feedback.ts': '6464f4c1712b5a0f2fd4ab01d451d5bb6ffaa13bde486826a424511059ef6425',
};
const hashes = () => Object.fromEntries(Object.keys(expected).map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex')]));
const report = { at: new Date().toISOString(), scope: 'INDEPENDENT_MB003_CURRENT_HASH_RECEIPT_POINTER_H5', browserAvailability: 'Browser plugin not available', sourceHashesBefore: hashes(), cases: [], pageErrors: [], expectedConsoleErrors: 0, unexpectedConsoleErrors: 0, requests: [] };
const save = () => fs.writeFileSync(path.join(OUT, 'receipt-pointer-results.json'), JSON.stringify(report, null, 2));
let browser;
async function snapshot(page) {
  return page.evaluate(() => {
    let i = document.querySelector('.v2-reset').__vueParentComponent; while (i && !('token' in i.setupState)) i = i.parent;
    const e = document.querySelector('.reset-receipt'), b = document.querySelector('.reset-submit');
    return {
      ...window.__receiptReview,
      receiptDOMCount: document.querySelectorAll('.reset-receipt').length,
      receiptVisibility: e ? getComputedStyle(e).visibility : null,
      receiptAriaHidden: e?.getAttribute('aria-hidden') ?? null,
      receiptRole: e?.getAttribute('role') ?? null,
      receiptHeight: e?.getBoundingClientRect().height ?? 0,
      buttonTop: b.getBoundingClientRect().top + scrollY,
      feedbackCaptured: !!i.setupState.pointerFeedback,
      heading: document.getElementById('mobile-reset-title').textContent,
      route: location.hash.split('?')[0],
    };
  });
}
(async () => {
  assert.deepEqual(report.sourceHashesBefore, expected); browser = await chromium.launch();
  for (const english200 of [false, true]) for (const delayMs of [0, 160]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    let requests = 0;
    await context.route('**/api/v1/**', async route => {
      const req = route.request(), url = new URL(req.url()), method = req.method();
      report.requests.push({ method, origin: url.origin, path: url.pathname });
      const headers = { 'content-type': 'application/json', 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true' };
      if (method === 'OPTIONS') return route.fulfill({ status: 204, headers, body: '' });
      if (method === 'POST' && url.pathname === '/api/v1/auth/password-reset/request') {
        assert.equal(url.protocol, 'https:'); requests++;
        return route.fulfill({ status: 202, headers, body: JSON.stringify({ data: { accepted: true } }) });
      }
      return route.fulfill({ status: 401, headers, body: JSON.stringify({ code: 'UNSPECIFIED_FAILURE' }) });
    });
    const p = await context.newPage();
    p.on('pageerror', e => report.pageErrors.push(e.name));
    p.on('console', m => { if (m.type() === 'error') { if (/Failed to load resource.*401/.test(m.text())) report.expectedConsoleErrors++; else report.unexpectedConsoleErrors++; } });
    await p.goto(`${BASE}/#/pages/reset-password/reset-password?theme=light&uiLocale=${english200 ? 'en-US' : 'zh-CN'}`, { waitUntil: 'networkidle' });
    await p.locator('#mobile-reset-identifier').waitFor();
    const identity = await p.evaluate(() => ({ route: location.hash.split('?')[0], title: document.title, heading: document.getElementById('mobile-reset-title').textContent, inputCount: document.querySelectorAll('.reset-input input').length, overlayCount: document.querySelectorAll('vite-error-overlay').length }));
    assert.equal(identity.route, '#/pages/reset-password/reset-password'); assert.equal(identity.inputCount, 1); assert.equal(identity.overlayCount, 0); assert.ok(identity.heading);
    if (english200) await p.evaluate(() => {
      const sizes = [...document.querySelectorAll('.v2-reset,.v2-reset *')].map(e => [e, parseFloat(getComputedStyle(e).fontSize)]);
      sizes.forEach(([e, n]) => { if (n) e.style.setProperty('font-size', `${n * 2}px`, 'important'); });
      const style = document.createElement('style'); style.textContent = '.v2-reset .reset-receipt{font-size:28px!important}'; document.head.append(style);
    });
    await p.locator('#mobile-reset-identifier').fill('independent-receipt-account'); await p.locator('#mobile-reset-identifier').blur();
    await p.locator('.reset-submit').click(); await p.locator('.reset-receipt[role=status]').waitFor(); assert.equal(requests, 1);
    await p.locator('.reset-submit').scrollIntoViewIfNeeded(); await p.locator('#mobile-reset-identifier').focus();
    const point = await p.locator('.reset-submit').evaluate(e => {
      const r = e.getBoundingClientRect(); window.__receiptReview = { trustedClicks: 0, downTargetAction: false, downTrusted: false };
      e.addEventListener('click', x => { if (x.isTrusted) window.__receiptReview.trustedClicks++; });
      document.addEventListener('pointerdown', x => { window.__receiptReview.downTrusted = x.isTrusted; window.__receiptReview.downTargetAction = !!x.target.closest?.('.reset-submit'); }, { once: true, capture: true });
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await p.mouse.move(point.x, point.y); const before = await snapshot(p);
    await p.evaluate(() => { const e = document.getElementById('mobile-reset-identifier'); e.dispatchEvent(new InputEvent('input', { bubbles: true })); e.value = 'independent-receipt-edited-account'; e.dispatchEvent(new InputEvent('input', { bubbles: true })); });
    await p.waitForTimeout(delayMs); await p.waitForFunction(() => document.querySelector('.reset-receipt').getAttribute('aria-hidden') === 'true');
    const edited = await snapshot(p); edited.visibleCount = await p.locator('.reset-receipt:visible').count();
    assert.equal(edited.receiptDOMCount, 1); assert.equal(edited.receiptVisibility, 'hidden'); assert.equal(edited.receiptAriaHidden, 'true'); assert.equal(edited.receiptRole, null); assert.equal(edited.visibleCount, 0); assert.equal(edited.buttonTop, before.buttonTop); assert.equal(edited.receiptHeight, before.receiptHeight);
    await p.mouse.down(); await p.waitForTimeout(160); const held = await snapshot(p);
    const row = { test: 'accepted-receipt-edit-real-pointer', english200, editDelayMs: delayMs, holdMs: 160, identity, before, edited, held }; report.cases.push(row); save();
    assert.equal(held.downTrusted, true); assert.equal(held.downTargetAction, true); assert.equal(held.feedbackCaptured, true); assert.equal(held.buttonTop, before.buttonTop); assert.equal(requests, 1);
    await p.screenshot({ path: path.join(OUT, `receipt-${english200 ? 'en200' : 'zh'}-delay${delayMs}-held.png`), fullPage: true });
    await p.mouse.up(); await p.waitForFunction(() => document.querySelector('.reset-form').getAttribute('aria-busy') === 'false');
    await p.locator('.reset-receipt[role=status]').waitFor(); row.after = await snapshot(p); row.requests = requests;
    assert.equal(row.after.trustedClicks, 1); assert.equal(row.after.feedbackCaptured, false); assert.equal(row.after.receiptVisibility, 'visible'); assert.equal(row.after.receiptAriaHidden, 'false'); assert.equal(row.after.receiptRole, 'status'); assert.equal(row.after.route, identity.route); assert.equal(requests, 2);
    await p.screenshot({ path: path.join(OUT, `receipt-${english200 ? 'en200' : 'zh'}-delay${delayMs}-after.png`), fullPage: true }); save(); await context.close();
  }
  report.sourceHashesAfter = hashes(); assert.deepEqual(report.sourceHashesAfter, expected); assert.deepEqual(report.pageErrors, []); assert.equal(report.unexpectedConsoleErrors, 0);
  report.result = 'RECEIPT_POINTER_SCOPE_PASS'; report.unverified = ['real IAM/accounts/mail/business reset', 'native credential storage or platform UI', 'physical keyboard/screen reader']; save(); console.log(JSON.stringify({ result: report.result, cases: report.cases.length }));
})().catch(e => { report.result = 'FAIL'; report.failure = { name: e.name, message: e.message }; save(); console.error(e.message); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); });
