import { createI18n } from "@englishflow/i18n";
import { createNuxtI18nAdapter } from "@englishflow/i18n/adapters";
import { officialWebsiteMessages } from "@englishflow/i18n/official-site";
import {
  createThemeController,
  type ThemeMode,
} from "@englishflow/design-tokens";
import { createNuxtThemeAdapter } from "@englishflow/design-tokens/adapters";

/** A fresh instance per Nuxt request; never share visitors' preferences in SSR. */
export function createOfficialFoundation(
  locale = "zh-CN",
  theme: ThemeMode = "system",
) {
  const browserStorage = import.meta.client
    ? {
        getItem(key: string) {
          try {
            return localStorage.getItem(key);
          } catch {
            return null;
          }
        },
        setItem(key: string, value: string) {
          try {
            localStorage.setItem(key, value);
          } catch {}
        },
      }
    : undefined;
  const officialI18n = createI18n({
    locale,
    contentLocale: "en-US",
    messages: officialWebsiteMessages,
  });
  const officialI18nAdapter = createNuxtI18nAdapter(officialI18n, {
    localeStorage: browserStorage,
  });
  const officialThemeController = createThemeController({
    initialTheme: theme,
    storage: browserStorage,
  });
  const officialThemeAdapter = createNuxtThemeAdapter(
    officialThemeController,
    import.meta.client ? document.documentElement : undefined,
  );
  return {
    officialI18n,
    officialI18nAdapter,
    officialThemeController,
    officialThemeAdapter,
  };
}
