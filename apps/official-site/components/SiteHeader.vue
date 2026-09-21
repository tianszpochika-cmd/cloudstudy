<script setup lang="ts">
import type { ThemeMode } from "@englishflow/design-tokens";
import { buildPublicLearningEntry } from "~/utils/public-links.mjs";
const { t, locale } = useSiteText(),
  { officialI18nAdapter, officialThemeController } = useNuxtApp().$foundation;
const route = useRoute(),
  menu = ref(false),
  preferences = useState("official:preferences", () => false),
  theme = ref(officialThemeController.theme),
  resolved = useState(
    "official:resolved-theme",
    () => officialThemeController.resolvedTheme,
  );
let unsub: (() => void) | undefined;
onMounted(() => {
  unsub = officialThemeController.subscribe((s) => {
    theme.value = s.theme;
    resolved.value = s.resolvedTheme;
  });
});
const unsubLocale = officialI18nAdapter.subscribe(
  (s) => (locale.value = s.locale),
);
onBeforeUnmount(() => {
  unsub?.();
  unsubLocale();
});
const { reduced, level } = useSiteMotion(),
  loginLabel = computed(() => t("official.c21f1e8827"));
const mobile = useLearningDevice(),
  config = useRuntimeConfig();
function authLink() {
  return buildPublicLearningEntry({
    base: String(
      mobile.value ? config.public.mobileH5Url : config.public.learnerWebUrl,
    ),
    mobile: mobile.value,
    login: true,
    locale: locale.value,
    theme: officialThemeController.theme,
    campaign: route.query,
  });
}
const links = [
  ["/courses", "official.c36a0f1dc5"],
  ["/world", "official.cdf0fd9f57"],
  ["/method", "official.c831468464"],
  ["/help", "official.c0adb1147b"],
];
function toggleTheme() {
  officialThemeController.setTheme(
    resolved.value === "dark" ? "light" : "dark",
  );
}
function setTheme(event: Event) {
  officialThemeController.setTheme(
    (event.target as HTMLSelectElement).value as ThemeMode,
  );
}
watch(
  () => route.fullPath,
  () => (menu.value = false),
);
</script>
<template>
  <header class="site-header">
    <div class="container header-inner">
      <SiteBrand />
      <nav class="desktop-nav" :aria-label="t('official.cfb1c7dc70')">
        <NuxtLink
          v-for="[path, label] in links"
          :key="path"
          :to="path"
          :aria-current="route.path === path ? 'page' : undefined"
          >{{ t(label) }}</NuxtLink
        >
      </nav>
      <div class="header-actions">
        <button
          class="round-button"
          :aria-label="
            t(
              resolved === 'dark'
                ? 'official.c43268b927'
                : 'official.c77d8a0cc2',
            )
          "
          @click="toggleTheme"
        >
          <SiteIcon :name="resolved === 'dark' ? 'sun' : 'moon'" /></button
        ><a class="login-link" :href="authLink()">{{ loginLabel }}</a
        ><SiteStartButton :label="t('official.cd28ebd1dd')" /><button
          class="round-button menu-toggle"
          :aria-label="t('official.c356a35564')"
          aria-haspopup="dialog"
          :aria-expanded="menu"
          @click="menu = true"
        >
          <SiteIcon name="menu" />
        </button>
      </div>
    </div>
  </header>
  <SiteModal
    :open="menu"
    :title="t('official.c78c3d2787')"
    menu
    @close="menu = false"
    ><nav class="mobile-nav-links" :aria-label="t('official.ca8e5ddc6a')">
      <NuxtLink to="/"
        >{{ t("official.cff93ad0e4") }}<SiteIcon name="arrow" /></NuxtLink
      ><NuxtLink v-for="[path, label] in links" :key="path" :to="path"
        >{{ t(label) }}<SiteIcon name="arrow" /></NuxtLink
      ><button
        class="menu-settings"
        @click="
          menu = false;
          preferences = true;
        "
      >
        {{ t("official.cf3b9e99ed") }}<SiteIcon name="right" />
      </button>
    </nav>
    <div class="mobile-nav-bottom">
      <SiteStartButton /><a :href="authLink()" class="menu-login">{{
        t("official.c801530ee0")
      }}</a>
      <p>{{ t("official.c5efc58ae7") }}</p>
    </div></SiteModal
  >
  <SiteModal
    :open="preferences"
    :title="t('official.cf3b9e99ed')"
    @close="preferences = false"
    ><div class="preferences-form">
      <label
        >{{ t("official.c09b58aa34")
        }}<select :value="theme" @change="setTheme">
          <option value="system">{{ t("official.cf4bbd91f7") }}</option>
          <option value="light">{{ t("official.c80ec9e2b1") }}</option>
          <option value="dark">{{ t("official.c30b2c979a") }}</option>
          <option value="high-contrast">{{ t("official.cf7c782f33") }}</option>
        </select></label
      ><label
        >{{ t("official.cd5d8edd12")
        }}<select
          :value="locale"
          @change="
            officialI18nAdapter.setLocale(
              ($event.target as HTMLSelectElement).value,
            )
          "
        >
          <option value="zh-CN">{{ t("official.c93659150d") }}</option>
        </select></label
      ><label
        >{{ t("official.cb0ed915ed")
        }}<select v-model="level">
          <option value="Ultra">{{ t("official.cf571e2cf7") }}</option>
          <option value="High">{{ t("official.c8beedd9bb") }}</option>
          <option value="Medium">{{ t("official.c68e09f351") }}</option>
          <option value="Performance">{{ t("official.c238c87629") }}</option>
        </select></label
      >
      <p>{{ t("official.c28f650e77") }}</p>
      <p v-if="reduced">{{ t("official.cdd1478165") }}</p>
    </div></SiteModal
  >
</template>
