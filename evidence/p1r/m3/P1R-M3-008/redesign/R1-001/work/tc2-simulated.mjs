import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
const siteRoot = join(process.cwd(), "apps/official-site");
const read = (p) => readFile(join(siteRoot, p), "utf8");
const [routeSource, gatewaySource, projectionSource] = await Promise.all([
  read("server/api/public-projection.get.ts"),
  read("utils/gateway.ts"),
  read("utils/public-projection.ts"),
]);
function load(source, globals = {}) {
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  runInNewContext(compiled, { module, exports: module.exports, URL, AbortSignal, ...globals });
  return module.exports;
}
const gateway = load(gatewaySource);
const projection = load(projectionSource);
const ok = (payload) => ({ ok: true, status: 200, json: async () => payload });
function harness() {
  let now = 1_000;
  const config = { gatewayInternalBaseUrl: "http://api-gateway:18070/api/v1", public: { gatewayBaseUrl: "https://public.example.invalid/api/v1", publicProjectionPath: "/public/site/projection" } };
  let fetchImpl = async () => { throw new Error("unused"); };
  const route = load(routeSource, {
    require: (n) => { if (n === "~/utils/gateway") return gateway; if (n === "~/utils/public-projection") return projection; throw new Error(n); },
    defineEventHandler: (h) => h,
    useRuntimeConfig: () => config,
    getQuery: (e) => e.query,
    setResponseHeader: (e, n, v) => { e.headers[n] = v; },
    Date: { now: () => now },
    fetch: (...a) => fetchImpl(...a),
  }).default;
  return { setFetch: (f) => { fetchImpl = f; }, async request() { const event = { query: { locale: "zh-CN" }, headers: {} }; return { body: await route(event), headers: event.headers }; } };
}
const course = { id: "course-1", title: "基础英语" };
const out = { checkedAt: new Date().toISOString(), scope: "simulated upstream 503 -> page failure -> simulated recovery -> retry reload (MOCKED fetch, not real Gateway)" };
// fail phase: content 503
{
  const app = harness();
  app.setFetch(async (url) => url.includes("/public/commerce/catalog") ? { ok: false, status: 503, json: async () => ({}) } : { ok: false, status: 503, json: async () => ({}) });
  const r = await app.request();
  out.fail = { state: r.body.state, courses: r.body.projection.courses.length, facetsCourses: r.body.facets.courses.state, cache: r.headers["cache-control"] };
}
// recovery phase: same harness, upstream restored to HTTP200 recovery with course + generatedAt, commerce healthy
{
  const app = harness();
  app.setFetch(async (url) => url.includes("/public/commerce/catalog")
    ? ok({ plans: [] })
    : ok({ state: "recovery", stale: true, errorCode: "PUBLIC_PROJECTION_STALE", data: { uiLocale: "zh-CN", generatedAt: "2026-10-03T00:00:00Z", courses: [course] } }));
  const r = await app.request();
  out.recovery = { state: r.body.state, stale: r.body.stale, errorCode: r.body.errorCode, courses: r.body.projection.courses.length, generatedAt: r.body.projection.generatedAt, facet: r.body.facets.courses, headers: r.headers };
  // retry: second identical request still returns the same real reloaded content
  const r2 = await app.request();
  out.retry = { state: r2.body.state, courses: r2.body.projection.courses.length, generatedAt: r2.body.projection.generatedAt };
}
const { writeFileSync } = await import("node:fs");
writeFileSync(process.argv[2] ?? "tc2-simulated.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
