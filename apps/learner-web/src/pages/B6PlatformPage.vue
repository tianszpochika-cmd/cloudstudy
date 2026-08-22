<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { createAdaptivePerformanceEngine, type PerformanceLevel } from '@englishflow/performance'
import { getB6AccessibilityChecklist, getB6ObservabilityDashboard, getB6PerformanceBudget, getB6ReleaseMatrix, getB6ResponsiveChecklist } from '../api/b6'
import { toAccessibility, toBudget, toMatrix, toResponsive, type B6AccessibilityChecklist, type B6PerformanceBudget, type B6ReleaseMatrix, type B6ResponsiveChecklist } from '../domain/b6'

const loading = ref(true)
const errorMessage = ref('')
const matrix = ref<B6ReleaseMatrix>(toMatrix({}))
const budget = ref<B6PerformanceBudget>(toBudget({}))
const accessibility = ref<B6AccessibilityChecklist>(toAccessibility({}))
const responsive = ref<B6ResponsiveChecklist>(toResponsive({}))
const observability = ref<Record<string, unknown>>({})
const engine = createAdaptivePerformanceEngine()
const performanceLevel = ref<PerformanceLevel>(engine.level)
const unsubscribe = engine.subscribe((state) => { performanceLevel.value = state.level })

function chooseLevel(level: PerformanceLevel): void { engine.setLevel(level, 'manual') }
async function load(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    const [matrixResponse, budgetResponse, accessibilityResponse, responsiveResponse, observabilityResponse] = await Promise.all([getB6ReleaseMatrix(), getB6PerformanceBudget(), getB6AccessibilityChecklist(), getB6ResponsiveChecklist(), getB6ObservabilityDashboard()])
    matrix.value = toMatrix(matrixResponse)
    budget.value = toBudget(budgetResponse)
    accessibility.value = toAccessibility(accessibilityResponse)
    responsive.value = toResponsive(responsiveResponse)
    observability.value = typeof observabilityResponse === 'object' && observabilityResponse !== null ? observabilityResponse as Record<string, unknown> : {}
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'B6 运行状态暂时无法读取，当前保留本地性能设置。'
  } finally { loading.value = false }
}

onMounted(() => { engine.restore(); void load() })
onUnmounted(() => { unsubscribe(); engine.dispose() })
</script>

<template>
  <section class="b6-page" aria-labelledby="b6-platform-title">
    <div class="b6-hero">
      <div><p class="eyebrow">B6 · PLATFORM & RELEASE</p><h2 id="b6-platform-title">跨端体验与发布准备</h2><p class="muted">一套学习业务代码覆盖 Web、H5、App、iPad、小程序和 PWA；真实设备验收留在测试阶段。</p></div>
      <button class="button button--secondary" type="button" :disabled="loading" @click="load">{{ loading ? '读取中…' : '刷新证据' }}</button>
    </div>
    <p v-if="errorMessage" class="b6-alert" role="alert">{{ errorMessage }}</p>

    <article class="b6-card"><div class="b6-card__heading"><div><h3>目标端矩阵</h3><p class="muted">{{ matrix.matrixVersion }} · {{ matrix.codeLayerStatus }}</p></div><span class="b6-status">{{ matrix.realDeviceEvidenceStatus }}</span></div><div class="b6-target-grid"><div v-for="target in matrix.targets" :key="target.platformCode" class="b6-target"><div class="b6-target__top"><strong>{{ target.platformCode }}</strong><span>{{ target.priority }}</span></div><p>{{ target.implementation }}</p><small>{{ target.buildStatus }} · {{ target.installability }}</small></div></div></article>

    <div class="b6-grid">
      <article class="b6-card"><div class="b6-card__heading"><div><h3>画质与降级</h3><p class="muted">{{ budget.autoDegrade ? '低帧率/内存压力自动降级' : '手动控制' }} · 不自动升档</p></div><span class="b6-level">{{ performanceLevel }}</span></div><div class="b6-levels"><button v-for="level in ['Ultra', 'High', 'Medium', 'Performance'] as PerformanceLevel[]" :key="level" type="button" :class="['level-button', { 'level-button--active': performanceLevel === level }]" :aria-pressed="performanceLevel === level" @click="chooseLevel(level)">{{ level }}</button></div><div class="b6-budget-list"><div v-for="profile in budget.levels" :key="profile.level"><span>{{ profile.level }}</span><span>{{ profile.textureBudgetMb }}MB · 粒子 {{ profile.particleBudget }} · {{ profile.enableThreeD ? '3D' : '静态/SVG' }}</span></div></div></article>
      <article class="b6-card"><div class="b6-card__heading"><div><h3>响应式基线</h3><p class="muted">视口、方向和单滚动容器规范</p></div><span class="b6-status">{{ responsive.evidenceStatus }}</span></div><div class="b6-breakpoints"><div v-for="point in responsive.breakpoints" :key="point.code"><strong>{{ point.code }}</strong><span>{{ point.minWidth }}–{{ point.maxWidth }}px · {{ point.orientation }}</span></div></div><div class="b6-chip-list"><span v-for="check in responsive.checks" :key="check" class="b6-chip">{{ check }}</span></div></article>
    </div>

    <div class="b6-grid">
      <article class="b6-card"><div class="b6-card__heading"><div><h3>无障碍与替代路径</h3><p class="muted">关键流程全部纳入上线阻断检查</p></div><span class="b6-status">{{ accessibility.releaseBlocking ? 'RELEASE BLOCKING' : 'ADVISORY' }}</span></div><div class="b6-a11y-list"><div v-for="check in accessibility.checks" :key="check.checkCode"><span class="b6-check" aria-hidden="true">✓</span><div><strong>{{ check.title }}</strong><p>{{ check.fallbackRule }}</p></div></div></div></article>
      <article class="b6-card"><div class="b6-card__heading"><div><h3>观测关联</h3><p class="muted">故障定位字段已冻结</p></div><span class="b6-status">B6 CODE READY</span></div><div class="b6-observe"><p><strong>requestId → traceId → eventName</strong></p><p>质量运行、告警和发布 Gate 均保留证据引用；真实压测、备份恢复和平台审核在测试阶段执行。</p><p v-if="Object.keys(observability).length === 0" class="muted">尚未加载运行看板</p><p v-else class="muted">运行看板已返回结构化数据</p></div></article>
    </div>
  </section>
</template>

<style scoped>
.b6-page{display:grid;gap:20px}.b6-hero,.b6-card__heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.b6-hero h2{margin:6px 0 8px;font-size:32px}.muted{margin:0;color:var(--yx-color-text-secondary);line-height:1.65}.b6-alert{margin:0;padding:12px 16px;border:1px solid #f3c5cc;border-radius:12px;color:#a93448;background:#fff1f3}.b6-card{display:grid;gap:18px;padding:24px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.b6-card h3{margin:0 0 5px;font-size:20px}.b6-status,.b6-level{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft);font-size:11px;font-weight:700;letter-spacing:.04em}.b6-target-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.b6-target{padding:16px;border:1px solid var(--yx-color-border);border-radius:12px;background:#fbfcff}.b6-target__top{display:flex;justify-content:space-between;gap:8px}.b6-target__top span,.b6-target small{color:var(--yx-color-text-tertiary);font-size:11px}.b6-target p{margin:10px 0 8px;color:var(--yx-color-text-secondary);font-size:13px;line-height:1.5}.b6-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.b6-levels{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.level-button{min-height:42px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-text-secondary);background:#fff}.level-button--active{border-color:var(--yx-color-brand-primary);color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft);font-weight:700}.b6-budget-list,.b6-breakpoints{display:grid;gap:8px}.b6-budget-list>div,.b6-breakpoints>div{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--yx-color-border);font-size:13px}.b6-budget-list span:last-child,.b6-breakpoints span{color:var(--yx-color-text-secondary)}.b6-chip-list{display:flex;flex-wrap:wrap;gap:8px}.b6-chip{padding:7px 10px;border-radius:999px;color:var(--yx-color-text-secondary);background:#f1f3fa;font-size:11px}.b6-a11y-list{display:grid;gap:14px}.b6-a11y-list>div{display:flex;gap:10px}.b6-check{display:grid;flex:0 0 22px;width:22px;height:22px;place-items:center;border-radius:50%;color:#fff;background:var(--yx-color-success);font-size:12px}.b6-a11y-list strong{font-size:14px}.b6-a11y-list p{margin:4px 0 0;color:var(--yx-color-text-secondary);font-size:13px;line-height:1.55}.b6-observe{padding:16px;border-radius:12px;background:#f7f8fc}.b6-observe p{margin:0 0 10px;color:var(--yx-color-text-secondary);line-height:1.65}.b6-observe p:first-child{color:var(--yx-color-text-primary)}
@media (max-width:1100px){.b6-target-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:760px){.b6-hero,.b6-card__heading{display:grid}.b6-hero h2{font-size:27px}.b6-grid{grid-template-columns:1fr}.b6-target-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.b6-levels{grid-template-columns:repeat(2,1fr)}}
@media (max-width:460px){.b6-target-grid{grid-template-columns:1fr}.b6-card{padding:18px}.b6-budget-list>div,.b6-breakpoints>div{display:grid;gap:4px}}
@media (prefers-reduced-motion:reduce){.b6-page *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
</style>
