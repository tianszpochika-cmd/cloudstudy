<script setup lang="ts">
import { onShow, onUnload } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { createAdaptivePerformanceEngine, type PerformanceLevel } from '@englishflow/performance'
import { getMobileB6AccessibilityChecklist, getMobileB6PerformanceBudget, getMobileB6ReleaseMatrix } from '../../api/b6'
import { toAccessibility, toBudget, toMatrix, type B6Accessibility, type B6Budget, type B6Matrix } from '../../domain/b6'

const loading = ref(true)
const errorMessage = ref('')
const matrix = ref<B6Matrix>(toMatrix({}))
const budget = ref<B6Budget>(toBudget({}))
const accessibility = ref<B6Accessibility>(toAccessibility({}))
const engine = createAdaptivePerformanceEngine()
const performanceLevel = ref<PerformanceLevel>(engine.level)
const unsubscribe = engine.subscribe((state) => { performanceLevel.value = state.level })

async function load(): Promise<void> { loading.value = true; errorMessage.value = ''; try { const [matrixResponse, budgetResponse, accessibilityResponse] = await Promise.all([getMobileB6ReleaseMatrix(), getMobileB6PerformanceBudget(), getMobileB6AccessibilityChecklist()]); matrix.value = toMatrix(matrixResponse); budget.value = toBudget(budgetResponse); accessibility.value = toAccessibility(accessibilityResponse) } catch (error) { errorMessage.value = error instanceof Error ? error.message : '网络不可用，当前使用本地性能设置。' } finally { loading.value = false } }
function chooseLevel(level: PerformanceLevel): void { engine.setLevel(level, 'manual') }
onShow(() => { engine.restore(); void load() })
onUnload(() => { unsubscribe(); engine.dispose() })
</script>

<template>
  <view class="yx-page b6-mobile-page">
    <text class="yx-eyebrow">B6 · PLATFORM & RELEASE</text>
    <view class="b6-mobile-heading"><view><text class="yx-title">跨端体验准备</text><text class="yx-description">移动 H5、App、iPad 与小程序共用学习业务代码；真机验收在测试阶段执行。</text></view><button class="yx-button yx-button--secondary b6-refresh" :loading="loading" @tap="load">刷新</button></view>
    <view v-if="errorMessage" class="b6-mobile-alert"><text>{{ errorMessage }}</text></view>
    <view class="yx-card"><view class="b6-mobile-card-heading"><view><text class="b6-mobile-card-title">目标端矩阵</text><text class="b6-mobile-muted">{{ matrix.matrixVersion }} · {{ matrix.codeLayerStatus }}</text></view><text class="b6-mobile-status">{{ matrix.realDeviceEvidenceStatus }}</text></view><view class="b6-mobile-target" v-for="target in matrix.targets" :key="target.platformCode"><view><text class="b6-mobile-target-code">{{ target.platformCode }}</text><text class="b6-mobile-muted">{{ target.priority }}</text></view><text class="b6-mobile-muted">{{ target.implementation }}</text><text class="b6-mobile-status">{{ target.buildStatus }}</text></view></view>
    <view class="yx-card"><view class="b6-mobile-card-heading"><view><text class="b6-mobile-card-title">画质与降级</text><text class="b6-mobile-muted">低帧率、内存压力或离线时自动降级</text></view><text class="b6-mobile-status">{{ performanceLevel }}</text></view><view class="b6-mobile-levels"><button v-for="level in ['Ultra', 'High', 'Medium', 'Performance'] as PerformanceLevel[]" :key="level" :class="['b6-level-button', { active: performanceLevel === level }]" :aria-pressed="performanceLevel === level" @tap="chooseLevel(level)">{{ level }}</button></view><view class="b6-budget-row" v-for="profile in budget.levels" :key="profile.level"><text>{{ profile.level }}</text><text class="b6-mobile-muted">{{ profile.textureBudgetMb }}MB · 粒子 {{ profile.particleBudget }} · {{ profile.enableThreeD ? '3D' : 'SVG/静态' }}</text></view></view>
    <view class="yx-card"><view class="b6-mobile-card-heading"><view><text class="b6-mobile-card-title">无障碍替代路径</text><text class="b6-mobile-muted">{{ accessibility.releaseBlocking ? '上线阻断检查' : '建议检查' }}</text></view><text class="b6-mobile-status">{{ accessibility.checks.length }} 项</text></view><view class="b6-a11y-row" v-for="check in accessibility.checks" :key="check.checkCode"><text class="b6-check" aria-hidden="true">✓</text><view><text>{{ check.title }}</text><text class="b6-mobile-muted">{{ check.fallbackRule }}</text></view></view></view>
  </view>
</template>

<style scoped>
.b6-mobile-page{padding-bottom:80rpx}.b6-mobile-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20rpx}.b6-mobile-heading .yx-title{display:block;margin-bottom:14rpx}.b6-refresh{width:160rpx;flex:none;margin-top:0}.b6-mobile-alert{margin-top:24rpx;padding:20rpx;border:1rpx solid #f3c5cc;border-radius:16rpx;color:#a93448;background:#fff1f3;font-size:24rpx;line-height:1.6}.b6-mobile-card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16rpx;margin-bottom:20rpx}.b6-mobile-card-title{display:block;margin-bottom:6rpx;font-size:34rpx;font-weight:700}.b6-mobile-muted{display:block;color:$yx-color-text-secondary;font-size:24rpx;line-height:1.6}.b6-mobile-status{display:block;color:$yx-color-brand-primary;font-size:22rpx;font-weight:700}.b6-mobile-target{display:grid;grid-template-columns:1fr auto;gap:8rpx;padding:20rpx 0;border-bottom:1rpx solid $yx-color-border}.b6-mobile-target:last-child,.b6-budget-row:last-child{border-bottom:0}.b6-mobile-target-code{display:block;margin-bottom:4rpx;font-size:30rpx;font-weight:700}.b6-mobile-levels{display:grid;grid-template-columns:repeat(2,1fr);gap:14rpx}.b6-level-button{height:78rpx;margin:0;border:1rpx solid $yx-color-border;border-radius:14rpx;color:$yx-color-text-secondary;background:$yx-color-surface-card;font-size:26rpx}.b6-level-button.active{border-color:$yx-color-brand-primary;color:$yx-color-brand-primary;background:$yx-color-brand-primary-soft;font-weight:700}.b6-budget-row{display:flex;justify-content:space-between;gap:16rpx;padding:18rpx 0;border-bottom:1rpx solid $yx-color-border;font-size:25rpx}.b6-a11y-row{display:flex;gap:14rpx;padding:16rpx 0;border-bottom:1rpx solid $yx-color-border}.b6-a11y-row:last-child{border-bottom:0}.b6-a11y-row>view{display:grid;gap:4rpx}.b6-check{display:flex;width:40rpx;height:40rpx;flex:none;align-items:center;justify-content:center;border-radius:50%;color:#fff;background:$yx-color-success;font-size:24rpx}
@media (max-width:420px){.b6-mobile-heading{display:grid}.b6-refresh{width:100%}.b6-budget-row{display:grid;gap:6rpx}}
</style>
