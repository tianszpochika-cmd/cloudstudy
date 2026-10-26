import { writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
const siteRoot = join(process.cwd(), "apps/official-site");
const read = (p) => readFile(join(siteRoot, p), "utf8");
const [projectionSource, composableSource] = await Promise.all([read("utils/public-projection.ts"), read("composables/usePublicProjection.ts")]);
function load(source, globals = {}) {
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  runInNewContext(compiled, { module, exports: module.exports, URL, AbortSignal, ...globals });
  return module.exports;
}
const projection = load(projectionSource);
const cases = [
  { name: "empty-global", value: { data: { uiLocale: "zh-CN", generatedAt: "2026-10-03T00:00:00Z", courses: [], pricingPlans: [], skus: [], campaigns: [], downloadChannels: [], announcements: [], complianceNotices: [] } } },
  { name: "empty-courses-with-other-data", value: { data: { uiLocale: "zh-CN", generatedAt: "2026-10-03T00:00:00Z", courses: [], announcements: [{ id: "a1", title: "公告" }] } } },
  ...["maintenance", "permission", "error"].map((state) => ({ name: `global-${state}-with-commerce-success`, value: { data: { uiLocale: "zh-CN", courses: [] }, state, commerceState: "ready", commerceErrorCode: null } })),
  { name: "recovery-download", value: { data: { uiLocale: "zh-CN", generatedAt: "2026-10-03T00:00:00Z", downloadChannels: [{ id: "web", name: "Web", platform: "PC", availability: "available" }] }, state: "recovery", stale: true } },
];
const rows = cases.map((c) => {
  const r = projection.normalizePublicProjectionResponse(c.value, "zh-CN");
  return { case: c.name, state: r.state, courses: r.facets.courses.state, pricing: r.facets.pricing.state, download: r.facets.download.state, stale: r.stale, commerceState: r.commerceState };
});
// composable 真实 throw 形状：与 BFF 单测同一 harness 语义，此处只记录类型完整性。
const state = new Map();
const composable = load(composableSource, { require: (n) => { if (n === "#imports") return { onMounted: () => {}, onServerPrefetch: () => {}, useRequestFetch: () => async () => { throw new Error("down"); }, useState: (k, init) => { if (!state.has(k)) state.set(k, { value: init() }); return state.get(k); } }; if (n === "~/utils/public-projection") return projection; throw new Error(n); }, useRoute: () => ({ query: {} }) });
const page = composable.usePublicProjection("rework-probe");
const initial = { state: page.projection.value.state, facets: page.projection.value.facets.courses.state, commerceState: page.projection.value.commerceState };
await page.load();
const afterThrow = { state: page.projection.value.state, pricing: page.projection.value.facets.pricing.state, commerceState: page.projection.value.commerceState, errorCode: page.projection.value.errorCode };
const report = { checkedAt: new Date().toISOString(), rows, composableInitial: initial, composableAfterThrow: afterThrow };
writeFileSync(process.argv[2] ?? "semantic-rework.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
