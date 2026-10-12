<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import AppIcon from '../../components/AppIcon.vue'
import { setMobileQuality, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onShow, onUnload } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { createAdaptivePerformanceEngine, type PerformanceLevel } from '@englishflow/performance'
import { getMobileB6AccessibilityChecklist, getMobileB6PerformanceBudget, getMobileB6ReleaseMatrix } from '../../api/b6'
import { toAccessibility, toBudget, toMatrix, type B6Accessibility, type B6Budget, type B6Matrix } from '../../domain/b6'
import { ensureMobilePageAccess } from '../../auth/navigation'

const loading = ref(true)
const errorMessage = ref('')
const matrix = ref<B6Matrix>(toMatrix({}))
const budget = ref<B6Budget>(toBudget({}))
const accessibility = ref<B6Accessibility>(toAccessibility({}))
const engine = createAdaptivePerformanceEngine()
const performanceLevel = ref<PerformanceLevel>(engine.level)
const unsubscribe = engine.subscribe((state) => { performanceLevel.value = state.level })

async function load(): Promise<void> { loading.value = true; errorMessage.value = ''; try { const [matrixResponse, budgetResponse, accessibilityResponse] = await Promise.all([getMobileB6ReleaseMatrix(), getMobileB6PerformanceBudget(), getMobileB6AccessibilityChecklist()]); matrix.value = toMatrix(matrixResponse); budget.value = toBudget(budgetResponse); accessibility.value = toAccessibility(accessibilityResponse) } catch (error) { errorMessage.value = error instanceof Error ? error.message : '网络不可用，当前使用本地性能设置。' } finally { loading.value = false } }
function chooseLevel(level: PerformanceLevel): void { engine.setLevel(level, 'manual'); setMobileQuality(level) }
onShow(async () => { if (await ensureMobilePageAccess('/pages/b6-platform/b6-platform')) { engine.restore(); void load() } })
onUnload(() => { unsubscribe(); engine.dispose() })
</script>

<template>
  <view class="yx-page b6-mobile-page v2-platform-page" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="b6-platform" />
    <view class="v2-platform-body">
      <view class="b6-mobile-heading v2-platform-head">
        <view class="v2-platform-titles">
          <view class="eyebrow v2-platform-eyebrow"><AppIcon name="grid" :size="14" /><text>原生与多端</text></view>
          <view><text class="yx-description d v2-platform-d">设备支持情况与画质选项，可在这里查看。</text></view>
        </view>
        <button tabindex="0" role="button" class="yx-button yx-button--secondary b6-refresh btn opt v2-platform-btn v2-platform-opt" :loading="loading" @tap="load">刷新<AppIcon name="refresh" :size="14" /></button>
      </view>
      <view v-if="errorMessage" class="b6-mobile-alert fb v2-platform-fb v2-platform-d" role="alert"><AppIcon name="alert" :size="14" /><text class="d v2-platform-d">{{ errorMessage }}</text></view>
      <view class="yx-card card v2-platform-card">
        <view class="b6-mobile-card-heading v2-platform-head">
          <view class="v2-platform-titles">
            <view class="eyebrow v2-platform-eyebrow"><AppIcon name="grid" :size="14" /><text>壳矩阵</text></view>
            <text class="b6-mobile-card-title h2 v2-platform-title v2-platform-h2">目标端矩阵</text>
            <text class="b6-mobile-muted d v2-platform-d">{{ matrix.matrixVersion }} · {{ matrix.codeLayerStatus }}</text>
          </view>
          <text class="b6-mobile-status v2-platform-state v2-platform-tag">{{ matrix.realDeviceEvidenceStatus }}</text>
        </view>
        <view class="v2-platform-list">
          <view class="b6-mobile-target list-row row card v2-platform-row v2-platform-card" v-for="target in matrix.targets" :key="target.platformCode">
            <view class="v2-platform-copy"><text class="b6-mobile-target-code h2 v2-platform-name v2-platform-h2">{{ target.platformCode }}</text><text class="b6-mobile-muted d v2-platform-d">{{ target.priority }}</text></view>
            <text class="b6-mobile-muted d v2-platform-d">{{ target.implementation }}</text>
            <text class="b6-mobile-status v2-platform-state v2-platform-tag">{{ target.buildStatus }}</text>
          </view>
        </view>
      </view>
      <view class="yx-card card v2-platform-card">
        <view class="b6-mobile-card-heading v2-platform-head">
          <view class="v2-platform-titles">
            <view class="eyebrow v2-platform-eyebrow"><AppIcon name="gear" :size="14" /><text>画质</text></view>
            <text class="b6-mobile-card-title h2 v2-platform-title v2-platform-h2">画质与降级</text>
            <text class="b6-mobile-muted d v2-platform-d">低帧率、内存压力或离线时自动降级</text>
          </view>
          <text class="b6-mobile-status v2-platform-state v2-platform-tag">{{ performanceLevel }}</text>
        </view>
        <view class="b6-mobile-levels v2-platform-levels"><button tabindex="0" role="button" v-for="level in ['Ultra', 'High', 'Medium', 'Performance'] as PerformanceLevel[]" :key="level" class="btn opt v2-platform-btn v2-platform-opt" :class="['b6-level-button', { active: performanceLevel === level }]" :aria-pressed="performanceLevel === level" @tap="chooseLevel(level)">{{ level }}</button></view>
        <view class="v2-platform-list">
          <view class="b6-budget-row list-row row v2-platform-row" v-for="profile in budget.levels" :key="profile.level"><text class="d v2-platform-d">{{ profile.level }}</text><text class="b6-mobile-muted d v2-platform-d">{{ profile.textureBudgetMb }}MB · 粒子 {{ profile.particleBudget }} · {{ profile.enableThreeD ? '3D' : 'SVG/静态' }}</text></view>
        </view>
      </view>
      <view class="yx-card card v2-platform-card">
        <view class="b6-mobile-card-heading v2-platform-head">
          <view class="v2-platform-titles">
            <view class="eyebrow v2-platform-eyebrow"><AppIcon name="check" :size="14" /><text>无障碍</text></view>
            <text class="b6-mobile-card-title h2 v2-platform-title v2-platform-h2">无障碍替代路径</text>
            <text class="b6-mobile-muted d v2-platform-d">{{ accessibility.releaseBlocking ? '上线阻断检查' : '建议检查' }}</text>
          </view>
          <text class="b6-mobile-status v2-platform-state v2-platform-tag">{{ accessibility.checks.length }} 项</text>
        </view>
        <view class="v2-platform-list">
          <view class="b6-a11y-row list-row row v2-platform-row" v-for="check in accessibility.checks" :key="check.checkCode"><text class="b6-check v2-platform-check" aria-hidden="true">✓</text><view class="v2-platform-copy"><text class="d v2-platform-d">{{ check.title }}</text><text class="b6-mobile-muted d v2-platform-d">{{ check.fallbackRule }}</text></view></view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.b6-mobile-page{padding-bottom:80rpx}.b6-mobile-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20rpx}.b6-mobile-heading .yx-title{display:block;margin-bottom:14rpx}.b6-refresh{width:160rpx;flex:none;margin-top:0}.b6-mobile-alert{margin-top:24rpx;padding:20rpx;border:1rpx solid var(--yx-danger);border-radius:16rpx;color:var(--yx-danger);background:var(--yx-danger-soft);font-size:24rpx;line-height:1.6}.b6-mobile-card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16rpx;margin-bottom:20rpx}.b6-mobile-card-title{display:block;margin-bottom:6rpx;font-size:34rpx;font-weight:700}.b6-mobile-muted{display:block;color:var(--yx-text-secondary);font-size:24rpx;line-height:1.6}.b6-mobile-status{display:block;color:var(--yx-brand);font-size:22rpx;font-weight:700}.b6-mobile-target{display:grid;grid-template-columns:1fr auto;gap:8rpx;padding:20rpx 0;border-bottom:1rpx solid var(--yx-border)}.b6-mobile-target:last-child,.b6-budget-row:last-child{border-bottom:0}.b6-mobile-target-code{display:block;margin-bottom:4rpx;font-size:30rpx;font-weight:700}.b6-mobile-levels{display:grid;grid-template-columns:repeat(2,1fr);gap:14rpx}.b6-level-button{height:78rpx;margin:0;border:1rpx solid var(--yx-border);border-radius:14rpx;color:var(--yx-text-secondary);background:var(--yx-surface-card);font-size:26rpx}.b6-level-button.active{border-color:var(--yx-brand);color:var(--yx-brand);background:var(--yx-brand-soft);font-weight:700}.b6-budget-row{display:flex;justify-content:space-between;gap:16rpx;padding:18rpx 0;border-bottom:1rpx solid var(--yx-border);font-size:25rpx}.b6-a11y-row{display:flex;gap:14rpx;padding:16rpx 0;border-bottom:1rpx solid var(--yx-border)}.b6-a11y-row:last-child{border-bottom:0}.b6-a11y-row>view{display:grid;gap:4rpx}.b6-check{display:flex;width:40rpx;height:40rpx;flex:none;align-items:center;justify-content:center;border-radius:50%;color:var(--yx-on-brand);background:var(--yx-success);font-size:24rpx}
@media (max-width:420px){.b6-mobile-heading{display:grid}.b6-refresh{width:100%}.b6-budget-row{display:grid;gap:6rpx}}
</style>
