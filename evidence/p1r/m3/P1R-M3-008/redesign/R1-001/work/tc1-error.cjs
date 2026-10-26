const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/tc1";
fs.mkdirSync(outDir, { recursive: true });
const origin = "http://127.0.0.1:18182";
const log = { checkedAt: new Date().toISOString(), origin, note: "empty-state branch only: upstream unavailable so BFF returns error; empty copy verified at unit level + error-state DOM. Success-state rendering stays BLOCKED (no real upstream).", viewports: [] };
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
      const context = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push("pageerror:" + String(e.message || e).slice(0, 200)));
      page.on("console", (m) => { if (m.type() === "error") errors.push("console:" + m.text().slice(0, 200)); });
      // courses: error-state honest retry control must exist (no fake empty success)
      await page.goto(origin + "/courses", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2500);
      const retryVisible = await page.getByRole("button", { name: "重新加载" }).first().isVisible().catch(() => false);
      const emptyCopy = await page.getByText("内容准备中").count().catch(() => -1);
      const coursesShot = path.join(outDir, "courses-error-" + viewport.width + "x" + viewport.height + ".png");
      await page.screenshot({ path: coursesShot, fullPage: false });
      const coursesDom = (await page.content()).replace(/<script[\s\S]*?<\/script>/g, "").slice(0, 6000);
      fs.writeFileSync(path.join(outDir, "courses-error-" + viewport.width + "x" + viewport.height + ".dom.txt"), coursesDom);
      // pricing: independent page still 200 with honest error, no purchase CTA
      await page.goto(origin + "/pricing", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2500);
      const purchaseCount = await page.getByRole("button", { name: /购买|下单|支付/ }).count().catch(() => -1);
      const pricingShot = path.join(outDir, "pricing-error-" + viewport.width + "x" + viewport.height + ".png");
      await page.screenshot({ path: pricingShot, fullPage: false });
      log.viewports.push({ viewport: viewport.width + "x" + viewport.height, coursesRetryVisible: retryVisible, coursesEmptyCopyCount: emptyCopy, pricingPurchaseControls: purchaseCount, consoleErrors: errors });
      await context.close();
    }
    log.result = "DONE";
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(outDir, "tc1-error.json"), JSON.stringify(log, null, 2));
  console.log(JSON.stringify(log, null, 2));
})().catch((e) => { console.error("TC1-FAIL:" + (e.stack || e.message)); process.exit(1); });
