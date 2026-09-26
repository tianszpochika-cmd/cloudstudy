const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
  for (const route of ['login', 'register']) {
    await page.goto(`https://mobile.clyunedev.com/#/pages/${route}/${route}?uiLocale=en-US&theme=dark`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const inputs = await page.locator('input').evaluateAll(nodes => nodes.map(node => ({
      outerHTML: node.outerHTML.slice(0, 450), placeholder: node.getAttribute('placeholder'),
      autocomplete: node.getAttribute('autocomplete'), ariaLabel: node.getAttribute('aria-label'),
    })));
    console.log(JSON.stringify({ route, inputs }));
  }
  await browser.close();
})().catch(error => { console.error(String(error.message).slice(0, 200)); process.exitCode = 1; });
