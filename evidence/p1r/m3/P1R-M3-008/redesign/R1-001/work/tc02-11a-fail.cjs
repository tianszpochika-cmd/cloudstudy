// TC02-11：同一失败页真实点击重试（无缓存503 + 有缓存recovery 双场景）。
// 同一页面+同一浏览器上下文：失败 → 错误说明+可用重试按钮 → 恢复自有content →
// 原页点击“重新加载” → 捕捉该点击产生的实际BFF响应 → DOM/更新时间恢复。
// 禁止 reload/goto/直接load/独立BFF预触发替代点击。错误态硬断言：实际响应
// state=error + 可见错误说明 + 可用按钮 + 零课程（不只看零卡）。
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/tc11/tc02-11";
fs.mkdirSync(outDir, { recursive: true });
const log = { startedAt: new Date().toISOString(), scope: "TC02-11 same-page click retry: no-cache 503 + cached recovery", steps: [], failedChecks: [] };
function step(name, ok, detail) {
  log.steps.push({ step: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error("STEP-FAIL:" + name + " " + JSON.stringify(detail || null).slice(0, 600)); }
  else console.log("STEP-PASS:" + name);
}
function shaFile(p) { return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"); }
async function errorState(page, label, route) {
  // 错误态硬断言：零课程 + 可见错误说明 + 可用重试按钮（PublicStatus error 有按钮）。
  const cards = await page.locator(".public-course-card").count();
  const region = page.locator(".published-courses").first();
  const regionText = await region.innerText().catch(() => "");
  const retryBtn = region.getByRole("button", { name: /重试|重新加载/ }).first();
  const retryVisible = await retryBtn.isVisible().catch(() => false);
  const retryEnabled = retryVisible && await retryBtn.isEnabled().catch(() => false);
  assert.equal(cards, 0, route + " cards=" + cards);
  assert.ok(regionText.length > 20, route + " empty region text");
  assert.equal(retryVisible, true, route + " retry not visible");
  assert.equal(retryEnabled, true, route + " retry not enabled");
  return { cards, retryVisible, retryEnabled, bodySample: regionText.slice(0, 200) };
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
      const label = viewport.width + "x" + viewport.height;
      // —— 场景A：无缓存503（BFF 新进程已在外部重启，content 已停）——
      {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
        page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
        const gw = await fetch("http://127.0.0.1:18070/api/v1/public/site/projection?uiLocale=zh-CN");
        const gwText = await gw.text();
        step(label + " A gateway-failure", [502, 503, 504].includes(gw.status), { status: gw.status, req: gw.headers.get("x-request-id"), body: gwText.slice(0, 200) });
        await page.goto("http://127.0.0.1:18182/courses", { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 });
        await page.waitForTimeout(2000);
        const est = await errorState(page, label + " A", "/courses");
        step(label + " A page-error-hard", true, est);
        await page.locator(".published-courses").first().screenshot({ path: path.join(outDir, `fail-nocache-${label}.png`) }).catch(() => {});
        await context.close();
        log.gatewayFailure = log.gatewayFailure || { status: gw.status, body: gwText.slice(0, 400) };
      }
    }
  } finally { await browser.close(); }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, "tc02-11-phaseA.json"), JSON.stringify(log, null, 2));
  if (log.failedChecks.length) { console.error("TC02-11-A: FAIL " + log.failedChecks.length); process.exit(1); }
  console.log("TC02-11-A: PASS (failure captured; restore + click in phase B)");
})().catch((e) => { console.error("FAIL:" + (e.stack || e.message)); process.exit(1); });
