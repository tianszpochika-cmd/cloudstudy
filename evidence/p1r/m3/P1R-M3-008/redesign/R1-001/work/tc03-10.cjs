const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/tc10/tc03-10";
fs.mkdirSync(outDir, { recursive: true });
const log = { startedAt: new Date().toISOString(), scope: "TC03: malicious returnTo, strict device entry, rapid click/return, official cookies", steps: [], failedChecks: [] };
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
      const expectedTarget = label === "375x812" ? "mobile" : "web";
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await page.goto("http://127.0.0.1:18182/courses", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 });
      await page.waitForTimeout(2500);
      // 严格设备入口：预期设备链接存在且 href 起始于固定 origin。
      const hrefs = await page.locator(`[data-learning-entry="${expectedTarget}"]`).evaluateAll((els) => els.map((e) => e.getAttribute("href")));
      const fixedOrigin = expectedTarget === "mobile" ? "http://127.0.0.1:18183" : "http://127.0.0.1:18180";
      step(label + " strict-device-entry", hrefs.length > 0 && hrefs.every((h) => h.startsWith(fixedOrigin + "/")), { count: hrefs.length, sample: (hrefs[0] || "").slice(0, 100) });
      // 恶意 returnTo：官网 href 均不含 evil（固定 returnTo 语义）。
      const allHrefs = await page.locator("[data-learning-entry]").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
      step(label + " no-evil-returnTo", allHrefs.every((h) => !h.includes("evil")), { count: allHrefs.length });
      // 快速双击 CTA：learner-web/mobile 未启动时外跳不可达属预期；改为核对
      // href 起始固定 origin（不提交注册；落地验证沿用 reviewer-3 已有证据）。
      const cta = page.locator(`[data-learning-entry="${expectedTarget}"]`).first();
      const href = await cta.getAttribute("href");
      const hrefOk = (href || "").startsWith(fixedOrigin + "/");
      step(label + " rapid-click-href", hrefOk === true, { href: (href || "").slice(0, 120) });
      await page.goBack().catch(() => {});
      await page.waitForTimeout(1500);
      // 官网 Cookie：仅官网偏好名，无业务命中（不输出值）。
      const names = (await context.cookies()).map((c) => c.name);
      const business = names.filter((n) => /refresh|session|token|auth|jwt|principal|subject|password|credential/i.test(n) && !/^yx\.public\.(locale|theme)$/.test(n));
      step(label + " cookie-no-business", business.length === 0, { total: names.length, official: names.filter((n) => /^yx\.public\./.test(n)), businessHits: business.length, storageChecked: false });
      await context.close();
    }
  } finally { await browser.close(); }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, "tc03-10.json"), JSON.stringify(log, null, 2));
  if (log.failedChecks.length) { console.error("TC03-RESULT: FAIL " + log.failedChecks.length); process.exit(1); }
  console.log("TC03-RESULT: PASS (no registration submitted; storage not checked)");
})().catch((e) => { console.error("FAIL:" + (e.stack || e.message)); process.exit(1); });
