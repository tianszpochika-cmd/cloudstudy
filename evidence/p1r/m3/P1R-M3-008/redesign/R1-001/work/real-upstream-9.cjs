// R1-001 版本9真实链采集器：nonempty（沿用成功态）+ empty（专用空 schema）双场景。
// 空态 generatedAt 动态：保存页面实际使用的 BFF 响应并关联其更新时间，不跨
// 请求逐字相等。价格说明限定真实价格容器 .page-body .container；错误排除用
// 当轮 facet + 组件可见重试语义（PublicStatus 非 empty/loading 才有重试按钮）。
// Cookie 业务命中失败。输出 outDir(real-upstream-9)，不覆盖已固定证据。
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const chain = require("./real-chain-assert-9.cjs");
const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/real-upstream-9";
fs.mkdirSync(outDir, { recursive: true });
const origin = process.env.OFFICIAL_SITE_URL || "http://127.0.0.1:18182";
const scenario = process.env.R1_001_SCENARIO === "empty" ? "empty" : "nonempty";
const startedAt = new Date().toISOString();
const log = { checkedAt: startedAt, origin, node: process.version, collector: "real-upstream-9.cjs", scenario, mocked: false, viewports: [], failedChecks: [] };
function record(name, ok, detail) {
  log.viewports.push({ check: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error("CHECK-FAIL:" + name + " " + JSON.stringify(detail || null).slice(0, 600)); }
  else console.log("CHECK-PASS:" + name);
}
function shaFile(p) { return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"); }
(async () => {
  const gwRes = await fetch("http://127.0.0.1:18070/api/v1/public/site/projection?uiLocale=zh-CN");
  const gw = await gwRes.json();
  const gwCourses = (gw.data?.courses || []).map((c) => c.contentCode);
  log.upstream = { status: gwRes.status, requestIdPresent: !!gwRes.headers.get("x-request-id"), traceIdPresent: !!gwRes.headers.get("x-trace-id"), courseCount: gwCourses.length, courseIds: gwCourses, generatedAt: gw.data?.generatedAt };
  const comRes = await fetch("http://127.0.0.1:18070/api/v1/public/commerce/catalog");
  const com = await comRes.json();
  const upstreamPlans = (com.plans || []).map((p) => p.skuId || p.id);
  log.commerce = { status: comRes.status, plans: upstreamPlans.length, planIds: upstreamPlans, catalogVersion: com.catalogVersion, productionPaymentEnabled: com.productionPaymentEnabled };
  const bffRes = await fetch("http://127.0.0.1:18182/api/public-projection?locale=zh-CN");
  const bff = await bffRes.json();
  log.bff = { status: bffRes.status, state: bff.state, source: bff.source, courses: (bff.projection?.courses || []).map((c) => c.id), generatedAt: bff.projection?.generatedAt, coursesFacet: bff.facets?.courses, pricingFacet: bff.facets?.pricing, pricingPlans: (bff.projection?.pricingPlans || []).length, planIds: (bff.projection?.pricingPlans || []).map((p) => p.id), skus: (bff.projection?.skus || []).length };
  log.bffTitles = (bff.projection?.courses || []).map((c) => String(c.title || "").trim());
  try {
    if (scenario === "empty") chain.assertEmptyChain({ upstream: log.upstream, commerce: log.commerce, bff: log.bff }, "chain");
    else chain.assertNonemptyChain({ upstream: log.upstream, commerce: log.commerce, bff: log.bff }, "chain");
    record("chain facts-linked", true, { scenario, courses: log.upstream.courseCount, generatedAt: log.upstream.generatedAt });
  } catch (e) { record("chain facts-linked", false, { scenario, error: String(e.message || e).slice(0, 300) }); }
  try {
    chain.assertCommercePricing({ upstreamPlans: log.commerce.planIds, bffPlans: log.bff.planIds, bffSkus: log.bff.skus }, "chain");
    record("chain commerce-pricing", true, { plans: log.commerce.plans });
  } catch (e) { record("chain commerce-pricing", false, { error: String(e.message || e).slice(0, 300) }); }
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
        const cards = await page.locator(".public-course-card").count();
        if (scenario === "empty") {
          const region = page.locator(".published-courses, .page-body .container").first();
          const emptyCopyVisible = await region.getByText("内容准备中").first().isVisible().catch(() => false);
          let ok = false, detail = {};
          try { chain.assertEmptyCoursesDom({ cards, emptyCopyVisible }, label + " /courses"); ok = cards === 0; detail = { cards, emptyCopyVisible, bffUpdatedAt: log.bff.generatedAt }; }
          catch (e) { detail = { cards, emptyCopyVisible, error: String(e.message || e).slice(0, 200) }; }
          record(label + " courses-empty-linked", ok === true, detail);
        } else {
          await page.locator(".public-course-card").first().waitFor({ state: "visible", timeout: 15000 });
          const emptyCopy = await page.getByText("内容准备中").count().catch(() => -1);
          const domTitles = await page.locator(".public-course-card h3").evaluateAll((els) => els.map((e) => e.innerText.trim()));
          let ok = false, detail = {};
          try { chain.assertCourseDomTitles(domTitles, log.bffTitles, label + " /courses"); ok = cards === log.upstream.courseCount && emptyCopy === 0; detail = { cards, upstreamCount: log.upstream.courseCount, emptyCopy, titlesMatch: true }; }
          catch (e) { detail = { cards, upstreamCount: log.upstream.courseCount, emptyCopy, error: String(e.message || e).slice(0, 200) }; }
          record(label + " courses-dom-bff-linked", ok === true, detail);
        }
        await page.screenshot({ path: path.join(outDir, `courses-${scenario}-` + label + ".png"), fullPage: false });
      }
      {
        await page.goto(origin + "/pricing", { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 });
        await page.waitForTimeout(1200);
        const priceCards = await page.locator(".pricing-card, .sku-card, [data-pricing-card]").count().catch(() => -1);
        const purchaseLinks = await page.locator('a[href*="checkout"], a[href*="payment"], a[href*="order"]').count().catch(() => -1);
        const purchaseButtons = await page.getByRole("button", { name: /购买|下单|支付/ }).count().catch(() => -1);
        // 真实价格容器限定；错误排除用当轮 facet + 组件可见重试语义。
        const pricingRegion = page.locator(".page-body .container").first();
        const emptyNoteVisible = await pricingRegion.getByText(/没有可购买|暂未发布|尚未开放|敬请期待|暂无/).first().isVisible().catch(() => false);
        const recoveryCount = await page.locator(".facet-recovery").count().catch(() => -1);
        const retryVisible = await page.getByRole("button", { name: /重试|重新加载/ }).first().isVisible().catch(() => false);
        const facetError = log.bff.pricingFacet && !["ready", "empty"].includes(log.bff.pricingFacet.state);
        let ok = false, detail = {};
        try {
          chain.assertPricingEmptyVisible({ priceCards, purchaseLinks, purchaseButtons, emptyNoteVisible, recoveryCount, errorCount: (facetError || retryVisible) ? 1 : 0, pricingFacet: log.bff.pricingFacet, bffPlans: log.bff.pricingPlans }, label + " /pricing");
          ok = true; detail = { priceCards, purchaseLinks, purchaseButtons, emptyNoteVisible, recoveryCount, retryVisible, bffPricingFacet: log.bff.pricingFacet };
        } catch (e) { detail = { priceCards, purchaseLinks, purchaseButtons, emptyNoteVisible, recoveryCount, retryVisible, error: String(e.message || e).slice(0, 200) }; }
        record(label + " pricing-authoritative-empty-visible", ok === true, detail);
      }
      const cookies = await context.cookies();
      const names = cookies.map((c) => c.name);
      try {
        const proof = chain.assertNoBusinessCookies(names, label + " /courses");
        record(label + " cookie-no-business", true, { total: proof.total, official: proof.official, businessHits: proof.businessHits, storageChecked: false });
      } catch (e) { record(label + " cookie-no-business", false, { names: names.slice(0, 20), error: String(e.message || e).slice(0, 200), storageChecked: false }); }
      record(label + " console-clean", consoleErrors.length === 0, { errors: consoleErrors.slice(0, 5) });
      await context.close();
    }
  } finally { await browser.close(); }
  log.finishedAt = new Date().toISOString();
  const shots = [`courses-${scenario}-375x812.png`, `courses-${scenario}-1440x900.png`].map((f) => ({ file: f, sha256: fs.existsSync(path.join(outDir, f)) ? shaFile(path.join(outDir, f)) : null }));
  log.screenshots = shots;
  fs.writeFileSync(path.join(outDir, `real-upstream-9-${scenario}.json`), JSON.stringify(log, null, 2));
  if (log.failedChecks.length) { console.error("RESULT: FAIL " + log.failedChecks.length); process.exit(1); }
  console.log("RESULT: PASS scenario=" + scenario);
})().catch((e) => { console.error("FAIL:" + (e.stack || e.message)); process.exit(1); });
