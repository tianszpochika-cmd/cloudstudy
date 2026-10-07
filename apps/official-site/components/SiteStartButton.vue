<script setup lang="ts">
withDefaults(defineProps<{ label?: string; secondary?: boolean }>(), {
  label: "",
});
const { t } = useSiteText();
const { registerLink } = useOfficialSiteLinks();
</script>
<template>
  <NuxtLink
    :to="registerLink()"
    external
    data-register-entry
    class="btn"
    :class="secondary ? 'btn-white' : 'btn-primary'"
    >{{ label || t("official.c03e46770e") }}<SiteIcon name="arrow"
  /></NuxtLink>
</template>
