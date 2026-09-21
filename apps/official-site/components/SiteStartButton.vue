<script setup lang="ts">
withDefaults(defineProps<{ label?: string; secondary?: boolean }>(), {
  label: "",
});
const { t } = useSiteText();
</script>
<template>
  <NuxtLink
    to="/start"
    class="btn"
    :class="secondary ? 'btn-white' : 'btn-primary'"
    >{{ label || t("official.c03e46770e") }}<SiteIcon name="arrow"
  /></NuxtLink>
</template>
