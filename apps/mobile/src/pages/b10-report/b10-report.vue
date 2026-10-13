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
const reportLabels: Record<string, string> = { PENDING_RETRY: "待补救", DELAY_VERIFY_D1: "待次日验证", DELAY_VERIFY_D7: "待七日验证", MASTERED: "已掌握", REOPENED: "重新打开", NEW: "新错题", LEARNING: "巩固中", CONSOLIDATED: "已巩固", READY: "已生成", PARTIAL: "部分生成", GENERATING: "生成中", FAILED: "生成失败" }
</script>

<template>
  <view class="yx-page" :class="themeClass" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="b10-report" />

    <view class="v2-report-body">
      <view class="b10-report-period v2-report-filter" role="tablist" aria-label="报告周期"><button tabindex="0" class="b10-period-button v2-report-opt v2-report-tab" :class="{ active: reportPeriod === 'daily' }" type="button" role="tab" :aria-selected="reportPeriod === 'daily'" @click="selectReportPeriod('daily')">日报</button><button tabindex="0" class="b10-period-button v2-report-opt v2-report-tab" :class="{ active: reportPeriod === 'weekly' }" type="button" role="tab" :aria-selected="reportPeriod === 'weekly'" @click="selectReportPeriod('weekly')">周报</button></view>

      <B10StatusPanel class="v2-report-progress" :status="status" :message="store.message" :performance-level="performanceLevel" @retry="load" @performance="setPerformance" />
      <text data-zero-only class="meta v2-report-meta">{{ ZERO_ONLY_COPY }}</text>
      <text data-projection-version class="meta v2-report-meta v2-report-sr-only">{{ store.projectionVersion || PROJECTION_VERSION }}</text>
      <text v-if="store.status === 'empty' || store.status === 'error' || store.status === 'offline'" data-empty-book class="meta v2-report-meta">{{ emptyLabel }}</text>
      <text v-if="store.remediationId" data-remediation class="meta v2-report-meta">{{ store.remediationId }}</text>
      <view v-if="store.mistakes.length" class="yx-card card b10-mistakes v2-report-card v2-report-mistakes"><text class="b10-section-title v2-report-title">{{ b10T('report.mistakes') }}</text><view class="v2-report-list"><view v-for="mistake in store.mistakes" :key="mistake.mistakeId" class="b10-mistake v2-report-item"><view class="b10-mistake__copy v2-report-copy"><text class="b10-mistake__title v2-report-stem">{{ mistake.errorCategory }}</text><text class="v2-report-desc">{{ mistake.prompt ?? `题目 ${mistake.itemId}` }}</text><text class="b10-mistake__meta fb v2-report-fb" data-closure>{{ (reportLabels[closureLabel(mistake.mistakeStatus, mistake.closureCopy)] ?? closureLabel(mistake.mistakeStatus, mistake.closureCopy)) }}</text><text v-if="mistake.masteryStatus" class="b10-mistake__meta fb v2-report-fb">{{ reportLabels[mistake.masteryStatus] ?? mistake.masteryStatus }}</text><text v-for="reason in mistake.reasonTrace" :key="reason.code" class="b10-mistake__reason fb v2-report-fb">{{ reason.label }}<template v-if="reason.evidence"> · {{ reason.evidence }}</template></text></view><button tabindex="0" role="button" class="b10-mini opt v2-report-opt v2-report-submit v2-report-retry" type="button" :disabled="mistake.mistakeStatus === 'MASTERED'" @click="retry(mistake.mistakeId)">{{ b10T('report.retry') }}</button></view></view></view>
      <view v-else-if="store.status !== 'loading'" class="yx-card card b10-empty v2-report-card v2-report-empty"><text class="v2-report-desc">{{ b10T('report.noMistakes') }}</text></view>
      <view v-if="store.report?.period" class="yx-card card b10-report v2-report-card v2-report-weekly" :data-period-availability="store.report.period.availability"><text data-period-copy class="v2-report-title">{{ store.report.period.copy }}</text><text class="v2-report-desc">统计范围 {{ store.report.period.periodStart }} 至 {{ store.report.period.periodEndExclusive }}（{{ store.report.period.learningDayZone }}）</text><text class="meta v2-report-meta">更新时间 {{ store.report.period.updatedAt }} · 版本 {{ store.report.period.reportVersion ?? '—' }}</text><text class="v2-report-stat">新学 {{ store.report.period.newItems ?? '—' }} · 复习 {{ store.report.period.reviewItems ?? '—' }}</text><text class="v2-report-desc">{{ store.report.period.durationCopy }}</text><text data-suggestion class="fb v2-report-fb v2-report-suggest">建议：{{ store.report.period.suggestion }}</text><text class="fb v2-report-fb">依据 {{ store.report.period.suggestionBasis }}。这是规则建议，不是已开放的 AI 功能。</text><view class="v2-report-actions"><button type="button" class="opt v2-report-opt v2-report-submit" data-share-issue @click="issueShare">生成只读链接</button><button v-if="shareRef" type="button" class="opt v2-report-opt" data-share-revoke @click="revokeShare">撤销分享</button></view><text v-if="shareRef" class="fb v2-report-fb">/pages/report-share/report-share?ref={{ shareRef }}</text><text v-if="shareNote" class="fb v2-report-fb">{{ shareNote }}</text></view>
      <view v-if="store.report" class="yx-card card b10-report v2-report-card v2-report-summary"><view class="b10-report__header v2-report-header"><text class="b10-section-title v2-report-title">{{ b10T('report.report') }}</text><text class="b10-report__status v2-report-status meta v2-report-meta">{{ reportLabels[store.report.status] ?? store.report.status }}</text></view><view class="b10-report__score v2-report-score"><text v-if="store.report.score !== null" class="v2-report-score-num">{{ store.report.score }}<text v-if="store.report.reportedMaxScore !== null" class="v2-report-score-max"> / {{ store.report.reportedMaxScore }}</text></text><text v-else class="v2-report-score-num">{{ store.report.status === 'PARTIAL' ? b10T('report.partial') : b10T('report.noReport') }}</text></view><view v-if="store.report.metrics.length" class="b10-metrics v2-report-stats v2-report-list"><view v-for="metric in store.report.metrics" :key="metric.code" class="b10-metric v2-report-item v2-report-stat"><text class="v2-report-desc">{{ metric.label }}</text><text class="v2-report-value">{{ metric.value }}<template v-if="metric.max !== undefined"> / {{ metric.max }}</template></text></view></view><view v-if="store.report.evidence.length" class="b10-evidence v2-report-evidence v2-report-list"><text class="b10-section-title v2-report-title">{{ b10T('report.reason') }}</text><view v-for="item in store.report.evidence" :key="`${item.label}-${item.detail}`" class="v2-report-item"><text class="v2-report-desc">{{ item.label }}</text><text class="fb v2-report-fb">{{ item.detail }}</text></view></view></view>
      <view v-else-if="store.reportStatus === 'loading'" class="yx-card card b10-empty v2-report-card v2-report-empty"><text class="v2-report-desc">{{ b10T('status.loading') }}</text></view>
      <view class="b10-links v2-report-links v2-report-actions"><button tabindex="0" role="button" class="yx-button yx-button--secondary opt v2-report-opt v2-report-next" type="button" @click="open('/pages/b2-vocabulary/b2-vocabulary')">词汇复习</button><button tabindex="0" role="button" class="yx-button yx-button--secondary opt v2-report-opt v2-report-next" type="button" @click="open('/pages/b2-practice/b2-practice')">继续练习</button></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.b10-report-period{display:flex;gap:8rpx;padding:6rpx;border:1rpx solid var(--yx-border);border-radius:14rpx;background:var(--yx-surface-card)}.b10-period-button{min-height:64rpx;padding:0 22rpx;border:0;border-radius:10rpx;color:var(--yx-text-secondary);background:transparent;font-size:23rpx}.b10-period-button.active{color:var(--yx-brand);background:var(--yx-brand-soft)}.b10-section-title{color:var(--yx-text-primary);font-size:29rpx;font-weight:750}.b10-mistakes,.b10-report{display:grid;gap:16rpx}.b10-mistake{display:flex;align-items:flex-start;justify-content:space-between;gap:14rpx;padding:16rpx 0;border-top:1rpx solid var(--yx-border);color:var(--yx-text-secondary);font-size:23rpx;line-height:1.5}.b10-mistake__copy{display:grid;gap:5rpx;flex:1}.b10-mistake__title{color:var(--yx-text-primary);font-size:27rpx;font-weight:700}.b10-mistake__meta{color:var(--yx-text-tertiary);font-size:21rpx}.b10-mistake__reason{color:var(--yx-warning-strong);font-size:21rpx}.b10-mini{min-width:120rpx;min-height:62rpx;border:1rpx solid var(--yx-border);border-radius:10rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx}.b10-report__header{display:flex;justify-content:space-between;gap:12rpx}.b10-report__status{color:var(--yx-success-strong);font-size:22rpx}.b10-report__score{padding:18rpx 0;color:var(--yx-brand);font-size:52rpx;font-weight:800}.b10-metrics,.b10-evidence{display:grid;gap:10rpx}.b10-metric{display:flex;justify-content:space-between;padding:14rpx;border-radius:10rpx;background:var(--yx-surface-soft);color:var(--yx-text-secondary);font-size:23rpx}.b10-evidence{padding-top:16rpx;border-top:1rpx solid var(--yx-border);color:var(--yx-text-secondary);font-size:22rpx;line-height:1.5}.b10-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12rpx}.yx-button--secondary{color:var(--yx-brand);background:var(--yx-surface-card)}.b10-empty{padding:24rpx;color:var(--yx-text-secondary);font-size:24rpx}
/* v2 报告页换皮：对齐 mobile/styles.css 与 refine.css 中 .stat/.tag（药丸 var(--v2-soft) 底 var(--v2-brand) 字、var(--v2-radius-pill)）、错题条目卡、统计卡；其余沿用 practice.vue v2-practice-* 数值，仅用 var(--v2-*)。 */
.v2-report-body{display:flex;flex-direction:column;gap:var(--v2-space-4);font-family:var(--v2-font)}
.v2-report-filter{display:flex;gap:var(--v2-space-2);padding:var(--v2-space-1);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-surface);font-family:var(--v2-font)}
.v2-report-opt{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap}
.v2-report-opt:hover{border-color:var(--v2-brand)}
.v2-report-opt:active{transform:scale(.97)}
.v2-report-opt:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-report-opt:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-report-tab{flex:1;border-color:transparent;background:transparent}
.v2-report-tab.active{border-color:var(--v2-brand);background:var(--v2-soft);color:var(--v2-brand)}
.v2-report-submit{border-color:transparent;background:var(--v2-brand);color:var(--v2-inverse);font-family:var(--v2-font);font-weight:700}
.v2-report-submit:hover{border-color:var(--v2-brand)}
.v2-report-retry{flex:none;width:auto;white-space:nowrap}
.v2-report-next{color:var(--v2-brand);font-family:var(--v2-font);white-space:nowrap}
.v2-report-progress{display:grid;gap:var(--v2-space-3)}
.v2-report-meta{display:block;margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
.v2-report-card{display:grid;gap:var(--v2-space-2);padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font)}
.v2-report-card:hover{border-color:var(--v2-brand)}
.v2-report-mistakes,.v2-report-weekly,.v2-report-summary{gap:var(--v2-space-3)}
.v2-report-empty{text-align:center;padding:var(--v2-space-8) var(--v2-space-5)}
.v2-report-title{display:block;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45}
.v2-report-header{display:flex;align-items:center;justify-content:space-between;gap:var(--v2-space-3)}
.v2-report-status{display:inline-block;padding:var(--v2-space-1) var(--v2-space-3);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;line-height:1.5}
.v2-report-list{display:grid;gap:var(--v2-space-3)}
.v2-report-stats{display:grid;gap:var(--v2-space-2)}
.v2-report-item{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--v2-space-3);padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-surface);font-family:var(--v2-font)}
.v2-report-item:hover{border-color:var(--v2-brand)}
.v2-report-copy{display:grid;gap:var(--v2-space-1);flex:1;min-width:0}
.v2-report-stem{display:block;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-md);font-weight:700;line-height:1.45}
.v2-report-desc{display:block;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
.v2-report-stat{display:inline-block;padding:var(--v2-space-1) var(--v2-space-3);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;line-height:1.5}
.v2-report-item.v2-report-stat{display:flex;align-items:center;justify-content:space-between;gap:var(--v2-space-3);padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-size:var(--v2-text-sm);font-weight:400}
.v2-report-value{color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.2}
.v2-report-score{display:block;padding:var(--v2-space-4) 0;color:var(--v2-brand);font-family:var(--v2-font)}
.v2-report-score-num{color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-2xl);font-weight:800;line-height:1.2}
.v2-report-score-max{color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600}
.v2-report-fb{display:block;margin-top:var(--v2-space-4);padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
.v2-report-fb.ok{background:var(--v2-ok-soft);color:var(--v2-ok)}
.v2-report-fb.no{background:var(--v2-bad-soft);color:var(--v2-bad)}
.v2-report-item .v2-report-fb{margin-top:0;padding:0;border-radius:var(--v2-radius-sm);background:transparent}
.v2-report-suggest{background:var(--v2-soft);color:var(--v2-brand)}
.v2-report-evidence{display:grid;gap:var(--v2-space-2);padding-top:var(--v2-space-4);border-top:1px solid var(--v2-line)}
.v2-report-actions{display:flex;flex-wrap:wrap;align-items:center;gap:var(--v2-space-2)}
.v2-report-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--v2-space-3)}
.v2-report-sr-only{display:none !important;}
.v2-report-mistakes .v2-report-item{flex-direction:column;align-items:stretch;gap:var(--v2-space-2);background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);padding:var(--v2-space-4);box-shadow:var(--v2-shadow);}
.v2-report-mistakes .v2-report-desc{font-size:var(--v2-text-md);font-weight:600;color:var(--v2-ink);}
.v2-report-mistakes [data-closure]{display:inline-block !important;width:fit-content;max-width:100%;align-self:flex-start;padding:var(--v2-space-1) var(--v2-space-3);border-radius:var(--v2-radius-pill);background:var(--v2-warn-soft);color:var(--v2-warn);font-size:var(--v2-text-xs);font-weight:700;}
.v2-report-mistakes .v2-report-retry{width:100%;min-height:44px;background:var(--v2-brand);color:#fff;border-radius:var(--v2-radius-md);border:0;}
</style>
