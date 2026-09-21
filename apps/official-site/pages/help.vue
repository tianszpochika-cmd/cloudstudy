<script setup lang="ts">
import { frequentlyAsked } from "~/utils/experience-content";
import { useOfficialSeo } from "~/utils/seo";
const { t } = useSiteText(),
  query = ref(""),
  group = ref("all"),
  filtered = computed(() =>
    frequentlyAsked.filter(
      (f) =>
        (group.value === "all" || f.group === group.value) &&
        (t(f.q) + t(f.a))
          .toLowerCase()
          .includes(query.value.trim().toLowerCase()),
    ),
  );
useOfficialSeo({
  title: t("official.c3ac7c63f8"),
  description: t("official.cb7a31944a"),
  path: "/help",
});
</script>
<template>
  <div>
    <PageHeading
      :title="t('official.c138f34389')"
      :lead="t('official.c20cbd8269')"
      :label="t('official.c0adb1147b')"
    />
    <section class="page-body">
      <div class="container help-layout">
        <aside class="help-sidebar">
          <p>{{ t("official.c55f3066a8") }}</p>
          <nav :aria-label="t('official.c76a6f87c5')">
            <button
              v-for="[key, icon, label] in [
                ['all', 'info', 'official.c5ac1bf9fc'],
                ['start', 'star', 'official.c758409794'],
                ['learn', 'book', 'official.c128a71f1f'],
                ['device', 'phone', 'official.cdf6c9f969'],
              ]"
              :key="key"
              :aria-pressed="group === key"
              @click="group = key!"
            >
              <SiteIcon :name="icon!" />{{ t(label!) }}
            </button>
          </nav>
          <div class="help-contact">
            <SiteIcon name="user" /><strong>{{
              t("official.c1298e2d3d")
            }}</strong>
            <p>{{ t("official.ce2b38dbd2") }}</p>
            <NuxtLink class="link-arrow" to="/start"
              >{{ t("official.cdebfe7b60") }}<SiteIcon name="arrow"
            /></NuxtLink>
          </div>
        </aside>
        <div class="help-main">
          <label class="search-field"
            ><SiteIcon name="search" /><input
              type="search"
              v-model="query"
              :placeholder="t('official.cbbf7c4dcc')"
              :aria-label="t('official.c962042f91')" /><button
              :aria-label="t('official.c1002728f3')"
              @click="query = ''"
            >
              <SiteIcon name="close" /></button
          ></label>
          <h2>{{ t("official.c0adb1147b") }}</h2>
          <SiteFaq :items="filtered" />
          <div v-if="!filtered.length" class="help-empty" role="status">
            {{ t("official.c2a3a465ff") }}<br /><button
              class="link-arrow"
              @click="
                query = '';
                group = 'all';
              "
            >
              {{ t("official.c5ee1dcfb9") }}<SiteIcon name="arrow" />
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
