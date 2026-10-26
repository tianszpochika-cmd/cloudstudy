const { chromium } = require("playwright");
const out = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/tc11/menu-probe3-11";
require("node:fs").mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:18182/download", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(2500);
    // 真实打开菜单：点击 header 内 aria-expanded=false 的 menu-toggle。
    const toggle = page.locator("header button.menu-toggle").first();
    console.log("toggle-visible=" + await toggle.isVisible().catch(() => "ERR"));
    await toggle.click({ timeout: 10000 });
    await page.waitForTimeout(2000);
    const dialogOpen = await page.locator("dialog.nav-dialog[open], dialog[open]").count();
    console.log("dialog-open-count=" + dialogOpen);
    const menuEntries = await page.locator(".mobile-nav-bottom [data-learning-entry], dialog[open] [data-learning-entry]").evaluateAll((els) => els.map((e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return { target: e.getAttribute("data-learning-entry"), visible: e.offsetParent !== null, rect: { w: Math.round(r.width), h: Math.round(r.height) }, display: cs.display, href: (e.getAttribute("href") || "").slice(0, 90) };
    })).catch((e) => "ERR:" + e.message.slice(0, 200));
    console.log("menuEntries=" + JSON.stringify(menuEntries, null, 1));
    await page.screenshot({ path: out + "/menu-open-375-download.png" });
    // 点击菜单内入口：验证点击出口（不实际导航到外部，检查 href 严格地址）。
    const menuCta = page.locator(".mobile-nav-bottom [data-learning-entry='mobile']").first();
    console.log("menu-cta-count=" + await page.locator(".mobile-nav-bottom [data-learning-entry='mobile']").count());
    console.log("menu-cta-visible=" + await menuCta.isVisible().catch(() => "ERR"));
    const href = await menuCta.getAttribute("href").catch(() => "ERR");
    console.log("menu-cta-href=" + (href || "").slice(0, 140));
    await context.close();
  } finally { await browser.close(); }
})().catch((e) => { console.error("FAIL:" + (e.stack || e.message)); process.exit(1); });
