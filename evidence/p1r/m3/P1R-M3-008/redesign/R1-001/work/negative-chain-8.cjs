// 真实链负例（MOCKED）：调用同一实际断言模块 real-chain-assert-8.cjs，
// 覆盖非200、错误ID/时间、缺空说明、Cookie 命中。不起浏览器/后台。
const { assertNoBusinessCookies, assertChainFacts, assertCourseDomTitles, assertPricingEmptyVisible } = require("./real-chain-assert-8.cjs");
const base = {
  upstream: { status: 200, courseIds: ["DEMO-P5-GRAMMAR-A1", "DEMO-P5-LISTEN-A2"], generatedAt: "2026-09-27T17:05:36.703141Z" },
  commerce: { status: 200 },
  bff: { status: 200, state: "ready", source: "gateway", courses: ["DEMO-P5-GRAMMAR-A1", "DEMO-P5-LISTEN-A2"], generatedAt: "2026-09-27T17:05:36.703141Z", pricingPlans: 0, skus: 0 },
};
const basePrice = { priceCards: 0, purchaseLinks: 0, purchaseButtons: 0, emptyNoteVisible: true, recoveryCount: 0, errorCount: 0, pricingFacet: { state: "ready", stale: false, errorCode: null }, bffPlans: 0 };
const cases = [
  ["valid-chain", () => assertChainFacts(base, "t"), true],
  ["non-200-upstream", () => assertChainFacts({ ...base, upstream: { ...base.upstream, status: 503 } }, "t"), false],
  ["non-200-bff", () => assertChainFacts({ ...base, bff: { ...base.bff, status: 502 } }, "t"), false],
  ["wrong-course-ids", () => assertChainFacts({ ...base, bff: { ...base.bff, courses: ["WRONG-ID"] } }, "t"), false],
  ["wrong-generatedAt", () => assertChainFacts({ ...base, bff: { ...base.bff, generatedAt: "2026-01-01T00:00:00Z" } }, "t"), false],
  ["wrong-bff-state", () => assertChainFacts({ ...base, bff: { ...base.bff, state: "error" } }, "t"), false],
  ["dom-titles-match", () => assertCourseDomTitles(["A", "B"], ["A", "B"], "t"), true],
  ["dom-titles-mismatch", () => assertCourseDomTitles(["A", "X"], ["A", "B"], "t"), false],
  ["price-valid", () => assertPricingEmptyVisible(basePrice, "t"), true],
  ["price-missing-note", () => assertPricingEmptyVisible({ ...basePrice, emptyNoteVisible: false }, "t"), false],
  ["price-recovery-present", () => assertPricingEmptyVisible({ ...basePrice, recoveryCount: 1 }, "t"), false],
  ["price-error-present", () => assertPricingEmptyVisible({ ...basePrice, errorCount: 1 }, "t"), false],
  ["cookie-clean-pass", () => assertNoBusinessCookies(["yx.public.locale", "yx.public.theme"], "t"), true],
  ["cookie-business-fail", () => assertNoBusinessCookies(["yx.public.locale", "session-id"], "t"), false],
  ["cookie-token-fail", () => assertNoBusinessCookies(["auth-token"], "t"), false],
];
(async () => {
  const log = { checkedAt: new Date().toISOString(), mocked: true, scope: "same real-chain-assert-8 module; synthetic facts only, no browser/backend", rows: [], failedChecks: [] };
  for (const [name, fn, expectedAccepted] of cases) {
    let accepted = true, error = null;
    try { fn(); } catch (e) { accepted = false; error = String(e.message || e).slice(0, 300); }
    const ok = accepted === expectedAccepted;
    log.rows.push({ name, expectedAccepted, accepted, matchesExpectation: ok, error });
    if (ok) console.log("NEG-PASS:" + name);
    else { log.failedChecks.push(name); console.error("NEG-FAIL:" + name); }
  }
  const fs = require("node:fs");
  const path = require("node:path");
  const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/negative-chain-8";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "negative-chain-8.json"), JSON.stringify(log, null, 2));
  if (log.failedChecks.length) { console.error("NEGATIVE-RESULT: FAIL " + log.failedChecks.length); process.exit(1); }
  console.log("NEGATIVE-RESULT: PASS (MOCKED assertion proof only)");
})().catch((e) => { console.error("NEG-FAIL:" + (e.stack || e.message)); process.exit(1); });
