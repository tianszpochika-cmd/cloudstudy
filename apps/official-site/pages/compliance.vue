<script setup lang="ts">
const { t } = useSiteText(),
  { loadState, load } = usePublicProjection("compliance");
const notices = computed(() => loadState.value.projection.complianceNotices);
const complianceFacet = computed(() => loadState.value.facets?.compliance ?? { state: loadState.value.state, updatedAt: null as string | null, errorCode: loadState.value.errorCode, stale: loadState.value.stale });
</script>
<template>
  <div>
    <PublicDocument kind="compliance" />
    <section class="section-compact">
      <div class="container">
        <div class="section-title">
          <h2>{{ t("official.ca3b2169c8") }}</h2>
        </div>
        <PublicStatus
          v-if="complianceFacet.state !== 'ready'"
          :state="complianceFacet.state"
          @retry="load"
        />
        <p v-if="complianceFacet.updatedAt" class="facet-updated" aria-live="polite">
          {{ t("official.c5a1f3e8d2") }}{{ complianceFacet.updatedAt.slice(0, 10) }}
        </p>
        <div v-if="notices.length" class="published-notices">
          <article v-for="notice in notices" :key="notice.title">
            <span class="eyebrow">{{ notice.status }}</span>
            <h2>{{ notice.title }}</h2>
            <p>{{ notice.description }}</p>
          </article>
        </div>
        <p v-else-if="loadState.state === 'ready'">
          {{ t("official.c1f1059f87") }}
        </p>
      </div>
    </section>
  </div>
</template>
