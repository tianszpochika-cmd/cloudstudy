<script setup lang="ts">
import { useOfficialSeo } from "~/utils/seo";
const { t } = useSiteText();
useOfficialSeo({
  title: t("official.c23abcdc89"),
  description: t("official.c70ed7b7a2"),
  path: "/world",
});
</script>
<template>
  <div>
    <PageHeading
      :title="t('official.c273ffb547')"
      :lead="t('official.cecfc7d0d9')"
      :label="t('official.cdf0fd9f57')"
    />
    <section class="page-body world-page">
      <div class="container">
        <WorldExperience />
        <div class="world-footer-note">
          <p>{{ t("official.c29f1d75c1") }}</p>
          <SiteStartButton :label="t('official.c896a13eca')" data-primary />
        </div>
        <div class="world-principles">
          <article>
            <h3>{{ t("official.c480cbe0f0") }}</h3>
            <p>{{ t("official.cc58310035") }}</p>
          </article>
          <article>
            <h3>{{ t("official.c61f2aec8d") }}</h3>
            <p>{{ t("official.c12ab30d2b") }}</p>
          </article>
          <article>
            <h3>{{ t("official.ca8034d6b9") }}</h3>
            <p>{{ t("official.ced2b8603f") }}</p>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>
