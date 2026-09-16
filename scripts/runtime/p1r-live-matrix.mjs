// Four-end browser matrix (local web only): render + console-error + a11y snapshot,
// plus one REAL UI login flow on learner-web against the live stack.
import { chromium } from 'playwright';
import fs from 'node:fs';

const results = [];
async function visit(id, url, { loginFlow = null, waitMs = 2500 } = {}) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 160)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_CONNECTION_REFUSED|Failed to load resource|favicon/i.test(m.text())) {
      errors.push('console.error: ' + m.text().slice(0, 160));
    }
  });
  const out = { id, url, status: -1, title: '', errors, a11y: '', flow: null };
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    out.status = resp ? resp.status() : -1;
    await page.waitForTimeout(waitMs);
    out.title = await page.title();
    try {
      out.a11y = (await page.locator('main, body').first().ariaSnapshot()).slice(0, 1200);
    } catch { out.a11y = '(no snapshot)'; }
    if (loginFlow) {
      const f = { steps: [] };
      try {
        await page.getByLabel(/用户|账号|手机|邮箱|username/i).first().fill(loginFlow.identifier);
        await page.getByLabel(/密码|password/i).first().fill(loginFlow.password);
        f.steps.push('filled');
        await page.getByRole('button', { name: /登录|登入|login/i }).first().click();
        await page.waitForTimeout(4000);
        f.afterUrl = page.url();
        f.afterTitle = await page.title();
        try {
          f.homeA11y = (await page.locator('main, body').first().ariaSnapshot()).slice(0, 900);
        } catch { f.homeA11y = '(no snapshot)'; }
        const ok = !/login/i.test(f.afterUrl) || (await page.content()).length > 30000;
        f.loggedIn = ok;
        out.flow = f;
      } catch (e) {
        out.flow = { error: String(e).slice(0, 200) };
      }
    }
  } catch (e) {
    errors.push('goto-fail: ' + String(e).slice(0, 200));
  }
  results.push(out);
  console.log(`${out.status === 200 ? 'ok  ' : 'FAIL'} ${id} :: HTTP ${out.status} title="${out.title}" errors=${errors.length}${out.flow ? ' flow=' + JSON.stringify(out.flow).slice(0, 160) : ''}`);
  await browser.close();
}

// Seed a UI-login user via API first (adult gate + consents so post-login pages work).
const stamp = Date.now().toString(36);
const identifier = `wui-${stamp}@local.invalid`;
const password = `E2eUi${stamp}Aa9!xQ`;
const device = { deviceType: 'WEB', clientVersion: 'w4matrix-1', deviceName: 'matrix' };
async function api(method, path, { token, body, idem } = {}) {
  const headers = { accept: 'application/json', 'x-client-platform': 'web' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (idem) headers['idempotency-key'] = idem;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch('http://127.0.0.1:18070' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  return { status: res.status, json: await res.json().catch(() => null) };
}
let r = await api('POST', '/api/v1/auth/register', { body: { identifier, password, device }, idem: `wui-${stamp}-reg-01` });
let token = r.json?.data?.accessToken ?? null;
await api('POST', '/api/v1/iam/adult-gate', { token, body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' }, idem: `wui-${stamp}-gate-01` });
for (const t of ['TERMS', 'PRIVACY', 'ADULT_LEARNING']) {
  await api('PUT', '/api/v1/iam/consents', { token, body: { type: t, version: 'b30-consent-v1', decision: 'ACCEPTED' }, idem: `wui-${stamp}-c-${t}` });
}
console.log('ui-user ready:', identifier);

await visit('official-home', 'http://127.0.0.1:18192/');
await visit('learner-home', 'http://127.0.0.1:18180/');
await visit('learner-login-flow', 'http://127.0.0.1:18180/login', { loginFlow: { identifier, password } });
await visit('learner-today', 'http://127.0.0.1:18180/today');
await visit('admin-login', 'http://127.0.0.1:18181/login');
await visit('mobile-h5-login', 'http://127.0.0.1:18183/#/pages/login/login', { waitMs: 8000 });
await visit('mobile-h5-home', 'http://127.0.0.1:18183/#/pages/home/home', { waitMs: 8000 });

const fails = results.filter((x) => x.status !== 200 || x.errors.length > 0);
fs.writeFileSync('evidence/live/2026-09-16/browser-matrix.json', JSON.stringify({ capturedAt: new Date().toISOString(), results }, null, 2) + '\n');
console.log(`MATRIX: ${results.length - fails.length}/${results.length} clean`);
process.exit(0);
