import { chromium } from 'playwright';
const WEB = 'http://127.0.0.1:18180';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
for (const route of ['login', 'register', 'reset-password']) {
  await page.goto(`${WEB}/${route}`, { waitUntil: 'domcontentloaded' }).catch(() => null);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `evidence/live/2026-09-16/ui-light-${route}.png` });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `evidence/live/2026-09-16/ui-dark-${route}.png` });
  console.log('shot', route);
}
console.log('pageerrors:', errors.length, errors.slice(0, 5));
await browser.close();
