// R1-001 版本7/8 共享真实链断言模块：Gateway/commerce/BFF 硬断言 + DOM 对照 +
// 价格区域可见空说明 + Cookie 业务命中失败。真实采集与负例共用同一函数，
// 不覆盖已固定证据；新文件一律使用 -8 后缀。
const assert = require("node:assert/strict");

// 业务 Cookie 名称模式：官网仅允许 yx.public.* 偏好；命中以下任一即判失败。
const BUSINESS_COOKIE_PATTERN = /refresh|session|token|auth|jwt|principal|subject|password|credential/i;
const OFFICIAL_COOKIE_ALLOW = /^yx\.public\.(locale|theme)$/;

function officialCookieNames(names) {
  return (names || []).filter((n) => OFFICIAL_COOKIE_ALLOW.test(n));
}

// Cookie 验收：记录官网相关名称/数量（不输出值）；业务命中 >0 即抛错。
function assertNoBusinessCookies(names, route) {
  const list = names || [];
  const official = officialCookieNames(list);
  const businessHits = list.filter((n) => BUSINESS_COOKIE_PATTERN.test(n) && !OFFICIAL_COOKIE_ALLOW.test(n));
  assert.equal(businessHits.length, 0, route + " business-cookie-hit=" + businessHits.slice(0, 5).join(","));
  return { total: list.length, official: official.slice(0, 20), officialCount: official.length, businessHits: businessHits.length };
}

// 同轮 Gateway/commerce/BFF 硬断言：HTTP 200、BFF ready/gateway、课程 ID 与
// generatedAt 对应。快照字段逐项相等，版本变动判不一致（不以数量相同通过）。
function assertChainFacts({ upstream, commerce, bff }, route) {
  assert.equal(upstream.status, 200, route + " upstream http=" + upstream.status);
  assert.equal(commerce.status, 200, route + " commerce http=" + commerce.status);
  assert.equal(bff.status, 200, route + " bff http=" + bff.status);
  assert.equal(bff.state, "ready", route + " bff state=" + bff.state);
  assert.equal(bff.source, "gateway", route + " bff source=" + bff.source);
  assert.ok(Array.isArray(upstream.courseIds) && upstream.courseIds.length > 0, route + " upstream courses empty");
  assert.deepEqual(bff.courses, upstream.courseIds, route + " bff/upstream courseIds mismatch");
  assert.equal(bff.generatedAt, upstream.generatedAt, route + " generatedAt mismatch");
  assert.equal(bff.pricingPlans, 0, route + " pricingPlans=" + bff.pricingPlans);
  assert.equal(bff.skus, 0, route + " skus=" + bff.skus);
  return { courseCount: upstream.courseIds.length, generatedAt: upstream.generatedAt };
}

// DOM 课程对照：完整渲染标题集合与当轮已归档 BFF 标题集合逐项相等。
function assertCourseDomTitles(domTitles, bffTitles, route) {
  assert.ok(domTitles.length > 0, route + " dom titles empty");
  assert.deepEqual(domTitles, bffTitles, route + " dom/bff titles mismatch");
  return { count: domTitles.length };
}

// 价格权威空：限定 pricing 区域、真实可见、排除 error/recovery 冒充。
function assertPricingEmptyVisible(facts, route) {
  assert.equal(facts.priceCards, 0, route + " priceCards=" + facts.priceCards);
  assert.equal(facts.purchaseLinks, 0, route + " purchaseLinks=" + facts.purchaseLinks);
  assert.equal(facts.purchaseButtons, 0, route + " purchaseButtons=" + facts.purchaseButtons);
  assert.equal(facts.emptyNoteVisible, true, route + " empty-note not visible in pricing region");
  assert.equal(facts.recoveryCount, 0, route + " recovery present");
  assert.equal(facts.errorCount, 0, route + " error present");
  const facet = facts.pricingFacet;
  assert.ok(facet && (facet.state === "empty" || (facet.state === "ready" && facts.bffPlans === 0)), route + " facet=" + JSON.stringify(facet));
  assert.equal(facet.stale, false, route + " facet stale");
  assert.equal(facet.errorCode, null, route + " facet error=" + facet.errorCode);
  return true;
}

module.exports = { BUSINESS_COOKIE_PATTERN, OFFICIAL_COOKIE_ALLOW, officialCookieNames, assertNoBusinessCookies, assertChainFacts, assertCourseDomTitles, assertPricingEmptyVisible };
