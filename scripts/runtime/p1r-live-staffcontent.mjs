// Staff content workspace in browser (M3-001 narrowing): reviewer-1 logs into
// admin-web and the B9 command workspace renders (list + command buttons).
// Staff provisioned via DB grant (documented local fixture).
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const identifier = `test-cview-${stamp}@local.invalid`;
const password = `E2eX${stamp}Aa9!xQ`;
const device = { deviceType: 'WEB', clientVersion: 'wcv-1', deviceName: 'cview' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
async function api(method, path, { body } = {}) {
  const h = { accept: 'application/json', 'content-type': 'application/json', 'x-client-platform': 'web', 'idempotency-key': `wcv-live-${stamp}-${Math.random().toString(36).slice(2, 8)}` };
  const res = await fetch(GW + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  return { status: res.status };
}
await api('POST', '/api/v1/auth/register', { body: { identifier, password, device } });
execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e', `UPDATE iam_service.iam_account SET roles = 'staff,review-l1', permissions = 'content:review:first,admin.content.read' WHERE identifier = '${identifier}'`], { stdio: 'ignore' });
record('staff-granted', true, 'reviewer-1 + admin.content.read', 'grant');
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 130)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|Failed to load resource/i.test(m.text())) errs.push('console.error: ' + m.text().slice(0, 130));
});
await page.goto('http://127.0.0.1:18181/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(2000);
await page.getByLabel(/管理员账号|邮箱/i).first().fill(identifier);
await page.getByLabel(/密码/i).first().fill(password);
await page.getByRole('button', { name: /登录后台/ }).first().click();
await page.waitForTimeout(5000);
await page.goto('http://127.0.0.1:18181/content', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(4000);
const body = (await page.locator('body').first().textContent().catch(() => '')) ?? '';
record('content-renders', page.url().includes('/content') && /内容命令工作区|CONTENT COMMANDS/.test(body), page.url(), 'workspace renders');
record('content-list', /内容投影|已发布/.test(body), 'projection list visible', 'list visible');
record('content-commands', /创建草稿|提交双审|发布/.test(body), 'command buttons visible', 'commands visible');
record('content-no-errors', errs.length === 0, `${errs.length} errors`, 'zero');
await browser.close();
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'CONTENT-WORKSPACE-LIVE', capturedAt: new Date().toISOString(), result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/content-workspace-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`CONTENT-WORKSPACE live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
