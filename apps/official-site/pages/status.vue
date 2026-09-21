<script setup lang="ts">
import { useOfficialSeo } from "~/utils/seo";
const { t } = useSiteText();
useOfficialSeo({
  title: t("official.cff5ae0a65"),
  description: t("official.c810033a10"),
  path: "/status",
});
</script>
<template>
  <div>
    <PageHeading
      :title="t('official.c134f05192')"
      :lead="t('official.c810033a10')"
      :label="t('official.cd42da9e2a')"
    />
    <section class="page-body">
      <div class="container status-note">
        <div class="empty-state">
          <SiteIcon name="bell" />
          <h2>{{ t("official.c729f9e616") }}</h2>
          <p>
            {{ t("official.c57aa90de3") }}<br />{{ t("official.cb0da2dd21") }}
          </p>
          <NuxtLink to="/announcements" class="btn btn-outline"
            >{{ t("official.c2bb18da4e") }}<SiteIcon name="arrow"
          /></NuxtLink>
        </div>
        <p>
          {{ t("official.cc32addaeb")
          }}<NuxtLink to="/help" class="link-arrow">{{
            t("official.c0adb1147b")
          }}</NuxtLink
          >。
        </p>
      </div>
    </section>
  </div>
</template>
