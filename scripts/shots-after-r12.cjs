// R12 after 显式截图：修复页 x 主题（与 before 缺陷截图同场景配对）
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = 'http://127.0.0.1:18283/mobile/';
const AFTER = path.join('docs/06-design/v2-980plus/redesign/mockups/mobile/evidence/visual-r12/after');
const AFTERXL = path.join('docs/06-design/v2-980plus/redesign/mockups/mobile/evidence/visual-r12/after-xl');
fs.mkdirSync(AFTERXL, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  for (const vp of [390]) {
    for (const th of [{ n: 'light', t: 'light', hc: false }, { n: 'dark', t: 'dark', hc: false }]) {
      const ctx = await browser.newContext({ viewport: { width: vp, height: 844 } });
      const p = await ctx.newPage();
      await p.goto(BASE + '#/home');
      await p.waitForTimeout(400);
      await p.evaluate(([t, h]) => { SET.theme = t; AX.c = h; applyA11y(); render(); }, [th.t, th.hc]);
      const jobs = [
        ['home', '', 'home'], ['home', 'S.plan=true;if(!S.today.length)S.today=freshToday();render();', 'home-planned'],
        ['today', '', 'today'], ['me', '', 'me'], ['world', '', 'world'],
      ];
      for (const j of jobs) {
        await p.goto(BASE + '#/' + j[0]);
        await p.waitForTimeout(200);
        if (j[1]) await p.evaluate(j[1]);
        await p.waitForTimeout(150);
        await p.screenshot({ path: path.join(AFTER, j[2] + '_' + th.n + '_' + vp + '.png') });
      }
      await ctx.close();
    }
  }
  for (const vp of [320, 390]) {
    for (const th of [{ n: 'light', t: 'light', hc: false }, { n: 'dark', t: 'dark', hc: false }]) {
      const ctx = await browser.newContext({ viewport: { width: vp, height: 844 } });
      const p = await ctx.newPage();
      await p.goto(BASE + '#/home');
      await p.waitForTimeout(400);
      await p.evaluate(([t, h]) => { SET.theme = t; AX.c = h; AX.f = 2; applyA11y(); render(); }, [th.t, th.hc]);
      const jobs = [
        ['home', '', 'home'], ['home', 'S.plan=true;if(!S.today.length)S.today=freshToday();render();', 'home-planned'],
      ];
      for (const j of jobs) {
        await p.goto(BASE + '#/' + j[0]);
        await p.waitForTimeout(200);
        if (j[1]) await p.evaluate(j[1]);
        await p.waitForTimeout(150);
        await p.screenshot({ path: path.join(AFTERXL, j[2] + '_' + th.n + '_' + vp + '.png') });
      }
      await ctx.close();
    }
  }
  await browser.close();
  console.log('after shots done');
})().catch(e => { console.error('SCRIPT_ERROR', e.message.split('\n')[0]); process.exit(2); });
