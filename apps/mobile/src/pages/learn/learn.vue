<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import B10ThemeBar from '../../components/b10/B10ThemeBar.vue'
import { b10ThemeMode } from '../../platform/b10-foundation'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
function open(path: string): void { getUniRuntime().navigateTo({ url: path }) }
onShow(() => { session.restore(); if (!session.isAuthenticated) getUniRuntime().navigateTo({ url: '/pages/login/login' }) })
</script>

<template>
  <view class="yx-page" :class="themeClass"><text class="yx-eyebrow">B10 / B11 · CONTINUE LEARNING</text><text class="yx-title">学习流</text><text class="yx-description">内容版本、学习进度、作答事实和 SRS 复习各由对应服务负责；移动端只编排交互。</text><B10ThemeBar /><view class="yx-card b10-flow"><text class="b10-flow__title">继续今天的闭环</text><text class="b10-flow__copy">目标 → 练习 → 反馈 → 复习 → 报告</text><button class="yx-button" type="button" @click="open('/pages/b2-practice/b2-practice')">开始基础练习</button><button class="yx-button yx-button--secondary" type="button" @click="open('/pages/b11-listening/b11-listening')">进入 B11 听力精练</button><button class="yx-button yx-button--secondary" type="button" @click="open('/pages/b11-reading/b11-reading')">进入 B11 分级阅读</button><button class="yx-button yx-button--secondary" type="button" @click="open('/pages/b11-speaking/b11-speaking')">进入 B11 音标与跟读</button><button class="yx-button yx-button--secondary" type="button" @click="open('/pages/b3-grammar/b3-grammar')">修复语法弱点</button></view></view>
</template>

<style scoped lang="scss">
.b10-flow{display:grid;gap:14rpx}.b10-flow__title{font-size:32rpx;font-weight:750}.b10-flow__copy{color:var(--yx-text-secondary);font-size:24rpx}.yx-button--secondary{color:var(--yx-brand);background:var(--yx-surface-card)}
</style>
