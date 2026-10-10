<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, onUnmounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { createAdaptivePerformanceEngine, type PerformanceLevel } from '@englishflow/performance'
import B10StatusPanel from '../../components/b10/B10StatusPanel.vue'
import { b10ThemeMode, b10T } from '../../platform/b10-foundation'
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

    <view class="b10-report-period" role="tablist" aria-label="报告周期"><button tabindex="0" class="b10-period-button" :class="{ active: reportPeriod === 'daily' }" type="button" role="tab" :aria-selected="reportPeriod === 'daily'" @click="selectReportPeriod('daily')">日报</button><button tabindex="0" class="b10-period-button" :class="{ active: reportPeriod === 'weekly' }" type="button" role="tab" :aria-selected="reportPeriod === 'weekly'" @click="selectReportPeriod('weekly')">周报</button></view>

    <B10StatusPanel :status="status" :message="store.message" :performance-level="performanceLevel" @retry="load" @performance="setPerformance" />
    <text data-zero-only>{{ ZERO_ONLY_COPY }}</text>
    <text data-projection-version>{{ store.projectionVersion || PROJECTION_VERSION }}</text>
    <text v-if="store.status === 'empty' || store.status === 'error' || store.status === 'offline'" data-empty-book>{{ emptyLabel }}</text>
    <text v-if="store.remediationId" data-remediation>{{ store.remediationId }}</text>
    <view v-if="store.mistakes.length" class="yx-card b10-mistakes"><text class="b10-section-title">{{ b10T('report.mistakes') }}</text><view v-for="mistake in store.mistakes" :key="mistake.mistakeId" class="b10-mistake"><view class="b10-mistake__copy"><text class="b10-mistake__title">{{ mistake.errorCategory }}</text><text>{{ mistake.prompt ?? `题目 ${mistake.itemId}` }}</text><text class="b10-mistake__meta" data-closure>{{ closureLabel(mistake.mistakeStatus, mistake.closureCopy) }}</text><text v-if="mistake.masteryStatus" class="b10-mistake__meta">{{ mistake.masteryStatus }}</text><text v-for="reason in mistake.reasonTrace" :key="reason.code" class="b10-mistake__reason">{{ reason.label }}<template v-if="reason.evidence"> · {{ reason.evidence }}</template></text></view><button tabindex="0" role="button" class="b10-mini" type="button" :disabled="mistake.mistakeStatus === 'MASTERED'" @click="retry(mistake.mistakeId)">{{ b10T('report.retry') }}</button></view></view>
    <view v-else-if="store.status !== 'loading'" class="yx-card b10-empty"><text>{{ b10T('report.noMistakes') }}</text></view>
    <view v-if="store.report" class="yx-card b10-report"><view class="b10-report__header"><text class="b10-section-title">{{ b10T('report.report') }}</text><text class="b10-report__status">{{ store.report.status }}</text></view><view class="b10-report__score"><text v-if="store.report.score !== null">{{ store.report.score }}<text v-if="store.report.reportedMaxScore !== null"> / {{ store.report.reportedMaxScore }}</text></text><text v-else>{{ store.report.status === 'PARTIAL' ? b10T('report.partial') : b10T('report.noReport') }}</text></view><view v-if="store.report.metrics.length" class="b10-metrics"><view v-for="metric in store.report.metrics" :key="metric.code" class="b10-metric"><text>{{ metric.label }}</text><text>{{ metric.value }}<template v-if="metric.max !== undefined"> / {{ metric.max }}</template></text></view></view><view v-if="store.report.evidence.length" class="b10-evidence"><text class="b10-section-title">{{ b10T('report.reason') }}</text><view v-for="item in store.report.evidence" :key="`${item.label}-${item.detail}`"><text>{{ item.label }}</text><text>{{ item.detail }}</text></view></view></view>
    <view v-else-if="store.reportStatus === 'loading'" class="yx-card b10-empty"><text>{{ b10T('status.loading') }}</text></view>
    <view class="b10-links"><button tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="open('/pages/b2-vocabulary/b2-vocabulary')">词汇复习</button><button tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="open('/pages/b2-practice/b2-practice')">继续练习</button></view>
  </view>
</template>

<style scoped lang="scss">
.b10-report-period{display:flex;gap:8rpx;padding:6rpx;border:1rpx solid var(--yx-border);border-radius:14rpx;background:var(--yx-surface-card)}.b10-period-button{min-height:64rpx;padding:0 22rpx;border:0;border-radius:10rpx;color:var(--yx-text-secondary);background:transparent;font-size:23rpx}.b10-period-button.active{color:var(--yx-brand);background:var(--yx-brand-soft)}.b10-section-title{color:var(--yx-text-primary);font-size:29rpx;font-weight:750}.b10-mistakes,.b10-report{display:grid;gap:16rpx}.b10-mistake{display:flex;align-items:flex-start;justify-content:space-between;gap:14rpx;padding:16rpx 0;border-top:1rpx solid var(--yx-border);color:var(--yx-text-secondary);font-size:23rpx;line-height:1.5}.b10-mistake__copy{display:grid;gap:5rpx;flex:1}.b10-mistake__title{color:var(--yx-text-primary);font-size:27rpx;font-weight:700}.b10-mistake__meta{color:var(--yx-text-tertiary);font-size:21rpx}.b10-mistake__reason{color:var(--yx-warning-strong);font-size:21rpx}.b10-mini{min-width:120rpx;min-height:62rpx;border:1rpx solid var(--yx-border);border-radius:10rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx}.b10-report__header{display:flex;justify-content:space-between;gap:12rpx}.b10-report__status{color:var(--yx-success-strong);font-size:22rpx}.b10-report__score{padding:18rpx 0;color:var(--yx-brand);font-size:52rpx;font-weight:800}.b10-metrics,.b10-evidence{display:grid;gap:10rpx}.b10-metric{display:flex;justify-content:space-between;padding:14rpx;border-radius:10rpx;background:var(--yx-surface-soft);color:var(--yx-text-secondary);font-size:23rpx}.b10-evidence{padding-top:16rpx;border-top:1rpx solid var(--yx-border);color:var(--yx-text-secondary);font-size:22rpx;line-height:1.5}.b10-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12rpx}.yx-button--secondary{color:var(--yx-brand);background:var(--yx-surface-card)}.b10-empty{padding:24rpx;color:var(--yx-text-secondary);font-size:24rpx}
</style>
