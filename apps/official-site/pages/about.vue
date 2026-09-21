<script setup lang="ts">
import { useOfficialSeo } from "~/utils/seo";
const { t } = useSiteText();
useOfficialSeo({
  title: t("official.c3a9d26408"),
  description: t("official.c464f12ed4"),
  path: "/about",
});
</script>
<template>
  <div>
    <PageHeading
      :title="t('official.c9d4463ed0')"
      :lead="t('official.c6c92bf054')"
      :label="t('official.c3a9d26408')"
    />
    <section class="page-body">
      <div class="container">
        <div class="about-banner">
          <div>
            <h2>
              {{ t("official.c4341b9672") }}<br />{{ t("official.cc7ff621c2") }}
            </h2>
            <p>
              {{ t("official.c2591d3f06") }}<br />{{ t("official.cd51a0f39c")
              }}<br />{{ t("official.c109933435") }}
            </p>
          </div>
          <img
            src="/illustrations/desk.svg"
            width="340"
            height="170"
            :alt="t('official.ca0717f23e')"
          />
        </div>
        <div class="principles">
          <article
            v-for="([title, text], i) in [
              ['official.cf55d4f51f', 'official.c0d82eb17f'],
              ['official.c709b2014e', 'official.cc5bd081f4'],
              ['official.c9576078dc', 'official.c20944d434'],
            ]"
            :key="title"
          >
            <span>0{{ i + 1 }}</span>
            <h3>{{ t(title!) }}</h3>
            <p>{{ t(text!) }}</p>
          </article>
        </div>
        <div class="about-end">
          <p>{{ t("official.c63e42afa3") }}</p>
          <SiteStartButton :label="t('official.cd3b2479fd')" data-primary />
        </div>
      </div>
    </section>
  </div>
</template>
