// TC02-11 连续会话 v2：同一页面+同一上下文完成 失败→恢复→点击→响应→DOM。
// 单脚本内编排：失败态打开 → 停止信号由脚本自己在“恢复阶段”通过 spawned
// restore 进程完成（调用方只需保证：启动时 content 已停、BFF 无缓存新进程）。
// 恢复阶段由本脚本 spawn 安全启动器（子进程 env 全 false），拿到 healthy 后
// 继续同页点击，结束后杀掉恢复进程。禁止 reload/goto/load() 替代点击。
const { chromium } = require("playwright");
const { spawn: spawnProc } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/tc11/tc02-11session";
fs.mkdirSync(outDir, { recursive: true });
const RESTORE_MARK = process.env.R1_001_RESTORE_MARK || "nonempty";
const log = { startedAt: new Date().toISOString(), scope: "TC02-11 continuous session v2: same page click retry", restoreMark: RESTORE_MARK, steps: [], failedChecks: [] };
function step(name, ok, detail) {
  log.steps.push({ step: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error("STEP-FAIL:" + name + " " + JSON.stringify(detail || null).slice(0, 600)); }
  else console.log("STEP-PASS:" + name);
}
function waitHealthy(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return (async () => {
    while (Date.now() < deadline) {
      try {
        const r = await fetch(url);
        if (r.ok) return true;
      } catch {}
      await new Promise((r) => setTimeout(r, 2000));
    }
    return false;
  })();
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  let restoreProc = null;
  try {
    for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
      const label = viewport.width + "x" + viewport.height;
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
      // 1. 失败态打开（调用方保证 content 已停、BFF 无缓存）。
      await page.goto("http://127.0.0.1:18182/courses", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 });
      await page.waitForTimeout(2000);
      const gw = await fetch("http://127.0.0.1:18070/api/v1/public/site/projection?uiLocale=zh-CN");
      const gwText = await gw.text();
      step(label + " gateway-failure", [502, 503, 504].includes(gw.status), { status: gw.status, req: gw.headers.get("x-request-id"), body: gwText.slice(0, 200) });
      log.gatewayFailure = log.gatewayFailure || { status: gw.status, body: gwText.slice(0, 400) };
      const bff0 = await (await fetch("http://127.0.0.1:18182/api/public-projection?locale=zh-CN")).json();
      // 有缓存 recovery 亦为合法失败态（60s TTL 内旧事实 + 恢复说明 + 可用重试）；
      // 无缓存 error 为另一合法失败态；两者分别硬断言（F16 recovery 双场景）。
      const isRecovery = bff0.state === "recovery" && bff0.source === "memory-cache";
      step(label + " bff-failure-state", (bff0.state === "error") || isRecovery, { state: bff0.state, source: bff0.source, errorCode: bff0.errorCode });
      const cards0 = await page.locator(".public-course-card").count();
      const region = page.locator(".published-courses").first();
      const regionText0 = await region.innerText().catch(() => "");
      const retryBtn = region.getByRole("button", { name: /重试|重新加载/ }).first();
      const retryVisible = await retryBtn.isVisible().catch(() => false);
      const retryEnabled = retryVisible && await retryBtn.isEnabled().catch(() => false);
      if (isRecovery) {
        step(label + " page-recovery-hard", cards0 > 0 && retryVisible && retryEnabled && regionText0.includes("正在恢复"), { cards: cards0, retryVisible, retryEnabled, bodySample: regionText0.slice(0, 160) });
      } else {
        step(label + " page-error-hard", cards0 === 0 && retryVisible && retryEnabled && regionText0.length > 20, { cards: cards0, retryVisible, retryEnabled, bodySample: regionText0.slice(0, 160) });
      }
      await region.screenshot({ path: path.join(outDir, `fail-${label}.png`) }).catch(() => {});
      // 2. 同页保持打开；恢复自有 content（每个视口独立恢复→点击→清理，
      // 保证第二视口仍从失败态开始；恢复进程每次用完即杀）。
      {
        restoreProc = spawnProc(process.execPath, ["evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/r1-001-safe-run-10.cjs", "--service", "content-service", "--timeout-ms", "180000"], { cwd: process.cwd(), stdio: "ignore", windowsHide: true });
        log["restorePid-" + label] = restoreProc.pid;
        const healthy = await waitHealthy("http://127.0.0.1:18089/actuator/health/readiness", 170000);
        step(label + " restore-content-healthy", healthy === true, { pid: restoreProc.pid });
        assert.ok(healthy, "restore content unhealthy");
      }
      // 3. 同一页面点击重试（禁止 reload/goto/load），捕捉该点击 BFF 响应。
      const pending = page.waitForResponse((res) => new URL(res.url()).pathname === "/api/public-projection" && res.request().method() === "GET", { timeout: 25000 });
      await retryBtn.click({ timeout: 10000 });
      const response = await pending;
      const body = await response.json();
      step(label + " click-bff-response", response.status() === 200 && ["ready", "empty"].includes(body.state), { status: response.status(), state: body.state, courses: (body.projection?.courses || []).length });
      await page.locator(".public-course-card").first().waitFor({ state: "visible", timeout: 20000 });
      const cards = await page.locator(".public-course-card").count();
      const regionText = await region.innerText();
      const date = String(body.projection?.generatedAt || body.facets?.courses?.updatedAt || "").slice(0, 10);
      step(label + " dom-recovered", cards === (body.projection?.courses || []).length && cards > 0 && regionText.includes(date), { cards, date });
      await region.screenshot({ path: path.join(outDir, `recovered-${label}.png`) }).catch(() => {});
      step(label + " console-clean", errors.length === 0, { errors: errors.slice(0, 3) });
      await context.close();
      // 视口间隔离：杀掉本视口恢复的 content，下视口重新从失败态开始。
      if (restoreProc && !restoreProc.killed) {
        restoreProc.kill("SIGTERM");
        await new Promise((r) => setTimeout(r, 8000));
        restoreProc = null;
      }
    }
  } finally {
    await browser.close();
    if (restoreProc && !restoreProc.killed) restoreProc.kill("SIGTERM");
  }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, "tc02-11session.json"), JSON.stringify(log, null, 2));
  if (log.failedChecks.length) { console.error("TC02-11-SESSION: FAIL " + log.failedChecks.length); process.exit(1); }
  console.log("TC02-11-SESSION: PASS");
})().catch((e) => { console.error("FAIL:" + (e.stack || e.message)); process.exit(1); });
