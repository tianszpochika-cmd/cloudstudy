<script setup lang="ts">
import { getPublicStateMeta } from "~/utils/public-state.mjs";
const props = defineProps<{
    state: string;
    title?: string;
    message?: string;
    actionLabel?: string;
    actionHref?: string;
  }>(),
  emit = defineEmits<{ retry: [] }>(),
  { t } = useSiteText();
const meta = computed(() => getPublicStateMeta(props.state));
const copy = computed(
  () =>
    (
      ({
        loading: ["official.c57bf3b88b", "official.c1ac5d662c"],
        empty: ["official.c010e9c193", "official.c409ded177"],
        permission: ["official.c37e341174", "official.c7a5e9ffa3"],
        recovery: ["official.ce3ebe23fc", "official.ca0731eec0"],
        maintenance: ["official.c84439c7d5", "official.c7a5e9ffa3"],
      }) as Record<string, string[]>
    )[props.state] || ["official.c0b1bd656f", "official.c60ab49ecc"],
);
</script>
<template>
  <section
    class="public-status empty-state"
    :role="meta.role"
    aria-live="polite"
  >
    <SiteIcon :name="state === 'loading' ? 'clock' : 'info'" />
    <h2>{{ title || t(copy[0]!) }}</h2>
    <p>{{ message || t(copy[1]!) }}</p>
    <NuxtLink v-if="actionHref" class="btn btn-outline" :to="actionHref">{{
      actionLabel || t("official.c2ced402df")
    }}</NuxtLink
    ><button
      v-else-if="!['empty', 'loading'].includes(state)"
      class="btn btn-outline"
      @click="emit('retry')"
    >
      {{ t("official.c5982c44c1") }}<SiteIcon name="repeat" />
    </button>
  </section>
</template>
