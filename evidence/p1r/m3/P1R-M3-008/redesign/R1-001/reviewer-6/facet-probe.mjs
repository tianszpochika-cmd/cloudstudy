import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const siteRoot = "C:\\Users\\Administrator\\Desktop\\my\\cloudstudy\\apps\\official-site";
const read = (path) => readFile(join(siteRoot, path), "utf8");
const [routeSource, gatewaySource, projectionSource, composableSource] = await Promise.all([
  read("server/api/public-projection.get.ts"),
  read("utils/gateway.ts"),
  read("utils/public-projection.ts"),
  read("composables/usePublicProjection.ts"),
]);

function loadTypeScript(source, globals = {}) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(compiled, {
    module,
    exports: module.exports,
    URL,
    AbortSignal,
    ...globals,
  });
  return module.exports;
}

const gateway = loadTypeScript(gatewaySource);
const projection = loadTypeScript(projectionSource);
const readyPayload = {
  data: {
    uiLocale: "zh-CN",
    courses: [{ id: "course-1", title: "基础英语" }],
  },
};
const emptyPayload = { data: { uiLocale: "zh-CN", courses: [] } };
const ok = (payload) => ({ ok: true, status: 200, json: async () => payload });
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function harness(internalBase = "http://api-gateway:18070/api/v1") {
  const calls = [];
  let now = 1_000;
  const config = {
    gatewayInternalBaseUrl: internalBase,
    public: {
      gatewayBaseUrl: "https://public.example.invalid/api/v1",
      publicProjectionPath: "/public/site/projection",
    },
  };
  let fetchImpl = async (url) =>
    ok(url.includes("/public/commerce/catalog") ? { plans: [] } : readyPayload);
  const route = loadTypeScript(routeSource, {
    require: (name) => {
      if (name === "~/utils/gateway") return gateway;
      if (name === "~/utils/public-projection") return projection;
      throw new Error(`Unexpected import: ${name}`);
    },
    defineEventHandler: (handler) => handler,
    useRuntimeConfig: () => config,
    getQuery: (event) => event.query,
    setResponseHeader: (event, name, value) => {
      event.headers[name] = value;
    },
    Date: { now: () => now },
    fetch: (...args) => {
      calls.push(args[0]);
      return fetchImpl(...args);
    },
  }).default;
  return {
    calls,
    config,
    advance: (milliseconds) => { now += milliseconds; },
    setFetch: (next) => { fetchImpl = next; },
    async request(locale = "zh-CN") {
      const event = { query: { locale }, headers: {} };
      const body = await route(event);
      return { body, headers: event.headers };
    },
  };
}

const rows=[];
for(const nextCatalog of ['empty','changed','failed']){
 const app=harness();
 const plan={skuId:'withdrawn',title:'Old published plan',currency:'CNY',amountMinor:1299,billingPeriod:'MONTH',availability:'PUBLISHED',entitlementCode:'learn.month',priceSnapshotId:'old-snapshot'};
 app.setFetch(async url=>ok(url.includes('/commerce/')?{plans:[plan]}:readyPayload));
 const first=(await app.request()).body;
 app.setFetch(async url=>url.includes('/commerce/')?(nextCatalog==='failed'?{ok:false,status:503,json:async()=>({})}:ok({plans:nextCatalog==='changed'?[{...plan,skuId:'new-plan',priceSnapshotId:'new-snapshot'}]:[]})):ok({state:'recovery',stale:true,errorCode:'PUBLIC_PROJECTION_STALE',data:{generatedAt:'2026-10-03T00:00:00Z',courses:[{id:'current-course',title:'Current recovery course'}]}}));
 const middle=(await app.request()).body;
 app.setFetch(async()=>{throw Error('synthetic outage')});
 const last=(await app.request()).body;
 const summarize=b=>({state:b.state,source:b.source,pricingFacet:b.facets.pricing.state,pricingError:b.facets.pricing.errorCode,commerceState:b.commerceState,commerceError:b.commerceErrorCode,skus:b.projection.pricingPlans.map(p=>p.skuId),courses:b.projection.courses.map(c=>c.id)});
 rows.push({nextCatalog,first:summarize(first),afterAuthoritativeRead:summarize(middle),afterOutage:summarize(last),oldSkuRevived:last.projection.pricingPlans.some(p=>p.skuId==='withdrawn')});
}
console.log(JSON.stringify({scope:'synthetic sequential current BFF VM execution, not actual integration',rows}));
