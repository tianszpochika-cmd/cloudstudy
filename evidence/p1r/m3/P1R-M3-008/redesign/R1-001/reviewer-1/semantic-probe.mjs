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

const app = harness();
app.setFetch(async url => ok(url.includes('/public/commerce/catalog') ? {plans:[]} : {data:{uiLocale:'zh-CN',generatedAt:'2026-10-03T00:00:00Z',courses:[]}}));
const empty = (await app.request()).body;
const courseSource = await read('pages/courses/index.vue');
const homepageSource = await read('pages/index.vue');
const pricingSource = await read('pages/pricing.vue');
const downloadSource = await read('pages/download.vue');
const maintenanceApp = harness();
maintenanceApp.setFetch(async url => ok(url.includes('/public/commerce/catalog') ? {plans:[]} : {state:'maintenance',data:{courses:[]}}));
const maintenance=(await maintenanceApp.request()).body;
app.setFetch(async url => ok(url.includes('/public/commerce/catalog') ? {plans:[]} : {data:{uiLocale:'zh-CN',generatedAt:'2026-10-03T00:00:00Z',courses:[{id:'synthetic-c1',title:'Synthetic course'}],downloads:[{id:'synthetic-d1',name:'Synthetic download',platform:'web',href:'https://example.invalid/download',availability:'available'}]}}));
await app.request();
app.setFetch(async ()=> {throw new Error('synthetic outage');});
const recovered = (await app.request()).body;
console.log(JSON.stringify({scope:'VM semantic reproduction with synthetic fetch; NOT actual upstream integration',maintenance:{global:maintenance.state,pricingFacet:maintenance.facets.pricing.state,pricingCount:maintenance.projection.pricingPlans.length},empty:{global:empty.state,courseFacet:empty.facets.courses.state,courseCount:empty.projection.courses.length,updatedAt:empty.facets.courses.updatedAt,courseTitleConditionReadyOnly:courseSource.includes(':title="coursesFacet.state === \'ready\' ? t(\'official.c52c0deec1\') : undefined"'),homeEmptyConditionReadyOnly:homepageSource.includes("homeCoursesFacet.state === 'ready' && !loadState.projection.courses.length")},recovery:{global:recovered.state,downloadFacet:recovered.facets.download.state,stale:recovered.facets.download.stale,downloadCount:recovered.projection.downloadChannels.length,downloadPageShowsOldCards:downloadSource.includes("['ready', 'recovery'].includes(downloadFacet.state) && channels.length"),downloadRecoveryNoticePresent:/PublicStatus[\s\S]*?v-if.*recovery/.test(downloadSource),pricingRecoveryNoticePresent:/PublicStatus[\s\S]*?v-if.*recovery/.test(pricingSource)}}));
