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
/* v2 练习页换皮：对齐 mobile/styles.css 与 refine.css 中 .meta/.card/.opt/.fb/.btn，对齐 today.vue v2-today-* 卡片数值，仅用 var(--v2-*)。 */
.v2-practice-body{display:flex;flex-direction:column;gap:var(--v2-space-4);font-family:var(--v2-font)}
.v2-practice-meta{display:block;margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
.v2-practice-list{display:grid;gap:var(--v2-space-4)}
.v2-practice-card{display:grid;gap:var(--v2-space-2);padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font)}
.v2-practice-card:hover{border-color:var(--v2-brand)}
.v2-practice-stem{display:block;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45}
.v2-practice-desc{display:block;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
.v2-practice-opt{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap}
.v2-practice-opt:hover{border-color:var(--v2-brand)}
.v2-practice-opt.sel{border-color:var(--v2-brand);background:var(--v2-soft)}
.v2-practice-opt:active{transform:scale(.97)}
.v2-practice-opt:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-practice-opt:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-practice-submit{border-color:transparent;background:var(--v2-brand);color:var(--v2-inverse);font-family:var(--v2-font);font-weight:700}
.v2-practice-submit:hover{border-color:var(--v2-brand)}
.v2-practice-next{font-family:var(--v2-font);white-space:nowrap}
.v2-practice-fb{display:block;margin-top:var(--v2-space-4);padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
.v2-practice-fb.ok{background:var(--v2-ok-soft);color:var(--v2-ok)}
.v2-practice-fb.no{background:var(--v2-bad-soft);color:var(--v2-bad)}
</style>
