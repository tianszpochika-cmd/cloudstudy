const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/r1-001-sweep-4";
fs.mkdirSync(outDir, { recursive: true });
const origin = process.env.OFFICIAL_SITE_URL || "http://127.0.0.1:18182";
const startedAt = new Date().toISOString();
const log = { checkedAt: startedAt, origin, node: process.version, viewports: [], failedChecks: [] };
function record(name, ok, detail) {
  log.viewports.push({ check: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error("CHECK-FAIL:" + name + " " + JSON.stringify(detail || null).slice(0, 400)); }
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
      const routes = ["/", "/courses", "/pricing", "/download", "/announcements", "/about", "/compliance", "/status", "/privacy", "/terms", "/minors"];
      for (const route of routes) {
        const started = Date.now();
        const response = await page.goto(origin + route, { waitUntil: "domcontentloaded", timeout: 30000 });
        const status = response ? response.status() : -1;
        try {
          assert.equal(status, 200, route + " http=" + status);
          record(label + " http " + route, true, { status, ms: Date.now() - started });
        } catch (e) { record(label + " http " + route, false, { status, error: e.message.slice(0, 200) }); }
        try {
          await page.locator("h1").first().waitFor({ state: "attached", timeout: 15000 });
          await page.waitForTimeout(2000);
          const h1 = (await page.locator("h1").first().innerText()).slice(0, 60);
          const entries = await page.locator("[data-learning-entry]").evaluateAll((els) => els.map((e) => ({ href: e.getAttribute("href"), target: e.getAttribute("data-learning-entry") })));
          assert.ok(entries.length > 0, route + " cta=0");
          for (const en of entries) {
            assert.ok(en.href && en.href.includes("/register"), route + " bad href=" + en.href);
            assert.ok(en.target === "web" || en.target === "mobile", route + " bad target=" + en.target);
          }
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
          assert.equal(overflow, false, route + " overflow");
          record(label + " r1-001 " + route, true, { h1, entries: entries.length, sample: entries[0] });
        } catch (e) { record(label + " r1-001 " + route, false, { error: e.message.slice(0, 300) }); }
      }
      const shot = path.join(outDir, "r1-001-" + label + ".png");
      await page.goto(origin + "/courses", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2000).catch(() => {});
      await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
      record(label + " console-clean", consoleErrors.length === 0, { errors: consoleErrors.slice(0, 5) });
      await context.close();
    }
  } finally { await browser.close(); }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, "r1-001-sweep-4.json"), JSON.stringify(log, null, 2));
  if (log.failedChecks.length) { console.error("SWEEP-RESULT: FAIL " + log.failedChecks.length); process.exit(1); }
  console.log("SWEEP-RESULT: PASS");
})().catch((e) => { console.error("SWEEP-FAIL:" + (e.stack || e.message)); process.exit(1); });
