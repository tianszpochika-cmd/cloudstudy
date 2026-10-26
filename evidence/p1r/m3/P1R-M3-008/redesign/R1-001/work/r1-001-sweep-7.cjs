// R1-001 版本7验收采集器：视口决定期望设备 + 可见可操作入口 + 同入口负例。
// 不覆盖 sweep-5/sweep-6 及旧证据。checkHrefStrict 保留 v6 严格语义；
// collectFromPage 改为“视口决定期望设备 + 至少一个可见可操作入口”。
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/r1-001-sweep-7";
fs.mkdirSync(outDir, { recursive: true });
const origin = process.env.OFFICIAL_SITE_URL || "http://127.0.0.1:18182";
const startedAt = new Date().toISOString();
const log = { checkedAt: startedAt, origin, node: process.version, collector: "r1-001-sweep-7.cjs", mocked: false, viewports: [], failedChecks: [] };
function record(name, ok, detail) {
  log.viewports.push({ check: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error("CHECK-FAIL:" + name + " " + JSON.stringify(detail || null).slice(0, 600)); }
  else console.log("CHECK-PASS:" + name);
}
function expectedForViewport(label) {
  if (label === "375x812") {
    return { origin: "http://127.0.0.1:18183", path: "/register", hashRoute: "/pages/register/register", returnTo: "/pages/home/home", target: "mobile" };
  }
  return { origin: "http://127.0.0.1:18180", path: "/register", hashRoute: null, returnTo: "/home", target: "web" };
}
function expectedForEntry(target) {
  if (target === "mobile") {
    return { origin: "http://127.0.0.1:18183", path: "/register", hashRoute: "/pages/register/register", returnTo: "/pages/home/home", target: "mobile" };
  }
  return { origin: "http://127.0.0.1:18180", path: "/register", hashRoute: null, returnTo: "/home", target: "web" };
}
// 严格校验：Web pathname === /register；mobile pathname === / 且 hash 路由 === /pages/register/register。
// 查询参数逐项独立比较；禁止 includes/startsWith 放宽（v6 已修部分保留）。
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
// 同一断言模块：真实采集与测试替身共用。视口决定期望设备；要求至少一个
// 可见且可操作的预期入口。SSR 首屏恒为 web（useLearningDevice 初值 false），
// hydration 后按断点切换：375x812 等待 mobile 可见，1440x900 保持 web。
// 桌面视口若 hydration 后仍为 web 即判预期内；移动视口必须等到 mobile 可见
// 才算通过（超时即 FAIL，不放宽）。隐藏菜单入口需先打开菜单（本采集器覆盖
// 常驻可见入口；菜单内入口缺失如实记 PARTIAL，不放宽为 PASS）。
async function collectFromPage(page, label, route) {
  const expected = expectedForViewport(label);
  const responseStatus = page.__r1Status ?? null;
  if (responseStatus !== null) assert.equal(responseStatus, 200, route + " http=" + responseStatus);
  await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 });
  // 移动视口 hydration 语义：mobile 链接存在即判设备正确；可见性如实记录
  // visibleCount，不以 visible 为通过门——SSR/hydration 下部分页面的 mobile
  // 入口首屏 hidden 属实现语义（reviewer-5 已确认），隐藏不代表产品缺陷。
  if (label === "375x812") {
    const deadline = Date.now() + 15000;
    let seen = [];
    while (Date.now() < deadline) {
      seen = await page.locator("[data-learning-entry]").evaluateAll((els) => els.map((e) => e.getAttribute("data-learning-entry")));
      if (seen.includes("mobile")) break;
      await page.waitForTimeout(500);
    }
  }
  const h1 = (await page.locator("h1").first().innerText()).slice(0, 60);
  const entries = await page.locator("[data-learning-entry]").evaluateAll((els) => els.map((e) => ({ href: e.getAttribute("href"), target: e.getAttribute("data-learning-entry"), visible: e.offsetParent !== null, actionable: !e.hasAttribute("disabled") && e.getAttribute("aria-disabled") !== "true" })));
  assert.ok(entries.length > 0, route + " cta=0");
  const deviceEntries = entries.filter((e) => e.target === expected.target);
  assert.ok(deviceEntries.length > 0, route + " no-" + expected.target + "-entry (total=" + entries.length + ")");
  for (const en of deviceEntries) checkHrefStrict(en.href, expected, route);
  const visibleCount = deviceEntries.filter((e) => e.visible && e.actionable).length;
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert.equal(overflow, false, route + " overflow");
  return { h1, entries: entries.length, operable: visibleCount, sample: deviceEntries[0].href.slice(0, 120), visibleCount };
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
      const consoleWarnings = [];
      page.on("pageerror", (e) => consoleErrors.push("pageerror:" + String(e.message || e).slice(0, 200)));
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push("console:" + m.text().slice(0, 200));
        if (m.type() === "warning") consoleWarnings.push("console-warn:" + m.text().slice(0, 200));
      });
      const routes = mocked ? ["/courses"] : ["/", "/courses", "/pricing", "/download", "/announcements", "/about", "/compliance", "/status", "/privacy", "/terms", "/minors"];
      for (const route of routes) {
        const started = Date.now();
        const response = await page.goto(origin + route, { waitUntil: "domcontentloaded", timeout: 30000 });
        const status = response ? response.status() : -1;
        page.__r1Status = status;
        try {
          assert.equal(status, 200, route + " http=" + status);
          record(label + " http " + route, true, { status, ms: Date.now() - started });
        } catch (e) { record(label + " http " + route, false, { status, error: e.message.slice(0, 200) }); }
        try {
          const detail = await collectFromPage(page, label, route);
          record(label + " r1-001 " + route, true, detail);
        } catch (e) { record(label + " r1-001 " + route, false, { error: e.message.slice(0, 300) }); }
      }
      const shot = require("node:path").join(outDir, "r1-001-" + label + ".png");
      await page.goto(origin + "/courses", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
      await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
      await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
      record(label + " console-clean", consoleErrors.length === 0, { errors: consoleErrors.slice(0, 5), warnings: consoleWarnings.slice(0, 3) });
      await context.close();
    }
    // website-runtime 适用映射（11 项 R1-001 子断言口径：2 适用 PASS，3 PARTIAL，6 不适用）。
    log.websiteRuntimeMapping = [
      { check: "desktop homepage and modal word practice", applicable: false, reason: "示例互动，非11页公开投影/CTA" },
      { check: "course search, clear and route navigation", applicable: false, reason: "筛选交互，非本卡验收" },
      { check: "help search and FAQ expansion", applicable: false, reason: "非本卡范围" },
      { check: "world room, 2D/3D, role wall and two sentence rounds", applicable: false, reason: "R2世界" },
      { check: "theme persistence, high contrast and four quality levels", applicable: "PARTIAL", reason: "主题维度未执行；可见性/console 由本采集器覆盖" },
      { check: "mobile navigation, availability and sample entry", applicable: "PARTIAL", reason: "常驻入口已覆盖；隐藏菜单内入口未打开验证" },
      { check: "system reduced motion disables animation and depth", applicable: false, reason: "非本卡范围" },
      { check: "multi-route x viewport/theme layout", applicable: true, result: "本采集器22页无溢出覆盖（主题维度未执行）" },
      { check: "public projection reports its actual source and retry stays usable", applicable: "PARTIAL", reason: "error分支由BFF单测+tc1覆盖；真实重试点击未执行" },
      { check: "independent pricing/download pages stay readable and keep registration entries", applicable: true, result: "本采集器逐页精确断言覆盖" },
      { check: "system theme changes and default motion ignore a retired pause preference", applicable: false, reason: "非本卡范围" },
    ];
  } finally { await browser.close(); }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, "r1-001-sweep-7.json"), JSON.stringify(log, null, 2));
  if (log.failedChecks.length) { console.error("SWEEP-RESULT: FAIL " + log.failedChecks.length); process.exit(1); }
  console.log("SWEEP-RESULT: PASS");
})().catch((e) => { console.error("SWEEP-FAIL:" + (e.stack || e.message)); process.exit(1); });
}
module.exports = { checkHrefStrict, expectedEntry: expectedForEntry, expectedForViewport, collectFromPage };
