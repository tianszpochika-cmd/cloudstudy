// TC02-11 连续会话：同一页面+同一上下文完成 失败→恢复→点击→响应→DOM。
// 由外部编排在“恢复自有content”前后调用：本脚本在失败态打开页面（不恢复），
// 等待外部信号文件出现后再点击重试。信号文件路径由 --signal 参数指定。
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/tc11/tc02-11session";
const signalIdx = process.argv.indexOf("--signal");
const signalFile = signalIdx >= 0 ? process.argv[signalIdx + 1] : null;
assert.ok(signalFile, "signal file required");
fs.mkdirSync(outDir, { recursive: true });
const log = { startedAt: new Date().toISOString(), scope: "TC02-11 continuous session: same page click retry", steps: [], failedChecks: [] };
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
      // 1. 失败态打开（content 已停，BFF 无缓存新进程）。
      await page.goto("http://127.0.0.1:18182/courses", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 });
      await page.waitForTimeout(2000);
      // 2. 错误态硬断言：实际 BFF error + 可见错误说明 + 可用按钮 + 零课程。
      const gw = await fetch("http://127.0.0.1:18070/api/v1/public/site/projection?uiLocale=zh-CN");
      step(label + " gateway-failure", [502, 503, 504].includes(gw.status), { status: gw.status });
      const cards0 = await page.locator(".public-course-card").count();
      const region = page.locator(".published-courses").first();
      const regionText0 = await region.innerText().catch(() => "");
      const retryBtn = region.getByRole("button", { name: /重试|重新加载/ }).first();
      const retryVisible = await retryBtn.isVisible().catch(() => false);
      const retryEnabled = retryVisible && await retryBtn.isEnabled().catch(() => false);
      step(label + " page-error-hard", cards0 === 0 && retryVisible && retryEnabled && regionText0.length > 20, { cards: cards0, retryVisible, retryEnabled, bodySample: regionText0.slice(0, 160) });
      await region.screenshot({ path: path.join(outDir, `fail-${label}.png`) }).catch(() => {});
      // 3. 等待外部恢复信号（自有content已恢复），期间不 reload/goto/load。
      const deadline = Date.now() + 120000;
      while (!fs.existsSync(signalFile) && Date.now() < deadline) await page.waitForTimeout(1000);
      assert.ok(fs.existsSync(signalFile), label + " restore signal timeout");
      // 4. 同一页面点击重试，捕捉该点击的实际BFF响应。
      const pending = page.waitForResponse((res) => new URL(res.url()).pathname === "/api/public-projection" && res.request().method() === "GET", { timeout: 25000 });
      await retryBtn.click({ timeout: 10000 });
      const response = await pending;
      const body = await response.json();
      step(label + " click-bff-response", response.status() === 200 && ["ready", "empty"].includes(body.state), { status: response.status(), state: body.state, courses: (body.projection?.courses || []).length, requestId: response.headers()["x-request-id"] || null });
      // 5. DOM 恢复 + 更新时间核对 + Console。
      await page.locator(".public-course-card").first().waitFor({ state: "visible", timeout: 20000 });
      const cards = await page.locator(".public-course-card").count();
      const regionText = await region.innerText();
      const date = String(body.projection?.generatedAt || body.facets?.courses?.updatedAt || "").slice(0, 10);
      step(label + " dom-recovered", cards === (body.projection?.courses || []).length && cards > 0 && regionText.includes(date), { cards, date });
      await region.screenshot({ path: path.join(outDir, `recovered-${label}.png`) }).catch(() => {});
      step(label + " console-clean", errors.length === 0, { errors: errors.slice(0, 3) });
      await context.close();
    }
  } finally { await browser.close(); }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, "tc02-11session.json"), JSON.stringify(log, null, 2));
  if (log.failedChecks.length) { console.error("TC02-11-SESSION: FAIL " + log.failedChecks.length); process.exit(1); }
  console.log("TC02-11-SESSION: PASS");
})().catch((e) => { console.error("FAIL:" + (e.stack || e.message)); process.exit(1); });
