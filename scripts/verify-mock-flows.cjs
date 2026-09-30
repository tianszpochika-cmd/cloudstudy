// 移动端原型关键流程实操验证（Chromium 真跑，非文案检查）
// 跑法：node scripts/verify-mock-flows.mjs
// 产物：docs/06-design/v2-980plus/redesign/mockups/mobile/evidence/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:18283/mobile/';
const EV = path.join('docs/06-design/v2-980plus/redesign/mockups/mobile/evidence');
fs.mkdirSync(EV, { recursive: true });

const results = [];
function ok(name, detail) { results.push({ name, pass: true, detail }); console.log('PASS ' + name + (detail ? ' — ' + detail : '')); }
function fail(name, detail) { results.push({ name, pass: false, detail }); console.log('FAIL ' + name + ' — ' + detail); }
async function shot(page, n) { await page.screenshot({ path: path.join(EV, n + '.png') }); }

async function waitHash(page, frag) { await page.waitForFunction(f => location.hash.includes(f), frag, { timeout: 15000 }); }
async function db(page) {
  return await page.evaluate(() => JSON.parse(localStorage.getItem('yxx-demo-v3') || 'null'));
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => fail('console-clean', 'pageerror: ' + String(e).split('\n')[0]));

  // F1 首次入门 → 定级 → 报告 → 计划
  await page.goto(BASE + '#/onboard');
  await page.selectOption('#m', '30');
  await page.click('button:has-text("保存，去定级")');
  await waitHash(page, 'placement');
  const mins = await db(page).then(d => d && d.S.minutes);
  (mins === 30) ? ok('F1-minutes-saved', '每天30分钟落库') : fail('F1-minutes-saved', 'minutes=' + mins);
  // 5 题：第1题故意答错（选B），其余答对；Q2 跳过测跳过
  const correct = [1, 1, 1, 0, 1];
  for (let i = 0; i < 5; i++) {
    await page.waitForSelector('#qo .opt');
    if (i === 1) { await page.click('button:has-text("跳过")'); }
    else { await page.click(`#qo .opt >> nth=${correct[i]}`); await page.click('button:has-text("提交")'); await page.waitForTimeout(650); }
    await page.waitForSelector(i < 4 ? 'button:has-text("下一题")' : 'button:has-text("出报告")');
    await page.click(i < 4 ? 'button:has-text("下一题")' : 'button:has-text("出报告")');
  }
  await waitHash(page, 'report');
  const rep = await db(page).then(d => ({ score: d.S.quiz.score, answers: d.S.quiz.answers }));
  (rep.score === 3) ? ok('F1-score', '对3/5（Q0故意答错＋Q2跳过不计分）') : fail('F1-score', JSON.stringify(rep));
  const body = await page.textContent('#view');
  (/短板|不错|跳过/.test(body)) ? ok('F1-report-dynamic', '报告随作答变化') : fail('F1-report-dynamic', body.slice(0, 80));
  await shot(page, 'f1-report');
  await page.click('text=生成我的计划');
  await waitHash(page, 'pgen');
  await page.click('button:has-text("生成")');
  await page.waitForTimeout(1800);
  (await page.url()).includes('#') && (await page.textContent('#view')).includes('计划已生成') ? ok('F1-pgen-ok', '生成成功态') : fail('F1-pgen-ok', await page.textContent('#view').then(t => t.slice(0, 60)));
  await shot(page, 'f1-pgen-ok');
  await page.click('button:has-text("开始第一组")');
  await waitHash(page, 'practice');

  // F2 今日完成：g1 三题（第2题故意答错）→ 结果 → 进度
  const g1ans = [1, 0, 0];
  for (let i = 0; i < 3; i++) {
    await page.waitForSelector('#po .opt');
    await page.click(`#po .opt >> nth=${g1ans[i]}`);
    await page.click('button:has-text("提交")');
    await page.waitForTimeout(600);
    await page.click(i < 2 ? 'button:has-text("下一题")' : 'text=看结果');
  }
  let t = await page.textContent('#view');
  (/本组结束 · 对 2\/3/.test(t)) ? ok('F2-group-result', '对2/3，完成≠掌握文案') : fail('F2-group-result', t.slice(0, 100));
  const st = await db(page).then(d => d.S.today.find(x => x.id === 't1'));
  (st && st.done && st.right === 2 && st.total === 3) ? ok('F2-task-updated', 't1 done, 对2/3') : fail('F2-task-updated', JSON.stringify(st));
  await shot(page, 'f2-group-result');
  await page.click('button:has-text("返回今日")');
  t = await page.textContent('#view');
  (/对 2\/3/.test(t)) ? ok('F2-today-sync', '今日显示对2/3') : fail('F2-today-sync', t.slice(0, 120));

  // F5 中断恢复：t2 开始第1题选了不提交 → 回今日 → 继续第1题（草稿保留）
  await page.goto(BASE + '#/today');
  await waitHash(page, 'today');
  await page.locator('.card:has-text("图书馆的一天") >> button:has-text("开始")').click();
  await page.waitForSelector('#po .opt');
  await page.click('#po .opt >> nth=0');
  await page.goto(BASE + '#/today');
  t = await page.textContent('#view');
  (/继续第 1 题/.test(t)) ? ok('F5-resume-label', '今日显示继续第1题') : fail('F5-resume-label', t.slice(0, 160));
  await page.click('button:has-text("继续第 1 题")');
  await page.waitForSelector('#po .opt.sel');
  ok('F5-draft-kept', '返回后选中态保留');
  // 做完 t2（全对）
  await page.click('button:has-text("提交")'); await page.waitForTimeout(600);
  await page.click('button:has-text("下一题")');
  await page.waitForSelector('#po .opt');
  await page.click('#po .opt >> nth=1');
  await page.click('button:has-text("提交")'); await page.waitForTimeout(600);
  await page.click('button:has-text("看结果")');
  await page.goto(BASE + '#/today');

  // F4 错题补救：筛选 → 变式通过 → 已掌握可查 → 撤销
  await page.goto(BASE + '#/mistakes');
  const before = await db(page).then(d => d.S.mistakes.filter(m => m.st !== 'done').length);
  await page.click('button:has-text("已掌握")');
  t = await page.textContent('#view');
  (/还没有已掌握|还没有已掌握的/.test(t)) ? ok('F4-done-empty', '初始已掌握为空态（非假数据）') : fail('F4-done-empty', t.slice(0, 100));
  await page.click('button:has-text("待补救")');
  // 找第一个变式按钮
  const varBtn = page.locator('text=变式再练').first();
  if (await varBtn.count()) {
    await varBtn.click();
    // 读正确选项：sentence 变式正确答案固定 are（第二项）
    await page.click('.opt >> nth=1');
    await page.click('button:has-text("提交")');
    t = await page.textContent('#view');
    (/已掌握/.test(t)) ? ok('F4-variant-pass', '变式通过记掌握') : fail('F4-variant-pass', t.slice(0, 100));
    await page.goto(BASE + '#/mistakes');
    await page.click('button:has-text("已掌握")');
    t = await page.textContent('#view');
    (/已掌握/.test(t) && !/还没有已掌握/.test(t)) ? ok('F4-done-listed', '已掌握列表可查') : fail('F4-done-listed', t.slice(0, 120));
    await shot(page, 'f4-done-listed');
    await page.click('button:has-text("撤销上次掌握")');
    const back = await db(page).then(d => d.S.mistakes.filter(m => m.st !== 'done').length);
    (back === before) ? ok('F4-undo', '撤销恢复待补救数') : fail('F4-undo', `before=${before} back=${back}`);
  } else { fail('F4-variant-pass', '无变式按钮'); }

  // F3 复习：忘了 → 下一词 → 撤销 → 结束
  await page.goto(BASE + '#/srs');
  let s = await page.textContent('#view');
  const w1 = await page.textContent('#view b').catch(() => '');
  if (/想一下/.test(s)) {
    await page.click('button:has-text("想一下，点看答案")');
    await page.click('button:has-text("忘了")');
    await page.waitForTimeout(300);
    s = await page.textContent('#view');
    const w2 = await page.textContent('#view b').catch(() => '');
    (w2 && w2 !== w1) ? ok('F3-forget-advance', `忘了后进入下一词 ${w1}→${w2}`) : fail('F3-forget-advance', `w1=${w1} w2=${w2}`);
    await page.click('button:has-text("撤销上次")');
    const w3 = await page.textContent('#view b').catch(() => '');
    (w3 === w1) ? ok('F3-undo', '撤销回到原词') : fail('F3-undo', `w3=${w3} w1=${w1}`);
    // 打完本轮：全部选很熟悉
    for (let k = 0; k < 8; k++) {
      s = await page.textContent('#view');
      if (/本轮结束/.test(s)) break;
      if (/想一下/.test(s)) await page.click('button:has-text("想一下，点看答案")');
      await page.click('button:has-text("很熟悉")');
      await page.waitForTimeout(200);
    }
    s = await page.textContent('#view');
    (/本轮结束/.test(s)) ? ok('F3-round-end', '正常结束有总结') : fail('F3-round-end', s.slice(0, 100));
    await shot(page, 'f3-round-end');
  } else { fail('F3-forget-advance', '复习首屏无想一下'); }

  // 持久化：reload 后进度仍在
  await page.reload();
  await page.goto(BASE + '#/today');
  const kept = await db(page).then(d => d.S.today.find(x => x.id === 't1'));
  (kept && kept.done) ? ok('persist-reload', '刷新后t1仍完成') : fail('persist-reload', JSON.stringify(kept));

  // lab 故障注入：提交失败 → 重试成功
  await page.goto(BASE + '#/lab');
  await page.click('button:has-text("提交失败 关")');
  await page.goto(BASE + '#/placement');
  // placement 已做完（done），用 lab 重做定级
  await page.goto(BASE + '#/lab');
  await page.click('button:has-text("重做定级")');
  await page.waitForSelector('#qo .opt');
  await page.click('#qo .opt >> nth=0');
  await page.click('button:has-text("提交")');
  await page.waitForTimeout(700);
  s = await page.textContent('#view');
  (/提交失败/.test(s)) ? ok('lab-fail', '注入失败可见可重试') : fail('lab-fail', s.slice(0, 100));
  await page.click('button:has-text("提交")');
  await page.waitForTimeout(700);
  s = await page.textContent('#view');
  (/已保存/.test(s)) ? ok('lab-retry', '重试一次成功（不重复计分走recordQuiz幂等）') : fail('lab-retry', s.slice(0, 100));

  // 主题/字号/动效
  await page.goto(BASE + '#/a11y');
  await page.click('button:has-text("动效")');
  const motion = await page.evaluate(() => document.documentElement.getAttribute('data-motion'));
  (motion === '0') ? ok('a11y-motion', 'data-motion=0') : fail('a11y-motion', motion);
  await page.click('button:has-text("动效")');
  await page.click('button:has-text("A 字体")');
  const zf = await page.evaluate(() => ({ z: document.getElementById('view').style.zoom, fz: document.documentElement.getAttribute('data-fz'), phone: document.querySelector('.phone').style.zoom || '1' }));
  (zf.z === '1.12' && zf.fz === '1' && zf.phone === '1') ? ok('a11y-font', '大字只缩放内容区，整机不动') : fail('a11y-font', JSON.stringify(zf));
  await shot(page, 'a11y-font-large');
  // 深色：跟随系统 + 模拟深色
  await ctx.close();
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + '#/today');
  const theme = await p2.evaluate(() => document.documentElement.getAttribute('data-theme'));
  (theme === 'dark') ? ok('theme-dark-follow', '跟随系统深色生效') : fail('theme-dark-follow', theme);
  await shot(p2, 'theme-dark-today');

  // 320 窄屏溢出
  const ctx3 = await browser.newContext({ viewport: { width: 320, height: 740 } });
  const p3 = await ctx3.newPage();
  await p3.goto(BASE + '#/today');
  const ow = await p3.evaluate(() => document.documentElement.scrollWidth);
  (ow <= 320) ? ok('narrow-320', '无横向溢出') : fail('narrow-320', 'scrollWidth=' + ow);
  await shot(p3, 'narrow-320-today');
  await p3.goto(BASE + '#/home');
  await shot(p3, 'narrow-320-home');

  await browser.close();
  const passed = results.filter(r => r.pass).length;
  console.log(`\n==== ${passed}/${results.length} 通过 ====`);
  fs.writeFileSync(path.join(EV, 'results.json'), JSON.stringify(results, null, 2));
  if (results.some(r => !r.pass)) process.exitCode = 1;
})().catch(e => { console.error('SCRIPT_ERROR', e); process.exit(2); });
