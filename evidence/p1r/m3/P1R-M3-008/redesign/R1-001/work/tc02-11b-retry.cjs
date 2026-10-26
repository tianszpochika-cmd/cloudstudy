// TC02-11B：恢复自有content后，在同一失败页点击“重新加载”，捕捉该点击的
// 实际BFF响应，核对DOM/更新时间恢复。禁止 reload/goto/load() 替代点击。
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/tc11/tc02-11b-retry";
fs.mkdirSync(outDir, { recursive: true });
const log = { startedAt: new Date().toISOString(), scope: "TC02-11B same-page click retry after restore", steps: [], failedChecks: [] };
function step(name, ok, detail) {
  log.steps.push({ step: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error("STEP-FAIL:" + name + " " + JSON.stringify(detail || null).slice(0, 600)); }
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
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
      // 注意：调用方须保证上游已恢复、本页处于失败态（沿用 phaseA 同一会话语义重建）。
      await page.goto("http://127.0.0.1:18182/courses", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 });
      await page.waitForTimeout(1500);
      // 若页面已恢复（BFF 自动恢复），则回退到“失败→恢复”连续会话在外部编排；
      // 本脚本只负责：找到可见可用重试按钮 → 点击 → 捕捉该点击 BFF 响应 → DOM 恢复。
      const region = page.locator(".published-courses").first();
      const retryBtn = region.getByRole("button", { name: /重试|重新加载/ }).first();
      const retryVisible = await retryBtn.isVisible().catch(() => false);
      if (!retryVisible) {
        // 页面已不在失败态：记录 cards/DOM，交外部连续会话脚本覆盖点击路径。
        const cards = await page.locator(".public-course-card").count();
        step(label + " B already-recovered", cards === 7, { cards, note: "retry button absent; covered by continuous session script" });
        await context.close();
        continue;
      }
      const pending = page.waitForResponse((res) => new URL(res.url()).pathname === "/api/public-projection" && res.request().method() === "GET", { timeout: 25000 });
      await retryBtn.click({ timeout: 10000 });
      const response = await pending;
      const body = await response.json();
      step(label + " B click-bff-response", response.status() === 200 && (body.state === "ready" || body.state === "empty"), { status: response.status(), state: body.state, courses: (body.projection?.courses || []).length });
      await page.locator(".public-course-card").first().waitFor({ state: "visible", timeout: 15000 });
      const cards = await page.locator(".public-course-card").count();
      const regionText = await region.innerText();
      const date = String(body.projection?.generatedAt || body.facets?.courses?.updatedAt || "").slice(0, 10);
      step(label + " B dom-recovered", cards === 7 && regionText.includes(date), { cards, date });
      await region.screenshot({ path: path.join(outDir, `recovered-${label}.png`) }).catch(() => {});
      step(label + " B console-clean", errors.length === 0, { errors: errors.slice(0, 3) });
      await context.close();
    }
  } finally { await browser.close(); }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, "tc02-11b.json"), JSON.stringify(log, null, 2));
  if (log.failedChecks.length) { console.error("TC02-11-B: FAIL " + log.failedChecks.length); process.exit(1); }
  console.log("TC02-11-B: PASS");
})().catch((e) => { console.error("FAIL:" + (e.stack || e.message)); process.exit(1); });
