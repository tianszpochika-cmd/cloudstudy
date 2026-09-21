<script setup lang="ts">
const { t } = useSiteText();
</script>
<template>
  <NuxtLink to="/" class="brand" :aria-label="t('official.ce2143a3f5')"
    ><span class="brand-mark"><SiteIcon name="star" /></span
    >{{ t("official.c78c3d2787") }}</NuxtLink
  >
</template>
