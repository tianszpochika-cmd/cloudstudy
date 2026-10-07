<script setup lang="ts">
import { useOfficialSeo } from "~/utils/seo";
const { t } = useSiteText();
const { loadState, load } = usePublicProjection("download");
const channels = computed(() => loadState.value.projection.downloadChannels);
const catalogEmpty = computed(() =>
  ["ready", "empty"].includes(loadState.value.state) && !channels.value.length,
);
const showCatalog = computed(() =>
  ["ready", "recovery"].includes(loadState.value.state) && channels.value.length > 0,
);
useOfficialSeo({
  title: t("official.r1DownloadTitle"),
  description: t("official.r1DownloadNote"),
  path: "/download",
});
</script>
<template>
  <div>
    <PageHeading
      :title="t('official.r1DownloadTitle')"
      :lead="t('official.r1DownloadNote')"
      :label="t('official.r1DownloadLabel')"
    />
    <section class="page-body">
      <div class="container">
        <div v-if="showCatalog" class="published-grid" data-public-catalog>
          <article v-for="item in channels" :key="item.id" class="public-course-card" :data-availability="item.availability">
            <h2>{{ item.name }}</h2>
            <p v-if="item.platform">{{ item.platform }}</p>
            <p v-if="item.description">{{ item.description }}</p>
            <p>{{ t(`official.r1Availability_${item.availability}`) }}</p>
          </article>
        </div>
        <PublicStatus
          v-if="loadState.state !== 'ready' || catalogEmpty"
          :state="catalogEmpty ? 'empty' : loadState.state"
          :title="catalogEmpty ? t('official.r1DownloadPreparing') : undefined"
          :message="catalogEmpty ? t('official.r1DownloadEmptyNote') : undefined"
          :action-href="catalogEmpty ? '/announcements' : undefined"
          :action-label="t('official.c584d952d2')"
          @retry="load"
        />
        <p class="catalog-note">{{ t("official.r1DownloadBoundary") }}</p>
        <SiteStartButton />
      </div>
    </section>
  </div>
</template>
