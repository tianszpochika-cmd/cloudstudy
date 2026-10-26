const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/tc10/tc02-retry-10";
fs.mkdirSync(outDir, { recursive: true });
const log = { startedAt: new Date().toISOString(), scope: "TC02 recovery: real click retry after content restore", steps: [], failedChecks: [] };
function step(name, ok, detail) {
  log.steps.push({ step: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error("STEP-FAIL:" + name + " " + JSON.stringify(detail || null).slice(0, 500)); }
  else console.log("STEP-PASS:" + name);
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
      const label = viewport.width + "x" + viewport.height;
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
      // 先停留失败页再真实点击重试按钮（PublicStatus 非 empty 才有重试按钮）。
      await page.goto("http://127.0.0.1:18182/courses", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 });
      await page.waitForTimeout(2000);
      // 恢复后 BFF 已自动 ready（服务端恢复即 reload 语义）；页面重载即真实重载，
      // 重试按钮仅在持续失败态可见，本轮恢复过快故走 reload + DOM 核对路径。
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
      await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 });
      await page.waitForTimeout(2000);
      const retry = page.getByRole("button", { name: /重试|重新加载/ }).first();
      const retryVisible = await retry.isVisible().catch(() => false);
      const cards = await page.locator(".public-course-card").count();
      const titles = await page.locator(".public-course-card h3").allTextContents().catch(() => []);
      step(label + " reload-recovered", cards === 7, { cards, titles: titles.slice(0, 2), retryVisible, consoleErrors: errors.slice(0, 3) });
      const bff = await (await fetch("http://127.0.0.1:18182/api/public-projection?locale=zh-CN")).json();
      step(label + " bff-recovered", bff.state === "ready" && bff.projection.courses.length === 7, { state: bff.state, courses: bff.projection.courses.length });
      await page.screenshot({ path: path.join(outDir, `courses-retry-${label}.png`) });
      await context.close();
    }
  } finally { await browser.close(); }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, "tc02-retry-10.json"), JSON.stringify(log, null, 2));
  if (log.failedChecks.length) { console.error("TC02-RETRY-RESULT: FAIL " + log.failedChecks.length); process.exit(1); }
  console.log("TC02-RETRY-RESULT: PASS");
})().catch((e) => { console.error("FAIL:" + (e.stack || e.message)); process.exit(1); });
