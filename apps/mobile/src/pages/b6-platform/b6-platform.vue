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
const QUALITY_LEVEL_LABELS: Record<string, string> = { Ultra: '极致', High: '高清', Medium: '标准', Performance: '省电' }
function qualityLevelLabel(level: unknown): string { return typeof level === 'string' ? (QUALITY_LEVEL_LABELS[level] ?? level) : '' }
const STATUS_LABELS: Record<string, string> = { READY_FOR_TEST_STAGE: '待测试阶段验证', PENDING_TEST_STAGE: '等待测试阶段', TEST_STAGE_REQUIRED: '需测试阶段验证', CODE_READY: '代码已就绪', READY: '已就绪', PASSED: '已通过', FAILED: '未通过', BUILT: '已构建' }
function statusLabel(value: unknown): string { return typeof value === 'string' ? (STATUS_LABELS[value] ?? value) : '待确认' }

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
            <text class="b6-mobile-muted d v2-platform-d">{{ matrix.matrixVersion }} · {{ statusLabel(matrix.codeLayerStatus) }}</text>
          </view>
          <text class="b6-mobile-status v2-platform-state v2-platform-tag">{{ statusLabel(matrix.realDeviceEvidenceStatus) }}</text>
        </view>
        <view class="v2-platform-list">
          <view class="b6-mobile-target list-row row card v2-platform-row v2-platform-card" v-for="target in matrix.targets" :key="target.platformCode">
            <view class="v2-platform-copy"><text class="b6-mobile-target-code h2 v2-platform-name v2-platform-h2">{{ target.platformCode }}</text><text class="b6-mobile-muted d v2-platform-d">{{ target.priority }}</text></view>
            <text class="b6-mobile-muted d v2-platform-d">{{ target.implementation }}</text>
            <text class="b6-mobile-status v2-platform-state v2-platform-tag">{{ statusLabel(target.buildStatus) }}</text>
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
          <text class="b6-mobile-status v2-platform-state v2-platform-tag">{{ qualityLevelLabel(performanceLevel) }}</text>
        </view>
        <view class="b6-mobile-levels v2-platform-levels"><button tabindex="0" role="button" v-for="level in ['Ultra', 'High', 'Medium', 'Performance'] as PerformanceLevel[]" :key="level" class="btn opt v2-platform-btn v2-platform-opt" :class="['b6-level-button', { active: performanceLevel === level }]" :aria-pressed="performanceLevel === level" @tap="chooseLevel(level)">{{ qualityLevelLabel(level) }}</button></view>
        <view class="v2-platform-list">
          <view class="b6-budget-row list-row row v2-platform-row" v-for="profile in budget.levels" :key="profile.level"><text class="d v2-platform-d">{{ qualityLevelLabel(profile.level) }}</text><text class="b6-mobile-muted d v2-platform-d">{{ profile.textureBudgetMb }}MB · 粒子 {{ profile.particleBudget }} · {{ profile.enableThreeD ? '3D' : 'SVG/静态' }}</text></view>
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
/* v2 平台页换皮：对齐 practice.vue v2-practice-* 与 today.vue v2-today-* 卡片/eyebrow/标题/列表行/按钮同样数值，对齐 webDemo/mobile/styles.css、refine.css，仅用 var(--v2-*)。 */
.v2-platform-page{box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-platform-body{display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-platform-body>*{min-width:0;max-width:100%}
.v2-platform-card{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font)}
.v2-platform-card:hover{border-color:var(--v2-brand)}
.v2-platform-head{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-platform-head>*{min-width:0;max-width:100%}
.v2-platform-titles{display:grid;gap:var(--v2-space-1);box-sizing:border-box;max-width:100%;min-width:0;flex:1 1 auto;font-family:var(--v2-font)}
.v2-platform-eyebrow{display:flex;align-items:center;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase;overflow-wrap:anywhere}
.v2-platform-title{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin:var(--v2-space-1) 0 0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-platform-name{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-platform-h2{box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-platform-d{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-platform-list{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-platform-list>*{min-width:0;max-width:100%}
.v2-platform-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);font-family:var(--v2-font)}
.v2-platform-row:hover{border-color:var(--v2-brand)}
.v2-platform-row>*{min-width:0;max-width:100%}
.v2-platform-copy{display:grid;gap:var(--v2-space-1);box-sizing:border-box;max-width:100%;min-width:0;flex:1 1 auto;font-family:var(--v2-font)}
.v2-platform-levels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-platform-levels>*{min-width:0;max-width:100%}
.v2-platform-check{display:flex;flex:none;align-items:center;justify-content:center;box-sizing:border-box;width:var(--v2-space-5);height:var(--v2-space-5);border-radius:var(--v2-radius-pill);background:var(--v2-ok);color:var(--v2-inverse);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;line-height:1}
.v2-platform-tag{display:inline-flex;align-items:center;justify-self:start;box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-1) var(--v2-space-2);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;line-height:1.5;overflow-wrap:anywhere}
.v2-platform-state{display:inline-flex;align-items:center;box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-1) var(--v2-space-2);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;line-height:1.5;overflow-wrap:anywhere}
.v2-platform-btn{box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:var(--v2-space-2);width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-platform-opt{box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:var(--v2-space-2);width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-platform-btn>*,.v2-platform-opt>*{min-width:0;max-width:100%}
.v2-platform-btn:hover,.v2-platform-opt:hover{border-color:var(--v2-brand)}
.v2-platform-btn.active,.v2-platform-opt.active,.v2-platform-btn.sel,.v2-platform-opt.sel{border-color:var(--v2-brand);background:var(--v2-soft);color:var(--v2-brand)}
.v2-platform-btn:active,.v2-platform-opt:active{transform:scale(.97)}
.v2-platform-btn:focus-visible,.v2-platform-opt:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-platform-btn:disabled,.v2-platform-opt:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-platform-fb{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin-top:var(--v2-space-4);padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
</style>
