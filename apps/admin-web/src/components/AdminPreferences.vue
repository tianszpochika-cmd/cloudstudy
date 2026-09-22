<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { adminThemeController } from "../platform/v2-foundation";
import { ui } from "../platform/experience";
import AdminIcon from "./AdminIcon.vue";
import { adminPerformance } from "../platform/motion";
import {
  PERFORMANCE_LEVELS,
  type PerformanceLevel,
} from "@englishflow/performance";
import type { ThemeMode } from "@englishflow/design-tokens";
const theme = ref(adminThemeController.theme);
const stop = adminThemeController.subscribe((state) => {
  theme.value = state.theme;
});
const quality = ref(adminPerformance.level);
const stopPerformance = adminPerformance.subscribe((state) => {
  quality.value = state.level;
});
onUnmounted(() => {
  stop();
  stopPerformance();
});
function select(value: string) {
  if (PERFORMANCE_LEVELS.includes(value as PerformanceLevel))
    adminPerformance.setLevel(value as PerformanceLevel);
  else adminThemeController.setTheme(value as ThemeMode);
}
const options: Array<{ value: ThemeMode; key: string }> = [
  { value: "light", key: "light" },
  { value: "dark", key: "dark" },
  { value: "system", key: "system" },
  { value: "high-contrast", key: "contrast" },
];
</script>
<template>
  <el-dropdown trigger="click" @command="select">
    <button
      class="admin-icon-button"
      type="button"
      :aria-label="ui('preferences')"
      :title="ui('preferences')"
    >
      <AdminIcon name="sun" />
    </button>
    <template #dropdown
      ><el-dropdown-menu
        ><el-dropdown-item
          v-for="option in options"
          :key="option.value"
          :command="option.value"
          :disabled="theme === option.value"
          >{{ theme === option.value ? "✓ " : ""
          }}{{ ui(option.key) }}</el-dropdown-item
        ><el-dropdown-item
          v-for="(level, index) in PERFORMANCE_LEVELS"
          :key="level"
          :command="level"
          :divided="index === 0"
          :disabled="quality === level"
          >{{ quality === level ? "✓ " : "" }}{{ level }}</el-dropdown-item
        ></el-dropdown-menu
      ></template
    >
  </el-dropdown>
</template>
