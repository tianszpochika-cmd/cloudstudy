// Editor browser run (M3-001): staff-editor creates a draft via the admin UI
// (ready), submits invalid JSON (client error toast), then a duplicate code
// (409 -> recovery panel). Staff provisioned via DB grant (local fixture).
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const stamp = Date.now().toString(36);
const identifier = `test-ced-${stamp}@local.invalid`;
const password = `E2eX${stamp}Aa9!xQ`;
const device = { deviceType: 'WEB', clientVersion: 'wed-1', deviceName: 'editor' };
const CODE = `wct-ui-${stamp}`;
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
async function api(method, path, { body } = {}) {
  const h = { accept: 'application/json', 'content-type': 'application/json', 'x-client-platform': 'web', 'idempotency-key': `wed-live-${stamp}-${Math.random().toString(36).slice(2, 8)}` };
  const res = await fetch(GW + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  return { status: res.status };
}
await api('POST', '/api/v1/auth/register', { body: { identifier, password, device } });
execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e', `UPDATE iam_service.iam_account SET roles = 'staff,content-editor', permissions = 'content:write,admin.content.read,admin.content.write' WHERE identifier = '${identifier}'`], { stdio: 'ignore' });
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 130)));
await page.goto('http://127.0.0.1:18181/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(2000);
await page.getByLabel(/管理员账号|邮箱/i).first().fill(identifier);
await page.getByLabel(/密码/i).first().fill(password);
await page.getByRole('button', { name: /登录后台/ }).first().click();
await page.waitForTimeout(5000);
await page.goto('http://127.0.0.1:18181/content', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(4000);
// valid create.
await page.getByLabel(/内容编码/).first().fill(CODE);
await page.getByLabel(/标题/).first().fill('ui editor probe');
await page.getByLabel(/内容 hash/).first().fill('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
await page.getByLabel(/来源编码/).first().fill('LOCAL_UI_PROBE');
await page.getByLabel(/版权编码/).first().fill('LOCAL_UI_LICENSE');
await page.getByLabel(/内容 payload/).first().fill('{"summary":"ui probe"}');
await page.getByRole('button', { name: /创建草稿命令/ }).first().click();
await page.waitForTimeout(5000);
let body = (await page.locator('body').first().textContent().catch(() => '')) ?? '';
record('editor-create', body.includes(CODE), 'draft listed', 'code visible');
// invalid JSON -> client error toast, no crash.
await page.getByLabel(/内容编码/).first().fill(`${CODE}-bad`);
await page.getByLabel(/标题/).first().fill('bad json probe');
await page.getByLabel(/内容 hash/).first().fill('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
await page.getByLabel(/来源编码/).first().fill('LOCAL_UI_PROBE');
await page.getByLabel(/版权编码/).first().fill('LOCAL_UI_LICENSE');
await page.getByLabel(/内容 payload/).first().fill('{not-json');
await page.getByRole('button', { name: /创建草稿命令/ }).first().click();
await page.waitForTimeout(2500);
body = (await page.locator('body').first().textContent().catch(() => '')) ?? '';
record('editor-bad-json', /不是有效 JSON|请填写/.test(body), 'client validation message', 'validation shown');
// duplicate code -> 409 recovery panel.
await page.getByLabel(/内容编码/).first().fill(CODE);
await page.getByLabel(/标题/).first().fill('dupe probe');
await page.getByLabel(/内容 hash/).first().fill('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
await page.getByLabel(/来源编码/).first().fill('LOCAL_UI_PROBE');
await page.getByLabel(/版权编码/).first().fill('LOCAL_UI_LICENSE');
await page.getByLabel(/内容 payload/).first().fill('{"summary":"dupe"}');
await page.getByRole('button', { name: /创建草稿命令/ }).first().click();
await page.waitForTimeout(5000);
body = (await page.locator('body').first().textContent().catch(() => '')) ?? '';
record('editor-duplicate', /内容操作需要恢复|版本冲突已保留/.test(body), 'recovery panel', 'recovery shown');
// auditor run: separate staff, /audit renders redacted rows.
const aid = `test-caud-${stamp}@local.invalid`;
await api('POST', '/api/v1/auth/register', { body: { identifier: aid, password, device } });
execFileSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1', 'mysql', '-uroot', '-N', '-e', `UPDATE iam_service.iam_account SET roles = 'staff,auditor', permissions = 'audit.export,admin.audit.read' WHERE identifier = '${aid}'`], { stdio: 'ignore' });
const actx = await browser.newContext();
const apage = await actx.newPage();
apage.on('pageerror', (e) => errs.push('audit: ' + String(e).slice(0, 100)));
await apage.goto('http://127.0.0.1:18181/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
await apage.waitForTimeout(2000);
await apage.getByLabel(/管理员账号|邮箱/i).first().fill(aid);
await apage.getByLabel(/密码/i).first().fill(password);
await apage.getByRole('button', { name: /登录后台/ }).first().click();
await apage.waitForTimeout(5000);
await apage.goto('http://127.0.0.1:18181/audit', { waitUntil: 'domcontentloaded', timeout: 45000 });
await apage.waitForTimeout(4000);
const abody = (await apage.locator('body').first().textContent().catch(() => '')) ?? '';
record('auditor-renders', apage.url().includes('/audit') && /审计|AUDIT/.test(abody), apage.url(), 'audit renders');
record('auditor-rows', /脱敏|已创建|动作/.test(abody), 'rows or headers visible', 'audit content');
await actx.close();
record('editor-no-errors', errs.length === 0, `${errs.length} pageerrors`, 'zero');
await browser.close();
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'EDITOR-UI-LIVE', capturedAt: new Date().toISOString(), contentCode: CODE, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/editor-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`EDITOR live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
