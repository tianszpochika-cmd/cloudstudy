<script setup lang="ts">
const { t } = useSiteText();
</script>
<template>
  <section class="section world-section">
    <div class="container">
      <div class="section-title">
        <div>
          <span class="eyebrow">{{ t("official.c5e7737cad") }}</span>
          <h2>{{ t("official.c7a5fa03f5") }}</h2>
          <p>
            {{ t("official.cfd28af02a") }}<br />{{ t("official.c04477b4c3") }}
          </p>
        </div>
        <NuxtLink to="/world" class="link-arrow"
          >{{ t("official.c7d0ea2965") }}<SiteIcon name="arrow"
        /></NuxtLink>
      </div>
      <WorldExperience />
      <div class="world-footer-note">
        <p>{{ t("official.cf7ba2f775") }}</p>
        <SiteStartButton :label="t('official.c17490d54c')" />
      </div>
    </div>
  </section>
</template>
