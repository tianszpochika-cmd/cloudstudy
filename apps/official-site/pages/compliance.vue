<script setup lang="ts">
const { t } = useSiteText(),
  { loadState, load } = usePublicProjection("compliance");
const notices = computed(() => loadState.value.projection.complianceNotices);
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
          v-if="loadState.state !== 'ready'"
          :state="loadState.state"
          @retry="load"
        />
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
