// 补充验证：快速开始 / 阅读收藏查词 / 支付失败 / 特大字 / 横屏
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = 'http://127.0.0.1:18283/mobile/';
const EV = path.join('docs/06-design/v2-980plus/redesign/mockups/mobile/evidence');
const results = [];
function ok(n, d) { results.push({ name: n, pass: true, detail: d }); console.log('PASS ' + n + ' — ' + d); }
function fail(n, d) { results.push({ name: n, pass: false, detail: d }); console.log('FAIL ' + n + ' — ' + d); }
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => fail('x-console', String(e).split('\n')[0]));
  // X1 快速开始
  await page.goto(BASE + '#/firstlearn');
  await page.click('button:has-text("快速开始")');
  await page.waitForTimeout(400);
  const q = await page.evaluate(() => ({ quick: S.quick, plan: S.plan, n: S.today.length }));
  (q.quick && q.plan && q.n === 2) ? ok('X1-quickstart', '基线计划2组，非正式成绩') : fail('X1-quickstart', JSON.stringify(q));
  // X2 阅读：长文/查词/收藏/位置（第二章为长文样例）
  await page.goto(BASE + '#/book');
  await page.locator('.opt:has-text("第二章")').click();
  await page.waitForTimeout(400);
  const h2 = await page.locator('#view article h2').count();
  const artLen = await page.textContent('#view article').then(t => t.length);
  (h2 >= 1 && artLen > 400) ? ok('X2-longtext', `长文样例${artLen}字`) : fail('X2-longtext', 'h2=' + h2 + ' len=' + artLen);
  await page.fill('#chapq', 'abandon');
  await page.click('button:has-text("查词")');
  let t = await page.textContent('#chapwd');
  (/抛弃/.test(t)) ? ok('X2-lookup', '查词出中文+搭配') : fail('X2-lookup', t.slice(0, 60));
  await page.click('button:has-text("加入复习")');
  const inS = await page.evaluate(() => SRSQ.some(x => x.w === 'abandon' && !x.done));
  inS ? ok('X2-tosrs', '生词进复习队列') : fail('X2-tosrs', 'not queued');
  await page.click('button:has-text("收藏本节")');
  const fav = await page.evaluate(() => (S.fav || []).length);
  (fav === 1) ? ok('X2-fav', '收藏1节') : fail('X2-fav', fav);
  await page.evaluate(() => document.getElementById('view').scrollTop = 300);
  await page.goto(BASE + '#/book');
  await page.goBack();
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => document.getElementById('view').scrollTop);
  (st > 100) ? ok('X2-pos', '返回恢复位置 sc=' + st) : fail('X2-pos', 'sc=' + st);
  await page.screenshot({ path: path.join(EV, 'x2-chapter.png') });
  // X3 支付失败→重试
  await page.goto(BASE + '#/lab');
  await page.click('button:has-text("提交失败 关")');
  await page.goto(BASE + '#/pay');
  await page.click('button:has-text("支付")');
  await page.click('button:has-text("再点一次确认")').catch(() => { });
  t = await page.textContent('#view');
  (/没成功/.test(t)) ? ok('X3-pay-fail', '失败态：钱没扣+可重试') : fail('X3-pay-fail', t.slice(0, 80));
  await page.click('button:has-text("支付")');
  await page.click('button:has-text("再点一次确认")').catch(() => { });
  t = await page.textContent('#view');
  (/支付成功/.test(t)) ? ok('X3-pay-retry', '重试成功') : fail('X3-pay-retry', t.slice(0, 80));
  // X4 特大字
  await page.goto(BASE + '#/a11y');
  await page.click('button:has-text("A 字体")');
  await page.click('button:has-text("A 字体")');
  const z = await page.evaluate(() => document.getElementById('view').style.zoom);
  const bigBtn = await page.locator('#view button:has-text("恢复默认")').isVisible();
  await page.goto(BASE + '#/home');
  await page.waitForTimeout(300);
  const tab = await page.evaluate(() => { const tb = document.getElementById('tabs'); const r = tb.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = Math.min(Math.max(r.top + r.height / 2, 0), window.innerHeight - 1); const el = document.elementFromPoint(cx, cy); return { vis: r.bottom > 0 && r.top < window.innerHeight, hit: !!(el && (el.id === 'tabs' || tb.contains(el))), top: Math.round(r.top), vh: window.innerHeight }; });
  (z === '1.25' && bigBtn && tab.vis && tab.hit) ? ok('X4-xl-font', '内容区zoom=1.25，底栏可见可点 top=' + tab.top + '/' + tab.vh) : fail('X4-xl-font', 'zoom=' + z + ' btn=' + bigBtn + ' tab=' + JSON.stringify(tab));
  await page.screenshot({ path: path.join(EV, 'x4-xl-font.png') });
  await browser.close();
  // X5 横屏
  const b2 = await chromium.launch();
  const c2 = await b2.newContext({ viewport: { width: 844, height: 390 } });
  const p2 = await c2.newPage();
  p2.on('pageerror', e => fail('x5-console', String(e).split('\n')[0]));
  await p2.goto(BASE + '#/today');
  await p2.waitForTimeout(500);
  const tb = await p2.locator('#view button').count();
  const tt = await p2.textContent('#view');
  (tb >= 1 && /今日|计划/.test(tt)) ? ok('X5-landscape', `横屏渲染，${tb}个按钮（fresh未建计划态）`) : fail('X5-landscape', 'btn=' + tb);
  await p2.screenshot({ path: path.join(EV, 'x5-landscape.png') });
  await b2.close();
  const passed = results.filter(r => r.pass).length;
  console.log(`\n==== extra ${passed}/${results.length} ====`);
  fs.writeFileSync(path.join(EV, 'results-extra.json'), JSON.stringify(results, null, 2));
  if (results.some(r => !r.pass)) process.exitCode = 1;
})().catch(e => { console.error('SCRIPT_ERROR', e.message.split('\n')[0]); process.exit(2); });
