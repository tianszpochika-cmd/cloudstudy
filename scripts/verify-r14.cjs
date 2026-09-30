// R14 针对性验证：跨书续读 / 刷新位置 / md加粗 / 按压容器稳定（真实点击）
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = 'http://127.0.0.1:18283/mobile/';
const OUT = path.join('docs/06-design/v2-980plus/redesign/mockups/mobile/evidence/visual-r13/after');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
function ok(n, d) { results.push({ name: n, pass: true, detail: d }); console.log('PASS ' + n + ' — ' + d); }
function fail(n, d) { results.push({ name: n, pass: false, detail: d }); console.log('FAIL ' + n + ' — ' + d); }
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => fail('r14-console', String(e).split('\n')[0]));
  // R1 跨书续读：b4c2 → home/today/me 继续读同书章
  await page.goto(BASE + '#/shelf');
  await page.waitForTimeout(400);
  await page.locator('.card:has-text("商务口语") >> button:has-text("进书")').click();
  await page.locator('.opt:has-text("第三章")').click();
  await page.waitForTimeout(300);
  let t = await page.textContent('#view');
  (/谈判/.test(t)) ? ok('R1-open-b4c2', '进入商务第三章') : fail('R1-open-b4c2', t.slice(0, 60));
  for (const [pg, sel] of [['home', null], ['today', null], ['me', null]]) {
    await page.goto(BASE + '#/' + pg);
    await page.waitForTimeout(300);
  }
  await page.goto(BASE + '#/home');
  await page.click('button:has-text("继续读")');
  await page.waitForTimeout(300);
  t = await page.textContent('#view');
  (/谈判/.test(t)) ? ok('R1-home-resume', '首页继续读回到商务谈判') : fail('R1-home-resume', t.slice(0, 80));
  await page.screenshot({ path: path.join(OUT, 'r14-continue-b4.png') });
  await page.goto(BASE + '#/today');
  await page.evaluate(() => { S.plan = true; render(); });
  await page.waitForTimeout(200);
  await page.click('button:has-text("继续读")');
  await page.waitForTimeout(300);
  t = await page.textContent('#view');
  (/谈判/.test(t)) ? ok('R1-today-resume', '今日继续读回到商务谈判') : fail('R1-today-resume', t.slice(0, 80));
  await page.goto(BASE + '#/me');
  await page.click('button:has-text("继续读")');
  await page.waitForTimeout(300);
  t = await page.textContent('#view');
  (/谈判/.test(t)) ? ok('R1-me-resume', '我的继续读回到商务谈判') : fail('R1-me-resume', t.slice(0, 80));
  // R2 滚动刷新恢复（长文 b1c1，保证可滚动量；机制与书章无关）
  await page.goto(BASE + '#/book');
  await page.waitForTimeout(300);
  await page.evaluate(() => { BK.cur = 'b1'; });
  await page.locator('.opt:has-text("第二章")').click();
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('view').scrollTo(0, 260));
  await page.waitForTimeout(700);
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForTimeout(500);
  const sc = await page.evaluate(() => document.getElementById('view').scrollTop);
  t = await page.textContent('#view');
  (/第二章|核心 1500/.test(t) && sc > 100) ? ok('R2-scroll-reload', `刷新后同章节且位置恢复 sc=${sc}`) : fail('R2-scroll-reload', `sc=${sc} hasChapter=${/第二章|核心 1500/.test(t)}`);
  // R3 md 列表加粗
  await page.goto(BASE + '#/book');
  await page.waitForTimeout(300);
  await page.evaluate(() => { BK.cur = 'b1'; });
  await page.locator('.opt:has-text("第二章")').click();
  await page.waitForTimeout(300);
  const raw = await page.evaluate(() => document.querySelector('#view article').innerHTML.includes('**'));
  const bold = await page.evaluate(() => document.querySelector('#view article').innerHTML.includes('<b>abandon</b>'));
  (!raw && bold) ? ok('R3-md-bold', '列表加粗正常渲染，无原始标记') : fail('R3-md-bold', `raw=${raw} bold=${bold}`);
  await page.screenshot({ path: path.join(OUT, 'r14-chapter-md.png') });
  // R4 按压容器稳定
  await page.goto(BASE + '#/home');
  await page.waitForTimeout(300);
  await page.evaluate(() => { S.plan = true; if (!S.today.length) S.today = freshToday(); render(); });
  await page.waitForTimeout(200);
  for (const [n, sel] of [['primary', '#view button:has-text("查看今日安排")'], ['ghost', '#view button:has-text("进错题本")']]) {
    await page.goto(BASE + '#/home');
    await page.waitForTimeout(300);
    const el = await page.$(sel);
    if (!el) { fail('R4-' + n, 'no-el'); continue; }
    const pre = await el.boundingBox();
    if (!pre) { fail('R4-' + n, 'no-box'); continue; }
    await page.mouse.move(pre.x + pre.width / 2, pre.y + pre.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);
    const down = await el.boundingBox();
    if (!down) { fail('R4-' + n, 'down-no-box'); await page.mouse.up(); continue; }
    const filt = await el.evaluate(e => getComputedStyle(e).filter);
    const same = Math.abs(pre.width - down.width) < 1 && Math.abs(pre.height - down.height) < 1;
    (same && down.height >= 44) ? ok('R4-' + n, `容器稳定 ${Math.round(down.width)}x${Math.round(down.height)} filter=${filt}`) : fail('R4-' + n, `pre=${Math.round(pre.width)}x${Math.round(pre.height)} down=${Math.round(down.width)}x${Math.round(down.height)} filter=${filt}`);
    if (n === 'primary') await page.screenshot({ path: path.join(OUT, 'r14-pressed-stable.png') });
    await page.mouse.up();
  }
  await browser.close();
  const passed = results.filter(r => r.pass).length;
  console.log(`\n==== r14 ${passed}/${results.length} ====`);
  fs.writeFileSync(path.join(OUT, 'results-r14.json'), JSON.stringify(results, null, 2));
  if (results.some(r => !r.pass)) process.exitCode = 1;
})().catch(e => { console.error('SCRIPT_ERROR', e.message.split('\n')[0]); process.exit(2); });
