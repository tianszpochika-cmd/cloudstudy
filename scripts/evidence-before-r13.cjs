// R13 缺陷 before 取证（4 缺陷同场景截图＋度量）
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = 'http://127.0.0.1:18283/mobile/';
const OUT = path.join('docs/06-design/v2-980plus/redesign/mockups/mobile/evidence/visual-r13/before');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  // D1: XL底栏出视口 320x740
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 740 } });
    const p = await ctx.newPage();
    await p.goto(BASE + '#/home');
    await p.waitForTimeout(500);
    await p.evaluate(() => { AX.f = 2; applyA11y(); render(); });
    await p.waitForTimeout(300);
    const m = await p.evaluate(() => {
      const ph = document.querySelector('.phone').getBoundingClientRect();
      const tb = document.getElementById('tabs').getBoundingClientRect();
      return { phoneH: Math.round(ph.height), tabTop: Math.round(tb.top), tabBottom: Math.round(tb.bottom), vpH: window.innerHeight, docScrollH: document.documentElement.scrollHeight };
    });
    console.log('D1-tabbar:', JSON.stringify(m));
    await p.screenshot({ path: path.join(OUT, 'd1-xl-tabbar-outside.png') });
    await ctx.close();
  }
  // D2: 阅读刷新空白
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
    await p.goto(BASE + '#/home');
    await p.waitForTimeout(400);
    await p.evaluate(() => { S.plan = true; render(); });
    await p.evaluate(() => { BK.cur = 'b1'; BK.ch = 1; });
    await p.goto(BASE + '#/chapter');
    await p.waitForTimeout(300);
    await p.reload();
    await p.waitForTimeout(500);
    const body = await p.textContent('#view');
    console.log('D2-reload len=' + body.length + ' errors=' + JSON.stringify(errs));
    await p.screenshot({ path: path.join(OUT, 'd2-chapter-reload-blank.png') });
    await ctx.close();
  }
  // D3: lab无内容仍有任务
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await p.goto(BASE + '#/lab');
    await p.waitForTimeout(400);
    await p.click('button:has-text("无内容")');
    await p.goto(BASE + '#/today');
    await p.waitForTimeout(300);
    const t = await p.textContent('#view');
    const st = await p.evaluate(() => ({ tasks: S.today.length, srsLeft: SRSQ.filter(q => !q.done).length }));
    console.log('D3-empty:', JSON.stringify(st), 'hasGroups=' + /新学/.test(t));
    await p.screenshot({ path: path.join(OUT, 'd3-empty-still-tasks.png') });
    await ctx.close();
  }
  // D4: 未建计划首页vs今日
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await p.goto(BASE + '#/home');
    await p.waitForTimeout(400);
    const h = await p.textContent('#view');
    await p.goto(BASE + '#/today');
    await p.waitForTimeout(300);
    const t = await p.textContent('#view');
    console.log('D4-home-has-taskcard=' + /今日任务（/.test(h), 'today-guide=' + /还没建计划/.test(t));
    await p.goto(BASE + '#/home');
    await p.screenshot({ path: path.join(OUT, 'd4-home-noplan.png') });
    await ctx.close();
  }
  await browser.close();
  console.log('before-evidence done');
})().catch(e => { console.error('SCRIPT_ERROR', e.message.split('\n')[0]); process.exit(2); });
