// R12 视觉审计：全路由 x 主题(浅/深/浅HC/深HC) x 状态，真实渲染测量
// 用法：MODE=before node scripts/audit-visual-r12.cjs [xl]
//   MODE=before|after（截图与数据分别存 evidence/visual-r12/<mode>/）
//   加 xl 参数则只跑特大字号溢出矩阵（320/390 x 10 页）
// 方法：对比度算法复用 theme-fix-20260930/inspect-colors.js（行内副本，见注）。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const MODE = process.env.MODE || 'before';
const XLONLY = process.argv.includes('xl');
const BASE = 'http://127.0.0.1:18283/mobile/';
const OUT = path.join('docs/06-design/v2-980plus/redesign/mockups/mobile/evidence/visual-r12', MODE);
fs.mkdirSync(OUT, { recursive: true });

// 注：以下 contrast 采样与 theme-fix-20260930/inspect-colors.js 同算法（rgba合成/相对亮度/WCAG阈值），
// 差异：可含禁用态（opt.includeDisabled），并附带阈值类型。
const MEASURE_SRC = `(() => {
  const rgba = s => { const m=String(s).match(/rgba?\\(([^)]+)\\)/); if(!m) return null; const v=m[1].split(/[,\\s/]+/).filter(Boolean).map(Number); return [v[0],v[1],v[2],v.length>3?v[3]:1]; };
  const blend=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3])).concat(1);
  const luminance=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  const backgrounds=e=>{if(!e)return [[255,255,255,1]]; const s=getComputedStyle(e), colors=(s.backgroundImage.match(/rgba?\\([^)]+\\)/g)||[]).map(rgba); const own=rgba(s.backgroundColor); if(colors.length){const bases=own&&own[3]===1?[own]:backgrounds(e.parentElement);return colors.flatMap(c=>bases.map(b=>blend(c,b)));} if(own&&own[3]===1)return[own];const bases=backgrounds(e.parentElement);return own&&own[3]>0?bases.map(b=>blend(own,b)):bases;};
  const rows=Array.from(document.querySelectorAll('#view *, .topbar *, .tabbar a')).filter(e=>Array.from(e.childNodes).some(n=>n.nodeType===3&&/[A-Za-z0-9\\u4e00-\\u9fff]/.test(n.textContent))&&OPT_INC!==!!e.closest('[disabled]')&&getComputedStyle(e).display!=='none'&&e.getClientRects().length).map(e=>{const s=getComputedStyle(e),fg=rgba(s.color),bg=backgrounds(e),r=Math.min(...bg.map(b=>ratio(fg,b)));const fs=Number.parseFloat(s.fontSize),fw=Number.parseInt(s.fontWeight);return {text:e.textContent.trim().slice(0,48),contrast:Number(r.toFixed(2)),fg:s.color,bg:bg.map(c=>c.slice(0,3).map(Math.round)),big:fs>=24||(fs>=18.66&&fw>=700),threshold:fs>=24||(fs>=18.66&&fw>=700)?3:4.5};});
  return {route:location.hash,theme:document.documentElement.dataset.theme,hc:document.documentElement.dataset.hc,count:rows.length,minContrast:rows.length?Math.min(...rows.map(r=>r.contrast)):null,failures:rows.filter(r=>r.contrast<r.threshold)};
})()`;

const MEASURE = MEASURE_SRC.split('OPT_INC').join('true');
const CHROME_SRC = `(() => {
  const ph = document.querySelector('.phone').getBoundingClientRect();
  const tb = document.getElementById('tabs').getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  const cx = tb.left + tb.width / 2, cy = Math.min(Math.max(tb.top + tb.height / 2, 0), vh - 1);
  const top = document.elementFromPoint(cx, cy);
  const view = document.getElementById('view');
  const last = view.lastElementChild;
  const lr = last ? last.getBoundingClientRect() : null;
  return { phoneH: Math.round(ph.height), phoneW: Math.round(ph.width), tabTop: Math.round(tb.top), tabBottom: Math.round(tb.bottom), tabVisible: tb.bottom > 0 && tb.top < vh, tabHit: !!(top && (top === document.getElementById('tabs') || document.getElementById('tabs').contains(top))), vw, vh, docScroll: document.documentElement.scrollHeight > vh + 1, viewScroll: view.scrollHeight > view.clientHeight + 1, lastBottom: lr ? Math.round(lr.bottom) : null, overlap: lr ? Math.round(lr.bottom - tb.top) : null };
})()`;
const OVERFLOW_SRC = `(() => {
  const bad = [];
  document.querySelectorAll('#view *, .topbar *, .tabbar *').forEach(e => {
    const sw = e.scrollWidth, cw = e.clientWidth;
    if (sw > cw + 1 && cw > 0) {
      let p = e.tagName.toLowerCase(), el = e;
      if (el.id) p += '#' + el.id;
      else if (el.className && typeof el.className === 'string') p += '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.');
      bad.push({ path: p.slice(0, 60), sw, cw, text: (e.textContent || '').trim().slice(0, 30) });
    }
  });
  const phone = document.querySelector('.phone');
  return { offenders: bad.slice(0, 25), viewSW: document.getElementById('view').scrollWidth, viewCW: document.getElementById('view').clientWidth, docSW: document.documentElement.scrollWidth };
})()`;

const TOUCH_SRC = `(() => Array.from(document.querySelectorAll('#view button, #view .opt, .tabbar a, .topbar .bk')).map(e => { const r = e.getBoundingClientRect(); return { t: (e.textContent || '').trim().slice(0, 18) || e.getAttribute('aria-label') || e.tagName, w: Math.round(r.width), h: Math.round(r.height) }; }).filter(x => (x.w > 0 && x.w < 44) || (x.h > 0 && x.h < 44)).slice(0, 20))()`;

// route 矩阵：每项 {r, setup(js), shots(是否截图)}
const ROUTES = [
  { r: 'home' }, { r: 'home', tag: 'planned', setup: `S.plan=true;if(!S.today.length)S.today=freshToday();render();` },
  { r: 'today' }, { r: 'today', tag: 'done', setup: `labToday('done')` }, { r: 'today', tag: 'empty', setup: `labToday('empty')` },
  { r: 'placement', setup: `S.quiz={i:0,sel:null,phase:'answer',answers:[],done:false,score:0};render();` },
  { r: 'placement', tag: 'saved', setup: `S.quiz.answers[0]={sel:1,ok:true};S.quiz.score=1;S.quiz.sel=1;S.quiz.phase='saved';S.quiz.fb={msg:'已保存',cls:'ok'};render();` },
  { r: 'placement', tag: 'failed', setup: `S.quiz.sel=0;S.quiz.phase='answer';S.quiz.fb={msg:'提交失败，再点一次提交重试（选择还在）',cls:'no'};render();` },
  { r: 'practice', setup: `if(!S.today.length)S.today=freshToday();startGroup('t1')` },
  { r: 'practice', tag: 'wrong', setup: `if(!S.today.length)S.today=freshToday();startGroup('t1');PR.sel=0;prRecord(0,0);` },
  { r: 'practice', tag: 'result', setup: `if(!S.today.length)S.today=freshToday();startGroup('t1');{const g=prGroup();g.items.forEach((x,i)=>{x._ok=true});const t=prTask();t.done=true;t.right=3;t.total=3;PR.phase='result';render();}` },
  { r: 'report', setup: `S.quiz={i:4,sel:null,phase:'saved',answers:[{sel:0,ok:true},{skip:true},{sel:1,ok:true},{sel:0,ok:true},{sel:1,ok:true}],done:true,score:4,fb:null};render();` },
  { r: 'pgen' }, { r: 'pgen', tag: 'ok', setup: `PG.st='ok';S.plan=true;if(!S.today.length)S.today=freshToday();render();` },
  { r: 'pgen', tag: 'fail', setup: `PG.st='fail';PG.msg='生成失败：拼装超时，重试不会建出两份计划';render();` },
  { r: 'mistakes' }, { r: 'mistakes', tag: 'done', setup: `MK.st='done';render();` }, { r: 'mistakes', tag: 'variant', setup: `MK.vid=2;MKPICK=-1;render();` },
  { r: 'srs' }, { r: 'srs', tag: 'done', setup: `SRS.phase='done';SRS.batch=4;SRS.done=3;SRS.again=1;SRS.remembered=3;render();` },
  { r: 'settings' }, { r: 'a11y' }, { r: 'me' }, { r: 'world' },
  { r: 'commerce' }, { r: 'commerce', tag: 'detail', setup: `GC.cur='g1';render();` },
  { r: 'pay' }, { r: 'pay', tag: 'success', setup: `document.getElementById('payr').className='fb ok';document.getElementById('payr').style.display='block';` },
  { r: 'login' }, { r: 'register' }, { r: 'reset' }, { r: 'gate' }, { r: 'onboard' },
  { r: 'vocab' }, { r: 'vocab', tag: 'search', setup: `VC.q='aban';render();` },
  { r: 'listening' }, { r: 'speaking' }, { r: 'writing' },
  { r: 'chapter', setup: `BK.cur='b1';BK.ch=1;render();` }, { r: 'book' }, { r: 'shelf' }, { r: 'courses' },
  { r: 'search' }, { r: 'search', tag: 'noresult', setup: `SH.q='zzzzzz';render();` }, { r: 'search', tag: 'results', setup: `SH.q='四级';render();` },
  { r: 'msgs' }, { r: 'npref' }, { r: 'offpkg' }, { r: 'offlinet' }, { r: 'arrears' }, { r: 'celebrate' },
  { r: 'firstlearn' }, { r: 'planexp' }, { r: 'session' }, { r: 'mastery' }, { r: 'pfault' },
  { r: 'league' }, { r: 'achieve' }, { r: 'avatar' }, { r: 'games' }, { r: 'space' },
  { r: 'subs' }, { r: 'native' }, { r: 'rewards' }, { r: 'aigate' }, { r: 'aiflow' },
  { r: 'voice' }, { r: 'vscore' }, { r: 'k12' }, { r: 'k12', tag: 'parent', setup: `K12.role='parent';render();` },
  { r: 'k12guard' }, { r: 'k12course' },
  { r: 'tdetail' }, { r: 'tdetail', tag: 'empty', setup: `TD.f='已提交';render();` },
  { r: 'paudio' }, { r: 'privacy' }, { r: 'support' }, { r: 'devices' },
  { r: 'admin' }, { r: 'aperm' }, { r: 'adraft' }, { r: 'areview' }, { r: 'apublish' }, { r: 'agov' }, { r: 'aaudit' },
  { r: 'alogin' }, { r: 'amedia' }, { r: 'acs' }, { r: 'ashop' }, { r: 'areport' }, { r: 'aobs' },
  { r: 'greject' }, { r: 'cupgrade' }, { r: 'drill' }, { r: 'drill', tag: 'quiz', setup: `DR.mode='quiz';render();` },
  { r: 'drill', tag: 'time', setup: `DR.mode='time';render();` },
  { r: 'wordbook' }, { r: 'phonics' }, { r: 'alphabet' }, { r: 'about' }, { r: 'lab' }, { r: 'refund' },
  { r: 'weekly' }, { r: 'ai' },
  { r: 'placement', tag: 'submitting', setup: `S.quiz.sel=0;S.quiz.phase='submitting';S.quiz.fb={msg:'提交中…',cls:'wa'};render();` },
  { r: 'placement', tag: 'unknown', setup: `S.quiz.sel=0;S.quiz.phase='unknown';S.quiz.fb={msg:'结果未知',cls:'wa'};render();` },
  { r: 'pgen', tag: 'run', setup: `PG.st='run';render();` },
];
const THEMES = [
  { name: 'light', theme: 'light', hc: false },
  { name: 'dark', theme: 'dark', hc: false },
  { name: 'light-hc', theme: 'light', hc: true },
  { name: 'dark-hc', theme: 'dark', hc: true },
];
const XL_PAGES = ['home', 'today', 'practice', 'placement', 'report', 'mistakes', 'srs', 'settings', 'me', 'world'];

(async () => {
  const browser = await chromium.launch();
  const summary = { mode: MODE, routes: ROUTES.length, results: [] };
  for (const vp of XLONLY ? [{ w: 320 }, { w: 390 }] : [{ w: 390 }]) {
    for (const th of THEMES) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: 844 } });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push(String(e).split('\n')[0]));
      await page.goto(BASE + '#/home');
      await page.waitForTimeout(400);
      await page.evaluate(([t, h]) => { SET.theme = t; AX.c = h; try { localStorage.removeItem('yxx-demo-v3'); } catch (e) { } applyA11y(); render(); }, [th.theme, th.hc]);
      if (XLONLY) await page.evaluate(() => { AX.f = 2; applyA11y(); render(); });
      const list = XLONLY ? ROUTES.filter(x => XL_PAGES.includes(x.r)) : ROUTES;
      for (const item of list) {
        const tag = item.tag ? '-' + item.tag : '';
        const key = `${item.r}${tag}@${th.name}@${vp.w}`;
        try {
          await page.goto(BASE + '#/' + item.r);
          await page.waitForTimeout(150);
          if (item.setup) await page.evaluate(item.setup);
          await page.waitForTimeout(120);
          const routeOk = await page.evaluate(r => location.hash === '#/' + r, item.r);
          const title = await page.textContent('#title').catch(() => '');
          const bodyLen = await page.textContent('#view').then(t => t.length).catch(() => 0);
          const m = await page.evaluate(MEASURE);
          const ov = await page.evaluate(OVERFLOW_SRC);
          const touch = await page.evaluate(TOUCH_SRC);
          const ch = await page.evaluate(CHROME_SRC);
          const pageErrs = errs.splice(0);
          const rec = { key, route: item.r, tag: item.tag || '', theme: th.name, vp: vp.w, injected: !!item.setup, routeOk, title, missing: bodyLen < 10, count: m.count, min: m.minContrast, fails: m.failures.length, failSample: m.failures.slice(0, 3), overflow: ov.offenders.slice(0, 5), viewOverflow: ov.viewSW > ov.viewCW + 1, touch: touch.slice(0, 5), chrome: ch, errors: pageErrs };
          summary.results.push(rec);
          const bad = !routeOk || rec.missing || rec.fails > 0 || rec.viewOverflow || rec.overflow.length > 0 || !ch.tabVisible || !ch.tabHit || ch.docScroll;
          if (bad) await page.screenshot({ path: path.join(OUT, key.replace(/[@]/g, '_') + '.png') });
        } catch (e) { summary.results.push({ key, error: String(e).split('\n')[0] }); }
      }
      await ctx.close();
    }
  }
  // 按住态（pressed）：6 个代表按钮 down-hold 采样
  if (!XLONLY) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(BASE + '#/home');
    await page.waitForTimeout(400);
    const pressed = [];
    const cases = [
      ['home-primary', '#/home', 'button:has-text("开始今日")', `S.plan=true;if(!S.today.length)S.today=freshToday();render();`],
      ['opt', '#/placement', '#qo .opt >> nth=0', `S.quiz={i:0,sel:null,phase:'answer',answers:[],done:false,score:0};render();`],
      ['ghost', '#/today', 'button:has-text("回首页")', `labToday('done')`],
      ['tab', '#/today', '.tabbar a >> nth=0', ''],
    ];
    for (const [n, h, sel, setup] of cases) {
      await page.goto(BASE + h);
      await page.waitForTimeout(250);
      if (setup) await page.evaluate(setup);
      await page.waitForTimeout(150);
      const el = await page.$(sel);
      if (!el) { pressed.push({ n, error: 'no-el' }); continue; }
      const pre = await el.boundingBox();
      await page.mouse.move(pre.x + pre.width / 2, pre.y + pre.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(200);
      const box = await el.boundingBox();
      const m = await page.evaluate(MEASURE);
      const mm = { count: m.count, minContrast: m.minContrast, failures: m.failures.slice(0, 2) };
      pressed.push({ n, boxPre: { w: Math.round(pre.width), h: Math.round(pre.height) }, boxDown: { w: Math.round(box.width), h: Math.round(box.height) }, min: mm.minContrast, fails: mm.failures.length });
      await page.screenshot({ path: path.join(OUT, `pressed-${n}.png`) });
      await page.mouse.up();
    }
    summary.pressed = pressed;
    await ctx.close();
  }
  await browser.close();
  const TABBED = ['home', 'today', 'world', 'me'];
  const chromeBad = r => r.chrome && (((TABBED.includes(r.route) && (!r.chrome.tabVisible || !r.chrome.tabHit))) || r.chrome.docScroll);
  const cat = { contrast: 0, overflow: 0, touch: 0, pageerror: 0, routeMismatch: 0, missing: 0, chrome: 0, injected: 0 };
  for (const r of summary.results) {
    if (r.error) { cat.pageerror++; continue; }
    if (r.injected) cat.injected++;
    if ((r.fails || 0) > 0) cat.contrast++;
    if ((r.overflow || []).length || r.viewOverflow) cat.overflow++;
    if ((r.touch || []).length) cat.touch++;
    if ((r.errors || []).length) cat.pageerror++;
    if (r.routeOk === false) cat.routeMismatch++;
    if (r.missing) cat.missing++;
    if (chromeBad(r)) cat.chrome++;
  }
  summary.totals = { n: summary.results.length, byCategory: cat, shots: fs.readdirSync(OUT).filter(f => f.endsWith('.png')).length };
  fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify(summary, null, 1));
  console.log(`done: ${summary.results.length} 组 ` + JSON.stringify(cat));
  for (const f of summary.results.filter(r => !r.error && ((r.fails || 0) > 0 || r.viewOverflow || (r.overflow || []).length || (r.touch || []).length || (r.errors || []).length || r.routeOk === false || r.missing || chromeBad(r))).slice(0, 60)) console.log(`- ${f.key} fails=${f.fails} min=${f.min} overflow=${(f.overflow || []).length} touch=${(f.touch || []).length} routeOk=${f.routeOk} missing=${!!f.missing} tabVisible=${f.chrome && f.chrome.tabVisible} tabHit=${f.chrome && f.chrome.tabHit} docScroll=${f.chrome && f.chrome.docScroll} errs=${JSON.stringify(f.errors || [])}`);
})().catch(e => { console.error('SCRIPT_ERROR', e.message.split('\n')[0]); process.exit(2); });
