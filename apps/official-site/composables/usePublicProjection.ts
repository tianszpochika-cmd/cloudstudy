import {
  onMounted,
  onServerPrefetch,
  useRequestFetch,
  useState,
} from "#imports";
import {
  EMPTY_PUBLIC_PROJECTION,
  resolvePublicUiLocale,
  type PublicProjectionResponse,
  type PublicUiLocale,
} from "~/utils/public-projection";

export function usePublicProjection(
  key = "official-site",
  requestedLocale?: PublicUiLocale,
) {
  const request = useRequestFetch();
  const route = useRoute();
  const locale = requestedLocale ?? resolvePublicUiLocale(route.query.locale);
  const result = useState<PublicProjectionResponse>(
    `public-projection:${key}:${locale}`,
    () => ({
      projection: EMPTY_PUBLIC_PROJECTION,
      state: "loading",
      stale: false,
      source: "empty-fallback",
      errorCode: null,
    }),
  );
  let pending: Promise<void> | null = null;

  async function load(): Promise<void> {
    if (pending) return pending;
    pending = (async () => {
      try {
        let commerceDegraded = false;
        const response = await request<PublicProjectionResponse>(
          "/api/public-projection",
          {
            query: { locale },
            onResponse({ response }) {
              commerceDegraded = response.headers.get("x-public-projection-commerce") === "degraded";
            },
          },
        );
        if (!response?.projection) throw new Error("PUBLIC_PROJECTION_UNAVAILABLE");
        // The existing BFF can keep content usable while its commerce read fails.
        // Only the pricing scope must treat that cleared catalog as unavailable.
        result.value = key === "pricing" && commerceDegraded
          ? {
              projection: EMPTY_PUBLIC_PROJECTION,
              state: "error",
              stale: false,
              source: "empty-fallback",
              errorCode: "PUBLIC_COMMERCE_PROJECTION_UNAVAILABLE",
            }
          : response;
      } catch {
        result.value = {
          projection: EMPTY_PUBLIC_PROJECTION,
          state: "error",
          stale: false,
          source: "empty-fallback",
          errorCode: "PUBLIC_PROJECTION_UNAVAILABLE",
        };
      } finally {
        pending = null;
      }
    })();
    return pending;
  }

  onServerPrefetch(load);
  // Prerendered HTML is only a fast first paint. Revalidate once in the
  // browser so price, eligibility, campaign and maintenance projections do
  // not remain frozen at build time.
  onMounted(() => {
    void load();
  });

  return { projection: result, loadState: result, locale, load };
}
