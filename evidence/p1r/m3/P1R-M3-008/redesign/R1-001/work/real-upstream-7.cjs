// R1-001 版本7真实链采集器（修订8断言语义，不改文件名避免覆盖已固定证据时混淆）：
// DOM-BFF 对应 + 价格区域可见空说明 + Cookie 业务命中失败 + 截图哈希。
// 价格权威空 PASS 条件：facet 合法空/ready空、无价格卡、无购买链接/按钮、
// 价格区域可见空说明文本、排除 error/recovery 冒充。
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { assertNoBusinessCookies, assertChainFacts, assertCourseDomTitles, assertPricingEmptyVisible } = require("./real-chain-assert-8.cjs");
const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/real-upstream-7";
fs.mkdirSync(outDir, { recursive: true });
const origin = process.env.OFFICIAL_SITE_URL || "http://127.0.0.1:18182";
const startedAt = new Date().toISOString();
const log = { checkedAt: startedAt, origin, node: process.version, collector: "real-upstream-7.cjs", mocked: false, viewports: [], failedChecks: [] };
function record(name, ok, detail) {
  log.viewports.push({ check: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error("CHECK-FAIL:" + name + " " + JSON.stringify(detail || null).slice(0, 600)); }
  else console.log("CHECK-PASS:" + name);
}
function shaFile(p) { return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"); }
(async () => {
  const gwRes = await fetch("http://127.0.0.1:18070/api/v1/public/site/projection?uiLocale=zh-CN");
  const gwRequestId = gwRes.headers.get("x-request-id");
  const gwTraceId = gwRes.headers.get("x-trace-id");
  const gw = await gwRes.json();
  const gwCourses = (gw.data?.courses || []).map((c) => c.contentCode);
  log.upstream = { status: gwRes.status, requestIdPresent: !!gwRequestId, traceIdPresent: !!gwTraceId, courseCount: gwCourses.length, courseIds: gwCourses, projectionVersion: gw.data?.projectionVersion, contentEpoch: gw.data?.contentEpoch, generatedAt: gw.data?.generatedAt };
  const comRes = await fetch("http://127.0.0.1:18070/api/v1/public/commerce/catalog");
  const com = await comRes.json();
  log.commerce = { status: comRes.status, plans: (com.plans || []).length, catalogVersion: com.catalogVersion, productionPaymentEnabled: com.productionPaymentEnabled };
  const bffRes = await fetch("http://127.0.0.1:18182/api/public-projection?locale=zh-CN");
  const bff = await bffRes.json();
  log.bff = { status: bffRes.status, state: bff.state, source: bff.source, courses: (bff.projection?.courses || []).map((c) => c.id), generatedAt: bff.projection?.generatedAt, pricingFacet: bff.facets?.pricing, pricingPlans: (bff.projection?.pricingPlans || []).length, skus: (bff.projection?.skus || []).length };
  // 当轮归档：保存用于 DOM 对照的完整脱敏标题集合及来源（避免另一次未归档 fetch）。
  log.bffTitles = (bff.projection?.courses || []).map((c) => String(c.title || "").trim());
  // 真实链硬断言：HTTP/状态/来源/ID/版本对应（版本变动判快照不一致）。
  try {
    assertChainFacts({ upstream: log.upstream, commerce: log.commerce, bff: log.bff }, "chain");
    record("chain facts-linked", true, { courses: log.upstream.courseCount, generatedAt: log.upstream.generatedAt });
  } catch (e) { record("chain facts-linked", false, { error: String(e.message || e).slice(0, 300) }); }
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
      const label = viewport.width + "x" + viewport.height;
      const context = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
      const page = await context.newPage();
      const consoleErrors = [];
      page.on("pageerror", (e) => consoleErrors.push("pageerror:" + String(e.message || e).slice(0, 200)));
      page.on("console", (m) => { if (m.type() === "error") consoleErrors.push("console:" + m.text().slice(0, 200)); });
      {
        const response = await page.goto(origin + "/courses", { waitUntil: "domcontentloaded", timeout: 30000 });
        assert.equal(response.status(), 200);
        await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 });
        await page.locator(".public-course-card").first().waitFor({ state: "visible", timeout: 15000 });
        const cards = await page.locator(".public-course-card").count();
        const emptyCopy = await page.getByText("内容准备中").count().catch(() => -1);
        // DOM-BFF 对应：当轮归档标题集合逐项相等（BFF 用 contentCode 作 id）。
        const domTitles = await page.locator(".public-course-card h3").evaluateAll((els) => els.map((e) => e.innerText.trim()));
        let domOk = false, domDetail = {};
        try {
          assertCourseDomTitles(domTitles, log.bffTitles, label + " /courses");
          domOk = cards === log.upstream.courseCount && emptyCopy === 0;
          domDetail = { cards, upstreamCount: log.upstream.courseCount, emptyCopy, titlesMatch: true, domTitles: domTitles.slice(0, 3) };
        } catch (e) { domDetail = { cards, upstreamCount: log.upstream.courseCount, emptyCopy, titlesMatch: false, error: String(e.message || e).slice(0, 200) }; }
        record(label + " courses-dom-bff-linked", domOk === true, domDetail);
        await page.screenshot({ path: path.join(outDir, "courses-success-" + label + ".png"), fullPage: false });
      }
      {
        await page.goto(origin + "/pricing", { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 });
        await page.waitForTimeout(1200);
        const priceCards = await page.locator(".pricing-card, .sku-card, [data-pricing-card]").count().catch(() => -1);
        const purchaseLinks = await page.locator('a[href*="checkout"], a[href*="payment"], a[href*="order"]').count().catch(() => -1);
        const purchaseButtons = await page.getByRole("button", { name: /购买|下单|支付/ }).count().catch(() => -1);
        // 价格权威空限定 pricing 区域：可见空说明必须在区域内真实可见；
        // error/recovery 文案不算权威空；响应/页面当前状态以当轮 facet 核实。
        const pricingRegion = page.locator("main, .page-body, body").first();
        const emptyNoteVisible = await pricingRegion.getByText(/没有可购买|暂未发布|尚未开放|敬请期待|暂无/).first().isVisible().catch(() => false);
        const recoveryCount = await page.locator(".facet-recovery").count().catch(() => -1);
        const errorCount = await page.locator(".facet-error, [data-facet-state='error']").count().catch(() => -1);
        let priceOk = false, priceDetail = {};
        try {
          assertPricingEmptyVisible({ priceCards, purchaseLinks, purchaseButtons, emptyNoteVisible, recoveryCount, errorCount, pricingFacet: log.bff.pricingFacet, bffPlans: log.bff.pricingPlans }, label + " /pricing");
          priceOk = true;
          priceDetail = { priceCards, purchaseLinks, purchaseButtons, emptyNoteVisible, recoveryCount, errorCount, bffPricingFacet: log.bff.pricingFacet, bffPlans: log.bff.pricingPlans };
        } catch (e) { priceDetail = { priceCards, purchaseLinks, purchaseButtons, emptyNoteVisible, recoveryCount, errorCount, bffPricingFacet: log.bff.pricingFacet, bffPlans: log.bff.pricingPlans, error: String(e.message || e).slice(0, 200) }; }
        record(label + " pricing-authoritative-empty-visible", priceOk === true, priceDetail);
      }
      // Cookie 验收：业务命中即失败；仅记录官网相关名称/数量，不输出值。
      // storage（localStorage/sessionStorage）未检查，如实保留未执行。
      const cookies = await context.cookies();
      const names = cookies.map((c) => c.name);
      try {
        const cookieProof = assertNoBusinessCookies(names, label + " /courses");
        record(label + " cookie-no-business", true, { total: cookieProof.total, official: cookieProof.official, businessHits: cookieProof.businessHits, storageChecked: false });
      } catch (e) { record(label + " cookie-no-business", false, { names: names.slice(0, 20), error: String(e.message || e).slice(0, 200), storageChecked: false }); }
      record(label + " console-clean", consoleErrors.length === 0, { errors: consoleErrors.slice(0, 5) });
      await context.close();
    }
  } finally { await browser.close(); }
  log.finishedAt = new Date().toISOString();
  const shots = ["courses-success-375x812.png", "courses-success-1440x900.png"].map((f) => ({ file: f, sha256: fs.existsSync(path.join(outDir, f)) ? shaFile(path.join(outDir, f)) : null }));
  log.screenshots = shots;
  fs.writeFileSync(path.join(outDir, "real-upstream-7.json"), JSON.stringify(log, null, 2));
  if (log.failedChecks.length) { console.error("RESULT: FAIL " + log.failedChecks.length); process.exit(1); }
  console.log("RESULT: PASS");
})().catch((e) => { console.error("FAIL:" + (e.stack || e.message)); process.exit(1); });
