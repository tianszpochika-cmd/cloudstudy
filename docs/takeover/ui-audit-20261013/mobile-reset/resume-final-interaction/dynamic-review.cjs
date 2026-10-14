// Isolated synthetic H5 UI review; every API intercepted. Never log/read real
// auth storage, credentials, request body/header, cookies or code-bearing URLs.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../../../../..'), OUT = __dirname, BASE = 'http://127.0.0.1:18183';
const SOURCE = 'apps/mobile/src/pages/reset-password/reset-password.vue', EXPECTED = process.env.MB003_SOURCE_HASH;
const digest = () => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, SOURCE))).digest('hex');
const HELPER = 'apps/mobile/src/platform/pointer-feedback.ts', HELPER_EXPECTED = process.env.MB003_HELPER_HASH;
const helperDigest = () => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, HELPER))).digest('hex');
const report = { helperHashBefore: helperDigest(), at: new Date().toISOString(), scope: 'INDEPENDENT_MOBILE_RESET_H5_INTERACTION_ONLY', sourceHashBefore: digest(), cases: [], pageErrors: [], expectedConsoleErrors: 0, unexpectedConsoleErrors: 0, requests: [] };
const save = () => fs.writeFileSync(path.join(OUT, 'dynamic-results.json'), JSON.stringify(report, null, 2));
const accountValue = 'independent-reset-account', codeValue = 'independent-fixture-'.padEnd(32, 'x'), passwordValue = 'independent-synthetic-password';
let browser; const pending = new Set();
async function fresh({ confirm = false, locale = 'zh-CN', query = '' } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const state = { scenario: '503', counts: { request: 0, confirm: 0 }, hold: false, release: null, entered: null };
  await context.route('**/api/v1/**', async route => {
    const req = route.request(), url = new URL(req.url()), method = req.method(), scenario = state.scenario;
    report.requests.push({ method, origin: url.origin, path: url.pathname, scenario });
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true' };
    if (method === 'OPTIONS') { await route.fulfill({ status: 204, headers, body: '' }); return; }
    if (method === 'POST' && /\/auth\/password-reset\/(request|confirm)$/.test(url.pathname)) {
      assert.equal(url.protocol, 'https:'); const kind = url.pathname.endsWith('/request') ? 'request' : 'confirm'; state.counts[kind]++;
      if (state.hold) await new Promise(resolve => { state.release = resolve; pending.add(resolve); state.entered?.(); });
      if (scenario === 'abort') { await route.abort('connectionfailed'); return; }
      const status = scenario === '202' ? 202 : scenario === '204' ? 204 : scenario === '429' ? 429 : ['invalid401', 'unknown401'].includes(scenario) ? 401 : 503;
      await route.fulfill({ status, headers, body: status === 204 ? '' : JSON.stringify(status === 202 ? { data: { accepted: true } } : { code: scenario === 'invalid401' ? 'iam.password_reset.invalid' : scenario === 'unknown401' ? 'UNSPECIFIED_FAILURE' : status === 429 ? 'RATE_LIMITED' : 'SERVICE_UNAVAILABLE', message: 'Synthetic reset fixture' }) }); return;
    }
    await route.fulfill({ status: 401, headers, body: JSON.stringify({ code: 'UNSPECIFIED_FAILURE' }) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push({ name: error.name, message: error.message.replace(/([?&]token=)[^&\s]+/g, '$1[redacted]') }));
  page.on('console', msg => { if (msg.type() === 'error') { if (/Failed to load resource.*(?:401|429|503|ERR_CONNECTION_FAILED)/.test(msg.text())) report.expectedConsoleErrors++; else report.unexpectedConsoleErrors++; } });
  await page.goto(`${BASE}/#/pages/reset-password/reset-password?theme=light&uiLocale=${locale}${query}`, { waitUntil: 'networkidle' }); await page.locator('#mobile-reset-identifier').waitFor();
  if (confirm && !query.includes('&token=')) { await page.locator('.reset-step-button').click(); await page.locator('#mobile-reset-newPassword').waitFor(); }
  return { context, page, state, release() { if (state.release) { pending.delete(state.release); state.release(); } state.hold = false; } };
}
async function semantic(page, confirm, locale = 'zh-CN', invalid = []) {
  const actual = await page.evaluate(() => [...document.querySelectorAll('.reset-input input')].map(e => ({ id: e.id, name: e.name, autocomplete: e.autocomplete, type: e.type, label: e.getAttribute('aria-label'), labelledby: e.getAttribute('aria-labelledby'), invalid: e.getAttribute('aria-invalid'), describedby: e.getAttribute('aria-describedby'), maxLength: e.maxLength })));
  const kinds = confirm ? ['identifier', 'token', 'newPassword'] : ['identifier']; assert.equal(actual.length, kinds.length);
  for (let i = 0; i < kinds.length; i++) { const kind = kinds[i], e = actual[i]; assert.equal(e.id, `mobile-reset-${kind}`); assert.equal(e.name, kind); assert.equal(e.autocomplete, kind === 'identifier' ? 'username' : kind === 'token' ? 'one-time-code' : 'new-password'); assert.equal(e.labelledby, `mobile-reset-${kind}-label`); assert.equal(e.invalid, invalid.includes(kind) ? 'true' : null); assert.equal(e.describedby, [kind === 'newPassword' ? 'mobile-reset-password-hint' : null, invalid.includes(kind) ? `mobile-reset-${kind}-error` : null].filter(Boolean).join(' ') || null); assert.ok(e.maxLength > 512 || e.maxLength < 0); assert.equal(e.label, locale === 'zh-CN' ? kind === 'identifier' ? '账号' : kind === 'token' ? '重置口令' : '新密码' : kind === 'identifier' ? 'Account' : kind === 'token' ? 'Reset code' : 'New password'); }
  return actual;
}
async function fillConfirm(page) { await page.locator('#mobile-reset-identifier').fill(accountValue); await page.locator('#mobile-reset-token').fill(codeValue); await page.locator('#mobile-reset-newPassword').fill(passwordValue); }
async function rapid(field, kind, activation) {
  const current = await fresh({ confirm: field !== 'identifier' }), { page } = current;
  if (field === 'identifier') { await page.locator('#mobile-reset-identifier').fill(accountValue); await page.locator('#mobile-reset-identifier').blur(); }
  else { await fillConfirm(page); await page.locator('#mobile-reset-newPassword').blur(); }
  const observed = await page.evaluate(async ({ field, kind, activation }) => {
    let instance = document.querySelector('.v2-reset').__vueParentComponent; while (instance && !('token' in instance.setupState)) instance = instance.parent;
    const state = instance.setupState, account = 'independent-reset-account', code = 'independent-fixture-'.padEnd(32, 'x'), password = 'independent-synthetic-password';
    const expected = kind === 'clear' ? '' : field === 'token' ? 'independent-long-code-'.padEnd(512, 'x') : `independent-${field}-replacement`;
    const calls = [], capture = (a, c, p) => { calls.push({ identifierMatches: a === (field === 'identifier' ? expected : account), codeMatches: field === 'identifier' ? true : c === (field === 'token' ? expected : code), passwordMatches: field === 'identifier' ? true : p === (field === 'newPassword' ? expected : password), codeLength: field === 'identifier' ? null : c.length }); state.session.lastError = 'UNKNOWN_AUTH_ERROR'; return false; };
    state.session.requestPasswordReset = async a => capture(a); state.session.confirmPasswordReset = async (a, c, p) => capture(a, c, p);
    const input = document.getElementById(`mobile-reset-${field}`); input.focus(); const started = performance.now();
    input.value = field === 'identifier' ? account : field === 'token' ? code : password;
    input.dispatchEvent(new InputEvent('input', { bubbles: true })); input.value = expected; input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: kind === 'clear' ? 'deleteContentBackward' : 'insertText' }));
    const staleModelWindow = state[field] !== expected;
    if (activation === 'click') { input.blur(); document.querySelector('.reset-submit').click(); }
    else { input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true })); if (field === 'token') document.getElementById('mobile-reset-newPassword').dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true })); }
    return { field, kind, activation, elapsedMs: performance.now() - started, staleModelWindow, nativeLength: input.value.length, calls };
  }, { field, kind, activation });
  assert.ok(observed.elapsedMs < 100); assert.equal(observed.staleModelWindow, true);
  if (kind === 'clear') { assert.equal(observed.calls.length, 0); await page.waitForFunction(id => document.activeElement.id === id, `mobile-reset-${field}`); assert.equal(await page.locator(`#mobile-reset-${field}`).getAttribute('aria-invalid'), 'true'); }
  else { assert.equal(observed.calls.length, 1); assert.ok(observed.calls[0].identifierMatches && observed.calls[0].codeMatches && observed.calls[0].passwordMatches); if (field === 'token') assert.equal(observed.calls[0].codeLength, 512); }
  assert.deepEqual(current.state.counts, { request: 0, confirm: 0 }); report.cases.push({ test: 'rapid-native-input', ...observed }); save(); await current.context.close();
}
(async () => {
  assert.match(EXPECTED || "", /^[0-9a-f]{64}$/); assert.match(HELPER_EXPECTED || "", /^[0-9a-f]{64}$/); assert.equal(report.sourceHashBefore, EXPECTED); assert.equal(report.helperHashBefore, HELPER_EXPECTED); browser = await chromium.launch();
  for (const field of ['identifier', 'token', 'newPassword']) for (const kind of ['clear', 'replace']) for (const activation of ['click', 'Enter']) await rapid(field, kind, activation);
  const lifecycle = await fresh(), p = lifecycle.page;
  const initial = await semantic(p, false); assert.equal(await p.locator('.reset-field-error').count(), 0); await p.locator('.reset-submit').click(); await p.waitForFunction(() => document.activeElement.id === 'mobile-reset-identifier'); await semantic(p, false, 'zh-CN', ['identifier']); assert.equal(lifecycle.state.counts.request, 0);
  await p.locator('#mobile-reset-identifier').fill(accountValue); await p.locator('#mobile-reset-identifier').blur(); await semantic(p, false);
  await p.locator('.reset-step-button').click(); await p.locator('#mobile-reset-newPassword').waitFor(); await p.waitForFunction(() => document.activeElement.id === 'mobile-reset-token'); const mounted = await semantic(p, true); assert.equal(await p.locator('.reset-field-error').count(), 0);
  await p.locator('.reset-submit').click(); await p.waitForFunction(() => document.activeElement.id === 'mobile-reset-token'); await semantic(p, true, 'zh-CN', ['token', 'newPassword']); assert.equal(lifecycle.state.counts.confirm, 0);
  for (const [field, value, limit] of [['token', 'x'.repeat(513), 512], ['newPassword', 'x'.repeat(129), 128], ['identifier', 'x'.repeat(129), 128]]) {
    await fillConfirm(p); await p.locator(`#mobile-reset-${field}`).fill(value); await p.locator('.reset-submit').click(); await p.waitForFunction(id => document.activeElement.id === id, `mobile-reset-${field}`);
    const actualLength = await p.locator(`#mobile-reset-${field}`).evaluate(e => e.value.length); assert.equal(actualLength, value.length); assert.equal(lifecycle.state.counts.confirm, 0); assert.ok((await p.locator(`#mobile-reset-${field}-error`).innerText()).includes(String(limit))); report.cases.push({ test: 'upper-bound-not-truncated', field, actualLength, limit, requests: 0 });
  }
  await fillConfirm(p); await p.locator('#mobile-reset-newPassword').blur(); await semantic(p, true);
  await p.evaluate(async () => { const { mobileI18nAdapter } = await import('/src/platform/v2-foundation.ts'); mobileI18nAdapter.setLocale('en-US'); }); await p.getByLabel('Reset code', { exact: true }).waitFor(); const english = await semantic(p, true, 'en-US');
  await p.getByRole('button', { name: 'Show new password', exact: true }).focus(); await p.keyboard.press('Enter'); assert.equal(await p.locator('#mobile-reset-newPassword').getAttribute('type'), 'text'); await p.keyboard.press('Space'); assert.equal(await p.locator('#mobile-reset-newPassword').getAttribute('type'), 'password');
  await p.locator('.reset-step-button').click(); await p.locator('#mobile-reset-token').waitFor({ state: 'detached' }); await semantic(p, false, 'en-US'); await p.locator('.reset-step-button').click(); await p.locator('#mobile-reset-newPassword').waitFor(); const remounted = await semantic(p, true, 'en-US');
  const cleared = await p.evaluate(() => { let i = document.querySelector('.v2-reset').__vueParentComponent; while(i && !('token' in i.setupState)) i = i.parent; const s=i.setupState; return { accountRetained: s.identifier === 'independent-reset-account', codeEmpty: s.token === '', passwordEmpty: s.newPassword === '', showFalse: !s.showPassword, errors: document.querySelectorAll('[role=alert],.reset-field-error').length }; }); assert.ok(cleared.accountRetained && cleared.codeEmpty && cleared.passwordEmpty && cleared.showFalse); assert.equal(cleared.errors, 0);
  report.cases.push({ test: 'step-language-native-lifecycle', initial, mounted, english, remounted, cleared }); await lifecycle.context.close(); save();
  const pointer = await fresh({ confirm: true }), q = pointer.page; await fillConfirm(q); await q.locator('#mobile-reset-newPassword').fill('short'); await q.locator('.reset-submit').click(); await q.locator('#mobile-reset-newPassword-error').waitFor(); await q.locator('.reset-submit').scrollIntoViewIfNeeded();
  const before = await q.evaluate(() => ({ buttonTop: document.querySelector('.reset-submit').getBoundingClientRect().top + scrollY, errorHeight: document.querySelector('#mobile-reset-newPassword-error').getBoundingClientRect().height })), button = await q.locator('.reset-submit').boundingBox();
  await q.evaluate(() => {
    let i = document.querySelector('.v2-reset').__vueParentComponent; while(i && !('token' in i.setupState)) i=i.parent; const s=i.setupState;
    window.__independentPointer = { calls: 0, matches: false, trustedPointer: false, staleAtPointer: false, elapsedMs: null };
    s.session.confirmPasswordReset = async (a,c,p) => { const r=window.__independentPointer; r.calls++; r.matches = a==='independent-reset-account' && c==='independent-fixture-'.padEnd(32,'x') && p==='independent-pointer-corrected-password'; s.session.lastError='UNKNOWN_AUTH_ERROR'; return false; };
    const input=document.getElementById('mobile-reset-newPassword'); input.focus(); input.dispatchEvent(new InputEvent('input',{bubbles:true})); const started=performance.now(); input.value='independent-pointer-corrected-password'; input.dispatchEvent(new InputEvent('input',{bubbles:true}));
    document.querySelector('.reset-submit').addEventListener('pointerdown',e=> { const r=window.__independentPointer; r.trustedPointer=e.isTrusted; r.staleAtPointer=s.newPassword!=='independent-pointer-corrected-password'; r.elapsedMs=performance.now()-started; },{once:true});
  });
  await q.mouse.click(button.x + button.width / 2, button.y + button.height / 2); await q.locator('.reset-server-error').waitFor();
  const after = await q.evaluate(() => ({ ...window.__independentPointer, buttonTop: document.querySelector('.reset-submit').getBoundingClientRect().top + scrollY, errorHeight: document.querySelector('#mobile-reset-newPassword-error').getBoundingClientRect().height, rowHidden: getComputedStyle(document.querySelector('#mobile-reset-newPassword-error')).visibility==='hidden', rowAriaHidden: document.querySelector('#mobile-reset-newPassword-error').getAttribute('aria-hidden')==='true', describedBy: document.getElementById('mobile-reset-newPassword').getAttribute('aria-describedby') }));
  // Server error adds a separate row after the click; the cleared field row
  // itself must retain height so pointerup still activates the original button.
  assert.equal(after.calls,1); assert.equal(after.matches,true); assert.equal(after.trustedPointer,true); assert.ok(after.elapsedMs<100); assert.equal(after.staleAtPointer,true); assert.equal(after.errorHeight,before.errorHeight); assert.equal(after.rowHidden,true); assert.equal(after.rowAriaHidden,true); assert.equal(after.describedBy,'mobile-reset-password-hint'); assert.deepEqual(pointer.state.counts,{request:0,confirm:0});
  report.cases.push({ test:'real-pointer-correction',before,after }); await q.screenshot({path:path.join(OUT,'reset-real-pointer-corrected.png'),fullPage:true,mask:[q.locator('#mobile-reset-token'),q.locator('#mobile-reset-newPassword')]}); await pointer.context.close(); save();
  const request = await fresh(), r=request.page; await r.locator('#mobile-reset-identifier').fill(accountValue);
  for (const [scenario,text] of [['202','申请已受理。若收到重置邮件，请按邮件指引操作。'],['429','操作过于频繁，请稍后再试。'],['503','发送没有完成，请稍后再试。'],['abort','发送没有完成，请稍后再试。']]) {
    request.state.scenario=scenario; await r.locator('.reset-submit').click(); await r.waitForFunction(()=>document.querySelector('.reset-form').getAttribute('aria-busy')==='false');
    const target=r.locator(scenario==='202'?'.reset-receipt':'.reset-server-error'); await target.waitFor(); assert.equal(await target.innerText(),text); assert.equal(await r.locator(scenario==='202'?'.reset-server-error':'.reset-receipt').count(),0); report.cases.push({test:'request-fixture',scenario,message:text,counts:{...request.state.counts}});
    if(scenario==='202'){ await r.locator('#mobile-reset-identifier').fill('independent-reset-other-account'); await r.locator('#mobile-reset-identifier').blur(); assert.equal(await r.locator('.reset-receipt').count(),0); }
  }
  await r.locator('.reset-step-button').click(); assert.equal(await r.getByRole('alert').count(),0); assert.equal(await r.locator('.reset-receipt').count(),0); await request.context.close(); save();
  const confirmation=await fresh({confirm:true}), c=confirmation.page; await fillConfirm(c);
  confirmation.state.scenario='unknown401'; confirmation.state.hold=true; const entered=new Promise(resolve=>{confirmation.state.entered=resolve}); await c.locator('#mobile-reset-newPassword').focus(); await c.keyboard.press('Enter'); await c.locator('.reset-form[aria-busy=true]').waitFor(); await entered;
  assert.ok((await c.locator('.reset-input input,.reset-submit,.reset-text-button,.reset-password-toggle').evaluateAll(es=>es.map(e=>e.hasAttribute('disabled')))).every(Boolean));
  const protectedState = await c.evaluate(async () => { let i=document.querySelector('.v2-reset').__vueParentComponent; while(i&&!('token'in i.setupState))i=i.parent; const s=i.setupState; document.querySelectorAll('.reset-step-button,.reset-login-button,.reset-password-toggle,.reset-submit').forEach(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true}))); document.querySelector('#mobile-reset-newPassword').dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true})); await s.switchStep(); s.returnLogin(); s.togglePassword(); await s.submit(); return { stepUnchanged:s.step==='confirm',showUnchanged:!s.showPassword,fieldsPreserved:s.identifier==='independent-reset-account'&&s.token==='independent-fixture-'.padEnd(32,'x')&&s.newPassword==='independent-synthetic-password',route:location.hash.split('?')[0] }; });
  assert.ok(protectedState.stepUnchanged&&protectedState.showUnchanged&&protectedState.fieldsPreserved); assert.equal(protectedState.route,'#/pages/reset-password/reset-password'); assert.equal(confirmation.state.counts.confirm,1); confirmation.release(); await c.locator('.reset-server-error').waitFor(); assert.equal(await c.locator('.reset-server-error').innerText(),'重置没有完成，请稍后再试。');
  confirmation.state.scenario='invalid401'; await c.locator('.reset-submit').click(); await c.waitForFunction(()=>document.querySelector('.reset-server-error')?.textContent==='重置口令无效或已过期，请重新申请。'); await semantic(c,true); report.cases.push({test:'confirm-busy-guard-and-marker-distinction',protectedState,unknown401Neutral:true,explicitInvalid401:true,confirmRequests:confirmation.state.counts.confirm});
  confirmation.state.scenario='204'; await c.locator('.reset-submit').click(); await c.locator('.reset-success').waitFor();
  const success=await c.evaluate(()=>{let i=document.querySelector('.v2-reset').__vueParentComponent;while(i&&!('token'in i.setupState))i=i.parent;const s=i.setupState;return {accountCleared:s.identifier==='',codeCleared:s.token==='',passwordCleared:s.newPassword==='',showCleared:!s.showPassword,inputsRemoved:document.querySelectorAll('input,.reset-form,.reset-password-toggle,.reset-step-button').length===0,message:document.querySelector('.reset-success').textContent};}); assert.ok(success.accountCleared&&success.codeCleared&&success.passwordCleared&&success.showCleared&&success.inputsRemoved); await c.screenshot({path:path.join(OUT,'reset-synthetic-confirm-success.png'),fullPage:true}); await c.locator('.reset-login-button').click(); await c.waitForURL(url=>url.hash.startsWith('#/pages/login/login')); report.cases.push({test:'synthetic204-clears-fields-and-return',...success,route:'#/pages/login/login'}); await confirmation.context.close(); save();
  const safe='/pages/b3-reading/b3-reading?practiceId=independent-fixture';
  for(const [name,value] of [['single',encodeURIComponent(safe)],['double',encodeURIComponent(encodeURIComponent(safe))],['external',encodeURIComponent('https://external.invalid/path')]]){const deep=await fresh({confirm:true,query:`&token=${encodeURIComponent(codeValue)}&returnTo=${value}`}), d=deep.page; assert.equal(await d.locator('#mobile-reset-token').evaluate(e=>e.value.length),32); await semantic(d,true); await d.locator('.reset-login-button').click(); await d.waitForURL(url=>url.hash.startsWith('#/pages/login/login')); let result=new URLSearchParams(d.url().split('?').slice(1).join('?')).get('returnTo'); for(let i=0;i<2&&result?.startsWith('%');i++)result=decodeURIComponent(result); assert.equal(result,name==='external'?'/pages/home/home':safe); report.cases.push({test:'code-deep-link-safe-return',encoding:name,codeLength:32,returnMatches:true,route:'#/pages/login/login'}); await deep.context.close();save();}
  report.helperHashAfter=helperDigest(); assert.equal(report.helperHashAfter,HELPER_EXPECTED); report.sourceHashAfter=digest(); assert.equal(report.sourceHashAfter,EXPECTED); assert.deepEqual(report.pageErrors,[]); assert.equal(report.unexpectedConsoleErrors,0); report.result='UI_SCOPE_PASS'; report.unverified=['real IAM/accounts/mail/business reset','native iOS/Android/iPad and mini-program','physical screen reader/keyboard','native credential clearing']; save(); console.log(JSON.stringify({result:report.result,cases:report.cases.length,sourceHash:report.sourceHashAfter}));
})().catch(error=>{report.result='FAIL';report.failure={name:error.name,message:error.message.replace(/([?&]token=)[^&\s]+/g,'$1[redacted]')};save();console.error(report.failure.message);process.exitCode=1;}).finally(async()=>{pending.forEach(resolve=>resolve());if(browser)await browser.close();});
