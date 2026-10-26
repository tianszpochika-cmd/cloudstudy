const { chromium } = require("playwright");
const out = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/tc11/menu-probe-11";
require("node:fs").mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
      const label = viewport.width + "x" + viewport.height;
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      for (const route of ["/download", "/minors"]) {
        await page.goto("http://127.0.0.1:18182" + route, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 });
        await page.waitForTimeout(2500);
        const headerEntries = await page.locator("header [data-learning-entry]").evaluateAll((els) => els.map((e) => ({ target: e.getAttribute("data-learning-entry"), visible: e.offsetParent !== null, cls: e.className.slice(0, 60) })));
        const toggle = page.locator("header button.menu-toggle, header [aria-label*='菜单'], header [aria-label*='导航']").first();
        const toggleCount = await page.locator("header button.menu-toggle, header [aria-label*='菜单'], header [aria-label*='导航']").count();
        const dialogCount = await page.locator("dialog, [role='dialog'], .mobile-nav-links").count();
        console.log(label + " " + route + " headerEntries=" + JSON.stringify(headerEntries));
        console.log(label + " " + route + " toggleCount=" + toggleCount + " dialogCount=" + dialogCount);
        if (toggleCount > 0) {
          await toggle.click().catch((e) => console.log("toggle-click-fail:" + e.message.slice(0, 200)));
          await page.waitForTimeout(1500);
          const afterDialog = await page.locator("dialog, [role='dialog'], .mobile-nav-links").count();
          const menuEntries = await page.locator("dialog [data-learning-entry], [role='dialog'] [data-learning-entry], .mobile-nav-links [data-learning-entry], .mobile-nav-bottom [data-learning-entry]").evaluateAll((els) => els.map((e) => ({ target: e.getAttribute("data-learning-entry"), visible: e.offsetParent !== null, href: (e.getAttribute("href") || "").slice(0, 80) }))).catch(() => "ERR");
          console.log(label + " " + route + " afterDialog=" + afterDialog + " menuEntries=" + JSON.stringify(menuEntries));
          await page.screenshot({ path: out + `/menu-${label.replace("x", "_")}-${route.replace("/", "")}.png` }).catch(() => {});
        }
      }
      await context.close();
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error("FAIL:" + (e.stack || e.message)); process.exit(1); });
