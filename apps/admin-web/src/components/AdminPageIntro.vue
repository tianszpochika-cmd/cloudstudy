<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { adminPages, ui } from "../platform/experience";
const route = useRoute();
const page = computed(() =>
  adminPages.find((item) => item.path === route.path),
);
</script>
<template>
  <div class="view-intro">
    <div>
      <span class="admin-header__eyebrow">{{
        ui(`group.${page?.group ?? "overview"}`)
      }}</span>
      <h2>{{ ui(`nav.${page?.key ?? "dashboard"}.title`) }}</h2>
      <p>{{ ui(`nav.${page?.key ?? "dashboard"}.description`) }}</p>
      <p class="mobile-table-hint">{{ ui("tableHint") }}</p>
    </div>
    <div v-if="$slots.default" class="view-intro__actions"><slot /></div>
  </div>
</template>
