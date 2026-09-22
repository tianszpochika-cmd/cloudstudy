<script setup lang="ts">
import { computed } from "vue";
import { ui } from "../platform/experience";
const props = defineProps<{ value: unknown }>();
const fields = computed(() => {
  const result: Array<{ key: string; label: string; value: string }> = [];
  function visit(value: unknown, path: string, depth: number) {
    if (depth > 5 || result.length >= 150) return;
    if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, item]) =>
        visit(item, path ? `${path} / ${key}` : key, depth + 1),
      );
    } else {
      const key = path.split(" / ").at(-1) ?? path;
      const translated = ui(`fields.${key}`);
      result.push({
        key: path,
        label: translated.startsWith("admin.fields.") ? path : translated,
        value:
          value === null || value === undefined || value === ""
            ? "—"
            : String(value),
      });
    }
  }
  visit(props.value, "", 0);
  return result;
});
</script>
<template>
  <dl v-if="fields.length" class="record-fields">
    <div v-for="field in fields" :key="field.key" class="record-field">
      <dt :title="field.key">{{ field.label }}</dt>
      <dd>{{ field.value }}</dd>
    </div>
  </dl>
  <el-empty v-else :description="ui('empty')" :image-size="70" />
</template>
