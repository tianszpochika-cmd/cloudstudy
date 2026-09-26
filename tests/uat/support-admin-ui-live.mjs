// Local-only browser acceptance. JWT and synthetic credentials stay in memory.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const gateway = 'http://127.0.0.1:18070';
const adminWeb = 'http://127.0.0.1:18181';
const nonce = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
const identifier = `uat-support-ui-${nonce}@local.invalid`;
const password = `Uat!${randomBytes(20).toString('base64url')}a9`;
const device = { deviceType: 'WEB', clientVersion: 'uat-support-ui', deviceName: 'local-uat' };
const output = 'artifacts/uat-2026-09-23/screenshots/admin-support';
const evidence = { capturedAt: new Date().toISOString(), statuses: {}, browser: {}, cleanup: null };
let principalId;
let registered = false;
let browser;
let requestNo = 0;

function mysql(sql) {
  return execFileSync('docker', ['exec', '-i', 'yuxuexing-local-mysql-1', 'sh', '-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N -B'],
  { input: `${sql.trim()}\n`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function exactIdentifier() {
  if (!/^uat-support-ui-[a-z0-9-]+@local\.invalid$/.test(identifier)) throw new Error('synthetic identifier guard failed');
  return identifier;
}
function exactPrincipal() {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(principalId ?? '')) throw new Error('synthetic principal guard failed');
  return principalId;
}
async function call(method, route, { token, body } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    headers['idempotency-key'] = `uat-support-ui-${nonce}-${++requestNo}`;
  }
  const response = await fetch(gateway + route, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual',
  });
  return { status: response.status, json: await response.json().catch(() => null) };
}
function setupAccount() {
  const rows = mysql(`SELECT principal_id FROM iam_service.iam_account
    WHERE identifier='${exactIdentifier()}' AND status='ACTIVE';`).split(/\r?\n/).filter(Boolean);
  if (rows.length !== 1) throw new Error('synthetic account lookup not unique');
  principalId = rows[0];
  const result = mysql(`UPDATE iam_service.iam_account
    SET roles='staff', permissions=TRIM(BOTH ',' FROM CONCAT_WS(',', NULLIF(permissions,''),
      'support.ticket.read', 'admin.support.read'))
    WHERE identifier='${exactIdentifier()}' AND principal_id='${exactPrincipal()}' AND status='ACTIVE';
    SELECT ROW_COUNT();`).trim();
  if (result !== '1') throw new Error('synthetic read grant not exact');
}
function cleanup() {
  const rows = mysql(`START TRANSACTION;
    UPDATE iam_service.iam_session s JOIN iam_service.iam_account a ON a.principal_id=s.principal_id
       SET s.status='REVOKED', s.revoked_at=UTC_TIMESTAMP(6), s.revoke_reason='LOCAL_UAT_CLEANUP'
     WHERE a.identifier='${exactIdentifier()}' AND a.principal_id='${exactPrincipal()}'
       AND s.status='ACTIVE';
    UPDATE iam_service.iam_account SET status='DISABLED', roles='', permissions=''
     WHERE identifier='${exactIdentifier()}' AND principal_id='${exactPrincipal()}' AND status='ACTIVE';
    SELECT ROW_COUNT();
    SELECT COUNT(*) FROM iam_service.iam_session s JOIN iam_service.iam_account a
      ON a.principal_id=s.principal_id WHERE a.identifier='${exactIdentifier()}' AND s.status='ACTIVE';
    COMMIT;`).split(/\r?\n/).filter(Boolean);
  if (rows.length !== 2 || rows[0] !== '1' || rows[1] !== '0') throw new Error('synthetic account cleanup failed');
  return { disabledAccounts: 1, activeSessions: 0 };
}
function ownerCounts() {
  return Object.fromEntries(mysql(`SELECT tenant_id, COUNT(*) FROM admin_ops_service.support_ticket
    WHERE tenant_id IN ('platform','local-support-fixture') GROUP BY tenant_id;`)
    .split(/\r?\n/).filter(Boolean).map((row) => {
      const [tenant, count] = row.split('\t');
      return [tenant, Number(count)];
    }));
}

async function snapshot(page, name) {
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
  return page.evaluate(() => ({
    viewport: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    tableRows: document.querySelectorAll('.el-table__body tr').length,
    alertTitles: [...document.querySelectorAll('.el-alert__title')].filter((el) => el.getClientRects().length > 0).map((el) => el.textContent?.trim()).filter(Boolean),
    emptyVisible: [...document.querySelectorAll('.el-empty')].some((el) => el.getClientRects().length > 0),
    detailActions: [...document.querySelectorAll('button[aria-label]')].filter((el) => /查看详情/.test(el.getAttribute('aria-label') ?? '')).length,
  }));
}

async function openAndCaptureDetail(page, name) {
  const response = page.waitForResponse((r) => /\/api\/v1\/admin\/ops\/tickets\/[^?]+$/.test(r.url()));
  await page.getByRole('button', { name: /查看详情/ }).first().click();
  const detailResponse = await response;
  await page.getByText('此历史工单仅保存脱敏元数据，问题内容不可查看。').waitFor({ timeout: 10000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${output}/${name}.png` });
  const result = {
    http: detailResponse.status(),
    dialogVisible: await page.getByRole('dialog', { name: '工单详情' }).isVisible(),
    fieldCount: await page.locator('.support-detail dt').count(),
    documentWidth: await page.evaluate(() => document.documentElement.scrollWidth),
    dialogRect: await page.getByRole('dialog', { name: '工单详情' }).evaluate((el) => {
      const { x, y, width, height } = el.getBoundingClientRect();
      return { x, y, width, height };
    }),
    panelRect: await page.locator('.el-dialog').evaluate((el) => {
      const { x, y, width, height } = el.getBoundingClientRect();
      return { x, y, width, height, opacity: getComputedStyle(el).opacity };
    }),
  };
  await page.locator('.el-dialog__headerbtn').click();
  await page.getByRole('dialog', { name: '工单详情' }).waitFor({ state: 'hidden' });
  assert.equal(result.http, 200);
  assert.equal(result.fieldCount, 6);
  assert.equal(result.dialogVisible, true);
  assert.ok(result.panelRect.x >= 0 && result.panelRect.x + result.panelRect.width <= page.viewportSize().width);
  return result;
}

try {
  mkdirSync(output, { recursive: true });
  evidence.ownerBefore = ownerCounts();
  const registration = await call('POST', '/api/v1/auth/register', { body: { identifier, password, device } });
  evidence.statuses.register = registration.status;
  registered = registration.status === 201;
  if (!registered || !registration.json?.data?.accessToken) throw new Error(`register HTTP ${registration.status}`);
  setupAccount();
  const initialToken = registration.json.data.accessToken;
  const gate = await call('POST', '/api/v1/iam/adult-gate', {
    token: initialToken, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' },
  });
  evidence.statuses.adultGate = gate.status;
  if (gate.status !== 200) throw new Error(`adult Gate HTTP ${gate.status}`);
  for (const type of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    const consent = await call('PUT', '/api/v1/iam/consents', {
      token: initialToken, body: { type, version: 'b30-consent-v1', decision: 'ACCEPTED' },
    });
    evidence.statuses[`consent${type}`] = consent.status;
    if (consent.status !== 200) throw new Error(`${type} consent HTTP ${consent.status}`);
  }

  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.name));
  await page.goto(`${adminWeb}/login?redirect=%2Fsupport`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: /账号|账户|邮箱|用户名/ }).first().fill(identifier);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/support', { timeout: 20000 });
  await page.getByText('历史工单仅供查看，处理功能暂不可用。').waitFor({ timeout: 15000 });
  await page.locator('.el-table__body tr').first().waitFor({ timeout: 15000 });
  evidence.browser.desktop = await snapshot(page, 'list-1440');
  assert.equal(evidence.browser.desktop.tableRows, 10);
  evidence.browser.desktopDetail = await openAndCaptureDetail(page, 'detail-1440');
  for (const [name, width, height] of [['tablet', 768, 1024], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    evidence.browser[name] = await snapshot(page, `list-${width}`);
    assert.equal(evidence.browser[name].documentWidth, width);
    evidence.browser[`${name}Detail`] = await openAndCaptureDetail(page, `detail-${width}`);
  }
  await page.locator('.el-pager li').filter({ hasText: '3' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.el-table__body tr').length === 7);
  evidence.browser.pageThree = {
    rows: await page.locator('.el-table__body tr').count(),
    currentPage: await page.locator('.el-pager li.is-active').textContent(),
  };
  assert.equal(evidence.browser.pageThree.rows, 7);
  await page.locator('.list-toolbar input').fill('学习数据');
  await page.waitForFunction(() => document.querySelectorAll('.el-table__body tr').length === 10);
  evidence.browser.localizedFilter = {
    rows: await page.locator('.el-table__body tr').count(),
    categoryMatched: (await page.locator('.el-table__body tr').allInnerTexts()).every((text) => text.includes('学习数据')),
    pageReset: await page.locator('.el-pagination').count() === 0,
  };
  assert.equal(evidence.browser.localizedFilter.categoryMatched, true);
  assert.equal(evidence.browser.localizedFilter.pageReset, true);
  await page.evaluate(() => { window.scrollTo(0, 0); document.activeElement?.blur(); });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${output}/filter-390.png`, fullPage: true });
  await page.locator('.list-toolbar input').fill('不存在的分类');
  await page.getByText('没有匹配的工单').waitFor({ timeout: 10000 });
  evidence.browser.noMatches = { emptyVisible: await page.locator('.el-empty').isVisible() };
  assert.equal(evidence.browser.noMatches.emptyVisible, true);
  await page.evaluate(() => { window.scrollTo(0, 0); document.activeElement?.blur(); });
  await page.screenshot({ path: `${output}/no-matches-390.png`, fullPage: true });
  await page.locator('.list-toolbar input').fill('');
  await page.route(/\/api\/v1\/admin\/ops\/tickets\/[^?]+$/, (route) => route.fulfill({
    status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'UAT_CONTROLLED_404' } }),
  }));
  await page.getByRole('button', { name: /查看详情/ }).first().click();
  await page.getByText('详情暂时不可用，请返回列表重试。').waitFor({ timeout: 10000 });
  await page.waitForTimeout(400);
  evidence.browser.detail404 = {
    alertVisible: await page.getByRole('dialog', { name: '工单详情' }).getByRole('alert').isVisible(),
  };
  await page.screenshot({ path: `${output}/detail-404-controlled.png` });
  await page.locator('.el-dialog__headerbtn').click();
  await page.unroute(/\/api\/v1\/admin\/ops\/tickets\/[^?]+$/);
  // Controlled UI states use network interception; owner data stays untouched.
  await page.route(/\/api\/v1\/admin\/ops\/tickets\?/, (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: [] } }),
  }));
  await page.getByRole('button', { name: '刷新' }).click();
  await page.locator('.el-empty').waitFor({ timeout: 10000 });
  evidence.browser.empty390 = await snapshot(page, 'empty-390-controlled');
  await page.unroute(/\/api\/v1\/admin\/ops\/tickets\?/);
  await page.route(/\/api\/v1\/admin\/ops\/tickets\?/, (route) => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'UAT_CONTROLLED_503' } }),
  }));
  await page.getByRole('button', { name: '刷新' }).click();
  await page.getByText('客服工单暂时不可用，请刷新重试。').waitFor({ timeout: 10000 });
  evidence.browser.error390 = await snapshot(page, 'error-390-controlled');
  assert.equal(evidence.browser.error390.tableRows, 0);
  await page.unroute(/\/api\/v1\/admin\/ops\/tickets\?/);
  evidence.browser.pageErrors = pageErrors;
  assert.equal(pageErrors.length, 0);
  evidence.ownerAfter = ownerCounts();
  assert.deepEqual(evidence.ownerAfter, evidence.ownerBefore);
  await context.close();
} catch (error) {
  evidence.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (registered) {
    try { evidence.cleanup = cleanup(); }
    catch (error) {
      evidence.cleanup = { failed: error instanceof Error ? error.message : String(error) };
      process.exitCode = 1;
    }
  }
  evidence.result = process.exitCode ? 'FAIL' : 'PASS';
  writeFileSync('artifacts/uat-2026-09-23/support-admin-ui-live.json', `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence));
}
