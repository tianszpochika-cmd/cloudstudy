<script setup lang="ts">
import { computed } from "vue";
import sprite from "../assets/v2-icons.svg?raw";
import type { AdminIconName } from "./AdminIcon.vue";

const props = withDefaults(
  defineProps<{ name: AdminIconName; size?: number }>(),
  { size: 18 },
);

if (
  typeof document !== "undefined" &&
  !document.getElementById("v2-icon-sprite")
) {
  const div = document.createElement("div");
  div.id = "v2-icon-sprite";
  div.setAttribute("aria-hidden", "true");
  div.style.display = "none";
  div.innerHTML = sprite;
  document.body.prepend(div);
}

const map: Record<AdminIconName, string> = {
  home: "grid",
  content: "learn",
  book: "book",
  audit: "list",
  audio: "type",
  people: "users",
  support: "ticket",
  wallet: "cart",
  flag: "flag",
  shield: "shield",
  settings: "key",
  release: "refresh",
  help: "help",
  chart: "chart",
  globe: "world",
  search: "search",
  spark: "spark",
  sun: "star",
  menu: "list",
  arrow: "chev",
};
const id = computed(() => map[props.name] ?? "spark");
</script>

<template>
  <svg class="v2-icon" :width="size" :height="size" aria-hidden="true" focusable="false"><use :href="'#i-' + id" /></svg>
</template>
