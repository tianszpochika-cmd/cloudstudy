const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] });
  const results = [];
  try {
    for (const width of [390, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 800 }, ignoreHTTPSErrors: true,
      });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(String(error.message)));
      const response = await page.goto('https://admin.clyunedev.com/login', { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200);
      const switcher = page.locator('.admin-locale-button');
      await switcher.waitFor();
      await switcher.click();
      await page.getByText('English', { exact: true }).click();
      assert.match(await switcher.innerText(), /en-US/);
      await switcher.click();
      await page.getByText('Chinese', { exact: true }).click();
      assert.match(await switcher.innerText(), /zh-CN/);
      const layout = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        buttonWidth: document.querySelector('.admin-locale-button').getBoundingClientRect().width,
      }));
      assert(layout.scrollWidth <= layout.viewportWidth);
      assert(layout.buttonWidth >= 72);
      assert.deepEqual(pageErrors, []);
      results.push({ width, status: response.status(), localeRoundTrip: true, pageErrors, layout });
      await context.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync('/out/admin-locale-interaction.json', JSON.stringify({ results }, null, 2) + '\n');
  console.log(JSON.stringify({ checked: results.length, passed: results.length }));
})().catch(error => { console.error(String(error.message)); process.exitCode = 1; });
