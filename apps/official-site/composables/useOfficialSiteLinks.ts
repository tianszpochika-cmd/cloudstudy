import {
  appendCampaignParams,
  buildLearnerLink,
  buildLearnerLoginLink,
  buildPublicLearningEntry,
  preserveCampaignParams,
  safePublicHref,
} from "~/utils/public-links.mjs";

export function useOfficialSiteLinks() {
  const { officialThemeController } =
    useNuxtApp().$foundation;
  const route = useRoute();
  const config = useRuntimeConfig();
  const { locale } = useSiteText();
  const entryTheme = ref(officialThemeController.theme);
  let stopTheme: (() => void) | undefined;
  onMounted(() => {
    stopTheme = officialThemeController.subscribe((state) => {
      entryTheme.value = state.theme;
    });
  });
  onBeforeUnmount(() => stopTheme?.());
  const learnerWebUrl = String(config.public.learnerWebUrl || "/");
  const configuredOrigins = Array.isArray(config.public.publicLinkOrigins)
    ? config.public.publicLinkOrigins.map(String)
    : String(config.public.publicLinkOrigins || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

  function campaignParams() {
    return preserveCampaignParams(route.query);
  }

  function learnerLink(
    path = "/",
    params: Record<string, string | undefined> = {},
  ) {
    return buildLearnerLink(learnerWebUrl, path, {
      ...campaignParams(),
      ...params,
    });
  }

  function authLink(returnTo = "/home") {
    // The official site only creates a controlled navigation to the shared
    // learner login page. It never receives, stores, or forwards business tokens.
    return buildLearnerLoginLink(learnerWebUrl, {
      returnTo,
      locale: locale.value,
      theme: entryTheme.value,
      campaignParams: campaignParams(),
    });
  }

  function registerLink() {
    return buildPublicLearningEntry({
      base: learnerWebUrl,
      locale: locale.value,
      theme: entryTheme.value,
      campaign: campaignParams(),
    });
  }

  function publicLink(
    value: string | null | undefined,
    fallback: string | null = null,
  ) {
    const safe = safePublicHref(value, {
      siteUrl: String(config.public.siteUrl || "/"),
      learnerWebUrl,
      allowedOrigins: configuredOrigins,
      fallback,
    });
    return appendCampaignParams(safe, route.query);
  }

  return { learnerLink, authLink, registerLink, publicLink, campaignParams };
}
