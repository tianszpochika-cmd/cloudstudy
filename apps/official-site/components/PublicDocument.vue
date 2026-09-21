<script setup lang="ts">
import { publicDocuments } from "~/utils/experience-content";
import { useOfficialSeo } from "~/utils/seo";
const props = defineProps<{ kind: keyof typeof publicDocuments }>(),
  { t } = useSiteText(),
  document = computed(() => publicDocuments[props.kind]);
useOfficialSeo({
  title: t(document.value.title) + " · " + t("official.c78c3d2787"),
  description: t(document.value.lead),
  path: "/" + props.kind,
});
const links = [
  ["privacy", "shield", "official.c5c7d60537"],
  ["terms", "file", "official.c15683f6cd"],
  ["minors", "user", "official.c770693e4f"],
  ["compliance", "info", "official.cfbcee5731"],
];
</script>
<template>
  <div>
    <PageHeading
      :title="t(document.title)"
      :lead="t(document.lead)"
      :label="t('official.cfbcee5731')"
    />
    <section class="page-body">
      <div class="container public-layout">
        <nav class="public-nav" :aria-label="t('official.c5e0350877')">
          <NuxtLink
            v-for="[key, icon, label] in links"
            :key="key"
            :to="'/' + key"
            :aria-current="kind === key ? 'page' : undefined"
            ><SiteIcon :name="icon!" />{{ t(label!) }}</NuxtLink
          >
        </nav>
        <article class="public-article">
          <div class="doc-label">
            <SiteIcon name="file" /><span
              >{{ t(document.label) }}{{ t("official.c099213be8") }}</span
            >
          </div>
          <template v-for="[title, text] in document.sections" :key="title"
            ><h2>{{ t(title) }}</h2>
            <p>{{ t(text) }}</p></template
          >
          <div class="notice-box">{{ t(document.note) }}</div>
          <NuxtLink class="link-arrow" to="/announcements"
            >{{ t("official.c2bb18da4e") }}<SiteIcon name="arrow"
          /></NuxtLink>
        </article>
      </div>
    </section>
  </div>
</template>
