<script setup lang="ts">
import { renderOfficialSiteTokenStyle } from "~/utils/design-system";
import { renderOfficialPalette } from "@englishflow/design-tokens/official-site";
import {
  resolvePublicThemeMode,
  resolvePublicUiLocale,
} from "~/utils/public-projection";
const { officialI18nAdapter, officialThemeController, officialThemeAdapter } =
  useNuxtApp().$foundation;
const route = useRoute(),
  { locale } = useSiteText();
const localeCookie = useCookie("yx.public.locale", { sameSite: "lax" }),
  themeCookie = useCookie("yx.public.theme", { sameSite: "lax" });
const unsubLocale = officialI18nAdapter.subscribe((next) => {
  locale.value = next.locale;
  localeCookie.value = next.locale;
});
const unsubTheme = officialThemeController.subscribe(
  (next) => (themeCookie.value = next.theme),
);
function syncUrlPreferences() {
  if (route.query.locale !== undefined)
    officialI18nAdapter.setLocale(resolvePublicUiLocale(route.query.locale));
  if (route.query.theme !== undefined)
    officialThemeController.setTheme(resolvePublicThemeMode(route.query.theme));
}
syncUrlPreferences();
onMounted(() => {
  officialI18nAdapter.restore();
  officialThemeController.restore();
  syncUrlPreferences();
  officialThemeAdapter.sync();
});
watch(() => [route.query.locale, route.query.theme], syncUrlPreferences);
onBeforeUnmount(() => {
  unsubLocale();
  unsubTheme();
  officialI18nAdapter.dispose();
  officialThemeAdapter.dispose();
  officialThemeController.dispose();
});
installSiteMotion();
useHead({
  htmlAttrs: {
    lang: computed(() => locale.value),
    "data-ui-locale": computed(() => locale.value),
    "data-content-locale": "en-US",
    // SSR per-request theme from the cookie so crawlers/first paint agree with
    // the client; 'system' stays unset for the no-flash script to resolve.
    // Evaluated once per SSR request (fresh Nuxt app each time: no cross-visitor leak).
    "data-theme": officialThemeController.theme === "system"
      ? undefined
      : officialThemeController.theme,
  },
  style: [
    {
      id: "englishflow-official-site-tokens",
      textContent: `:root{${renderOfficialSiteTokenStyle()};${renderOfficialPalette()}}`,
    },
  ],
  script: [
    {
      id: "englishflow-official-theme-bootstrap",
      textContent:
        officialThemeAdapter.noFlashScript +
        (officialThemeController.theme === "system"
          ? ';document.documentElement.dataset.theme=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";'
          : ""),
    },
  ],
});
</script>
<template>
  <NuxtLayout><NuxtPage :page-key="(route) => route.path" /></NuxtLayout>
</template>
