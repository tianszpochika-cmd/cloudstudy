const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/real-upstream-5";
fs.mkdirSync(outDir, { recursive: true });
const origin = "http://127.0.0.1:18182";
const startedAt = new Date().toISOString();
const log = { checkedAt: startedAt, origin, scope: "real Gateway18070+content/commerce upstream, success-state rendering", viewports: [], failedChecks: [] };
function record(name, ok, detail) {
  log.viewports.push({ check: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error("CHECK-FAIL:" + name + " " + JSON.stringify(detail || null).slice(0, 500)); }
  else console.log("CHECK-PASS:" + name);
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
      const label = viewport.width + "x" + viewport.height;
      const context = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
      const page = await context.newPage();
      const consoleErrors = [];
      page.on("pageerror", (e) => consoleErrors.push("pageerror:" + String(e.message || e).slice(0, 200)));
      page.on("console", (m) => { if (m.type() === "error") consoleErrors.push("console:" + m.text().slice(0, 200)); });
      // courses success-state: real published courses render, no empty copy
      {
        const response = await page.goto(origin + "/courses", { waitUntil: "domcontentloaded", timeout: 30000 });
        assert.equal(response.status(), 200);
        await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 });
        await page.locator(".public-course-card").first().waitFor({ state: "visible", timeout: 15000 });
        const cards = await page.locator(".public-course-card").count();
        const emptyCopy = await page.getByText("内容准备中").count().catch(() => -1);
        const titles = await page.locator(".public-course-card h3").evaluateAll((els) => els.map((e) => e.innerText.slice(0, 40)));
        record(label + " courses-success", cards >= 1 && emptyCopy === 0, { cards, emptyCopy, titles: titles.slice(0, 3) });
        await page.screenshot({ path: path.join(outDir, "courses-success-" + label + ".png"), fullPage: false });
      }
      // pricing empty-pricing honest state (authoritative empty catalog, no purchase)
      {
        await page.goto(origin + "/pricing", { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 });
        await page.waitForTimeout(1500);
        const purchase = await page.getByRole("button", { name: /购买|下单|支付/ }).count().catch(() => -1);
        const body = await page.content();
        record(label + " pricing-empty-honest", purchase === 0, { purchase });
      }
      record(label + " console-clean", consoleErrors.length === 0, { errors: consoleErrors.slice(0, 5) });
      await context.close();
    }
  } finally { await browser.close(); }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, "real-upstream-5.json"), JSON.stringify(log, null, 2));
  if (log.failedChecks.length) { console.error("RESULT: FAIL " + log.failedChecks.length); process.exit(1); }
  console.log("RESULT: PASS");
})().catch((e) => { console.error("FAIL:" + (e.stack || e.message)); process.exit(1); });
