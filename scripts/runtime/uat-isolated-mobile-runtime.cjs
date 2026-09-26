// Read-only browser capability probe. Never reads storage values, cookies or credentials.
const fs = require('node:fs');
const { chromium } = require('playwright');

const routes = [
  { name: 'root', url: 'https://mobile.clyunedev.com/' },
  { name: 'login', url: 'https://mobile.clyunedev.com/#/pages/login/login' }
];

(async () => {
  const browser = await chromium.launch({ headless: true,
    args: ['--no-sandbox', '--ignore-certificate-errors'] });
  const results = [];
  try {
    for (const route of routes) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 },
        ignoreHTTPSErrors: true });
      const page = await context.newPage();
      let action = `load ${route.url}`;
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', (error) => pageErrors.push({ at: new Date().toISOString(), action,
        stack: String(error.stack || error.message).slice(0, 1600) }));
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push({ at: new Date().toISOString(), action,
          text: message.text().slice(0, 400) });
      });
      const response = await page.goto(route.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      action = `settle ${route.url} after DOMContentLoaded; no click`;
      await page.waitForTimeout(1800);
      const runtime = await page.evaluate(() => {
        const uni = window.uni;
        return {
          hash: window.location.hash,
          hasPlus: Boolean(window.plus),
          uniType: typeof uni,
          navigateTo: typeof uni?.navigateTo,
          reLaunch: typeof uni?.reLaunch,
          redirectTo: typeof uni?.redirectTo,
          switchTab: typeof uni?.switchTab,
          addInterceptor: typeof uni?.addInterceptor,
          getStorageSync: typeof uni?.getStorageSync,
          request: typeof uni?.request,
          showToast: typeof uni?.showToast,
          getSystemInfoSync: typeof uni?.getSystemInfoSync,
          setTabBarStyle: typeof uni?.setTabBarStyle,
          getLaunchOptionsSync: typeof uni?.getLaunchOptionsSync
        };
      });
      results.push({ name: route.name, requestedUrl: route.url,
        requestedHash: new URL(route.url).hash,
        status: response?.status() ?? 0, finalUrl: page.url(),
        runtime, pageErrors, consoleErrors });
      await context.close();
    }
  } finally {
    await browser.close();
  }
  const evidence = { at: new Date().toISOString(),
    mode: 'private HTTPS + containerized Chromium; read-only capability types',
    results };
  const batch = /^batch\d+$/u.test(process.env.UAT_MOBILE_BATCH || '')
    ? process.env.UAT_MOBILE_BATCH : 'batch10';
  fs.writeFileSync(`/out/mobile-runtime-types-${batch}.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(results.map((result) => ({ name: result.name,
    status: result.status, pageErrors: result.pageErrors.length,
    consoleErrors: result.consoleErrors.length, runtime: result.runtime }))));
})().catch((error) => {
  console.error(`Mobile runtime probe failed: ${String(error.message).slice(0, 180)}`);
  process.exitCode = 1;
});
