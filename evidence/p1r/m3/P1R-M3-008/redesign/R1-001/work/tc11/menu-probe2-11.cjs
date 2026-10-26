const { chromium } = require("playwright");
const out = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/tc11/menu-probe2-11";
require("node:fs").mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:18182/download", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(2500);
    const toggles = await page.locator("header button").evaluateAll((els) => els.map((e) => ({ label: e.getAttribute("aria-label"), cls: e.className, visible: e.offsetParent !== null, text: (e.innerText || "").slice(0, 40) })));
    console.log("header-buttons=" + JSON.stringify(toggles, null, 1));
    const dialogs = await page.locator("dialog, [role='dialog']").evaluateAll((els) => els.map((e) => ({ tag: e.tagName, open: e.open, visible: e.offsetParent !== null, cls: e.className.slice(0, 80) })));
    console.log("dialogs=" + JSON.stringify(dialogs));
    const allEntries = await page.locator("[data-learning-entry]").evaluateAll((els) => els.map((e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return { target: e.getAttribute("data-learning-entry"), visible: e.offsetParent !== null, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, display: cs.display, visibility: cs.visibility, opacity: cs.opacity };
    }));
    console.log("allEntries=" + JSON.stringify(allEntries, null, 1));
    await context.close();
  } finally { await browser.close(); }
})().catch((e) => { console.error("FAIL:" + (e.stack || e.message)); process.exit(1); });
