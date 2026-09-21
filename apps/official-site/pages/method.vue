<script setup lang="ts">
import { useOfficialSeo } from "~/utils/seo";
const { t } = useSiteText();
useOfficialSeo({
  title: t("official.c7f1c9ea53"),
  description: t("official.c57e19a7b0"),
  path: "/method",
});
</script>
<template>
  <div>
    <PageHeading
      :title="t('official.c2a0f0bc01')"
      :lead="t('official.c8e3e07ec3')"
      :label="t('official.c831468464')"
    />
    <section class="page-body">
      <div class="container">
        <div class="method-preview">
          <div class="try-copy">
            <span class="eyebrow">{{ t("official.c48eee5164") }}</span>
            <h2>
              {{ t("official.c9a031e3f0") }}<br />{{ t("official.c9bde11c4b") }}
            </h2>
            <p>
              {{ t("official.ca92463717") }}<br />{{ t("official.cdcec35847") }}
            </p>
          </div>
          <PracticeSample />
        </div>
        <div class="method-bottom">
          <p>
            <strong>{{ t("official.c481ae79c1") }}</strong
            >{{ t("official.c517ae4253") }}
          </p>
          <SiteStartButton data-primary />
        </div>
      </div>
    </section>
  </div>
</template>
