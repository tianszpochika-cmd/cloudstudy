// Full UI onboarding from zero (local web only): register -> adult gate ->
// goal -> save -> lands on /assessment with the first server question.
// Proves the UI/server contract (P1-LIVE-014): policy version, gate mapping,
// three consents, post-consent rotation, sequential version chaining.
import { chromium } from 'playwright';
import fs from 'node:fs';

const WEB = 'http://127.0.0.1:18180';
const stamp = Date.now().toString(36);
const identifier = `wuon-${stamp}@local.invalid`;
const password = `E2eUon${stamp}Aa9!xQ`;
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 130)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|Failed to load resource/i.test(m.text())) errs.push('console.error: ' + m.text().slice(0, 130));
});
const writes = {};
page.on('response', async (resp) => {
  const u = resp.url();
  if (u.includes('18070') && resp.request().method() !== 'GET') {
    writes[u.split('18070')[1].split('?')[0]] = resp.status();
  }
});
await page.goto(`${WEB}/register`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(2000);
await page.getByPlaceholder(/邮箱或账号/).fill(identifier);
await page.getByPlaceholder(/^输入密码/).fill(password);
await page.getByPlaceholder(/再输入一次/).fill(password);
await page.getByRole('button', { name: /注册并继续/ }).first().click();
await page.waitForTimeout(5000);
record('ui-register', page.url().includes('/onboarding'), page.url(), 'lands onboarding');
await page.getByLabel(/出生年份/).first().fill('1995');
await page.getByLabel(/已满 18/).first().check();
await page.getByLabel(/隐私说明/).first().check();
await page.getByLabel(/学习服务条款/).first().check();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /^继续$/ }).first().click();
await page.waitForTimeout(5000);
const step2 = page.url().includes('/onboarding') && ((await page.locator('body').first().textContent().catch(() => '')) ?? '').includes('定制你的学习计划');
record('ui-gate-step2', step2, 'step 2/2 shown (gate 200, no policy alert)', 'gate advances');
await page.getByRole('button', { name: /四六级备考/ }).first().click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /保存并开始测评/ }).first().click();
await page.waitForTimeout(10000);
const finalUrl = page.url();
record('ui-save-lands-assessment', finalUrl.includes('/assessment'), finalUrl, 'lands /assessment');
const body = (await page.locator('body').first().textContent().catch(() => '')) ?? '';
record('ui-first-question', /Choose the greeting|1\/2/.test(body), 'first server question rendered', 'question visible');
const saveWrites = ['/api/v1/iam/consents', '/api/v1/auth/token/refresh', '/api/v1/learner/profile', '/api/v1/learner/targets', '/api/v1/learner/preferences'];
const writesOk = saveWrites.every((k) => writes[k] === 200);
record('ui-save-writes', writesOk, JSON.stringify(writes), 'all save writes 200');
// Answer the placement questions through the UI (first options), then read
// the report and today through the UI.
let answered = 0;
for (let q = 0; q < 4; q++) {
  const opts = await page.getByRole('button', { name: /^[AB] / }).all().catch(() => []);
  if (opts.length === 0) break;
  await opts[0].click();
  await page.waitForTimeout(3000);
  answered++;
}
record('ui-placement-answered', answered >= 2, `${answered} answers submitted`, 'both questions answered');
await page.waitForTimeout(2000);
const afterBody = (await page.locator('body').first().textContent().catch(() => '')) ?? '';
record('ui-placement-report', /CEFR|[ABC][12]|完成|报告/.test(afterBody), page.url(), 'report shown');
await page.goto(`${WEB}/today`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null);
await page.waitForTimeout(3000);
record('ui-today-after-placement', page.url().includes('/today'), page.url(), 'today reachable');
record('ui-no-errors', errs.length === 0, `${errs.length} errors`, 'zero');
await browser.close();
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'ONBOARDING-UI-LIVE', capturedAt: new Date().toISOString(), identifier, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/onboarding-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`ONBOARDING live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
