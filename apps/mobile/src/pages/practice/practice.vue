<script setup lang="ts">
import MobileFeatureGrid from '../../components/MobileFeatureGrid.vue'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { mobileT, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { b10ThemeMode, b10T } from '../../platform/b10-foundation'
import { openUniPage } from '../../platform/uni-runtime'
import { ensureMobilePageAccess } from '../../auth/navigation'

const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const entryPages = ['assessment', 'b10-report', 'b3-reading', 'b3-listening', 'b3-speaking']
const entries = computed(() => entryPages.map((page) => ({ title: mobileT(`pages.${page}.short`), description: mobileT(`pages.${page}.description`), path: `/pages/${page}/${page}` })))
function open(path: string): void { openUniPage(path) }
onShow(async () => { await ensureMobilePageAccess('/pages/practice/practice') })
</script>

<template>
  <view class="yx-page" :class="themeClass" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="practice" />
    <view class="v2-practice-body">
      <view class="meta v2-practice-meta"><text>共 {{ entries.length }} 个练习入口</text></view>
      <MobileFeatureGrid />
      <view class="b10-entry-grid v2-practice-list">
        <view v-for="entry in entries" :key="entry.path" class="yx-card b10-entry card v2-practice-card">
          <text class="b10-entry__title v2-practice-stem">{{ entry.title }}</text>
          <text class="b10-entry__description v2-practice-desc">{{ entry.description }}</text>
          <button tabindex="0" role="button" class="yx-button opt v2-practice-opt v2-practice-submit v2-practice-next" type="button" @click="open(entry.path)">进入</button>
        </view>
      </view>
      <text class="b10-footnote fb v2-practice-fb">{{ b10T('practice.description') }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.b10-entry-grid{display:grid;gap:16rpx}.b10-entry{display:grid;gap:10rpx}.b10-entry__title{font-size:30rpx;font-weight:750}.b10-entry__description,.b10-footnote{color:var(--yx-text-secondary);font-size:23rpx;line-height:1.6}.b10-footnote{display:block;margin-top:18rpx}
</style>
