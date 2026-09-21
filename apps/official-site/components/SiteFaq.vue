<script setup lang="ts">
defineProps<{ items: readonly { q: string; a: string }[] }>();
const { t } = useSiteText();
</script>
<template>
  <div class="faq-list">
    <details v-for="item in items" :key="item.q">
      <summary>{{ t(item.q) }}<SiteIcon name="plus" /></summary>
      <div class="faq-answer">
        <p
          v-for="(paragraph, index) in t(item.a).split(/\n\s*\n/)"
          :key="index"
        >
          {{ paragraph }}
        </p>
      </div>
    </details>
  </div>
</template>
