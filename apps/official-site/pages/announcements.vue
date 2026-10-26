<script setup lang="ts">
import { useOfficialSeo } from "~/utils/seo";
const { t } = useSiteText(),
  { publicLink } = useOfficialSiteLinks(),
  { loadState, load } = usePublicProjection("announcements");
const announcementsFacet = computed(() => loadState.value.facets?.announcements ?? { state: loadState.value.state, updatedAt: null as string | null, errorCode: loadState.value.errorCode, stale: loadState.value.stale });
useOfficialSeo({
  title: t("official.c9f9bb9530"),
  description: t("official.ce8a9e7813"),
  path: "/announcements",
});
</script>
<template>
  <div>
    <PageHeading
      :title="t('official.c8c4d1266b')"
      :lead="t('official.c203263801')"
      :label="t('official.c941d9548f')"
    />
    <section class="page-body">
      <div class="container status-note">
        <p
          v-if="announcementsFacet.state === 'recovery'"
          class="facet-recovery"
          role="status"
        >
          {{ t("official.ce3ebe23fc") }}：{{ t("official.ca0731eec0") }}
          <span v-if="announcementsFacet.updatedAt">{{ t("official.c5a1f3e8d2") }}{{ announcementsFacet.updatedAt.slice(0, 10) }}</span>
          <button class="btn btn-outline" type="button" @click="load">{{ t("official.c5982c44c1") }}</button>
        </p>
        <p v-if="announcementsFacet.updatedAt && announcementsFacet.state !== 'recovery'" class="facet-updated" aria-live="polite">
          {{ t("official.c5a1f3e8d2") }}{{ announcementsFacet.updatedAt.slice(0, 10) }}
        </p>
        <template
          v-if="
            ['ready', 'recovery'].includes(announcementsFacet.state) &&
            loadState.projection.announcements.length
          "
          ><article
            v-for="item in loadState.projection.announcements"
            :key="item.id"
            class="update-card"
          >
            <h2>{{ item.title }}</h2>
            <p>{{ item.summary }}</p>
            <time v-if="item.publishedAt">{{
              item.publishedAt.slice(0, 10)
            }}</time
            ><a
              v-if="publicLink(item.href)"
              class="link-arrow"
              :href="publicLink(item.href)!"
              >{{ t("official.c24b7643c9") }}<SiteIcon name="arrow"
            /></a></article></template
        ><PublicStatus
          v-else
          :state="announcementsFacet.state === 'ready' ? 'empty' : announcementsFacet.state"
          @retry="load"
        />
      </div>
    </section>
  </div>
</template>
