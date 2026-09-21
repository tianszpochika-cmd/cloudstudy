<script setup lang="ts">
const { t } = useSiteText();
</script>
<template>
  <div class="free-banner">
    <div>
      <span class="free-kicker">{{ t("official.cfc20bd937") }}</span>
      <h2>
        {{ t("official.c0f921987a") }}<br />{{ t("official.ce62733459") }}
      </h2>
      <p>{{ t("official.ce9c9057b2") }}</p>
    </div>
    <SiteStartButton :label="t('official.c03e46770e')" secondary />
  </div>
</template>
