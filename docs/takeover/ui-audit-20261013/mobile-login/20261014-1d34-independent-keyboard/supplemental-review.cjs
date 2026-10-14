// Independent narrow actual-key review. Every API is intercepted as a rejection.
// Do not read bodies/headers, credentials, cookies, tokens or storage. Only public
// UI semantics, route metadata, booleans, counts and event targets are recorded.
const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../../../../..'), BASE = 'http://127.0.0.1:18183';
const SOURCE = 'apps/mobile/src/pages/login/login.vue', EXPECTED = '1d347967146a38723ab0bf3ae0b1accca3b519ae6515e7c14f12297be1b80e19';
const hash = () => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, SOURCE))).digest('hex');
const report = { at: new Date().toISOString(), scope: 'INDEPENDENT_MB001_1D34_LATEST_FIELD_AND_SPACE_SCROLL_H5', sourceHashBefore: hash(), browserAvailability: 'Browser plugin not available; existing Playwright 1.63.0 Chromium', cases: [], requests: [], pageErrors: [], expectedConsoleErrors: 0, unexpectedConsoleErrors: 0 };
const save = () => fs.writeFileSync(path.join(__dirname, 'supplemental-results.json'), JSON.stringify(report, null, 2));
const pending = new Set(); let browser;
async function fresh({height=844}={}) {
  const context = await browser.newContext({ viewport: { width: 390, height }, reducedMotion: 'reduce' });
  const state = { loginCount: 0, hold: false, release: null, entered: null };
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), u = new URL(request.url()), method = request.method(); report.requests.push({ method, origin: u.origin, path: u.pathname });
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true' };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers, body: '' });
    if (method === 'POST' && u.pathname === '/api/v1/auth/login') {
      assert.equal(u.protocol, 'https:'); state.loginCount++;
      if (state.hold) await new Promise(resolve => { state.release = resolve; pending.add(resolve); state.entered?.(); });
    }
    return route.fulfill({ status: 401, headers, body: JSON.stringify({ code: 'iam.credentials.invalid', message: 'Synthetic UI rejection' }) });
  });
  const p = await context.newPage(); p.on('pageerror', e => report.pageErrors.push(e.name));
  p.on('console', m => { if (m.type() === 'error') { if (/Failed to load resource.*401/.test(m.text())) report.expectedConsoleErrors++; else report.unexpectedConsoleErrors++; } });
  await p.goto(`${BASE}/#/pages/login/login?theme=light&uiLocale=zh-CN`, { waitUntil: 'networkidle' }); await p.locator('#mobile-login-identifier').waitFor();
  const identity = await p.evaluate(() => ({ route: location.hash.split('?')[0], title: document.title, heading: document.getElementById('mobile-login-title').textContent, inputs: document.querySelectorAll('.login-input input').length, overlay: document.querySelectorAll('vite-error-overlay').length }));
  assert.equal(identity.route, '#/pages/login/login'); assert.equal(identity.heading, '欢迎回来'); assert.equal(identity.inputs, 2); assert.equal(identity.overlay, 0);
  await p.evaluate(() => { window.__keyboardTrace = []; for (const type of ['keydown', 'keyup', 'click', 'focusin']) document.addEventListener(type, e => window.__keyboardTrace.push({ type, key: e.key ?? null, repeat: e.repeat ?? null, targetId: e.target.id ?? null, targetClass: typeof e.target.className === 'string' ? e.target.className : null, trusted: e.isTrusted, focusId: document.activeElement.id }), true); });
  return { context, p, state, identity, release() { if (state.release) { pending.delete(state.release); state.release(); state.release = null; } state.hold = false; } };
}
async function semantics(p, missing = []) {
  const actual = await p.locator('.login-input input').evaluateAll(es => es.map(e => ({ id: e.id, name: e.name, autocomplete: e.autocomplete, type: e.type, labelledBy: e.getAttribute('aria-labelledby'), invalid: e.getAttribute('aria-invalid'), describedBy: e.getAttribute('aria-describedby'), disabled: e.hasAttribute('disabled') })));
  assert.equal(actual.length, 2);
  for (const [index, field] of ['identifier', 'password'].entries()) {
    const e = actual[index]; assert.equal(e.id, `mobile-login-${field}`); assert.equal(e.name, field); assert.equal(e.autocomplete, field === 'identifier' ? 'username' : 'current-password'); assert.equal(e.labelledBy, `mobile-login-${field}-label`); assert.equal(e.invalid, missing.includes(field) ? 'true' : null); assert.equal(e.describedBy, missing.includes(field) ? 'mobile-login-error' : null);
  }
  return actual;
}
async function fill(p) { await p.locator('#mobile-login-identifier').fill('independent-keyboard-synthetic-account'); await p.locator('#mobile-login-password').fill('independent-keyboard-synthetic-password'); await p.locator('#mobile-login-password').blur(); }
async function heldKey(p, key) {
  await p.locator('.login-submit').focus(); await p.keyboard.down(key); await p.waitForTimeout(160); await p.keyboard.down(key);
  return p.evaluate(() => ({ buttonFocused: document.activeElement.classList.contains('login-submit'), errors: document.querySelectorAll('#mobile-login-error').length, busy: document.querySelector('.login-form').getAttribute('aria-busy') }));
}
async function shot(p, name) { await p.screenshot({ path: path.join(__dirname, name), fullPage: true, mask: [p.locator('#mobile-login-password')] }); }
(async () => {
  assert.equal(report.sourceHashBefore,EXPECTED); browser=await chromium.launch();
  for(const field of ['identifier','password'])for(const change of ['clear','replace'])for(const key of ['Enter','Space']) {
    const c=await fresh(),{p,state}=c; await fill(p);
    const probe=await p.evaluate(({field,change})=>{
      let i=document.querySelector('.v2-login').__vueParentComponent;while(i&&!('identifier'in i.setupState))i=i.parent;const s=i.setupState;
      const original=s.session.login.bind(s.session), expected=change==='clear'?'':field==='identifier'?'independent-rapid-replacement-account':'independent-rapid-replacement-password';
      window.__currentFieldProbe={calls:0,identifierMatches:null,passwordMatches:null};
      s.session.login=async(a,b)=>{const out=window.__currentFieldProbe;out.calls++;out.identifierMatches=a===(field==='identifier'?expected:'independent-keyboard-synthetic-account');out.passwordMatches=b===(field==='password'?expected:'independent-keyboard-synthetic-password');return original(a,b)};
      const e=document.getElementById(`mobile-login-${field}`);e.focus();e.dispatchEvent(new InputEvent('input',{bubbles:true}));e.value=expected;e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:change==='clear'?'deleteContentBackward':'insertText'}));
      const staleBeforeBlur=s[field]!==expected;document.querySelector('.login-submit').focus();return{staleBeforeBlur,nativeLength:e.value.length,primaryFocused:document.activeElement.classList.contains('login-submit')};
    },{field,change});
    assert.equal(probe.primaryFocused,true);await p.keyboard.press(key);
    if(change==='clear'){await p.waitForFunction(id=>document.activeElement.id===id,`mobile-login-${field}`);await semantics(p,[field]);assert.equal(state.loginCount,0)}
    else {await p.locator('#mobile-login-error[role=alert]').waitFor();await p.locator('.login-form[aria-busy=false]').waitFor();await semantics(p);assert.equal(state.loginCount,1)}
    const actual=await p.evaluate(()=>({...window.__currentFieldProbe,focus:document.activeElement.id}));
    assert.equal(actual.calls,change==='clear'?0:1);if(change==='replace'){assert.equal(actual.identifierMatches,true);assert.equal(actual.passwordMatches,true)}
    report.cases.push({test:'rapid-native-edit-immediate-primary-key',field,change,key,probe,actual,loginRequests:state.loginCount,result:'PASS'});save();await c.context.close();
  }
  const c=await fresh({height:460}),{p,state}=c;await fill(p);state.hold=true;const entered=new Promise(resolve=>state.entered=resolve);await p.locator('.login-submit').focus();
  const before=await p.evaluate(()=>({scrollY,focusClass:document.activeElement.className}));await p.keyboard.down('Space');await p.waitForTimeout(160);const down=await p.evaluate(()=>({scrollY,focusClass:document.activeElement.className}));assert.equal(state.loginCount,0);assert.equal(down.scrollY,before.scrollY);
  await p.keyboard.up('Space');await entered;await p.locator('.login-form[aria-busy=true]').waitFor();const up=await p.evaluate(()=>({scrollY,busy:document.querySelector('.login-form').getAttribute('aria-busy')}));assert.equal(up.scrollY,before.scrollY);assert.equal(state.loginCount,1);
  report.cases.push({test:'space-short-viewport-no-default-scroll-while-valid-submission-pending',viewport:{width:390,height:460},holdMs:160,before,down,up,loginRequests:state.loginCount,result:'PASS'});save();await shot(p,'space-short-viewport-pending.png');c.release();await p.locator('.login-form[aria-busy=false]').waitFor();await c.context.close();
  report.sourceHashAfter=hash();assert.equal(report.sourceHashAfter,EXPECTED);assert.deepEqual(report.pageErrors,[]);assert.equal(report.unexpectedConsoleErrors,0);report.result='UI_PASS_LATEST_FIELD_AND_SPACE_SCROLL_H5';save();console.log(JSON.stringify({result:report.result,cases:report.cases.length,sourceHash:report.sourceHashAfter}));
})().catch(e=>{report.result='FAIL';report.failure={name:e.name,message:e.message};report.sourceHashAfter=hash();save();console.error(e.message);process.exitCode=1}).finally(async()=>{pending.forEach(resolve=>resolve());if(browser)await browser.close()});