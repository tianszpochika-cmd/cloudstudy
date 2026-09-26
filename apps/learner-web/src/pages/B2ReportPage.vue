<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { computed, onMounted, ref } from 'vue'
import B10StatePanel from '../components/b10/B10StatePanel.vue'
import { useLearningUi } from '../platform/learning-ui'
import { useB10Store } from '../stores/b10'
import type { B10PerformanceLevel } from '../domain/b10'

import '../platform/b10-i18n'

const ui = useLearningUi()
const store = useB10Store()
const reportType = ref<'DAILY' | 'WEEKLY'>('DAILY')
const status = computed(() => store.reportStatus)
const generatedAt = computed(() => {
  const value = store.report?.generatedAt
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
})
onMounted(() => { store.restore(); void store.loadReport(reportType.value) })
function load(): void { void store.loadReport(reportType.value) }
function performance(level: B10PerformanceLevel): void { store.setPerformanceLevel(level) }
</script>

<template>
  <section class="b10-page" :data-performance="store.performanceLevel" aria-labelledby="report-title">
    <ExperienceHeader page="Report" icon="chart" title-id="report-title"><div class="report-switch"><button type="button" :class="{ active: reportType === 'DAILY' }" @click="reportType = 'DAILY'; load()">{{ ui.t('b10.report.daily') }}</button><button type="button" :class="{ active: reportType === 'WEEKLY' }" @click="reportType = 'WEEKLY'; load()">{{ ui.t('b10.report.weekly') }}</button></div></ExperienceHeader>
    <B10StatePanel v-if="status !== 'ready'" :status="status" :message="store.reportMessage" module-label="ASM / REPORT" :performance-level="store.performanceLevel" @retry="load" @performance="performance" />
    <article v-if="store.report" class="report-card"><div class="report-heading"><div><span class="eyebrow">{{ reportType === 'DAILY' ? ui.t('b10.report.daily') : ui.t('b10.report.weekly') }}</span><h3>学习回顾</h3></div></div><p v-if="store.report.calculationVersion === 'B25-LEGACY-UNVERIFIED-1'" class="muted">历史复习记录未核验，统计暂不展示。</p><div class="metrics"><div><strong>{{ store.report.studyMinutes ?? '—' }}</strong><span>学习分钟</span></div><div><strong>{{ store.report.newItems ?? '—' }}</strong><span>新学内容</span></div><div><strong>{{ store.report.reviewItems ?? '—' }}</strong><span>复习内容</span></div><div><strong>{{ store.report.accuracy === null ? '—' : `${Math.round(store.report.accuracy)}%` }}</strong><span>正确率</span></div><div><strong>{{ store.report.masteredIncrement ?? '—' }}</strong><span>掌握增量</span></div></div><div class="report-grid"><section><h3>后续复习</h3><p>明日待复习：<strong>{{ store.report.d1Pending ?? '—' }}</strong></p><p>一周后待复习：<strong>{{ store.report.d7Pending ?? '—' }}</strong></p><p>遗忘率：<strong>{{ store.report.forgettingRate === null ? '—' : `${Math.round(store.report.forgettingRate)}%` }}</strong></p></section><section><h3>{{ ui.t('b10.report.weakness') }}</h3><div v-if="store.reportWeaknesses.length" class="weakness-list"><div v-for="item in store.reportWeaknesses" :key="item.label" class="weakness"><div><span>{{ item.label }}</span><strong>{{ Math.round(item.value) }}</strong></div><progress :value="item.value" max="100">{{ item.value }}</progress><small v-if="item.evidence">证据：{{ item.evidence }}</small><small v-if="item.nextAction">下一步：{{ item.nextAction }}</small></div></div><p v-else class="muted">{{ ui.t('b10.report.noWeakness') }}</p></section></div><p v-if="generatedAt" class="footnote">更新于 {{ generatedAt }}</p></article>
    <section v-else-if="status === 'empty'" class="empty-panel"><strong>{{ ui.t('b10.report.noReport') }}</strong><button type="button" @click="load">{{ ui.t('b10.common.retry') }}</button></section>
  </section>
</template>

<style scoped>
.b10-page{display:grid;gap:22px}.page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.page-heading h2{margin:8px 0;font-size:clamp(30px,5vw,48px);line-height:1.1}.page-heading p:not(.eyebrow){max-width:720px;margin:0;color:var(--yx-color-text-secondary);line-height:1.7}.eyebrow{margin:0;color:var(--yx-color-brand-primary);font-size:12px;font-weight:800;letter-spacing:.12em}.report-switch{display:flex;gap:6px;padding:5px;border:1px solid var(--yx-color-border);border-radius:12px;background:var(--yx-color-surface-card)}.report-switch button{min-height:36px;padding:0 12px;border:0;border-radius:8px;color:var(--yx-color-text-secondary);background:transparent}.report-switch button.active{color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.report-card,.empty-panel{display:grid;gap:22px;padding:28px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.report-heading{display:flex;justify-content:space-between;gap:18px}.report-heading h3{margin:8px 0 0;font-size:clamp(24px,4vw,38px)}.report-heading>span{color:var(--yx-color-text-secondary);font-size:12px}.metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.metrics div{display:grid;gap:5px;padding:16px;border-radius:14px;background:var(--yx-color-surface-muted)}.metrics strong{font-size:26px}.metrics span{color:var(--yx-color-text-secondary);font-size:12px}.report-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.report-grid section{padding:18px;border:1px solid var(--yx-color-border);border-radius:14px}.report-grid h3{margin:0 0 12px}.report-grid p{margin:8px 0;color:var(--yx-color-text-secondary);line-height:1.6}.weakness-list{display:grid;gap:12px}.weakness{display:grid;gap:5px}.weakness>div{display:flex;justify-content:space-between}.weakness small,.muted,.footnote{color:var(--yx-color-text-secondary);font-size:12px}.weakness progress{width:100%;height:8px;accent-color:var(--yx-color-brand-primary)}.footnote{margin:0;border-top:1px solid var(--yx-color-border);padding-top:14px}.empty-panel{min-height:160px}.empty-panel button{justify-self:start;min-height:40px;padding:0 14px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-brand-primary);background:var(--yx-color-surface-page)}
@media(max-width:760px){.page-heading,.report-heading{align-items:flex-start;flex-direction:column}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.report-grid{grid-template-columns:1fr}}
</style>
