<script setup lang="ts">
import { computed } from "vue";

export type AdminIconName =
  | "audit"
  | "chart"
  | "content"
  | "flag"
  | "globe"
  | "help"
  | "home"
  | "release"
  | "search"
  | "settings"
  | "spark"
  | "support"
  | "wallet"
  | "book"
  | "audio"
  | "people"
  | "shield"
  | "sun"
  | "menu"
  | "arrow";
const props = withDefaults(
  defineProps<{ name?: AdminIconName; size?: number }>(),
  { name: "spark", size: 18 },
);
const iconPaths: Record<AdminIconName, string[]> = {
  book: [
    "M3 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H3V4Z",
    "M21 4h-6a3 3 0 0 0-3 3v14a4 4 0 0 1 4-2h5V4Z",
  ],
  audio: ["M5 9v6", "M9 5v14", "M13 3v18", "M17 7v10", "M21 10v4"],
  people: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    "M22 21v-2a4 4 0 0 0-3-3.9",
    "M16 3.1a4 4 0 0 1 0 7.8",
  ],
  shield: ["M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z", "m8 12 3 3 5-6"],
  sun: [
    "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    "M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5",
  ],
  menu: ["M4 6h16M4 12h16M4 18h16"],
  arrow: ["M4 12h16", "m14 6 6 6-6 6"],
  audit: ["M5 4h14v16H5z", "M8 8h8", "M8 12h8", "M8 16h5"],
  chart: ["M4 19V5", "M4 19h16", "m7 15 3-4 3 2 4-6"],
  content: ["M5 4h14v16H5z", "M8 8h8", "M8 12h5", "M8 16h7"],
  flag: ["M6 21V4", "M6 5h11l-2 4 2 4H6"],
  globe: [
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
    "M3 12h18",
    "M12 3c2.2 2.4 3.3 5.4 3.3 9s-1.1 6.6-3.3 9c-2.2-2.4-3.3-5.4-3.3-9S9.8 5.4 12 3Z",
  ],
  help: [
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
    "M9.8 9a2.4 2.4 0 1 1 4.2 1.6c-.9.8-2 1.2-2 2.7",
    "M12 17h.01",
  ],
  home: ["M3.5 10.5 12 3l8.5 7.5", "M5.5 9.5V21h13V9.5", "M9.5 21v-6h5v6"],
  release: ["M4 5h16v14H4z", "M8 9h8", "M8 13h5", "M8 17h3"],
  search: [
    "M10.8 18a7.2 7.2 0 1 0 0-14.4 7.2 7.2 0 0 0 0 14.4Z",
    "m16 16 4.5 4.5",
  ],
  settings: [
    "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z",
    "m19.4 15 .1.1a2 2 0 1 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4v.2a2 2 0 1 1-4 0v-.2a2 2 0 0 0-3.4-1.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A2 2 0 0 0 4.5 12a2 2 0 0 0-1.5-1.9 2 2 0 1 1 1.5-3.8 2 2 0 0 0 1.5-1.9 2 2 0 1 1 3.8-1.5 2 2 0 0 0 3.4-1.4v-.2a2 2 0 1 1 4 0v.2a2 2 0 0 0 3.4 1.4 2 2 0 1 1 2.8 2.8l-.1.1A2 2 0 0 0 19.5 8c0 .9.6 1.7 1.5 1.9a2 2 0 1 1-1.5 3.8 2 2 0 0 0-.1 1.3Z",
  ],
  spark: [
    "M12 2.5 14.2 9l6.3 2.2-6.3 2.2L12 20l-2.2-6.6-6.3-2.2L9.8 9 12 2.5Z",
  ],
  support: [
    "M4 13v-1a8 8 0 0 1 16 0v1",
    "M4 13h3v6H6a2 2 0 0 1-2-2v-4Z",
    "M20 13h-3v6h1a2 2 0 0 0 2-2v-4Z",
  ],
  wallet: [
    "M4 6.5A2.5 2.5 0 0 1 6.5 4H19a1 1 0 0 1 1 1v15H6.5A2.5 2.5 0 0 1 4 17.5v-11Z",
    "M4 8h16",
    "M15 13h3",
  ],
};
const paths = computed(() => iconPaths[props.name] ?? iconPaths.spark);
</script>

<template>
  <svg
    class="admin-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path v-for="path in paths" :key="path" :d="path" />
  </svg>
</template>

<style scoped>
.admin-icon {
  display: block;
  flex: 0 0 auto;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
