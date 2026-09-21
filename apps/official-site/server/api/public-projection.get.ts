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
  if (!isRecord(projection) || !isRecord(commerce)) return projection;
  const plans = list(commerce.plans);
  if (!plans.length) return projection;

  // The official site may display commerce facts, but it must not own or copy
  // order/entitlement data. Keep only the catalog's public, field-filtered
  // plan projection and merge it at the BFF boundary.
  const pricing = plans.map((plan) => ({
    id: plan.planId,
    skuId: plan.planId,
    name: plan.name,
    price: plan.displayPrice,
    unit: plan.unit,
    currency:
      typeof plan.displayPrice === "string"
        ? plan.displayPrice.slice(0, 3)
        : "",
    features: plan.features,
    availability: plan.availability,
    entitlementCode: plan.entitlementCode,
    priceSnapshotId: plan.priceSnapshotId,
  }));
  const data = isRecord(projection.data) ? projection.data : projection;
  const mergedData = { ...data, pricing };
  return isRecord(projection.data)
    ? { ...projection, data: mergedData }
    : mergedData;
}

const lastGoodProjectionByLocale = new Map<
  PublicUiLocale,
  PublicProjectionResponse
>();

function joinPath(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export default defineEventHandler(
  async (event): Promise<PublicProjectionResponse> => {
    const config = useRuntimeConfig(event);
    const query = getQuery(event);
    const locale = resolvePublicUiLocale(query.locale);
    const projectionPath = String(
      config.public.publicProjectionPath || "/public/site/projection",
    );
    const gatewayBase = resolveGatewayBaseUrl(
      config.public.gatewayBaseUrl,
      "http://127.0.0.1:18070/api/v1",
    );
    const gatewayUrl = joinPath(gatewayBase, projectionPath);
    setResponseHeader(
      event,
      "cache-control",
      "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
    );
    setResponseHeader(event, "vary", "Accept-Language");

    try {
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
      if (!response.ok)
        throw new Error(`PUBLIC_PROJECTION_HTTP_${response.status}`);
      const projectionPayload = await response.json();
      let mergedPayload: unknown = projectionPayload;
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
          mergedPayload = mergeCommercePricing(
            projectionPayload,
            await commerceResponse.json(),
          );
          setResponseHeader(event, "x-public-projection-commerce", "gateway");
        } else {
          setResponseHeader(event, "x-public-projection-commerce", "degraded");
        }
      } catch {
        // Content remains usable when commerce is temporarily unavailable. The
        // UI will show the projection's honest empty pricing state instead of a
        // fabricated plan or a network error for unrelated public content.
        setResponseHeader(event, "x-public-projection-commerce", "degraded");
      }
      const result: PublicProjectionResponse = {
        ...normalizePublicProjectionResponse(mergedPayload, locale),
        source: "gateway",
        stale: false,
        errorCode: null,
      };
      if (result.state === "ready")
        lastGoodProjectionByLocale.set(locale, result);
      setResponseHeader(event, "x-public-projection-source", "gateway");
      return result;
    } catch (error) {
      const lastGoodProjection = lastGoodProjectionByLocale.get(locale);
      if (lastGoodProjection) {
        const stale: PublicProjectionResponse = {
          ...lastGoodProjection,
          state: "recovery",
          stale: true,
          source: "memory-cache",
          errorCode: "PUBLIC_PROJECTION_STALE",
        };
        setResponseHeader(event, "x-public-projection-source", "memory-cache");
        return stale;
      }
      const fallback: PublicProjectionResponse = {
        projection: EMPTY_PUBLIC_PROJECTION,
        state: "error",
        stale: false,
        source: "empty-fallback",
        errorCode: "PUBLIC_PROJECTION_UNAVAILABLE",
      };
      setResponseHeader(event, "x-public-projection-source", "empty-fallback");
      return fallback;
    }
  },
);
