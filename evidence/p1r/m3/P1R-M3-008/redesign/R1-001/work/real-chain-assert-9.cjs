// R1-001 nonempty/empty 场景断言模块（-9）：保留已通过非空语义，另加 empty 场景。
// 空态：Gateway/BFF 课程数组 []、课程 facet 非 error/permission/maintenance 且
// 不 stale、DOM 零卡 +“内容准备中”可见。空目录 generatedAt 动态，不跨请求
// 逐字相等；保存页面实际使用的 BFF 响应并关联更新时间。价格事实需上游/BFF
// 对应；未比较的版本字段不声称已验证。真实采集与负例共用。
const assert = require("node:assert/strict");
const base8 = require("./real-chain-assert-8.cjs");

const LEGAL_COURSE_FACETS = ["ready", "empty", "recovery", "loading"];

function assertNonemptyChain({ upstream, commerce, bff }, route) {
  return base8.assertChainFacts({ upstream, commerce, bff }, route);
}

// 空态链：课程数组 []；facet 合法非错；generatedAt 仅要求当轮 BFF 自洽
//（页面使用同一 BFF 响应的更新时间），不跨 GET 逐字相等。
function assertEmptyChain({ upstream, commerce, bff }, route) {
  assert.equal(upstream.status, 200, route + " upstream http=" + upstream.status);
  assert.equal(commerce.status, 200, route + " commerce http=" + commerce.status);
  assert.equal(bff.status, 200, route + " bff http=" + bff.status);
  assert.deepEqual(upstream.courseIds, [], route + " upstream not empty");
  assert.deepEqual(bff.courses, [], route + " bff not empty");
  assert.ok(["ready", "empty"].includes(bff.state), route + " bff state=" + bff.state);
  assert.equal(bff.source, "gateway", route + " bff source=" + bff.source);
  const facet = bff.coursesFacet;
  assert.ok(facet && LEGAL_COURSE_FACETS.includes(facet.state), route + " courses facet=" + JSON.stringify(facet));
  assert.ok(!["error", "permission", "maintenance"].includes(facet.state), route + " courses facet illegal=" + facet.state);
  assert.equal(facet.stale, false, route + " courses facet stale");
  assert.equal(facet.errorCode, null, route + " courses facet error=" + facet.errorCode);
  return { generatedAt: bff.generatedAt, facetState: facet.state };
}

// 空态 DOM：零课程卡 +“内容准备中”在课程区域真实可见。
function assertEmptyCoursesDom(facts, route) {
  assert.equal(facts.cards, 0, route + " cards=" + facts.cards);
  assert.equal(facts.emptyCopyVisible, true, route + " empty copy not visible in courses region");
  return true;
}

// commerce 价格事实对应：上游 plans 与 BFF pricingPlans/skus 在同一场景下一致。
function assertCommercePricing({ upstreamPlans, bffPlans, bffSkus }, route) {
  assert.deepEqual(bffPlans, upstreamPlans, route + " pricing plans mismatch");
  assert.equal(bffSkus, 0, route + " skus=" + bffSkus);
  return true;
}

module.exports = { LEGAL_COURSE_FACETS, assertNonemptyChain, assertEmptyChain, assertEmptyCoursesDom, assertCommercePricing, ...base8 };
