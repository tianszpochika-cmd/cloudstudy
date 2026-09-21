<script setup lang="ts">
import { useOfficialSeo } from "~/utils/seo";
const { t } = useSiteText(),
  { publicLink } = useOfficialSiteLinks(),
  { loadState, load } = usePublicProjection("announcements");
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
        <template
          v-if="
            loadState.state === 'ready' &&
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
          :state="loadState.state === 'ready' ? 'empty' : loadState.state"
          @retry="load"
        />
      </div>
    </section>
  </div>
</template>
