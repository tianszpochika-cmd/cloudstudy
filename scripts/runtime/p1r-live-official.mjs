// Official-site public sweep (local web only, logged OUT): every public route at
// desktop + phone viewports. No token anywhere: status/title/errors + a11y
// headline + proof that no business session leaks (no Authorization header
// can exist without a login; record Set-Cookie absence on business names).
import { chromium } from 'playwright';
import fs from 'node:fs';

const WEB = 'http://127.0.0.1:18192';
const ROUTES = ['/', '/about', '/announcements', '/compliance', '/download', '/pricing', '/privacy', '/terms', '/minors', '/status'];
const VIEWPORTS = [{ width: 1440, height: 900 }, { width: 390, height: 844 }];
const rows = [];
const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: vp });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 130)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/i.test(m.text())) errors.push('console.error: ' + m.text().slice(0, 130));
  });
  for (const route of ROUTES) {
    const before = errors.length;
    let status = -1;
    let title = '';
    let headline = '';
    let businessCookie = false;
    try {
      const resp = await page.goto(WEB + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
      status = resp ? resp.status() : -1;
      await page.waitForTimeout(2000);
      title = await page.title();
      const h = page.locator('h1').first();
      if ((await h.count()) > 0) headline = ((await h.textContent()) ?? '').trim().slice(0, 60);
      const cookies = await context.cookies();
      businessCookie = cookies.some((c) => /refresh|session|token/i.test(c.name));
    } catch (e) {
      errors.push(`goto-fail ${route}: ` + String(e).slice(0, 100));
    }
    const fresh = errors.length - before;
    rows.push({ route, viewport: `${vp.width}x${vp.height}`, status, title, headline, businessCookie, newErrors: fresh });
    console.log(`  ${status === 200 && fresh === 0 && !businessCookie ? 'ok  ' : 'NOTE'} ${route} @${vp.width} :: HTTP ${status} "${headline}" cookie=${businessCookie} +${fresh}err`);
  }
  await context.close();
}
await browser.close();
const pageErrors = rows.flatMap(() => []);
const bad = rows.filter((x) => x.status !== 200 || x.newErrors > 0 || x.businessCookie);
const evidence = { task: 'OFFICIAL-LIVE-SWEEP', capturedAt: new Date().toISOString(), result: bad.length === 0 ? 'PASS' : 'FAIL', routes: rows.length, bad: bad.length, rows };
fs.mkdirSync('evidence/live/2026-09-16', { recursive: true });
fs.writeFileSync('evidence/live/2026-09-16/official-sweep.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`OFFICIAL: ${rows.length - bad.length}/${rows.length} clean`);
process.exit(0);
