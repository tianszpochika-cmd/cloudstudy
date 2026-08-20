<script setup lang="ts">
import { onMounted } from 'vue'
import B2ReportCard from '../components/b2/B2ReportCard.vue'
import B2StatusBanner from '../components/b2/B2StatusBanner.vue'
import { useB2Store } from '../stores/b2'
import type { PerformanceLevel } from '../domain/b2'
const b2 = useB2Store()
onMounted(() => { b2.restore(); void b2.loadReport('DAILY') })
function retry(): void { void b2.loadReport('DAILY') }
function sync(): void { void b2.syncQueue() }
function performance(level: PerformanceLevel): void { b2.setPerformanceLevel(level) }
</script>
<template><main class="b2-page" aria-labelledby="report-title"><header><p class="eyebrow">LEARNING REPORT</p><h1 id="report-title">看见已经确认的进步，也看见下一步。</h1><p>报告只展示服务端生成的快照，样本不足或接口不可用时不会用本地估算填充。</p></header><B2StatusBanner :status="b2.reportStatus" :message="b2.lastError" :queue-count="b2.queueCount" :performance-level="b2.performanceLevel" @retry="retry" @sync="sync" @performance="performance" /><B2ReportCard v-if="b2.report" :report="b2.report" /><section v-else-if="b2.reportStatus === 'loading'" class="empty-panel">正在读取报告快照…</section><section v-else class="empty-panel"><strong>报告暂时不可用</strong><p>{{ b2.lastError ?? '服务端尚未返回日报快照。' }}</p><button class="secondary-button" type="button" @click="retry">重新读取</button></section></main></template>
<style scoped>.b2-page{display:grid;gap:24px}.b2-page h1{max-width:760px;margin:8px 0;font-size:clamp(30px,5vw,48px);line-height:1.12}.b2-page header>p:not(.eyebrow){max-width:760px;margin:0;color:#666d80;line-height:1.7}.eyebrow{margin:0;color:#596bff;font-size:12px;font-weight:800;letter-spacing:.12em}.empty-panel{display:grid;justify-items:start;align-content:center;gap:10px;min-height:180px;padding:22px;border:1px dashed #d9dce7;border-radius:18px;background:#fff}.empty-panel strong{font-size:20px}.empty-panel p{margin:0;color:#666d80;line-height:1.6}.secondary-button{min-height:42px;padding:0 14px;border:1px solid #d9dce7;border-radius:12px;color:#596bff;background:#fff;font-weight:750}</style>
