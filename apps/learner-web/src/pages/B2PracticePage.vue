<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import B2ImmediateFeedback from '../components/b2/B2ImmediateFeedback.vue'
import B2PracticeQuestion from '../components/b2/B2PracticeQuestion.vue'
import B2StatusBanner from '../components/b2/B2StatusBanner.vue'
import { useB2Store } from '../stores/b2'
import type { PerformanceLevel } from '../domain/b2'

const b2 = useB2Store(); const route = useRoute()
const progress = computed(() => b2.practice && b2.practice.questions.length ? Math.round((b2.practice.currentIndex / b2.practice.questions.length) * 100) : 0)
onMounted(() => { b2.restore(); const sessionId = typeof route.query.sessionId === 'string' ? route.query.sessionId : null; if (sessionId) void b2.loadPractice(sessionId); else void b2.startPractice('DAILY') })
function retry(): void { if (b2.practice?.sessionId) void b2.loadPractice(b2.practice.sessionId); else void b2.startPractice('DAILY') }
function answer(value: unknown): void { void b2.answerPractice(value) }
function next(): void { b2.nextPractice() }
function retryQuestion(): void { b2.practiceFeedback = null; b2.clearError() }
function sync(): void { void b2.syncQueue() }
function performance(level: PerformanceLevel): void { b2.setPerformanceLevel(level) }
</script>

<template>
  <main class="b2-page" aria-labelledby="practice-title">
    <header class="page-heading"><div><p class="eyebrow">PRACTICE HUB · RULE-BASED</p><h1 id="practice-title">做一题，马上知道下一步。</h1><p>即时反馈只展示服务端判定；断点和待同步状态会明确标记，不把本地答案当成已提交结果。</p></div></header>
    <B2StatusBanner :status="b2.status" :message="b2.lastError" :queue-count="b2.queueCount" :performance-level="b2.performanceLevel" @retry="retry" @sync="sync" @performance="performance" />
    <section v-if="b2.currentQuestion && b2.practice" class="practice-layout"><div class="practice-main"><div class="practice-progress"><div><span>第 {{ b2.practice.currentIndex + 1 }} / {{ b2.practice.questions.length }} 题</span><span>{{ progress }}%</span></div><progress :value="progress" max="100">{{ progress }}%</progress></div><B2PracticeQuestion :question="b2.currentQuestion" :disabled="Boolean(b2.practiceFeedback)" :performance-level="b2.performanceLevel" @answer="answer" /><B2ImmediateFeedback :feedback="b2.practiceFeedback" :performance-level="b2.performanceLevel" @next="next" @retry="retryQuestion" /></div><aside class="side-panel"><h2>断点与状态</h2><p>会话：{{ b2.practice.sessionId }}</p><p>服务端断点序号：{{ b2.practice.checkpointSeq }}</p><p>待同步事件：{{ b2.queueCount }}</p><button class="secondary-button" type="button" @click="b2.saveCheckpoint()">保存断点</button></aside></section>
    <section v-else-if="b2.status === 'loading'" class="empty-panel" role="status">正在创建练习会话…</section>
    <section v-else class="empty-panel" role="status"><strong>{{ b2.status === 'empty' ? '服务端没有返回可练习题目' : '练习会话暂时不可用' }}</strong><p>{{ b2.lastError ?? '没有使用本地样例题目填充，等待服务端题包。' }}</p><button class="secondary-button" type="button" @click="retry">重新读取</button></section>
  </main>
</template>

<style scoped>.b2-page{display:grid;gap:24px}.page-heading h1{margin:8px 0;font-size:clamp(30px,5vw,48px);line-height:1.12}.page-heading p:not(.eyebrow){max-width:720px;margin:0;color:#666d80;line-height:1.7}.eyebrow{margin:0;color:#596bff;font-size:12px;font-weight:800;letter-spacing:.12em}.practice-layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:20px}.practice-main{display:grid;gap:16px}.practice-progress{display:grid;gap:8px}.practice-progress>div{display:flex;justify-content:space-between;color:#666d80;font-size:13px}.practice-progress progress{width:100%;height:8px;accent-color:#596bff}.side-panel,.empty-panel{display:grid;align-content:start;gap:10px;padding:22px;border:1px solid #e6e8f0;border-radius:18px;background:#fff}.side-panel h2{margin:0;font-size:18px}.side-panel p{margin:0;color:#666d80;line-height:1.6}.secondary-button{min-height:42px;padding:0 14px;border:1px solid #d9dce7;border-radius:12px;color:#596bff;background:#fff;font-weight:750}.empty-panel{justify-items:start;min-height:180px;align-content:center}.empty-panel strong{font-size:20px}.empty-panel p{margin:0;color:#666d80;line-height:1.6}@media(max-width:800px){.practice-layout{grid-template-columns:1fr}.side-panel{order:-1}.secondary-button{width:100%}}</style>
