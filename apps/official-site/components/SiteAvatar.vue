<script setup lang="ts">
import { avatarMarkup } from "~/utils/avatar-art";
const props = defineProps<{ index: number; outfit: number }>();
const svg = computed(() =>
  avatarMarkup(
    Math.max(0, Math.min(2, props.index)),
    Math.max(0, Math.min(2, props.outfit)),
  ),
);
</script>
<template>
  <span class="avatar-vector" aria-hidden="true" v-html="svg" />
</template>
