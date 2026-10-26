// empty/nonempty 场景负例（MOCKED）：共用 real-chain-assert-9.cjs，不起浏览器/后台。
const chain = require("./real-chain-assert-9.cjs");
const nonEmpty = {
  upstream: { status: 200, courseIds: ["A", "B"], generatedAt: "T1" },
  commerce: { status: 200 },
  bff: { status: 200, state: "ready", source: "gateway", courses: ["A", "B"], generatedAt: "T1", pricingPlans: 0, skus: 0 },
};
const emptyOk = {
  upstream: { status: 200, courseIds: [], generatedAt: "T9" },
  commerce: { status: 200 },
  bff: { status: 200, state: "empty", source: "gateway", courses: [], generatedAt: "T9bff", coursesFacet: { state: "empty", stale: false, errorCode: null }, pricingPlans: 0, skus: 0 },
};
const priceOk = { priceCards: 0, purchaseLinks: 0, purchaseButtons: 0, emptyNoteVisible: true, recoveryCount: 0, errorCount: 0, pricingFacet: { state: "ready", stale: false, errorCode: null }, bffPlans: 0 };
const cases = [
  ["nonempty-valid", () => chain.assertNonemptyChain(nonEmpty, "t"), true],
  ["empty-valid", () => chain.assertEmptyChain(emptyOk, "t"), true],
  ["empty-generatedAt-differs-ok", () => chain.assertEmptyChain({ ...emptyOk, bff: { ...emptyOk.bff, generatedAt: "OTHER" } }, "t"), true],
  ["empty-nonempty-courses-fail", () => chain.assertEmptyChain({ ...emptyOk, upstream: { ...emptyOk.upstream, courseIds: ["A"] } }, "t"), false],
  ["empty-error-facet-fail", () => chain.assertEmptyChain({ ...emptyOk, bff: { ...emptyOk.bff, coursesFacet: { state: "error", stale: false, errorCode: "X" } } }, "t"), false],
  ["empty-stale-facet-fail", () => chain.assertEmptyChain({ ...emptyOk, bff: { ...emptyOk.bff, coursesFacet: { state: "ready", stale: true, errorCode: null } } }, "t"), false],
  ["empty-dom-ok", () => chain.assertEmptyCoursesDom({ cards: 0, emptyCopyVisible: true }, "t"), true],
  ["empty-dom-cards-fail", () => chain.assertEmptyCoursesDom({ cards: 2, emptyCopyVisible: true }, "t"), false],
  ["empty-dom-note-hidden-fail", () => chain.assertEmptyCoursesDom({ cards: 0, emptyCopyVisible: false }, "t"), false],
  ["commerce-plans-match", () => chain.assertCommercePricing({ upstreamPlans: [], bffPlans: [], bffSkus: 0 }, "t"), true],
  ["commerce-plans-mismatch-fail", () => chain.assertCommercePricing({ upstreamPlans: ["P1"], bffPlans: [], bffSkus: 0 }, "t"), false],
  ["price-valid", () => chain.assertPricingEmptyVisible(priceOk, "t"), true],
  ["price-missing-note-fail", () => chain.assertPricingEmptyVisible({ ...priceOk, emptyNoteVisible: false }, "t"), false],
  ["cookie-hit-fail", () => chain.assertNoBusinessCookies(["session-id"], "t"), false],
  ["cookie-clean-pass", () => chain.assertNoBusinessCookies(["yx.public.locale"], "t"), true],
];
(async () => {
  const log = { checkedAt: new Date().toISOString(), mocked: true, scope: "same real-chain-assert-9 module; synthetic facts only", rows: [], failedChecks: [] };
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
  const outDir = process.argv[2] || "evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/negative-chain-9";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "negative-chain-9.json"), JSON.stringify(log, null, 2));
  if (log.failedChecks.length) { console.error("NEGATIVE-RESULT: FAIL " + log.failedChecks.length); process.exit(1); }
  console.log("NEGATIVE-RESULT: PASS (MOCKED assertion proof only)");
})().catch((e) => { console.error("NEG-FAIL:" + (e.stack || e.message)); process.exit(1); });
