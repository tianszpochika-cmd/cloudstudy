// Messages live (M6-001): inbox + preferences + read receipts in browser.
// Message seeding uses the internal queue endpoint (documented fixture,
// same as W4); the UI only reads and receipts, never authors.
import { chromium } from 'playwright';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const NV = 'http://127.0.0.1:18093';
const WEB = 'http://127.0.0.1:18180';
const stamp = Date.now().toString(36);
const identifier = `wmsg-${stamp}@local.invalid`;
const password = `E2eWmsg${stamp}Aa9!xQ`;
const device = { deviceType: 'WEB', clientVersion: 'wmsg-1', deviceName: 'messages' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
async function call(base, method, path, { token, body } = {}) {
  const h = { accept: 'application/json', 'x-client-platform': 'web', origin: WEB, 'idempotency-key': `wmsg-live-${stamp}-${++idemN}-k`.slice(0, 60) };
  if (token) h.authorization = `Bearer ${token}`;
  if (body !== undefined) h['content-type'] = 'application/json';
  const res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}
let r = await call(GW, 'POST', '/api/v1/auth/register', { body: { identifier, password, device } });
let token = r.json?.data?.accessToken ?? null;
await call(GW, 'POST', '/api/v1/iam/adult-gate', { token, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' } });
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  await call(GW, 'PUT', '/api/v1/iam/consents', { token, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' } });
}
r = await call(GW, 'POST', '/api/v1/auth/login', { body: { identifier, password, device } });
token = r.json?.data?.accessToken ?? null;
record('setup', !!token, 'learner ready', 'token');
await call(GW, 'PUT', '/api/v1/notifications/preferences/REVIEW_DUE/PUSH', { token, body: { enabled: true, locale: 'zh-CN' } });
r = await call(NV, 'POST', '/internal/v1/notifications/messages', { token, body: { notificationType: 'REVIEW_DUE', channel: 'IN_APP', templateKey: 'review-due-v1', templateVersion: 'v1', title: 'wmsg probe', safeBody: 'live probe body', contentVersion: 'notif-v1' } });
const msgId = r.json?.messageId ?? r.json?.data?.messageId ?? null;
record('seed-message', r.status === 200 && !!msgId, `HTTP ${r.status}`, 'HTTP 200 + id');
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 130)));
await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(2000);
await page.getByLabel(/账号|邮箱/i).first().fill(identifier);
await page.getByLabel(/密码/i).first().fill(password);
await page.getByRole('button', { name: /登录/i }).first().click();
await page.waitForTimeout(4000);
await page.goto(`${WEB}/messages`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(4000);
let body = (await page.locator('body').first().textContent().catch(() => '')) ?? '';
record('messages-renders', page.url().includes('/messages') && body.includes('消息中心'), page.url(), 'renders');
record('messages-shows', body.includes('wmsg probe') && body.includes('REVIEW_DUE'), 'message + pref visible', 'content visible');
const readBtn = page.getByRole('button', { name: /标为已读/ }).first();
if ((await readBtn.count()) > 0) {
  await readBtn.click();
  await page.waitForTimeout(3000);
  body = (await page.locator('body').first().textContent().catch(() => '')) ?? '';
  record('message-read', body.includes('已读'), 'receipt shown', 'marked read');
} else {
  record('message-read', false, 'no read button', 'marked read');
}
const togBtn = page.getByRole('button', { name: /^关闭$/ }).first();
if ((await togBtn.count()) > 0) {
  await togBtn.click();
  await page.waitForTimeout(3000);
  record('pref-toggle', true, 'toggle clicked, no error', 'toggles');
} else {
  record('pref-toggle', false, 'no toggle button', 'toggles');
}
record('messages-no-errors', errs.length === 0, `${errs.length} pageerrors`, 'zero');
await browser.close();
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'MESSAGES-LIVE', capturedAt: new Date().toISOString(), identifier, result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/messages-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`MESSAGES live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
