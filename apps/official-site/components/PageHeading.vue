<script setup lang="ts">
defineProps<{ title: string; lead: string; label: string }>();
const { t } = useSiteText();
</script>
<template>
  <section class="page-heading">
    <div class="container">
      <nav class="breadcrumb" :aria-label="t('official.cb458ea40b')">
        <NuxtLink to="/">{{ t("official.cff93ad0e4") }}</NuxtLink
        ><SiteIcon name="right" /><span>{{ label }}</span>
      </nav>
      <span class="eyebrow">{{ label }}</span>
      <h1>{{ title }}</h1>
      <p>{{ lead }}</p>
    </div>
  </section>
</template>
