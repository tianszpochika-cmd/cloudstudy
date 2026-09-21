<script setup lang="ts">
defineProps<{ error: { statusCode?: number; statusMessage?: string } }>();
const { t } = useSiteText();
useHead({
  title: t("official.cf9e4e94e2"),
  meta: [{ name: "robots", content: "noindex, nofollow" }],
});
</script>
<template>
  <div class="error-page">
    <div class="error-page-inner">
      <SiteBrand /><span class="eyebrow">{{ error.statusCode || 500 }}</span>
      <h1>
        {{
          t(
            error.statusCode === 404
              ? "official.c763d67d09"
              : "official.cbbc736f68",
          )
        }}
      </h1>
      <p>{{ t("official.cdcbe15e69") }}</p>
      <button class="btn btn-primary" @click="clearError({ redirect: '/' })">
        {{ t("official.cab85b3ad3") }}<SiteIcon name="arrow" />
      </button>
    </div>
  </div>
</template>
