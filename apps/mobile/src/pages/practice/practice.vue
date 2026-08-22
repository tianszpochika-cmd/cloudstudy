<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import B10ThemeBar from '../../components/b10/B10ThemeBar.vue'
import { b10ThemeMode, b10T } from '../../platform/b10-foundation'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const entries = [
  { title: '词汇 / SRS', description: '主动回忆、信心度、离线待同步复习。', path: '/pages/b2-vocabulary/b2-vocabulary' },
  { title: '基础练习', description: '服务端题面、断点、幂等提交和规则反馈。', path: '/pages/b2-practice/b2-practice' },
  { title: '错题与报告', description: 'D0/D1/D7 订正、错误原因和报告证据。', path: '/pages/b10-report/b10-report' },
  { title: '语法 / 长难句', description: '知识树、句法 X 光和结构化练习。', path: '/pages/b3-grammar/b3-grammar' },
  { title: '阅读', description: '版本锁定、进度保存、理解检查和表达挖掘。', path: '/pages/b3-reading/b3-reading' },
  { title: 'B11 听力 / Clips', description: '授权播放、速度、A-B、字幕、听写和离线进度。', path: '/pages/b11-listening/b11-listening' },
  { title: 'B11 分级阅读', description: '版本绑定、阅读位置、理解题和恢复同步。', path: '/pages/b11-reading/b11-reading' },
  { title: 'B11 音标 / 跟读', description: '麦克风权限、录音回放、自评与安全本地副本。', path: '/pages/b11-speaking/b11-speaking' },
  { title: '规则写作', description: '翻译、仿写、病句改错与规则反馈。', path: '/pages/b3-writing/b3-writing' },
]
function open(path: string): void { getUniRuntime().navigateTo({ url: path }) }
onShow(() => { session.restore(); if (!session.isAuthenticated) getUniRuntime().navigateTo({ url: '/pages/login/login' }) })
</script>

<template>
  <view class="yx-page" :class="themeClass"><text class="yx-eyebrow">B10 · LEARNING LOOP</text><text class="yx-title">练习中心</text><text class="yx-description">从目标进入练习，再回到反馈、复习和报告。</text><B10ThemeBar /><view class="b10-entry-grid"><view v-for="entry in entries" :key="entry.path" class="yx-card b10-entry"><text class="b10-entry__title">{{ entry.title }}</text><text class="b10-entry__description">{{ entry.description }}</text><button class="yx-button" type="button" @click="open(entry.path)">进入</button></view></view><text class="b10-footnote">{{ b10T('practice.description') }}</text></view>
</template>

<style scoped lang="scss">
.b10-entry-grid{display:grid;gap:16rpx}.b10-entry{display:grid;gap:10rpx}.b10-entry__title{font-size:30rpx;font-weight:750}.b10-entry__description,.b10-footnote{color:var(--yx-text-secondary);font-size:23rpx;line-height:1.6}.b10-footnote{display:block;margin-top:18rpx}
</style>
