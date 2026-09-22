<script setup lang="ts">
import AppIcon, { type AppIconName } from './AppIcon.vue'
import { useExperienceText } from '../platform/experience-ui'
withDefaults(defineProps<{ page: string; titleId?: string; icon?: AppIconName; hero?: boolean }>(), { icon: 'spark', hero: false })
const t = useExperienceText()
</script>
<template>
  <header class="experience-heading" :class="{ 'experience-heading--hero': hero }">
    <div class="experience-heading__copy">
      <span class="experience-eyebrow"><AppIcon :name="icon" :size="15" />{{ t('workspace') }}</span>
      <h1 :id="titleId">{{ t(`title${page}`) }}</h1>
      <p>{{ t(`desc${page}`) }}</p>
    </div>
    <div v-if="$slots.default" class="experience-heading__actions"><slot /></div>
    <div v-else class="experience-heading__art" aria-hidden="true"><AppIcon :name="icon" :size="54" /><i></i><i></i></div>
  </header>
</template>
