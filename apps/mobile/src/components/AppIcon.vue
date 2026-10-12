<template>
  <view class="app-icon" :aria-label="label" :aria-hidden="label ? undefined : true" v-html="svg" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { V2_ICONS, type V2IconName } from '../theme/v2-icons';

const props = withDefaults(
  defineProps<{
    name: V2IconName;
    size?: number;
    label?: string;
  }>(),
  {
    size: 20,
  },
);

const svg = computed(
  () =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="${props.size}" height="${props.size}">` +
    V2_ICONS[props.name] +
    `</svg>`,
);
</script>

<style scoped>
.app-icon {
  display: inline-flex;
  line-height: 0;
}
</style>
