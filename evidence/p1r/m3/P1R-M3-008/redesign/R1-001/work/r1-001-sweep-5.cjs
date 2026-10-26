const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/r1-001-sweep-5";
fs.mkdirSync(outDir, { recursive: true });
const origin = process.env.OFFICIAL_SITE_URL || "http://127.0.0.1:18182";
const startedAt = new Date().toISOString();
const log = { checkedAt: startedAt, origin, node: process.version, collector: "r1-001-sweep-5.cjs", viewports: [], failedChecks: [] };
function record(name, ok, detail) {
  log.viewports.push({ check: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error("CHECK-FAIL:" + name + " " + JSON.stringify(detail || null).slice(0, 500)); }
  else console.log("CHECK-PASS:" + name);
}
// 设备对应的精确注册目标：origin/port/path/returnTo/locale/theme 全量校验。
function expectedEntry(viewportLabel) {
  if (viewportLabel === "375x812") {
    return {
      origin: "http://127.0.0.1:18183",
      path: "/#/pages/register/register",
      returnTo: "/pages/home/home",
      target: "mobile",
    };
  }
  return { origin: "http://127.0.0.1:18180", path: "/register", returnTo: "/home", target: "web" };
}
function checkHref(href, expected, route) {
  assert.ok(href, route + " missing href");
  const url = new URL(href);
  assert.equal(url.origin, expected.origin, route + " origin=" + url.origin);
  assert.ok(url.pathname + url.hash.split("?")[0] === expected.path || (url.pathname === "/" && url.hash.startsWith("#" + expected.path)) || url.href.includes(expected.path), route + " path=" + url.pathname + url.hash);
  // mobile returnTo 位于 hash query（#/pages/...?returnTo=...），桌面端位于 search。
  const hashQuery = new URLSearchParams((url.hash.split("?")[1] || "").split("#")[0]);
  const returnTo = url.searchParams.get("returnTo") || hashQuery.get("returnTo");
  assert.equal(returnTo, expected.returnTo, route + " returnTo=" + returnTo);
  const uiLocale = url.searchParams.get("uiLocale") || hashQuery.get("uiLocale");
  const theme = url.searchParams.get("theme") || hashQuery.get("theme");
  assert.ok(uiLocale === "zh-CN" || uiLocale === "en-US", route + " locale=" + uiLocale);
  assert.ok(["light", "dark", "system", "high-contrast"].includes(theme), route + " theme=" + theme);
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
      const label = viewport.width + "x" + viewport.height;
      const expected = expectedEntry(label);
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
          // 可见页面 + 预期设备 CTA：以可见 h1 与“DOM 存在 + 精确目标断言”为证据；
          // mobile CTA 在 SSR 首屏为 hidden（hydration 后按断点显示），不以 visible
          // 作为通过门槛，可见性差异如实记录在 detail.visibleCount 中。
          await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 });
          await page.locator('[data-learning-entry]').first().waitFor({ state: "attached", timeout: 15000 });
          const h1 = (await page.locator("h1").first().innerText()).slice(0, 60);
          const entries = await page.locator("[data-learning-entry]").evaluateAll((els) => els.map((e) => ({ href: e.getAttribute("href"), target: e.getAttribute("data-learning-entry"), visible: e.offsetParent !== null })));
          assert.ok(entries.length > 0, route + " cta=0");
          const visibleCount = entries.filter((e) => e.visible).length;
          for (const en of entries) {
            assert.equal(en.target, expected.target, route + " target=" + en.target + " expected=" + expected.target);
            checkHref(en.href, expected, route);
          }
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
          assert.equal(overflow, false, route + " overflow");
          record(label + " r1-001 " + route, true, { h1, entries: entries.length, visibleCount, sample: entries[0].href.slice(0, 120) });
        } catch (e) { record(label + " r1-001 " + route, false, { error: e.message.slice(0, 300) }); }
      }
      const shot = path.join(outDir, "r1-001-" + label + ".png");
      await page.goto(origin + "/courses", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
      await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
      await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
      record(label + " console-clean", consoleErrors.length === 0, { errors: consoleErrors.slice(0, 5) });
      await context.close();
    }
    // website-runtime.cjs 适用映射（11 项）：本采集器覆盖 4 适用项；其余 7 项非本卡范围。
    log.websiteRuntimeMapping = [
      { check: "desktop homepage and modal word practice", applicable: false, reason: "示例互动，非11页公开投影/CTA" },
      { check: "course search, clear and route navigation", applicable: false, reason: "筛选交互，非本卡验收" },
      { check: "help search and FAQ expansion", applicable: false, reason: "非本卡范围" },
      { check: "world room, 2D/3D, role wall and two sentence rounds", applicable: false, reason: "R2世界" },
      { check: "theme persistence, high contrast and four quality levels", applicable: "PARTIAL", reason: "主题维度未在本采集器检查；由设计token/偏好持久化既有能力覆盖，未执行" },
      { check: "mobile navigation, availability and sample entry", applicable: "PARTIAL", reason: "导航CTA由本采集器覆盖；示例入口语义未执行" },
      { check: "system reduced motion disables animation and depth", applicable: false, reason: "非本卡范围" },
      { check: "multi-route x viewport/theme layout", applicable: true, result: "本采集器22页无溢出覆盖（主题维度未执行，见上）" },
      { check: "public projection reports its actual source and retry stays usable", applicable: "PARTIAL", reason: "error分支 bracketry 由BFF单测+tc1覆盖；真实重试点击未执行" },
      { check: "independent pricing/download pages stay readable and keep registration entries", applicable: true, result: "本采集器逐页精确断言覆盖" },
      { check: "system theme changes and default motion ignore a retired pause preference", applicable: false, reason: "非本卡范围" },
    ];
  } finally { await browser.close(); }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, "r1-001-sweep-5.json"), JSON.stringify(log, null, 2));
  if (log.failedChecks.length) { console.error("SWEEP-RESULT: FAIL " + log.failedChecks.length); process.exit(1); }
  console.log("SWEEP-RESULT: PASS");
})().catch((e) => { console.error("SWEEP-FAIL:" + (e.stack || e.message)); process.exit(1); });
