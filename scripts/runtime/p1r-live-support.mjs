// Support live: attachment/size negatives (API) + SLA browser proofs (UI create,
// list SLA, detail due date) + cross-user browser isolation (B sees empty).
import { chromium } from 'playwright';
import fs from 'node:fs';

const GW = 'http://127.0.0.1:18070';
const WEB = 'http://127.0.0.1:18180';
const stamp = Date.now().toString(36);
const mkuser = (tag) => `wsp-${tag}-${stamp}@local.invalid`;
const password = (tag) => `E2eLive${stamp}Aa9!xQ-${tag}`;
const device = { deviceType: 'WEB', clientVersion: 'wsp-1', deviceName: 'support' };
const checks = [];
const record = (name, ok, observed, expected) => {
  checks.push({ name, ok: !!ok, observed, expected });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} :: ${observed}`);
};
let idemN = 0;
const idem = (s) => `wsp-live-${stamp}-${++idemN}-${s}`.slice(0, 60);
async function api(method, path, { token, body, idemKey } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web', origin: WEB };
  if (token) headers.authorization = `Bearer ${token}`;
  if (idemKey) headers['idempotency-key'] = idemKey;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(GW + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  return { status: res.status, json: await res.json().catch(() => null) };
}
async function setup(tag) {
  const identifier = mkuser(tag);
  let r = await api('POST', '/api/v1/auth/register', { body: { identifier, password: password(tag), device }, idemKey: idem(`${tag}-reg`) });
  const t0 = r.json?.data?.accessToken ?? null;
  await api('POST', '/api/v1/iam/adult-gate', { token: t0, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idemKey: idem(`${tag}-gate`) });
  for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
    await api('PUT', '/api/v1/iam/consents', { token: t0, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idemKey: idem(`${tag}-c-${t}`) });
  }
  r = await api('POST', '/api/v1/auth/login', { body: { identifier, password: password(tag), device }, idemKey: idem(`${tag}-login`) });
  return { identifier, password: password(tag), token: r.json?.data?.accessToken ?? null };
}
const A = await setup('a');
const B = await setup('b');
record('setup', !!A.token && !!B.token, 'A+B ready', 'tokens');
// attachment-limit + size negatives (API).
const FP = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const ref = (i) => ({ objectRef: `media/ref-${i}`, objectVersion: 'v1', purposeCode: 'SUPPORT', contentType: 'image/png', sizeBytes: 1024 });
let r = await api('POST', '/api/v1/support/tickets', { token: A.token, body: { categoryCode: 'TECHNICAL', resourceRef: 'wsp', descriptionFingerprint: FP, priority: 'NORMAL', attachments: [ref(1), ref(2), ref(3), ref(4), ref(5), ref(6)] }, idemKey: idem('limit') });
record('attach-limit', r.status === 400 && JSON.stringify(r.json).includes('SUPPORT_ATTACHMENT_LIMIT'), `HTTP ${r.status}`, 'HTTP 400 LIMIT');
r = await api('POST', '/api/v1/support/tickets', { token: A.token, body: { categoryCode: 'TECHNICAL', resourceRef: 'wsp', descriptionFingerprint: FP, priority: 'NORMAL', attachments: [{ ...ref(1), sizeBytes: 60 * 1024 * 1024 }] }, idemKey: idem('oversize') });
record('attach-size', r.status === 400 && JSON.stringify(r.json).includes('SUPPORT_MEDIA_SIZE_INVALID'), `HTTP ${r.status}`, 'HTTP 400 SIZE');
// Browser: A sees empty -> creates via UI -> list shows SLA -> detail shows due date.
const browser = await chromium.launch();
async function loginAs(identifier, pwd) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2000);
  await page.getByLabel(/账号|邮箱/i).first().fill(identifier);
  await page.getByLabel(/密码/i).first().fill(pwd);
  await page.getByRole('button', { name: /登录/i }).first().click();
  await page.waitForTimeout(4000);
  return { ctx, page, errs };
}
const a = await loginAs(A.identifier, A.password);
await a.page.goto(`${WEB}/support`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await a.page.waitForTimeout(3000);
let bodyA = (await a.page.locator('body').first().textContent().catch(() => '')) ?? '';
record('support-empty', bodyA.includes('暂无可见工单'), 'empty state', 'empty for fresh user');
await a.page.getByLabel(/问题描述/).first().fill('live probe ticket body stays local');
await a.page.getByLabel(/关联引用/).first().fill('wsp-probe-ref-01');
await a.page.getByRole('button', { name: /提交工单/ }).first().click();
await a.page.waitForTimeout(4000);
bodyA = (await a.page.locator('body').first().textContent().catch(() => '')) ?? '';
record('support-create-sla', /SLA\s+\S+/.test(bodyA) && !bodyA.includes('暂无可见工单'), 'list shows SLA', 'SLA visible');
const ticketBtn = a.page.locator('section[aria-label="我的工单"] button').first();
if ((await ticketBtn.count()) > 0) {
  await ticketBtn.click();
  await a.page.waitForTimeout(2500);
  const detail = (await a.page.locator('body').first().textContent().catch(() => '')) ?? '';
  record('support-detail-sla', /slaDueAt|SLA/i.test(detail) && /\d{4}-\d{2}-\d{2}/.test(detail), 'due date shown', 'SLA due date');
} else {
  record('support-detail-sla', false, 'no ticket button', 'SLA due date');
}
// Browser: B sees empty (isolation).
const b = await loginAs(B.identifier, B.password);
await b.page.goto(`${WEB}/support`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await b.page.waitForTimeout(3000);
const bodyB = (await b.page.locator('body').first().textContent().catch(() => '')) ?? '';
record('support-cross-user-empty', bodyB.includes('暂无可见工单'), 'B sees empty', 'isolation in browser');
const allErrs = [...a.errs, ...b.errs];
record('support-no-pageerrors', allErrs.length === 0, `${allErrs.length} pageerrors`, 'zero');
await browser.close();
const passed = checks.filter((c) => c.ok).length;
const evidence = { task: 'SUPPORT-LIVE', capturedAt: new Date().toISOString(), result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length, checks };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/support-live-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`SUPPORT live: ${passed}/${checks.length} ${evidence.result}`);
process.exit(evidence.result === 'PASS' ? 0 : 1);
