<script setup lang="ts">
import { useOfficialSeo } from "~/utils/seo";
import { buildPublicLearningEntry } from "~/utils/public-links.mjs";
const { t, locale } = useSiteText(),
  config = useRuntimeConfig(),
  route = useRoute(),
  { officialThemeController } = useNuxtApp().$foundation;
const mobile = useLearningDevice(),
  other = ref(false),
  copyState = ref("");
const entry = (login = false) =>
  buildPublicLearningEntry({
    base: mobile.value
      ? String(config.public.mobileH5Url)
      : String(config.public.learnerWebUrl),
    mobile: mobile.value,
    login,
    locale: locale.value,
    theme: officialThemeController.theme,
    campaign: route.query,
  });
const siteAddress = computed(
  () => String(config.public.siteUrl).replace(/\/$/, "") + "/start",
);
async function copy() {
  try {
    await navigator.clipboard.writeText(siteAddress.value);
    copyState.value = t("official.c2344282d4");
  } catch {
    copyState.value = t("official.c807b1c5ad");
  }
}
useOfficialSeo({
  title: t("official.c3c8699607"),
  description: t("official.cca1d656e3"),
  path: "/start",
});
</script>
<template>
  <div>
    <PageHeading
      :title="t('official.cbd70ad936')"
      :lead="t('official.ce55878cbf')"
      :label="t('official.cd28ebd1dd')"
    />
    <section class="page-body">
      <div class="container">
        <div class="start-wrap">
          <div class="start-action">
            <span class="device-icon"
              ><SiteIcon :name="mobile ? 'phone' : 'monitor'"
            /></span>
            <h2>
              {{ t(mobile ? "official.c89f868063" : "official.c5973f1b79") }}
            </h2>
            <p>{{ t("official.cf5629c6ae") }}</p>
            <a
              class="btn btn-primary btn-wide"
              :href="entry()"
              data-learning-entry
              >{{ t(mobile ? "official.c2573715f8" : "official.c8c7a38714")
              }}<SiteIcon name="arrow"
            /></a>
            <p class="start-footnote">{{ t("official.c584d952d2") }}</p>
            <div class="switch-device">
              <SiteIcon :name="mobile ? 'monitor' : 'phone'" /><span>{{
                t(mobile ? "official.ce6604926b" : "official.c0c4437e91")
              }}</span
              ><button @click="other = true">
                {{ t("official.c7197b208b") }}<SiteIcon name="right" />
              </button>
            </div>
            <div class="text-login">
              {{ t("official.c605fd9419")
              }}<a :href="entry(true)">{{ t("official.cfcc98f81f") }}</a>
            </div>
          </div>
          <div class="start-benefits">
            <span class="eyebrow">{{ t("official.cfc20bd937") }}</span>
            <h2>
              {{ t("official.c0f921987a") }}<br />{{ t("official.ce62733459") }}
            </h2>
            <p>{{ t("official.c9645a4eef") }}</p>
            <ul class="included-list">
              <li
                v-for="text in [
                  'official.c88fc1b678',
                  'official.cf1d468491',
                  'official.ccfaa20f31',
                  'official.c41a50348d',
                ]"
                :key="text"
              >
                <SiteIcon name="check" />{{ t(text) }}
              </li>
            </ul>
            <img
              src="/illustrations/desk.svg"
              width="340"
              height="170"
              :alt="t('official.c622eae578')"
            />
          </div>
        </div>
        <div class="start-links">
          <NuxtLink to="/privacy">{{ t("official.c5c7d60537") }}</NuxtLink
          ><NuxtLink to="/terms">{{ t("official.c15683f6cd") }}</NuxtLink
          ><NuxtLink to="/help">{{ t("official.cb270efd71") }}</NuxtLink>
        </div>
        <p class="free-note">{{ t("official.cfb3505acc") }}</p>
      </div>
    </section>
    <SiteModal
      :open="other"
      :title="t('official.c90a402d5e')"
      @close="other = false"
      ><p>{{ t("official.ceed5c104a") }}</p>
      <div class="copy-field">{{ siteAddress }}</div>
      <button class="btn btn-primary btn-wide" @click="copy">
        {{ t("official.cee16259fc") }}<SiteIcon name="copy" />
      </button>
      <p role="status">{{ copyState }}</p>
      <p
        v-if="
          siteAddress.includes('127.0.0.1') || siteAddress.includes('localhost')
        "
        class="dialog-note"
      >
        {{ t("official.cb84af9d4e") }}
      </p></SiteModal
    >
  </div>
</template>
