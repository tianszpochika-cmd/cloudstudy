<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, onUnmounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { createAdaptivePerformanceEngine, type PerformanceLevel } from '@englishflow/performance'
import B10StatusPanel from '../../components/b10/B10StatusPanel.vue'
import { b10ThemeMode, b10T } from '../../platform/b10-foundation'
import { b10LearningApi } from '../../api/b10'
import { useB10LearningStore } from '../../stores/b10-learning'
import { openUniPage, getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'
import { PROJECTION_VERSION, ZERO_ONLY_COPY, closureLabel, emptyBook } from '../../domain/mistake-book'

const session = useSessionStore()
const store = useB10LearningStore()
const engine = createAdaptivePerformanceEngine()
const performanceLevel = ref<PerformanceLevel>(engine.level)
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const reportPeriod = ref<'daily' | 'weekly'>('daily')
const status = computed(() => store.reportStatus !== 'idle' && store.reportStatus !== 'ready' ? store.reportStatus : store.status)
function setPerformance(level: PerformanceLevel): void { engine.setLevel(level, 'manual'); performanceLevel.value = level }
function load(): void { void Promise.all([store.loadMistakes(), store.loadReport(reportPeriod.value)]) }
function selectReportPeriod(period: 'daily' | 'weekly'): void { reportPeriod.value = period; load() }
function retry(mistakeId: number): void { void store.startMistakeRetry(mistakeId) }
const shareRef = ref('')
const shareNote = ref('')
function issueShare(): void {
  shareNote.value = ''
  void b10LearningApi.issueReportShare(reportPeriod.value).then((share) => {
    shareRef.value = share.ref
    shareNote.value = '只读链接不含登录信息，7 天后失效。'
  }).catch((error: unknown) => { shareNote.value = error instanceof Error ? error.message : '分享链接没有生成。' })
}
function revokeShare(): void {
  if (!shareRef.value) return
  void b10LearningApi.revokeReportShare(shareRef.value).then(() => { shareRef.value = ''; shareNote.value = '这份分享已经撤销。' })
}
const emptyLabel = computed(() => {
  if (store.status === 'error' || store.status === 'offline') return emptyBook(0, 0, true).copy
  return store.emptyCopy || emptyBook(store.attemptCount, store.mistakes.length).copy
})
function open(path: string): void { openUniPage(path) }
onShow(async () => { await session.restore(); if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return } load() })
onUnmounted(() => engine.dispose())
</script>

<template>
  <view class="yx-page" :class="themeClass" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="b10-report" />

    <view class="v2-report-body">
      <view class="b10-report-period v2-report-filter" role="tablist" aria-label="报告周期"><button tabindex="0" class="b10-period-button v2-report-opt v2-report-tab" :class="{ active: reportPeriod === 'daily' }" type="button" role="tab" :aria-selected="reportPeriod === 'daily'" @click="selectReportPeriod('daily')">日报</button><button tabindex="0" class="b10-period-button v2-report-opt v2-report-tab" :class="{ active: reportPeriod === 'weekly' }" type="button" role="tab" :aria-selected="reportPeriod === 'weekly'" @click="selectReportPeriod('weekly')">周报</button></view>

      <B10StatusPanel class="v2-report-progress" :status="status" :message="store.message" :performance-level="performanceLevel" @retry="load" @performance="setPerformance" />
      <text data-zero-only class="meta v2-report-meta">{{ ZERO_ONLY_COPY }}</text>
      <text data-projection-version class="meta v2-report-meta">{{ store.projectionVersion || PROJECTION_VERSION }}</text>
      <text v-if="store.status === 'empty' || store.status === 'error' || store.status === 'offline'" data-empty-book class="meta v2-report-meta">{{ emptyLabel }}</text>
      <text v-if="store.remediationId" data-remediation class="meta v2-report-meta">{{ store.remediationId }}</text>
      <view v-if="store.mistakes.length" class="yx-card card b10-mistakes v2-report-card v2-report-mistakes"><text class="b10-section-title v2-report-title">{{ b10T('report.mistakes') }}</text><view class="v2-report-list"><view v-for="mistake in store.mistakes" :key="mistake.mistakeId" class="b10-mistake v2-report-item"><view class="b10-mistake__copy v2-report-copy"><text class="b10-mistake__title v2-report-stem">{{ mistake.errorCategory }}</text><text class="v2-report-desc">{{ mistake.prompt ?? `题目 ${mistake.itemId}` }}</text><text class="b10-mistake__meta fb v2-report-fb" data-closure>{{ closureLabel(mistake.mistakeStatus, mistake.closureCopy) }}</text><text v-if="mistake.masteryStatus" class="b10-mistake__meta fb v2-report-fb">{{ mistake.masteryStatus }}</text><text v-for="reason in mistake.reasonTrace" :key="reason.code" class="b10-mistake__reason fb v2-report-fb">{{ reason.label }}<template v-if="reason.evidence"> · {{ reason.evidence }}</template></text></view><button tabindex="0" role="button" class="b10-mini opt v2-report-opt v2-report-submit v2-report-retry" type="button" :disabled="mistake.mistakeStatus === 'MASTERED'" @click="retry(mistake.mistakeId)">{{ b10T('report.retry') }}</button></view></view></view>
      <view v-else-if="store.status !== 'loading'" class="yx-card card b10-empty v2-report-card v2-report-empty"><text class="v2-report-desc">{{ b10T('report.noMistakes') }}</text></view>
      <view v-if="store.report?.period" class="yx-card card b10-report v2-report-card v2-report-weekly" :data-period-availability="store.report.period.availability"><text data-period-copy class="v2-report-title">{{ store.report.period.copy }}</text><text class="v2-report-desc">统计范围 {{ store.report.period.periodStart }} 至 {{ store.report.period.periodEndExclusive }}（{{ store.report.period.learningDayZone }}）</text><text class="meta v2-report-meta">更新时间 {{ store.report.period.updatedAt }} · 版本 {{ store.report.period.reportVersion ?? '—' }}</text><text class="v2-report-stat">新学 {{ store.report.period.newItems ?? '—' }} · 复习 {{ store.report.period.reviewItems ?? '—' }}</text><text class="v2-report-desc">{{ store.report.period.durationCopy }}</text><text data-suggestion class="fb v2-report-fb v2-report-suggest">建议：{{ store.report.period.suggestion }}</text><text class="fb v2-report-fb">依据 {{ store.report.period.suggestionBasis }}。这是规则建议，不是已开放的 AI 功能。</text><view class="v2-report-actions"><button type="button" class="opt v2-report-opt v2-report-submit" data-share-issue @click="issueShare">生成只读链接</button><button v-if="shareRef" type="button" class="opt v2-report-opt" data-share-revoke @click="revokeShare">撤销分享</button></view><text v-if="shareRef" class="fb v2-report-fb">/pages/report-share/report-share?ref={{ shareRef }}</text><text v-if="shareNote" class="fb v2-report-fb">{{ shareNote }}</text></view>
      <view v-if="store.report" class="yx-card card b10-report v2-report-card v2-report-summary"><view class="b10-report__header v2-report-header"><text class="b10-section-title v2-report-title">{{ b10T('report.report') }}</text><text class="b10-report__status v2-report-status meta v2-report-meta">{{ store.report.status }}</text></view><view class="b10-report__score v2-report-score"><text v-if="store.report.score !== null" class="v2-report-score-num">{{ store.report.score }}<text v-if="store.report.reportedMaxScore !== null" class="v2-report-score-max"> / {{ store.report.reportedMaxScore }}</text></text><text v-else class="v2-report-score-num">{{ store.report.status === 'PARTIAL' ? b10T('report.partial') : b10T('report.noReport') }}</text></view><view v-if="store.report.metrics.length" class="b10-metrics v2-report-stats v2-report-list"><view v-for="metric in store.report.metrics" :key="metric.code" class="b10-metric v2-report-item v2-report-stat"><text class="v2-report-desc">{{ metric.label }}</text><text class="v2-report-value">{{ metric.value }}<template v-if="metric.max !== undefined"> / {{ metric.max }}</template></text></view></view><view v-if="store.report.evidence.length" class="b10-evidence v2-report-evidence v2-report-list"><text class="b10-section-title v2-report-title">{{ b10T('report.reason') }}</text><view v-for="item in store.report.evidence" :key="`${item.label}-${item.detail}`" class="v2-report-item"><text class="v2-report-desc">{{ item.label }}</text><text class="fb v2-report-fb">{{ item.detail }}</text></view></view></view>
      <view v-else-if="store.reportStatus === 'loading'" class="yx-card card b10-empty v2-report-card v2-report-empty"><text class="v2-report-desc">{{ b10T('status.loading') }}</text></view>
      <view class="b10-links v2-report-links v2-report-actions"><button tabindex="0" role="button" class="yx-button yx-button--secondary opt v2-report-opt v2-report-next" type="button" @click="open('/pages/b2-vocabulary/b2-vocabulary')">词汇复习</button><button tabindex="0" role="button" class="yx-button yx-button--secondary opt v2-report-opt v2-report-next" type="button" @click="open('/pages/b2-practice/b2-practice')">继续练习</button></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.b10-report-period{display:flex;gap:8rpx;padding:6rpx;border:1rpx solid var(--yx-border);border-radius:14rpx;background:var(--yx-surface-card)}.b10-period-button{min-height:64rpx;padding:0 22rpx;border:0;border-radius:10rpx;color:var(--yx-text-secondary);background:transparent;font-size:23rpx}.b10-period-button.active{color:var(--yx-brand);background:var(--yx-brand-soft)}.b10-section-title{color:var(--yx-text-primary);font-size:29rpx;font-weight:750}.b10-mistakes,.b10-report{display:grid;gap:16rpx}.b10-mistake{display:flex;align-items:flex-start;justify-content:space-between;gap:14rpx;padding:16rpx 0;border-top:1rpx solid var(--yx-border);color:var(--yx-text-secondary);font-size:23rpx;line-height:1.5}.b10-mistake__copy{display:grid;gap:5rpx;flex:1}.b10-mistake__title{color:var(--yx-text-primary);font-size:27rpx;font-weight:700}.b10-mistake__meta{color:var(--yx-text-tertiary);font-size:21rpx}.b10-mistake__reason{color:var(--yx-warning-strong);font-size:21rpx}.b10-mini{min-width:120rpx;min-height:62rpx;border:1rpx solid var(--yx-border);border-radius:10rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx}.b10-report__header{display:flex;justify-content:space-between;gap:12rpx}.b10-report__status{color:var(--yx-success-strong);font-size:22rpx}.b10-report__score{padding:18rpx 0;color:var(--yx-brand);font-size:52rpx;font-weight:800}.b10-metrics,.b10-evidence{display:grid;gap:10rpx}.b10-metric{display:flex;justify-content:space-between;padding:14rpx;border-radius:10rpx;background:var(--yx-surface-soft);color:var(--yx-text-secondary);font-size:23rpx}.b10-evidence{padding-top:16rpx;border-top:1rpx solid var(--yx-border);color:var(--yx-text-secondary);font-size:22rpx;line-height:1.5}.b10-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12rpx}.yx-button--secondary{color:var(--yx-brand);background:var(--yx-surface-card)}.b10-empty{padding:24rpx;color:var(--yx-text-secondary);font-size:24rpx}
</style>
