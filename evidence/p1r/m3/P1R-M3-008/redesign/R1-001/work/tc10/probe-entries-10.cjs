const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  for (const route of ["/", "/courses", "/download", "/minors"]) {
    await page.goto("http://127.0.0.1:18182" + route, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
    const entries = await page.locator("[data-learning-entry]").evaluateAll((els) => els.map((e) => ({ href: (e.getAttribute("href") || "").slice(0, 80), target: e.getAttribute("data-learning-entry"), visible: e.offsetParent !== null, cls: e.className, tag: e.tagName })));
    console.log(route + " entries=" + JSON.stringify(entries));
  }
  await browser.close();
})().catch((e) => { console.error("FAIL:" + e.message); process.exit(1); });
