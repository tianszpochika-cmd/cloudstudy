<script setup lang="ts">
import type { ThemeMode } from '@englishflow/design-tokens'
import { b10ContentLocale, b10ThemeMode, b10T, b10UiLocale, setB10ContentLocale, setB10ThemeMode } from '../../platform/b10-foundation'

const themeModes: ThemeMode[] = ['light', 'dark', 'system', 'high-contrast']
const themeLabels = ['common.light', 'common.dark', 'common.system', 'common.contrast']
const contentLocales = ['en-US', 'zh-CN']
function selectTheme(index: number): void { setB10ThemeMode(themeModes[index] ?? 'system') }
function selectContentLocale(index: number): void { setB10ContentLocale(contentLocales[index] ?? 'en-US') }
</script>

<template>
  <view class="b10-theme-bar" aria-label="学习端显示设置">
    <text class="b10-theme-bar__label">{{ b10T('common.theme') }}</text>
    <picker :range="themeLabels.map((key) => b10T(key))" :value="themeModes.indexOf(b10ThemeMode)" @change="selectTheme(Number($event.detail.value))">
      <view class="b10-theme-bar__picker">{{ b10T(themeLabels[themeModes.indexOf(b10ThemeMode)] ?? 'common.system') }}</view>
    </picker>
    <text class="b10-theme-bar__label">{{ b10T('common.contentLocale') }}</text>
    <picker :range="contentLocales" :value="contentLocales.indexOf(b10ContentLocale)" @change="selectContentLocale(Number($event.detail.value))">
      <view class="b10-theme-bar__picker">{{ b10ContentLocale }}</view>
    </picker>
    <text class="b10-theme-bar__hint">{{ b10T('common.uiLocale') }}: {{ b10UiLocale }}</text>
  </view>
</template>

<style scoped lang="scss">
.b10-theme-bar{display:flex;align-items:center;gap:10rpx;flex-wrap:wrap;margin-top:18rpx;color:var(--yx-text-tertiary);font-size:20rpx}.b10-theme-bar__label{font-weight:700}.b10-theme-bar__picker{min-height:54rpx;padding:0 14rpx;border:1rpx solid var(--yx-border);border-radius:10rpx;color:var(--yx-text-secondary);background:var(--yx-surface-card);line-height:54rpx}.b10-theme-bar__hint{margin-left:auto}
</style>
