import { chromium } from 'playwright';

const targets = [
  ['official-home', 'http://127.0.0.1:18192/'],
  ['learner-home', 'http://127.0.0.1:18180/'],
  ['learner-login', 'http://127.0.0.1:18180/login'],
];
const results = [];
for (const [id, url] of targets) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 200)); });
  let status = -1, title = '', bytes = 0;
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    status = resp ? resp.status() : -1;
    title = await page.title();
    bytes = (await page.content()).length;
    await page.waitForTimeout(1500);
  } catch (e) {
    errors.push('goto-fail: ' + String(e).slice(0, 300));
  }
  results.push({ id, url, status, title, bytes, errors });
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
const fail = results.filter((r) => r.status !== 200 || r.errors.length > 0);
console.log(fail.length === 0 ? 'SMOKE PASS' : 'SMOKE ISSUES: ' + fail.length);
process.exit(fail.length === 0 ? 0 : 1);
