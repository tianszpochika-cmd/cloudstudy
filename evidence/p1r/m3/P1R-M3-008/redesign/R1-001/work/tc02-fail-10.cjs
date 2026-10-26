const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/tc10/tc02-fail-10";
fs.mkdirSync(outDir, { recursive: true });
const log = { startedAt: new Date().toISOString(), scope: "TC02 no-cache: own content stopped, Gateway/BFF real failure + page error", steps: [], failedChecks: [] };
function step(name, ok, detail) {
  log.steps.push({ step: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error("STEP-FAIL:" + name + " " + JSON.stringify(detail || null).slice(0, 500)); }
  else console.log("STEP-PASS:" + name);
}
(async () => {
  // Gateway 真实失败（content 已停）。
  const gw = await fetch("http://127.0.0.1:18070/api/v1/public/site/projection?uiLocale=zh-CN");
  const gwText = await gw.text();
  step("gateway-failure", gw.status === 503 || gw.status === 504 || gw.status === 502, { status: gw.status, requestId: gw.headers.get("x-request-id"), traceId: gw.headers.get("x-trace-id"), body: gwText.slice(0, 300) });
  log.gatewayFailure = { status: gw.status, requestIdPresent: !!gw.headers.get("x-request-id"), traceIdPresent: !!gw.headers.get("x-trace-id"), body: gwText.slice(0, 500) };
  // BFF 真实失败（无缓存新进程）。
  const bff = await fetch("http://127.0.0.1:18182/api/public-projection?locale=zh-CN");
  const bffBody = await bff.json();
  step("bff-failure", bffBody.state === "error" && bffBody.source === "empty-fallback", { status: bff.status, state: bffBody.state, source: bffBody.source, errorCode: bffBody.errorCode, facet: bffBody.facets?.courses });
  log.bffFailure = { status: bff.status, state: bffBody.state, source: bffBody.source, errorCode: bffBody.errorCode, coursesFacet: bffBody.facets?.courses };
  // 页面错误态（双视口）。
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
      const label = viewport.width + "x" + viewport.height;
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
      await page.goto("http://127.0.0.1:18182/courses", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 });
      await page.waitForTimeout(2000);
      const cards = await page.locator(".public-course-card").count();
      const body = await page.locator(".published-courses").first().innerText().catch(() => "");
      step(label + " page-error", cards === 0, { cards, bodySample: body.slice(0, 200), consoleErrors: errors.slice(0, 3) });
      await page.screenshot({ path: path.join(outDir, `courses-fail-${label}.png`) });
      await context.close();
    }
  } finally { await browser.close(); }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, "tc02-fail-10.json"), JSON.stringify(log, null, 2));
  if (log.failedChecks.length) { console.error("TC02-FAIL-RESULT: FAIL " + log.failedChecks.length); process.exit(1); }
  console.log("TC02-FAIL-RESULT: PASS");
})().catch((e) => { console.error("FAIL:" + (e.stack || e.message)); process.exit(1); });
