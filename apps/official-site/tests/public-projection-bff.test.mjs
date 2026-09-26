import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const siteRoot = join(import.meta.dirname, "..");
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

test("BFF uses the private Gateway for both public reads and caches a complete response", async () => {
  const app = harness();
  const { body, headers } = await app.request();
  assert.equal(body.state, "ready");
  assert.equal(body.source, "gateway");
  assert.equal(headers["cache-control"], "public, max-age=60, s-maxage=60");
  assert.equal(headers["x-public-projection-commerce"], "gateway");
  assert.deepEqual(app.calls, [
    "http://api-gateway:18070/api/v1/public/site/projection?uiLocale=zh-CN",
    "http://api-gateway:18070/api/v1/public/commerce/catalog?uiLocale=zh-CN",
  ]);
});

test("an upstream failure uses a no-store fallback, including a recent recovery snapshot", async () => {
  const app = harness();
  app.setFetch(async () => { throw new Error("TLS failure"); });
  const first = await app.request();
  assert.equal(first.body.state, "error");
  assert.equal(first.body.source, "empty-fallback");
  assert.equal(first.headers["cache-control"], "no-store");

  app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog") ? { plans: [] } : readyPayload));
  assert.equal((await app.request()).body.state, "ready");
  app.setFetch(async () => { throw new Error("temporary outage"); });
  const recovery = await app.request();
  assert.equal(recovery.body.state, "recovery");
  assert.equal(recovery.body.source, "memory-cache");
  assert.equal(recovery.headers["cache-control"], "no-store");
});

test("an authoritative empty projection clears the old ready snapshot", async () => {
  const app = harness();
  await app.request();
  app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog") ? { plans: [] } : emptyPayload));
  const empty = await app.request();
  assert.equal(empty.body.state, "empty");
  assert.match(empty.headers["cache-control"], /^public/);
  app.setFetch(async () => { throw new Error("outage"); });
  const after = await app.request();
  assert.equal(after.body.state, "error");
  assert.equal(after.headers["cache-control"], "no-store");
});

test("an expired snapshot cannot revive an old course during an outage", async () => {
  const app = harness();
  await app.request();
  app.advance(60_001);
  app.setFetch(async () => { throw new Error("outage"); });
  const after = await app.request();
  assert.equal(after.body.state, "error");
  assert.equal(after.body.projection.courses.length, 0);
  assert.equal(after.headers["cache-control"], "no-store");
});

test("upstream rejection cannot expose a cached public projection", async () => {
  for (const status of [401, 403, 404, 410]) {
    const app = harness();
    await app.request();
    app.setFetch(async () => ({ ok: false, status, json: async () => ({}) }));
    const denied = await app.request();
    assert.equal(denied.body.state, status === 401 || status === 403 ? "permission" : "error");
    assert.equal(denied.body.projection.courses.length, 0);
    assert.equal(denied.headers["cache-control"], "no-store");
    app.setFetch(async () => { throw new Error("outage"); });
    assert.equal((await app.request()).body.state, "error");
  }
});

test("an in-flight older ready response cannot refill a revoked public snapshot", async () => {
  for (const status of [401, 403, 404, 410]) {
    const app = harness();
    const commerceStarted = deferred();
    const delayedCommerce = deferred();
    let contentReads = 0;
    app.setFetch(async (url) => {
      if (url.includes("/public/commerce/catalog")) {
        commerceStarted.resolve();
        return delayedCommerce.promise;
      }
      contentReads += 1;
      return contentReads === 1 ? ok(readyPayload) : { ok: false, status, json: async () => ({}) };
    });
    const oldReady = app.request();
    await commerceStarted.promise;
    const revoked = await app.request();
    assert.equal(revoked.body.projection.courses.length, 0);
    delayedCommerce.resolve(ok({ plans: [] }));
    const late = await oldReady;
    assert.equal(late.body.projection.courses.length, 0);
    assert.equal(late.headers["cache-control"], "no-store");
    app.setFetch(async () => { throw new Error("later outage"); });
    const after = await app.request();
    assert.equal(after.body.projection.courses.length, 0);
    assert.equal(after.body.state, "error");
  }
});

test("browser network failure clears prior public facts and exposes only a controlled code", async () => {
  const state = new Map();
  let request = async () => ({
    projection: projection.normalizePublicProjection(readyPayload),
    state: "ready", stale: false, source: "gateway", errorCode: null,
  });
  const composable = loadTypeScript(composableSource, {
    require: (name) => {
      if (name === "#imports") return {
        onMounted: () => {}, onServerPrefetch: () => {},
        useRequestFetch: () => (...args) => request(...args),
        useState: (key, initialize) => {
          if (!state.has(key)) state.set(key, { value: initialize() });
          return state.get(key);
        },
      };
      if (name === "~/utils/public-projection") return projection;
      throw new Error(`Unexpected import: ${name}`);
    },
    useRoute: () => ({ query: { locale: "zh-CN" } }),
  });
  const page = composable.usePublicProjection("fail-closed");
  await page.load();
  assert.equal(page.projection.value.projection.courses.length, 1);
  request = async () => { throw new Error("private upstream network detail"); };
  await page.load();
  assert.equal(page.projection.value.state, "error");
  assert.equal(page.projection.value.projection.courses.length, 0);
  assert.equal(page.projection.value.projection.pricingPlans.length, 0);
  assert.equal(page.projection.value.errorCode, "PUBLIC_PROJECTION_UNAVAILABLE");
});

test("success and recovery snapshots remain isolated by UI locale", async () => {
  const app = harness();
  await app.request("zh-CN");
  app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog") ? { plans: [] } : emptyPayload));
  assert.equal((await app.request("en-US")).body.state, "empty");
  app.setFetch(async () => { throw new Error("outage"); });
  assert.equal((await app.request("zh-CN")).body.state, "recovery");
  assert.equal((await app.request("en-US")).body.state, "error");
  assert.ok(app.calls.some((url) => url.endsWith("?uiLocale=en-US")));
});

test("bad private URL fails closed and commerce degradation does not enter shared cache", async () => {
  const invalid = harness("javascript:alert(1)");
  const blocked = await invalid.request();
  assert.equal(blocked.body.state, "error");
  assert.equal(blocked.headers["cache-control"], "no-store");
  assert.equal(invalid.calls.length, 0);

  const app = harness();
  app.setFetch(async (url) => url.includes("/public/commerce/catalog")
    ? { ok: false, status: 503, json: async () => ({}) }
    : ok(readyPayload));
  const degraded = await app.request();
  assert.equal(degraded.body.state, "ready");
  assert.equal(degraded.headers["x-public-projection-commerce"], "degraded");
  assert.equal(degraded.headers["cache-control"], "no-store");
});

test("an empty or failed commerce catalog never revives prices from content", async () => {
  const contentWithOldOffer = {
    data: {
      uiLocale: "zh-CN",
      courses: [{ id: "course-1", title: "基础英语" }],
      pricingPlans: [{ id: "old-plan", name: "旧价格", price: "¥9", availability: "AVAILABLE" }],
      skus: [{ skuId: "old-plan", name: "旧价格", price: "¥9", availability: "AVAILABLE" }],
    },
  };
  const app = harness();
  app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog")
    ? { plans: [] } : contentWithOldOffer));
  const empty = await app.request();
  assert.equal(empty.body.projection.pricingPlans.length, 0);
  assert.equal(empty.body.projection.skus.length, 0);

  app.setFetch(async (url) => url.includes("/public/commerce/catalog")
    ? { ok: false, status: 503, json: async () => ({}) }
    : ok(contentWithOldOffer));
  const degraded = await app.request();
  assert.equal(degraded.body.projection.pricingPlans.length, 0);
  assert.equal(degraded.body.projection.skus.length, 0);
  assert.equal(degraded.headers["cache-control"], "no-store");
});

test("malformed public offers are withheld instead of displaying a placeholder price", async () => {
  const app = harness();
  const valid = {
    skuId: "sku-valid", title: "月度方案", currency: "CNY", amountMinor: 1299,
    billingPeriod: "MONTH", availability: "PUBLISHED",
    entitlementCode: "learn.month", priceSnapshotId: "sku-valid-v1",
  };
  app.setFetch(async (url) => ok(url.includes("/public/commerce/catalog")
    ? { plans: [
      valid,
      { ...valid, skuId: "sku-invalid-currency", currency: "INVALID" },
      { ...valid, skuId: "sku-no-snapshot", priceSnapshotId: "" },
      { ...valid, skuId: "sku-invalid-term", billingPeriod: "WEEK" },
      { ...valid, skuId: "sku-fractional", amountMinor: 12.5 },
    ] }
    : readyPayload));
  const { body } = await app.request();
  assert.deepEqual(body.projection.pricingPlans.map((plan) => plan.skuId), ["sku-valid"]);
  assert.equal(body.projection.pricingPlans[0].price, "¥12.99");
  assert.deepEqual(body.projection.skus.map((sku) => sku.skuId), ["sku-valid"]);
});

test("Nuxt and full Compose keep the internal address private", async () => {
  const [config, compose, envExample] = await Promise.all([
    read("nuxt.config.ts"),
    readFile(join(siteRoot, "../../infra/docker/clyunedev/docker-compose.full.yml"), "utf8"),
    readFile(join(siteRoot, "../../infra/docker/clyunedev/clyunedev.full.env.example"), "utf8"),
  ]);
  assert.match(config, /runtimeConfig:\s*\{\s*gatewayInternalBaseUrl,\s*public:/);
  assert.match(config, /NUXT_PUBLIC_GATEWAY_BASE_URL/);
  assert.match(compose, /official-site:\s*\n\s*environment:\s*\n\s*NUXT_GATEWAY_INTERNAL_BASE_URL:/);
  assert.match(envExample, /NUXT_GATEWAY_INTERNAL_BASE_URL=http:\/\/api-gateway:18070\/api\/v1/);
});
