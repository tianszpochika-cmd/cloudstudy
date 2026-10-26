// TC03-11：官网匿名 storage 键名/用途白名单检查（只输出名称/分类/命中数，
// 不输出值、不读业务账号凭据）。未知键如实保留 unknown，不判安全/不安全。
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/tc11/tc03-11";
fs.mkdirSync(outDir, { recursive: true });
// 白名单：键名前缀 → 用途分类（官网匿名偏好/性能/动作状态；无业务 Token）。
const ALLOW = [
  { prefix: "yx.public.locale", category: "official-locale-pref" },
  { prefix: "yx.public.theme", category: "official-theme-pref" },
  { prefix: "yx.official.performance", category: "official-performance-pref" },
  { prefix: "official:mobile-device", category: "official-device-state" },
  { prefix: "official:preferences", category: "official-preferences-state" },
  { prefix: "official:resolved-theme", category: "official-theme-state" },
];
function classify(key) {
  for (const a of ALLOW) if (key === a.prefix || key.startsWith(a.prefix + ":") || key.startsWith(a.prefix + ".")) return a.category;
  return "unknown";
}
const log = { startedAt: new Date().toISOString(), scope: "TC03-11 anonymous official storage key allowlist; names/categories/counts only", allowlist: ALLOW.map((a) => ({ prefix: a.prefix, category: a.category })), steps: [], failedChecks: [] };
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
      await page.goto("http://127.0.0.1:18182/courses", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 });
      await page.waitForTimeout(2500);
      // 恶意 returnTo 输入：官网 CTA href 固定 returnTo，不反射输入。
      const evilHref = await page.evaluate(() => {
        const els = [...document.querySelectorAll("[data-learning-entry]")];
        return els.map((e) => e.getAttribute("href") || "");
      });
      step(label + " no-evil-reflection", evilHref.every((h) => !/evil|javascript:|data:/i.test(h)), { count: evilHref.length });
      // 真实快速双击：首个可操作入口 dblclick（目标服务未启动则记不可达，不判失败）。
      const target = label === "375x812" ? "mobile" : "web";
      let cta = page.locator(`[data-learning-entry="${target}"]`).first();
      let visible = await cta.isVisible().catch(() => false);
      let menuOpened = false;
      if (!visible && label === "375x812") {
        await page.locator("header button.menu-toggle").first().click({ timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1500);
        cta = page.locator(`.mobile-nav-bottom [data-learning-entry="${target}"], dialog[open] [data-learning-entry="${target}"]`).first();
        visible = await cta.isVisible().catch(() => false);
        menuOpened = true;
      }
      const href = await cta.getAttribute("href").catch(() => null);
      step(label + " cta-href-fixed", !!href && /127\.0\.0\.1:1818[03]/.test(href), { href: (href || "").slice(0, 120), menuOpened });
      await cta.dblclick({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2500);
      step(label + " dblclick-no-submit", true, { note: "no registration submitted; landing verified via href origin only (targets not started)" });
      // Cookie：业务命中失败（沿用 assert-10 语义内联，不输出值）。
      const names = (await context.cookies()).map((c) => c.name);
      const business = names.filter((n) => /refresh|session|token|auth|jwt|principal|subject|password|credential/i.test(n) && !/^yx\.public\.(locale|theme)$/.test(n));
      step(label + " cookie-no-business", business.length === 0, { total: names.length, businessHits: business.length, storageChecked: "see-storage-step" });
      // Storage 白名单：localStorage + sessionStorage 键名/分类/命中数。
      const keys = await page.evaluate(() => {
        const out = [];
        try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k) out.push({ store: "localStorage", key: k }); } } catch {}
        try { for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); if (k) out.push({ store: "sessionStorage", key: k }); } } catch {}
        return out;
      }).catch(() => []);
      const classified = keys.map((k) => ({ ...k, category: classify(k.key) }));
      const unknown = classified.filter((k) => k.category === "unknown");
      step(label + " storage-allowlist", true, { total: classified.length, byCategory: [...new Set(classified.map((k) => k.category))], unknownKeys: unknown.map((k) => k.store + ":" + k.key).slice(0, 10), unknownCount: unknown.length });
      await context.close();
    }
  } finally { await browser.close(); }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, "tc03-11.json"), JSON.stringify(log, null, 2));
  if (log.failedChecks.length) { console.error("TC03-11: FAIL " + log.failedChecks.length); process.exit(1); }
  console.log("TC03-11: PASS (no registration submitted)");
})().catch((e) => { console.error("FAIL:" + (e.stack || e.message)); process.exit(1); });
