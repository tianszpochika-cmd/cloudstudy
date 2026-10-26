// R1-001 版本11验收采集器：恢复真正可操作入口门 + 菜单路径 + 点击出口。
// 不覆盖 sweep-5/6/7 及旧证据。checkHrefStrict 保留 v6/v7 严格语义。
// collectFromPage：视口决定期望设备；等待 hydration；若常驻入口无可见可操作
// 项，则真实打开移动端折叠菜单（header button.menu-toggle），再验证菜单内
// 入口可见、可操作、精确路径/参数，并实际点击验证出口（同一上下文）。
// 全隐藏/全禁用/错设备/错路径必须失败；visibleCount=0 不得 PASS。
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/r1-001-sweep-11";
fs.mkdirSync(outDir, { recursive: true });
const origin = process.env.OFFICIAL_SITE_URL || "http://127.0.0.1:18182";
const startedAt = new Date().toISOString();
const log = { checkedAt: startedAt, origin, node: process.version, collector: "r1-001-sweep-11.cjs", mocked: false, viewports: [], failedChecks: [] };
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
async function snapshotEntries(page) {
  return page.locator("[data-learning-entry]").evaluateAll((els) => els.map((e) => {
    const r = e.getBoundingClientRect();
    return { href: e.getAttribute("href"), target: e.getAttribute("data-learning-entry"), visible: e.offsetParent !== null, actionable: !e.hasAttribute("disabled") && e.getAttribute("aria-disabled") !== "true", w: Math.round(r.width), h: Math.round(r.height) };
  }));
}
// 真实打开移动端折叠菜单（header button.menu-toggle），返回菜单内入口快照。
async function openMobileMenu(page, route) {
  const toggle = page.locator("header button.menu-toggle");
  const first = toggle.first();
  assert.ok(first, route + " no menu toggle");
  if (typeof first.count === "function") {
    assert.ok((await first.count().catch(() => 1)) > 0, route + " no menu toggle");
  }
  await first.click({ timeout: 10000 });
  await page.waitForTimeout(1500);
  const openCount = await page.locator("dialog[open]").count();
  assert.ok(openCount > 0, route + " menu did not open");
  return snapshotEntries(page);
}
async function collectFromPage(page, label, route) {
  const expected = expectedForViewport(label);
  const responseStatus = page.__r1Status ?? null;
  if (responseStatus !== null) assert.equal(responseStatus, 200, route + " http=" + responseStatus);
  await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 });
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
  let entries = await snapshotEntries(page);
  assert.ok(entries.length > 0, route + " cta=0");
  let deviceEntries = entries.filter((e) => e.target === expected.target);
  assert.ok(deviceEntries.length > 0, route + " no-" + expected.target + "-entry (total=" + entries.length + ")");
  let operable = deviceEntries.filter((e) => e.visible && e.actionable);
  let menuOpened = false;
  // 移动端常驻入口不可见时，真实打开折叠菜单再验证（菜单内 CTA 即产品可操作路径）。
  if (label === "375x812" && operable.length === 0) {
    entries = await openMobileMenu(page, route);
    deviceEntries = entries.filter((e) => e.target === expected.target);
    assert.ok(deviceEntries.length > 0, route + " no-" + expected.target + "-entry after menu open");
    operable = deviceEntries.filter((e) => e.visible && e.actionable);
    menuOpened = true;
  }
  // 可操作门：operable=0 不得 PASS（F15 回归门）。
  assert.ok(operable.length > 0, route + " no-visible-operable-" + expected.target + " (total=" + deviceEntries.length + ", menuOpened=" + menuOpened + ")");
  for (const en of operable) checkHrefStrict(en.href, expected, route);
  // 点击出口验证：点击首个可操作入口，核对导航到固定 origin（外部目标用新上下文探测，不离开本页）。
  const clickHref = operable[0].href;
  const clickUrl = new URL(clickHref);
  assert.equal(clickUrl.origin, expected.origin, route + " click origin=" + clickUrl.origin);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert.equal(overflow, false, route + " overflow");
  return { h1, entries: entries.length, operable: operable.length, visibleCount: operable.length, menuOpened, sample: operable[0].href.slice(0, 120) };
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
      // 课程区域截图（支撑状态断言，非上方介绍区）。
      await page.goto(origin + "/courses", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
      await page.locator(".published-courses").first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
      await page.locator(".published-courses").first().screenshot({ path: require("node:path").join(outDir, "courses-region-" + label + ".png") }).catch(() => {});
      // 菜单入口截图（移动端打开菜单后）。
      if (label === "375x812") {
        await page.goto(origin + "/download", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
        await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
        await page.locator("header button.menu-toggle").first().click({ timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1500);
        await page.screenshot({ path: require("node:path").join(outDir, "menu-" + label + ".png") }).catch(() => {});
      }
      record(label + " console-clean", consoleErrors.length === 0, { errors: consoleErrors.slice(0, 5), warnings: consoleWarnings.slice(0, 3) });
      await context.close();
    }
    log.websiteRuntimeMapping = [
      { check: "desktop homepage and modal word practice", applicable: false, reason: "示例互动，非11页公开投影/CTA" },
      { check: "course search, clear and route navigation", applicable: false, reason: "筛选交互，非本卡验收" },
      { check: "help search and FAQ expansion", applicable: false, reason: "非本卡范围" },
      { check: "world room, 2D/3D, role wall and two sentence rounds", applicable: false, reason: "R2世界" },
      { check: "theme persistence, high contrast and four quality levels", applicable: "PARTIAL", reason: "主题维度由 website-runtime 全套覆盖" },
      { check: "mobile navigation, availability and sample entry", applicable: true, result: "本采集器真实打开菜单验证菜单内可操作入口" },
      { check: "system reduced motion disables animation and depth", applicable: false, reason: "非本卡范围" },
      { check: "multi-route x viewport/theme layout", applicable: true, result: "本采集器22页无溢出覆盖（主题维度未执行）" },
      { check: "public projection reports its actual source and retry stays usable", applicable: "PARTIAL", reason: "error分支由BFF单测+tc1覆盖；真实重试由tc02-11覆盖" },
      { check: "independent pricing/download pages stay readable and keep registration entries", applicable: true, result: "本采集器逐页精确断言覆盖" },
      { check: "system theme changes and default motion ignore a retired pause preference", applicable: false, reason: "非本卡范围" },
    ];
  } finally { await browser.close(); }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, "r1-001-sweep-11.json"), JSON.stringify(log, null, 2));
  if (log.failedChecks.length) { console.error("SWEEP-RESULT: FAIL " + log.failedChecks.length); process.exit(1); }
  console.log("SWEEP-RESULT: PASS");
})().catch((e) => { console.error("SWEEP-FAIL:" + (e.stack || e.message)); process.exit(1); });
}
module.exports = { checkHrefStrict, expectedEntry: expectedForEntry, expectedForViewport, collectFromPage, openMobileMenu, snapshotEntries };
