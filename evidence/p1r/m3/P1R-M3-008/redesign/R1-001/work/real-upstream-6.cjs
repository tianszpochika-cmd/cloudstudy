const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/real-upstream-6";
fs.mkdirSync(outDir, { recursive: true });
const origin = "http://127.0.0.1:18182";
const startedAt = new Date().toISOString();
const log = { checkedAt: startedAt, origin, scope: "real Gateway18070+content/commerce upstream with version/ID/trace linkage", viewports: [], failedChecks: [] };
function record(name, ok, detail) {
  log.viewports.push({ check: name, ok, detail: detail || null });
  if (!ok) { log.failedChecks.push(name); console.error("CHECK-FAIL:" + name + " " + JSON.stringify(detail || null).slice(0, 600)); }
  else console.log("CHECK-PASS:" + name);
}
(async () => {
  // 同轮上游→Gateway→BFF 事实固定（含 request/trace 脱敏关联）。
  const gwRes = await fetch("http://127.0.0.1:18070/api/v1/public/site/projection?uiLocale=zh-CN");
  const gwRequestId = gwRes.headers.get("x-request-id");
  const gwTraceId = gwRes.headers.get("x-trace-id");
  const gw = await gwRes.json();
  const gwCourses = (gw.data?.courses || []).map((c) => c.contentCode);
  const gwVersion = { projectionVersion: gw.data?.projectionVersion, contentEpoch: gw.data?.contentEpoch, generatedAt: gw.data?.generatedAt };
  log.upstream = { status: gwRes.status, requestIdPresent: !!gwRequestId, traceIdPresent: !!gwTraceId, courseCount: gwCourses.length, courseIds: gwCourses, ...gwVersion };
  const comRes = await fetch("http://127.0.0.1:18070/api/v1/public/commerce/catalog");
  const com = await comRes.json();
  log.commerce = { status: comRes.status, plans: (com.plans || []).length, catalogVersion: com.catalogVersion, productionPaymentEnabled: com.productionPaymentEnabled };
  const bffRes = await fetch("http://127.0.0.1:18182/api/public-projection?locale=zh-CN");
  const bff = await bffRes.json();
  log.bff = { status: bffRes.status, state: bff.state, source: bff.source, courses: (bff.projection?.courses || []).map((c) => c.id), generatedAt: bff.projection?.generatedAt, pricingFacet: bff.facets?.pricing, pricingPlans: (bff.projection?.pricingPlans || []).length, skus: (bff.projection?.skus || []).length };
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
        const titles = await page.locator(".public-course-card h3").evaluateAll((els) => els.map((e) => e.innerText.slice(0, 40)));
        const domIds = await page.locator(".public-course-card").evaluateAll((els) => els.map((e) => e.getAttribute("data-course-id") || e.querySelector("h3")?.textContent?.slice(0, 40)));
        record(label + " courses-success-linked", cards === log.upstream.courseCount && emptyCopy === 0, { cards, upstreamCount: log.upstream.courseCount, emptyCopy, titles: titles.slice(0, 3) });
        await page.screenshot({ path: path.join(outDir, "courses-success-" + label + ".png"), fullPage: false });
      }
      {
        await page.goto(origin + "/pricing", { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.locator("h1").first().waitFor({ state: "visible", timeout: 15000 });
        await page.waitForTimeout(1200);
        const body = await page.content();
        const priceCards = await page.locator(".pricing-card, .sku-card, [data-pricing-card]").count().catch(() => -1);
        const purchaseLinks = await page.locator('a[href*="checkout"], a[href*="payment"], a[href*="order"]').count().catch(() => -1);
        const purchaseButtons = await page.getByRole("button", { name: /购买|下单|支付/ }).count().catch(() => -1);
        const emptyNote = body.includes("暂无") || body.includes("敬请期待") || body.includes("尚未开放") || body.includes("暂未发布") || body.includes("没有可购买");
        const facetOk = log.bff.pricingFacet && (log.bff.pricingFacet.state === "empty" || (log.bff.pricingFacet.state === "ready" && log.bff.pricingPlans === 0));
        record(label + " pricing-authoritative-empty", priceCards === 0 && purchaseLinks === 0 && purchaseButtons === 0 && facetOk === true, { priceCards, purchaseLinks, purchaseButtons, emptyNote, bffPricingFacet: log.bff.pricingFacet, bffPlans: log.bff.pricingPlans });
      }
      record(label + " console-clean", consoleErrors.length === 0, { errors: consoleErrors.slice(0, 5) });
      await context.close();
    }
  } finally { await browser.close(); }
  log.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, "real-upstream-6.json"), JSON.stringify(log, null, 2));
  if (log.failedChecks.length) { console.error("RESULT: FAIL " + log.failedChecks.length); process.exit(1); }
  console.log("RESULT: PASS");
})().catch((e) => { console.error("FAIL:" + (e.stack || e.message)); process.exit(1); });
