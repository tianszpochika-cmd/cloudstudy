<script setup lang="ts">
import type { ThemeMode } from '@englishflow/design-tokens'
import { useLearningUi } from '../platform/learning-ui'

const ui = useLearningUi()
const themes: readonly ThemeMode[] = ['system', 'light', 'dark', 'high-contrast']

function changeLocale(event: Event): void {
  ui.setLocale((event.target as HTMLSelectElement).value)
}

function changeContentLocale(event: Event): void {
  ui.setContentLocale((event.target as HTMLSelectElement).value)
}

function changeTheme(event: Event): void {
  ui.setTheme((event.target as HTMLSelectElement).value as ThemeMode)
}
</script>

<template>
  <div class="learning-preferences" aria-label="学习显示偏好">
    <label>
      <span>{{ ui.t('learning.preferences.uiLocale') }}</span>
      <select :value="ui.locale" @change="changeLocale">
        <option value="zh-CN">{{ ui.t('learning.preferences.zh') }}</option>
        <option value="en-US">{{ ui.t('learning.preferences.en') }}</option>
      </select>
    </label>
    <label>
      <span>{{ ui.t('learning.preferences.contentLocale') }}</span>
      <select :value="ui.contentLocale" @change="changeContentLocale">
        <option value="en-US">English</option>
        <option value="zh-CN">中文</option>
      </select>
    </label>
    <label>
      <span>{{ ui.t('learning.preferences.theme') }}</span>
      <select :value="ui.theme" @change="changeTheme">
        <option v-for="theme in themes" :key="theme" :value="theme">{{ ui.t(`learning.preferences.${theme}`) }}</option>
      </select>
    </label>
  </div>
</template>

<style scoped>
.learning-preferences { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.learning-preferences label { display: inline-flex; align-items: center; gap: 6px; color: var(--ef-color-text-secondary, var(--yx-color-text-secondary)); font-size: 12px; }
.learning-preferences select { min-height: 32px; padding: 0 8px; border: 1px solid var(--ef-color-border-default, var(--yx-color-border)); border-radius: 8px; color: var(--ef-color-text-primary, var(--yx-color-text-primary)); background: var(--ef-color-background-surface, var(--yx-color-surface-card)); }
@media (max-width: 640px) { .learning-preferences { display: grid; grid-template-columns: 1fr; align-items: stretch; } .learning-preferences label { justify-content: space-between; } }
</style>
