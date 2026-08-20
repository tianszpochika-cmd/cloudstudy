<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import B2StatusBanner from '../components/b2/B2StatusBanner.vue'
import B2VocabularyCard from '../components/b2/B2VocabularyCard.vue'
import { useB2Store } from '../stores/b2'
import type { PerformanceLevel } from '../domain/b2'

const b2 = useB2Store()
const router = useRouter()
const checkpointPending = computed(() => Boolean(b2.continueContext) || b2.queueCount > 0)
onMounted(() => { b2.restore(); void b2.loadVocabulary() })
function retry(): void { void b2.loadVocabulary() }
function sync(): void { void b2.syncQueue() }
function performance(level: PerformanceLevel): void { b2.setPerformanceLevel(level) }
function openPractice(): void { void router.push({ name: 'b2-practice' }) }
</script>

<template>
  <main class="b2-page" aria-labelledby="vocab-title">
    <header class="page-heading"><div><p class="eyebrow">VOCABULARY · SRS</p><h1 id="vocab-title">先想起来，再看答案。</h1><p>词卡只展示服务端已发布内容；翻面后才能看到释义并提交 0～3 信心度。</p></div><button class="secondary-button" type="button" @click="openPractice">进入练习中心</button></header>
    <B2StatusBanner :status="b2.status" :message="b2.lastError" :queue-count="b2.queueCount" :checkpoint-pending="checkpointPending" :performance-level="b2.performanceLevel" @retry="retry" @sync="sync" @performance="performance" />
    <section v-if="b2.currentCard" class="vocab-layout"><div><B2VocabularyCard :card="b2.currentCard" :phase="b2.cardPhase" :performance-level="b2.performanceLevel" @reveal="b2.revealCard" @rate="b2.rateCard" @retry="retry" /></div><aside class="side-panel"><h2>本批次状态</h2><p>当前 {{ b2.cardIndex + 1 }} / {{ b2.cards.length }} 张</p><p>已排队事件：{{ b2.queueCount }}</p><p v-if="b2.currentCard.srs?.delayedVerifyStage === 'D1_PENDING'">这张卡等待 D+1 延迟复测。</p><p v-else-if="b2.currentCard.srs?.delayedVerifyStage === 'D7_PENDING'">这张卡等待 D+7 延迟复测。</p><p v-else>掌握状态由服务端规则计算，客户端不自行推断。</p><button class="secondary-button" type="button" @click="sync">检查同步</button></aside></section>
    <section v-else-if="b2.status === 'loading'" class="empty-panel" role="status">正在读取当天 SRS 批次…</section>
    <section v-else class="empty-panel" role="status"><strong>{{ b2.status === 'empty' ? '今天没有可用词卡' : '还没有可展示的词卡' }}</strong><p>{{ b2.lastError ?? '服务端没有返回已发布批次，因此页面保持空态。' }}</p><button class="secondary-button" type="button" @click="retry">重新读取</button></section>
  </main>
</template>

<style scoped>
.b2-page{display:grid;gap:24px}.page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.page-heading h1{margin:8px 0;font-size:clamp(30px,5vw,48px);line-height:1.12}.page-heading p:not(.eyebrow){max-width:720px;margin:0;color:#666d80;line-height:1.7}.eyebrow{margin:0;color:#596bff;font-size:12px;font-weight:800;letter-spacing:.12em}.vocab-layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:20px}.side-panel,.empty-panel{display:grid;align-content:start;gap:10px;padding:22px;border:1px solid #e6e8f0;border-radius:18px;background:#fff}.side-panel h2{margin:0;font-size:18px}.side-panel p{margin:0;color:#666d80;line-height:1.6}.secondary-button{min-height:42px;padding:0 14px;border:1px solid #d9dce7;border-radius:12px;color:#596bff;background:#fff;font-weight:750}.empty-panel{justify-items:start;min-height:180px;align-content:center}.empty-panel strong{font-size:20px}.empty-panel p{margin:0;color:#666d80;line-height:1.6}@media(max-width:800px){.page-heading{align-items:flex-start;flex-direction:column}.vocab-layout{grid-template-columns:1fr}.side-panel{order:-1}.secondary-button{width:100%}}</style>
