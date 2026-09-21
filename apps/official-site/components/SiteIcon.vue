<script setup lang="ts">
import { siteIcons } from "~/utils/site-icons";
defineProps<{ name: string }>();
</script>
<template>
  <svg
    class="icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
    v-html="siteIcons[name] || siteIcons.star"
  />
</template>
