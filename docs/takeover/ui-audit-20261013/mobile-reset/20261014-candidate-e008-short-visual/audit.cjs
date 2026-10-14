// Independent frozen-source review: four named H5 states plus helper isolation/lifecycle.
// All API calls blocked; no body/header/storage/token or input-value reads.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ROOT = path.resolve(__dirname, '../../../../..');
const BASE = 'http://127.0.0.1:18183';
const PAGE = 'apps/mobile/src/pages/reset-password/reset-password.vue';
const HELPER = 'apps/mobile/src/platform/pointer-feedback.ts';
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const hash = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');
const mr = createRequire(path.join(ROOT, 'apps/mobile/package.json'));
const pr = createRequire(mr.resolve('@dcloudio/vite-plugin-uni'));
const pre = pr('@dcloudio/uni-cli-shared');
const ts = mr('typescript');
const report = {
  scope: 'MB003_E008_FROZEN_SHORT_NAMED_VISUAL',
  at: new Date().toISOString(), browser: 'Playwright Chromium; Browser plugin/skill unavailable',
  sourceHashes: { [PAGE]: hash(PAGE), [HELPER]: hash(HELPER) },
  isolation: [], lifecycle: [], states: [], apiRequestCount: 0, pageErrors: [], consoleErrors: [],
};
const save = () => fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(report, null, 2));
assert.equal(report.sourceHashes[PAGE], 'e00853df5fb3dfdc0d79a824f2f751035a8c3319697910d92115334dbb42031b');
assert.equal(report.sourceHashes[HELPER], '6464f4c1712b5a0f2fd4ab01d451d5bb6ffaa13bde486826a424511059ef6425');
function compile(source) {
  return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
}
function helperRuntime(code, native) {
  const mounted = [], unmounted = [], doc = new Map(), win = new Map();
  const target = map => ({ addEventListener: (name, fn) => map.set(name, fn), removeEventListener: (name, fn) => { assert.equal(map.get(name), fn); map.delete(name); } });
  class FakeElement { closest() { return this; } getBoundingClientRect() { return { left: 0, right: 10, top: 0, bottom: 10 }; } }
  const exports = {};
  const sandbox = { exports, require: id => {
    assert.equal(id, 'vue');
    return { shallowRef: value => ({ value }), nextTick: () => Promise.resolve(),
      onMounted: fn => { assert.equal(native, false, 'native helper registered DOM lifecycle'); mounted.push(fn); },
      onUnmounted: fn => { assert.equal(native, false, 'native helper registered DOM lifecycle'); unmounted.push(fn); } };
  } };
  if (!native) Object.assign(sandbox, { document: target(doc), window: target(win), Element: FakeElement });
  vm.runInNewContext(code, sandbox);
  const action = new FakeElement(), root = { contains: element => element === action };
  let releaseCallbacks = 0;
  const snapshot = exports.usePointerFeedback({ root: () => root, actions: '.action', capture: () => ({ marker: true }), disabled: () => false, afterRelease: () => releaseCallbacks++ });
  return { snapshot, mounted, unmounted, doc, win, action, callbacks: () => releaseCallbacks };
}
async function checkIsolationAndLifecycle() {
  for (const platform of ['app', 'mp-weixin']) {
    pre.initPreContext(platform);
    const helper = compile(pre.preJs(read(HELPER), HELPER));
    const script = read(PAGE).match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
    const page = compile(pre.preJs(script, PAGE));
    assert.equal(/\b(document|window|Element|PointerEvent)\b|querySelector|syncNativeInputs/.test(helper + page), false);
    const instance = helperRuntime(helper, true);
    assert.equal(instance.snapshot.value, null);
    assert.equal(instance.mounted.length + instance.unmounted.length, 0);
    report.isolation.push({ platform, officialUniPreprocess: true, noRuntimeDomReferences: true, helperWithoutDomGlobals: 'PASS', nativeRuntime: 'NOT_RUN' });
  }
  pre.initPreContext('h5');
  const code = compile(pre.preJs(read(HELPER), HELPER));
  for (const scenario of ['active-gesture-unmount', 'queued-release-unmount']) {
    const i = helperRuntime(code, false);
    i.mounted.forEach(fn => fn());
    assert.equal(i.doc.size, 7); assert.equal(i.win.size, 1);
    i.doc.get('pointerdown')({ target: i.action, isPrimary: true, button: 0, pointerId: 1 });
    assert.equal(i.snapshot.value.marker, true);
    if (scenario === 'queued-release-unmount') i.doc.get('click')();
    i.unmounted.forEach(fn => fn());
    await Promise.resolve(); await Promise.resolve();
    assert.equal(i.snapshot.value, null); assert.equal(i.doc.size + i.win.size, 0); assert.equal(i.callbacks(), 0);
    report.lifecycle.push({ scenario, listenersBefore: 8, listenersAfter: 0, snapshotReleased: true, callbackAfterUnmount: false, status: 'PASS' });
  }
}
async function facts(page) {
  return page.evaluate(() => {
    const rect = e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
    const bg = e => { for (let n = e; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)') return c; } return 'rgb(255,255,255)'; };
    const lum = c => c.match(/[\d.]+/g).slice(0,3).map(Number).map(n => { const v = n/255; return v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4; }).reduce((a,v,i) => a+v*[.2126,.7152,.0722][i],0);
    const ratio = e => { const a=lum(getComputedStyle(e).color), b=lum(bg(e)); return (Math.max(a,b)+.05)/(Math.min(a,b)+.05); };
    const fields = [...document.querySelectorAll('.reset-field')].map(rect);
    const elements = ['.reset-title','.reset-description','.reset-label','.reset-submit','.reset-step-button','.reset-login-button'];
    if (document.querySelector('.reset-password-hint')) elements.push('.reset-password-hint');
    return { route: location.hash.split('?')[0], title: document.title, theme: document.documentElement.dataset.theme,
      overflow: document.documentElement.scrollWidth > innerWidth+1, contentWidth: rect(document.querySelector('.reset-content')).width,
      headingCount: document.querySelectorAll('[role="heading"]').length,
      inputFonts: [...document.querySelectorAll('.reset-input input')].map(e=>getComputedStyle(e).fontSize),
      fonts: Object.fromEntries(elements.map(s=>[s,getComputedStyle(document.querySelector(s)).fontSize])),
      fieldGaps: fields.slice(1).map((r,i)=>r.top-fields[i].bottom), actionGap: rect(document.querySelector('.reset-submit')).top-fields.at(-1).bottom,
      targets: [...document.querySelectorAll('.reset-password-toggle,.reset-text-button,.reset-submit')].map(rect),
      contrast: Object.fromEntries(elements.map(s=>[s,ratio(document.querySelector(s))])),
      errors: [...document.querySelectorAll('.reset-field-error')].map(e=>({ ...rect(e), role:e.getAttribute('role'), hidden:e.getAttribute('aria-hidden'),font:getComputedStyle(e).fontSize,contrast:ratio(e) })),
      semantics: [...document.querySelectorAll('.reset-input input')].map(e=>({ name:e.name,label:e.getAttribute('aria-label'),autocomplete:e.autocomplete,invalid:e.getAttribute('aria-invalid') })),
    };
  });
}
let browser;
(async () => {
  report.helperEvidenceReference = '../20261014-resume-final-visual/results.json'; save();
  browser = await chromium.launch({ headless:true });
  const states = [
    { name:'request-390-zh-CN-light', width:390,height:844,locale:'zh-CN',theme:'light',step:'request' },
    { name:'confirm-390-zh-CN-light', width:390,height:844,locale:'zh-CN',theme:'light',step:'confirm' },
    { name:'confirm-390-zh-CN-high-contrast', width:390,height:844,locale:'zh-CN',theme:'high-contrast',step:'confirm' },
    { name:'confirm-320-en-US-200-short-required', width:320,height:460,locale:'en-US',theme:'light',step:'confirm',enlarged:true },
  ];
  for (const state of states) {
    const context = await browser.newContext({ viewport:{width:state.width,height:state.height},reducedMotion:'reduce' });
    await context.route('**/*', route => { const u=new URL(route.request().url()); return u.hostname==='127.0.0.1'&&u.port==='18183' ? route.continue() : route.abort(); });
    await context.route('**/api/v1/**', route => { report.apiRequestCount++; return route.fulfill({ status:503,headers:{'content-type':'application/json','access-control-allow-origin':BASE},body:'{"code":"SERVICE_UNAVAILABLE"}' }); });
    const page = await context.newPage();
    page.on('pageerror',e=>report.pageErrors.push(e.message));
    page.on('console',m=>{ if(m.type()==='error') report.consoleErrors.push(m.text()); });
    await page.goto(BASE+'/#/pages/reset-password/reset-password?uiLocale='+state.locale+'&theme='+state.theme);
    await page.locator('#mobile-reset-identifier').waitFor();
    if(state.step==='confirm') await page.locator('.reset-step-button').click();
    await page.waitForFunction(expected=>document.querySelectorAll('.reset-input input').length===expected,state.step==='confirm'?3:1);
    assert.equal(await page.locator('vite-error-overlay,.yx-card,.mobile-page-header').count(),0);
    if(state.enlarged) {
      await page.evaluate(()=>{ for(const e of document.querySelectorAll('.reset-brand,.reset-adult-note,.reset-title,.reset-description,.reset-label,.reset-input,.reset-password-hint,.reset-submit,.reset-text-button,.reset-exit')) e.style.fontSize=parseFloat(getComputedStyle(e).fontSize)*2+'px'; });
      await page.locator('.reset-submit').click();
      await page.waitForFunction(()=>document.querySelectorAll('.reset-field-error[role="alert"]').length===3&&document.activeElement.id==='mobile-reset-identifier');
      await page.locator('.reset-field-error').evaluateAll(es=>es.forEach(e=>e.style.fontSize='28px'));
    } else assert.equal(await page.locator('.reset-field-error,.reset-server-error,.reset-success,.reset-receipt').count(),0);
    const f=await facts(page);
    assert.equal(f.route,'#/pages/reset-password/reset-password'); assert.equal(f.headingCount,1); assert.equal(f.overflow,false);
    assert.deepEqual(f.inputFonts,state.step==='request'?['16px']:state.enlarged?['32px','32px','32px']:['16px','16px','16px']);
    assert.ok([...f.fieldGaps,f.actionGap].every(g=>Math.abs(g-24)<.2));
    assert.ok(f.targets.every(t=>t.width>=44&&t.height>=44)); assert.ok(Object.values(f.contrast).every(v=>v>=4.5));
    assert.deepEqual(f.semantics.map(e=>e.name),state.step==='request'?['identifier']:['identifier','token','newPassword']);
    if(state.enlarged) assert.ok(f.errors.every(e=>e.font==='28px'&&e.height>40&&e.contrast>=4.5));
    await page.screenshot({path:path.join(__dirname,state.name+'.png'),fullPage:true});
    if(state.enlarged) {
      await page.locator('.reset-login-button').scrollIntoViewIfNeeded();
      const b=await page.locator('.reset-login-button').boundingBox();
      assert.ok(b.y>=0&&b.y+b.height<=state.height+1);
      f.shortViewportExit={top:b.y,bottom:b.y+b.height,height:state.height,reachable:true};
      await page.screenshot({path:path.join(__dirname,state.name+'-exit-visible.png'),fullPage:false});
    }
    report.states.push({...state,...f,status:'PASS'}); save(); await context.close();
  }
  assert.equal(report.apiRequestCount,0); assert.deepEqual(report.pageErrors,[]); assert.deepEqual(report.consoleErrors,[]);
  for(const file of [PAGE,HELPER]) assert.equal(hash(file),report.sourceHashes[file]);
  report.status='PASS';save();console.log(JSON.stringify({status:report.status,isolation:report.isolation.length,lifecycle:report.lifecycle.length,states:report.states.length,api:report.apiRequestCount,pageErrors:report.pageErrors.length}));
})().catch(error=>{ report.status='FAIL';report.failure=error.message;save();console.error(error.stack);process.exitCode=1; }).finally(async()=>{await browser?.close();});
