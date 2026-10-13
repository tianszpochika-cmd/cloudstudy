<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue'
import { useExperienceText } from '../platform/experience-ui'
const t = useExperienceText()
</script>
<template>
  <main class="status-layout">
    <RouterLink class="brand status-layout__brand" :to="{ name: 'home' }"><AppIcon name="spark" :size="25" /><span>{{ t('brand') }}</span></RouterLink>
    <div class="status-layout__body"><slot /></div>
  </main>
</template>
<style>
.status-layout{min-height:100dvh;display:grid;grid-template-rows:auto 1fr;gap:var(--v2-space-6,24px);padding:32px 24px;background:var(--v2-bg);color:var(--v2-ink);font-family:var(--v2-font)}
.status-layout__brand{justify-self:center;display:inline-flex;align-items:center;gap:8px;color:inherit;text-decoration:none;font-weight:700}
.status-layout__body{width:100%;max-width:960px;margin:0 auto;align-self:start;min-width:0}
</style>
