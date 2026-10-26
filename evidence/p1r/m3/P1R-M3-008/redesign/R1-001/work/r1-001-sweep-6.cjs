// R1-001 版本6验收采集器：严格路径 + 同入口负例（MOCKED 标记）。
// 不覆盖 r1-001-sweep-5.cjs / negative-sweep-5.cjs / real-upstream-5.cjs。
// 校验模块 checkHrefStrict 同时被真实采集与受控负例调用。
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/r1-001-sweep-6";
fs.mkdirSync(outDir, { recursive: true });
const origin = process.env.OFFICIAL_SITE_URL || "http://127.0.0.1:18182";
const startedAt = new Date().toISOString();
const log = { checkedAt: startedAt, origin, node: process.version, collector: "r1-001-sweep-6.cjs", mocked: false, viewports: [], failedChecks: [] };
function record(name, ok, detail) {
  log.viewports.push({ check: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error("CHECK-FAIL:" + name + " " + JSON.stringify(detail || null).slice(0, 500)); }
  else console.log("CHECK-PASS:" + name);
}
function expectedEntry(targetOrViewport) {
  // 兼容旧探针按视口调用：375x812→mobile 期望，1440x900→web 期望；
  // 采集主体按 DOM 实际 target 调用 expectedForEntry。
  if (targetOrViewport === "375x812") return expectedForEntry("mobile");
  if (targetOrViewport === "1440x900") return expectedForEntry("web");
  return expectedForEntry(targetOrViewport);
}
function expectedForEntry(target) {
  if (target === "mobile") {
    return { origin: "http://127.0.0.1:18183", path: "/register", hashRoute: "/pages/register/register", returnTo: "/pages/home/home", target: "mobile" };
  }
  return { origin: "http://127.0.0.1:18180", path: "/register", hashRoute: null, returnTo: "/home", target: "web" };
}
// 严格校验：Web pathname === /register；mobile pathname === / 且 hash 路由 === /pages/register/register。
// 查询参数逐项独立比较；禁止 includes/startsWith 放宽。
function checkHrefStrict(href, expected, route) {
  assert.ok(href, route + " missing href");
  const url = new URL(href);
  assert.equal(url.origin, expected.origin, route + " origin=" + url.origin);
  if (expected.hashRoute) {
    assert.equal(url.pathname, "/", route + " mobile pathname=" + url.pathname);
    const hashPath = url.hash.split("?")[0].replace(/^#/, "");
    assert.equal(hashPath, expected.hashRoute, route + " hashRoute=" + hashPath);
  } else {
    assert.equal(url.pathname, expected.path, route + " pathname=" + url.pathname);
    assert.ok(!url.hash || url.hash === "", route + " unexpected hash=" + url.hash);
  }
  const hashQuery = new URLSearchParams((url.hash.split("?")[1] || "").split("#")[0]);
  const get = (k) => url.searchParams.get(k) || hashQuery.get(k);
  assert.equal(get("returnTo"), expected.returnTo, route + " returnTo=" + get("returnTo"));
  const uiLocale = get("uiLocale");
  const theme = get("theme");
  assert.ok(uiLocale === "zh-CN" || uiLocale === "en-US", route + " locale=" + uiLocale);
  assert.ok(["light", "dark", "system", "high-contrast"].includes(theme), route + " theme=" + theme);
}
async function collectFromPage(page, label, route) {
  await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 });
  await page.locator("[data-learning-entry]").first().waitFor({ state: "attached", timeout: 15000 });
  const h1 = (await page.locator("h1").first().innerText()).slice(0, 60);
  const entries = await page.locator("[data-learning-entry]").evaluateAll((els) => els.map((e) => ({ href: e.getAttribute("href"), target: e.getAttribute("data-learning-entry"), visible: e.offsetParent !== null })));
  assert.ok(entries.length > 0, route + " cta=0");
  for (const en of entries) {
    // DOM 实际渲染目标决定期望：SSR 首屏为 web（hydration 后按断点切 mobile）。
    const expected = expectedForEntry(en.target === "mobile" ? "mobile" : "web");
    assert.ok(en.target === "web" || en.target === "mobile", route + " target=" + en.target);
    checkHrefStrict(en.href, expected, route);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert.equal(overflow, false, route + " overflow");
  return { h1, entries: entries.length, sample: entries[0].href.slice(0, 120) };
}
if (require.main === module) {
(async () => {
  const mocked = process.env.R1_001_MOCKED === "1";
  if (mocked) log.mocked = true;
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
      const label = viewport.width + "x" + viewport.height;
      const context = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
      const page = await context.newPage();
      const consoleErrors = [];
      page.on("pageerror", (e) => consoleErrors.push("pageerror:" + String(e.message || e).slice(0, 200)));
      page.on("console", (m) => { if (m.type() === "error") consoleErrors.push("console:" + m.text().slice(0, 200)); });
      const routes = mocked ? ["/courses"] : ["/", "/courses", "/pricing", "/download", "/announcements", "/about", "/compliance", "/status", "/privacy", "/terms", "/minors"];
      for (const route of routes) {
        const started = Date.now();
        const response = await page.goto(origin + route, { waitUntil: "domcontentloaded", timeout: 30000 });
        const status = response ? response.status() : -1;
        try {
          assert.equal(status, 200, route + " http=" + status);
          record(label + " http " + route, true, { status, ms: Date.now() - started });
        } catch (e) { record(label + " http " + route, false, { status, error: e.message.slice(0, 200) }); }
        try {
          const detail = await collectFromPage(page, label, route);
          record(label + " r1-001 " + route, true, detail);
        } catch (e) { record(label + " r1-001 " + route, false, { error: e.message.slice(0, 300) }); }
      }
      record(label + " console-clean", consoleErrors.length === 0, { errors: consoleErrors.slice(0, 5) });
      await context.close();
    }
  } finally { await browser.close(); }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, "r1-001-sweep-6.json"), JSON.stringify(log, null, 2));
  if (log.failedChecks.length) { console.error("SWEEP-RESULT: FAIL " + log.failedChecks.length); process.exit(1); }
  console.log("SWEEP-RESULT: PASS");
})().catch((e) => { console.error("SWEEP-FAIL:" + (e.stack || e.message)); process.exit(1); });
}
module.exports = { checkHrefStrict, expectedEntry };
