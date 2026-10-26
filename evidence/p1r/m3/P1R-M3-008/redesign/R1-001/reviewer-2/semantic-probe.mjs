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

const results={scope:'synthetic VM execution of current BFF, not actual Gateway integration'};
for(const state of ['maintenance','permission','error']){const app=harness();app.setFetch(async url=>ok(url.includes('/commerce/')?{plans:[]}:{state,data:{courses:[]}}));const r=await app.request();results[state]={state:r.body.state,pricing:r.body.facets.pricing.state};assert.equal(r.body.facets.pricing.state,state);}
const app=harness();app.setFetch(async url=>ok(url.includes('/commerce/')?{plans:[]}:{data:{courses:[]}}));const empty=(await app.request()).body;results.empty={state:empty.state,courseFacet:empty.facets.courses.state};assert.equal(empty.facets.courses.state,'empty');
const staleApp=harness();staleApp.setFetch(async url=>ok(url.includes('/commerce/')?{plans:[]}:{state:'recovery',stale:true,errorCode:'PUBLIC_PROJECTION_STALE',data:{generatedAt:'2026-10-03T00:00:00Z',courses:[{id:'synthetic-course',title:'Synthetic course'}]}}));const stale=(await staleApp.request()).body;results.businessRecovery={state:stale.state,stale:stale.stale,errorCode:stale.errorCode,courses:stale.projection.courses.length,updatedAt:stale.projection.generatedAt,courseFacet:stale.facets.courses,pricingFacet:stale.facets.pricing};
const metaApp=harness();metaApp.setFetch(async url=>ok(url.includes('/commerce/')?{plans:[]}:{data:{projectionVersion:'public-v1',contentEpoch:1,generatedAt:'2026-10-03T00:00:00Z',courses:[{contentCode:'synthetic-course',contentType:'COURSE',title:'Synthetic course',summary:'Synthetic',contentLocale:'en-US',targetLevel:'A1',contentVersionId:'version-1',availability:'PUBLISHED'}],pricing:[],downloads:[],announcements:[],compliance:[]},meta:{projectionVersion:'public-v1',contentEpoch:1,generatedAt:'2026-10-03T00:00:00Z',source:'CACHE',stale:true}}));const meta=(await metaApp.request()).body;results.metaStale={state:meta.state,stale:meta.stale,courseFacet:meta.facets.courses,headers:(await metaApp.request()).headers};
const cacheApp=harness();await cacheApp.request();cacheApp.setFetch(async()=>{throw Error('synthetic outage')});const cache=(await cacheApp.request()).body;results.cachedRecovery={state:cache.state,stale:cache.stale,courses:cache.projection.courses.length};assert.equal(cache.stale,true);assert.equal(cache.projection.courses.length,1);
console.log(JSON.stringify(results));
