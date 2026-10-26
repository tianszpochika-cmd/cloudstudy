import {
  EMPTY_PUBLIC_PROJECTION,
  normalizePublicProjectionResponse,
  resolvePublicUiLocale,
  type PublicProjectionResponse,
  type PublicUiLocale,
} from "~/utils/public-projection";
import { resolveGatewayBaseUrl } from "~/utils/gateway";

type PublicGatewayResponse = {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
};
type PublicGatewayRequest = (
  input: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<PublicGatewayResponse>;

type PublicGatewayPayload = Record<string, unknown>;

function isRecord(value: unknown): value is PublicGatewayPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function list(value: unknown): PublicGatewayPayload[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function mergeCommercePricing(projection: unknown, commerce: unknown): unknown {
  if (!isRecord(projection)) return projection;
  const plans = isRecord(commerce) ? list(commerce.plans) : [];
  const data = isRecord(projection.data) ? projection.data : projection;
  const locale = data.uiLocale === "en-US" ? "en-US" : "zh-CN";

  // The official site may display commerce facts, but it must not own or copy
  // order/entitlement data. Keep only the catalog's public, field-filtered
  // plan projection and merge it at the BFF boundary.
  const pricing = plans.flatMap((plan) => {
    const skuId = typeof plan.skuId === "string" ? plan.skuId.trim() : "";
    const name = typeof plan.title === "string" ? plan.title.trim() : "";
    const currency = typeof plan.currency === "string" ? plan.currency.trim() : "";
    const billingPeriod = typeof plan.billingPeriod === "string" ? plan.billingPeriod : "";
    const availability = typeof plan.availability === "string" ? plan.availability : "";
    const entitlementCode = typeof plan.entitlementCode === "string" ? plan.entitlementCode.trim() : "";
    const priceSnapshotId = typeof plan.priceSnapshotId === "string" ? plan.priceSnapshotId.trim() : "";
    const amountMinor = plan.amountMinor;
    if (!skuId || !name || !/^[A-Z]{3}$/.test(currency)
      || !["FREE", "MONTH", "QUARTER", "YEAR", "PERPETUAL"].includes(billingPeriod)
      || !["PUBLISHED", "COMING_SOON", "UNAVAILABLE"].includes(availability)
      || !entitlementCode || !priceSnapshotId
      || typeof amountMinor !== "number" || !Number.isSafeInteger(amountMinor) || amountMinor < 0) return [];
    let price: string;
    try {
      const formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
      const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
      price = formatter.format(amountMinor / (10 ** digits));
    } catch { return []; }
    return [{
      id: skuId,
      skuId,
      name,
      price,
      unit: billingPeriod,
      currency,
      billingPeriod,
      features: [],
      availability,
      entitlementCode,
      priceSnapshotId,
    }];
  });
  // Commerce owns public offers. A missing or empty catalog must also clear
  // prices and SKUs carried by an older content projection.
  const mergedData = { ...data, pricingPlans: pricing, skus: [] };
  return isRecord(projection.data)
    ? { ...projection, data: mergedData }
    : mergedData;
}

const LAST_GOOD_MAX_AGE_MS = 60_000;
const lastGoodProjectionByLocale = new Map<
  PublicUiLocale,
  { response: PublicProjectionResponse; fetchedAt: number }
>();
const invalidationByLocale = new Map<PublicUiLocale, { generation: number; state: "permission" | "error" }>();
const latestAppliedRequestByLocale = new Map<PublicUiLocale, number>();
let nextRequestId = 0;

function invalidate(locale: PublicUiLocale, state: "permission" | "error"): void {
  const generation = (invalidationByLocale.get(locale)?.generation ?? 0) + 1;
  invalidationByLocale.set(locale, { generation, state });
  lastGoodProjectionByLocale.delete(locale);
}

function emptyFallback(state: "permission" | "error"): PublicProjectionResponse {
  const errorCode = state === "permission" ? "PUBLIC_PROJECTION_PERMISSION" : "PUBLIC_PROJECTION_UNAVAILABLE";
  const facets = {
    courses: { state, updatedAt: null, errorCode, stale: false },
    pricing: { state, updatedAt: null, errorCode, stale: false },
    download: { state, updatedAt: null, errorCode, stale: false },
    announcements: { state, updatedAt: null, errorCode, stale: false },
    compliance: { state, updatedAt: null, errorCode, stale: false },
  } as PublicProjectionResponse["facets"];
  return {
    projection: EMPTY_PUBLIC_PROJECTION,
    state,
    stale: false,
    source: "empty-fallback",
    errorCode,
    facets,
    commerceState: state,
    commerceErrorCode: errorCode,
  };
}

function joinPath(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export default defineEventHandler(
  async (event): Promise<PublicProjectionResponse> => {
    const config = useRuntimeConfig(event);
    const query = getQuery(event);
    const locale = resolvePublicUiLocale(query.locale);
    const requestId = ++nextRequestId;
    const initialGeneration = invalidationByLocale.get(locale)?.generation ?? 0;
    const projectionPath = String(
      config.public.publicProjectionPath || "/public/site/projection",
    );
    // Keep failures out of shared caches. Only a complete public response gets
    // the short cache lifetime below.
    setResponseHeader(event, "cache-control", "no-store");
    setResponseHeader(event, "vary", "Accept-Language");

    let accessDenied = false;
    try {
      const internalBase = String(config.gatewayInternalBaseUrl || "").trim();
      const gatewayBase = resolveGatewayBaseUrl(
        internalBase || config.public.gatewayBaseUrl,
        "",
      );
      if (!/^https?:\/\//i.test(gatewayBase))
        throw new Error("PUBLIC_PROJECTION_GATEWAY_URL_INVALID");
      const gatewayUrl = joinPath(gatewayBase, projectionPath);
      const request = Reflect.get(globalThis, "fetch") as
        PublicGatewayRequest | undefined;
      if (typeof request !== "function")
        throw new Error("SSR public request unavailable");
      const response = await request(
        gatewayUrl + `?uiLocale=${encodeURIComponent(locale)}`,
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(2500),
        },
      );
      if (response.status === 401 || response.status === 403) {
        accessDenied = true;
        invalidate(locale, "permission");
      } else if (response.status === 404 || response.status === 410) {
        invalidate(locale, "error");
      }
      if (!response.ok)
        throw new Error(`PUBLIC_PROJECTION_HTTP_${response.status}`);
      const projectionPayload = await response.json();
      let mergedPayload: unknown = mergeCommercePricing(projectionPayload, null);
      let commerceDegraded = false;
      try {
        const commerceUrl = joinPath(gatewayBase, "/public/commerce/catalog");
        const commerceResponse = await request(
          commerceUrl + `?uiLocale=${encodeURIComponent(locale)}`,
          {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(2500),
          },
        );
        if (commerceResponse.ok) {
          const commercePayload = await commerceResponse.json();
          if (isRecord(commercePayload) && Array.isArray(commercePayload.plans)) {
            mergedPayload = mergeCommercePricing(projectionPayload, commercePayload);
            setResponseHeader(event, "x-public-projection-commerce", "gateway");
          } else {
            commerceDegraded = true;
            setResponseHeader(event, "x-public-projection-commerce", "degraded");
          }
        } else {
          commerceDegraded = true;
          setResponseHeader(event, "x-public-projection-commerce", "degraded");
        }
      } catch {
        // Content remains usable when commerce is temporarily unavailable. The
        // UI will show the projection's honest empty pricing state instead of a
        // fabricated plan or a network error for unrelated public content.
        commerceDegraded = true;
        setResponseHeader(event, "x-public-projection-commerce", "degraded");
      }
      const normalized = normalizePublicProjectionResponse(
        {
          ...(isRecord(mergedPayload) ? mergedPayload : {}),
          commerceState: commerceDegraded ? "error" : "ready",
          commerceErrorCode: commerceDegraded ? "PUBLIC_COMMERCE_DEGRADED" : null,
          commerceDegraded,
        },
        locale,
      );
      // 合法 recovery：保留经过字段过滤的可读公开数据、更新时间、旧数据
      // 标记与恢复原因；permission/error/maintenance 仍按不可读处理。
      const keepRecoveryData = normalized.state === "recovery";
      const result: PublicProjectionResponse = {
        ...normalized,
        projection: normalized.state === "ready" || keepRecoveryData ? normalized.projection : EMPTY_PUBLIC_PROJECTION,
        source: "gateway",
        stale: keepRecoveryData ? true : false,
        errorCode: keepRecoveryData
          ? (normalized.errorCode ?? "PUBLIC_PROJECTION_STALE")
          : commerceDegraded ? normalized.errorCode : null,
      };
      const latestInvalidation = invalidationByLocale.get(locale);
      if ((latestInvalidation?.generation ?? 0) !== initialGeneration
        || requestId < (latestAppliedRequestByLocale.get(locale) ?? 0)) {
        setResponseHeader(event, "x-public-projection-source", "empty-fallback");
        return emptyFallback(latestInvalidation?.state ?? "error");
      }
      latestAppliedRequestByLocale.set(locale, requestId);
      if (result.state === "ready" && !commerceDegraded)
        lastGoodProjectionByLocale.set(locale, { response: result, fetchedAt: Date.now() });
      else if (result.state === "recovery") {
        // F10: recovery 携带权威内容+commerce 事实。刷新缓存中的事实，使随后的
        // 网络故障不能复活已被清空/替换的旧套餐；保留原 fetchedAt，recovery 永不
        // 延长 60 秒 TTL。无前置缓存时不从 recovery 新建缓存。
        const prior = lastGoodProjectionByLocale.get(locale);
        if (prior) {
          lastGoodProjectionByLocale.set(locale, { response: result, fetchedAt: prior.fetchedAt });
        }
      } else
        invalidate(locale, result.state === "permission" ? "permission" : "error");
      if (!commerceDegraded && (result.state === "ready" || result.state === "empty"))
        setResponseHeader(
          event,
          "cache-control",
          "public, max-age=60, s-maxage=60",
        );
      setResponseHeader(event, "x-public-projection-source", "gateway");
      return result;
    } catch (error) {
      if (accessDenied) {
        setResponseHeader(event, "x-public-projection-source", "empty-fallback");
        return emptyFallback("permission");
      }
      const lastGoodProjection = lastGoodProjectionByLocale.get(locale);
      const snapshotAge = lastGoodProjection ? Date.now() - lastGoodProjection.fetchedAt : -1;
      if (lastGoodProjection && snapshotAge >= 0 && snapshotAge <= LAST_GOOD_MAX_AGE_MS) {
        // F12: 缓存回填保留已知不可读 facet 的状态及原因；仅对此前成功取得的
        // 可读缓存标记 stale/recovery。pricing facet 与 commerce 信号保持一致。
        const cachedFacets = lastGoodProjection.response.facets;
        const cachedGeneratedAt = lastGoodProjection.response.projection.generatedAt;
        const toOutageFacet = (
          cached: { readonly state: string; readonly updatedAt: string | null; readonly errorCode: string | null; readonly stale: boolean },
        ): PublicProjectionResponse["facets"]["courses"] => {
          if (cached.state === "error" || cached.state === "permission" || cached.state === "maintenance") return { ...cached } as PublicProjectionResponse["facets"]["courses"];
          return { state: "recovery", updatedAt: cachedGeneratedAt, errorCode: "PUBLIC_PROJECTION_STALE", stale: true };
        };
        const outagePricing = toOutageFacet(cachedFacets.pricing);
        const stale: PublicProjectionResponse = {
          ...lastGoodProjection.response,
          state: "recovery",
          stale: true,
          source: "memory-cache",
          errorCode: "PUBLIC_PROJECTION_STALE",
          facets: {
            courses: toOutageFacet(cachedFacets.courses),
            pricing: outagePricing,
            download: toOutageFacet(cachedFacets.download),
            announcements: toOutageFacet(cachedFacets.announcements),
            compliance: toOutageFacet(cachedFacets.compliance),
          },
          commerceState: outagePricing.state,
          commerceErrorCode: outagePricing.errorCode,
        };
        setResponseHeader(event, "x-public-projection-source", "memory-cache");
        return stale;
      }
      lastGoodProjectionByLocale.delete(locale);
      const fallbackFacets = {
        courses: { state: "error", updatedAt: null, errorCode: "PUBLIC_PROJECTION_UNAVAILABLE", stale: false },
        pricing: { state: "error", updatedAt: null, errorCode: "PUBLIC_PROJECTION_UNAVAILABLE", stale: false },
        download: { state: "error", updatedAt: null, errorCode: "PUBLIC_PROJECTION_UNAVAILABLE", stale: false },
        announcements: { state: "error", updatedAt: null, errorCode: "PUBLIC_PROJECTION_UNAVAILABLE", stale: false },
        compliance: { state: "error", updatedAt: null, errorCode: "PUBLIC_PROJECTION_UNAVAILABLE", stale: false },
      } as PublicProjectionResponse["facets"];
      const fallback: PublicProjectionResponse = {
        projection: EMPTY_PUBLIC_PROJECTION,
        state: "error",
        stale: false,
        source: "empty-fallback",
        errorCode: "PUBLIC_PROJECTION_UNAVAILABLE",
        facets: fallbackFacets,
        commerceState: "error",
        commerceErrorCode: "PUBLIC_PROJECTION_UNAVAILABLE",
      };
      setResponseHeader(event, "x-public-projection-source", "empty-fallback");
      return fallback;
    }
  },
);
