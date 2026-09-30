// R13 缺陷 after 取证（与 before 同场景配对）
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = 'http://127.0.0.1:18283/mobile/';
const OUT = path.join('docs/06-design/v2-980plus/redesign/mockups/mobile/evidence/visual-r13/after');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  // D1: XL底栏常驻 320x740
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 740 } });
    const p = await ctx.newPage();
    await p.goto(BASE + '#/home');
    await p.waitForTimeout(500);
    await p.evaluate(() => { AX.f = 2; applyA11y(); render(); });
    await p.waitForTimeout(300);
    const m = await p.evaluate(() => {
      const tb = document.getElementById('tabs').getBoundingClientRect();
      const cx = tb.left + tb.width / 2, cy = Math.min(Math.max(tb.top + tb.height / 2, 0), window.innerHeight - 1);
      const el = document.elementFromPoint(cx, cy);
      return { tabTop: Math.round(tb.top), tabBottom: Math.round(tb.bottom), vpH: window.innerHeight, hit: !!(el && (el.id === 'tabs' || document.getElementById('tabs').contains(el))), fz: document.documentElement.getAttribute('data-fz'), zoom: document.getElementById('view').style.zoom };
    });
    console.log('D1-tabbar:', JSON.stringify(m));
    await p.screenshot({ path: path.join(OUT, 'd1-xl-tabbar-fixed.png') });
    await ctx.close();
  }
  // D2: 阅读刷新恢复
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
    console.log('D2-reload len=' + body.length + ' hasChapter=' + /核心 1500|第一章|第二章/.test(body) + ' errors=' + JSON.stringify(errs));
    await p.screenshot({ path: path.join(OUT, 'd2-chapter-reload-fixed.png') });
    await ctx.close();
  }
  // D3: lab无内容真空
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
    console.log('D3-empty:', JSON.stringify(st), 'showsEmpty=' + /今天没任务啦|还没建计划/.test(t));
    await p.screenshot({ path: path.join(OUT, 'd3-empty-fixed.png') });
    await ctx.close();
  }
  // D4: 未建计划首页与今日一致
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await p.goto(BASE + '#/home');
    await p.waitForTimeout(400);
    const h = await p.textContent('#view');
    console.log('D4-home-guide=' + /还没有计划/.test(h), 'home-taskcard=' + /今日任务（/.test(h));
    await p.screenshot({ path: path.join(OUT, 'd4-home-noplan-fixed.png') });
    await ctx.close();
  }
  // D5: 首页主动作唯一 + KPI 不换行（XL 320）
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 740 } });
    const p = await ctx.newPage();
    await p.goto(BASE + '#/home');
    await p.waitForTimeout(400);
    await p.evaluate(() => { S.plan = true; if (!S.today.length) S.today = freshToday(); AX.f = 2; applyA11y(); render(); });
    await p.waitForTimeout(300);
    const m = await p.evaluate(() => {
      const kpis = [...document.querySelectorAll('.hero .kpi span')].map(e => ({ t: e.textContent, wrap: e.getBoundingClientRect().height > parseFloat(getComputedStyle(e).fontSize) * 1.6 }));
      return { kpis, starters: [...document.querySelectorAll('#view button')].filter(b => /开始今日/.test(b.textContent)).length };
    });
    console.log('D5:', JSON.stringify(m));
    await p.screenshot({ path: path.join(OUT, 'd5-home-xl-fixed.png') });
    await ctx.close();
  }
  await browser.close();
  console.log('after-evidence done');
})().catch(e => { console.error('SCRIPT_ERROR', e.message.split('\n')[0]); process.exit(2); });
