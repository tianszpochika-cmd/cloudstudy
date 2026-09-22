<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { computed, onMounted, ref } from 'vue'
import B10StatePanel from '../components/b10/B10StatePanel.vue'
import { useLearningUi } from '../platform/learning-ui'
import { useB10Store } from '../stores/b10'
import type { B10PerformanceLevel, B10ReadingQuestion } from '../domain/b10'

import '../platform/b10-i18n'

const ui = useLearningUi()
const store = useB10Store()
const fontSize = ref(18)
const bilingual = ref(true)
const progress = computed(() => store.readingArticle?.blocks.length ? Math.round(((store.readingActiveBlock + 1) / store.readingArticle.blocks.length) * 100) : 0)

onMounted(() => { store.restore(); void store.loadReading() })
function retry(): void { void store.loadReading() }
function sync(): void { void store.syncOffline() }
function performance(level: B10PerformanceLevel): void { store.setPerformanceLevel(level) }
function next(): void {
  const article = store.readingArticle
  if (!article) return
  const index = Math.min(article.blocks.length - 1, store.readingActiveBlock + 1)
  store.readingActiveBlock = index
  const block = article.blocks[index]
  if (block) void store.saveCurrentReadingProgress(block.blockId, Math.round(((index + 1) / article.blocks.length) * 100), index + 1)
}
function submitQuestion(question: B10ReadingQuestion): void { const answer = store.readingAnswers[question.questionId]; if (answer) void store.submitReadingQuestion(question, answer) }
</script>

<template>
  <main class="b10-page" :data-performance="store.performanceLevel" aria-labelledby="reading-title">
    <ExperienceHeader page="Reading" icon="book" title-id="reading-title" />
    <B10StatePanel v-if="store.readingStatus !== 'ready' || store.queueCount" :status="store.readingStatus" :message="store.readingMessage" :queue-count="store.queueCount" :cached="store.readingCached" module-label="RDG / READING" :performance-level="store.performanceLevel" @retry="retry" @sync="sync" @performance="performance" />
    <section v-if="store.readingArticle" class="reading-layout">
      <aside class="side-panel"><p class="eyebrow">{{ store.readingArticle.cefrLevel }} · {{ store.readingArticle.estimatedMinutes }} min</p><h3>{{ store.readingArticle.title }}</h3><div class="progress"><span :style="{ width: `${progress}%` }"></span></div><small>{{ ui.t('b10.reading.progress', { percent: progress }) }}</small><label>字号 <input v-model.number="fontSize" type="range" min="14" max="32"><span>{{ fontSize }}px</span></label><button class="secondary-button" type="button" @click="bilingual = !bilingual">{{ bilingual ? '隐藏中文' : '显示中文' }}</button><button class="secondary-button" type="button" :disabled="!store.queueCount" @click="sync">{{ ui.t('b10.common.sync') }}（{{ store.queueCount }}）</button><div v-if="store.readingDictionary || store.readingDictionaryMessage" class="dictionary"><strong v-if="store.readingDictionary">{{ store.readingDictionary.lemma }}</strong><span v-if="store.readingDictionary">{{ store.readingDictionary.meaningCn }}</span><small v-if="store.readingDictionary?.exampleText">{{ store.readingDictionary.exampleText }}</small><small v-if="store.readingDictionaryMessage">{{ store.readingDictionaryMessage }}</small></div></aside>
      <article class="article-panel" :style="{ fontSize: `${fontSize}px` }"><div v-for="(block, index) in store.readingArticle.blocks" :key="block.blockId" class="block" :class="{ active: store.readingActiveBlock === index }" @click="store.readingActiveBlock = index"><p>{{ block.text }}</p><div v-if="block.tokens.length" class="token-buttons"><button v-for="token in block.tokens" :key="token.tokenId" type="button" @click.stop="void store.lookupReading(token.tokenId)">{{ token.text }}</button></div><p v-if="bilingual && block.translation" class="translation">{{ block.translation }}</p><div class="block-actions"><small>{{ block.blockId }} · {{ ui.t('b10.reading.lookup') }}</small><button type="button" @click.stop="void store.mineReading(block.blockId)">{{ store.minedBlocks.has(block.blockId) ? ui.t('b10.reading.mined') : ui.t('b10.reading.mine') }}</button></div></div><button class="primary-button" type="button" :disabled="store.readingActiveBlock >= store.readingArticle.blocks.length - 1" @click="next">{{ ui.t('b10.practice.next') }}</button><section v-if="store.readingQuestions.length" class="questions"><div class="question-heading"><h3>{{ ui.t('b10.reading.quiz') }}</h3><span>{{ ui.t('b10.common.noAnswerRule') }}</span></div><div v-for="question in store.readingQuestions" :key="question.questionId" class="question"><strong>{{ question.stemText }}</strong><label v-for="option in question.options" :key="option.key"><input v-model="store.readingAnswers[question.questionId]" type="radio" :name="`reading-${question.questionId}`" :value="option.key">{{ option.text }}</label><button class="secondary-button" type="button" :disabled="!store.readingAnswers[question.questionId]" @click="submitQuestion(question)">{{ ui.t('b10.reading.quizSubmit') }}</button><small v-if="store.readingResults[question.questionId]" :class="{ correct: store.readingResults[question.questionId].correct }">{{ store.readingResults[question.questionId].correct ? '规则命中' : '需要复习' }} · {{ store.readingResults[question.questionId].feedbackCode }}</small></div></section></article>
    </section>
    <section v-else-if="store.readingStatus === 'empty'" class="empty-panel"><strong>{{ ui.t('b10.reading.noArticle') }}</strong><p>{{ ui.t('b10.state.empty') }}</p></section>
  </main>
</template>

<style scoped>
.b10-page{display:grid;gap:22px}.page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.page-heading h2{margin:8px 0;font-size:clamp(30px,5vw,48px);line-height:1.1}.page-heading p:not(.eyebrow){max-width:720px;margin:0;color:var(--yx-color-text-secondary);line-height:1.7}.eyebrow{margin:0;color:var(--yx-color-brand-primary);font-size:12px;font-weight:800;letter-spacing:.12em}.locale-pill{padding:9px 12px;border:1px solid var(--yx-color-border);border-radius:999px;color:var(--yx-color-text-secondary);font-size:12px}.reading-layout{display:grid;grid-template-columns:260px minmax(0,1fr);gap:20px}.side-panel,.article-panel,.empty-panel{padding:24px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.side-panel{display:grid;align-content:start;gap:14px;height:max-content}.side-panel h3{margin:0;font-size:22px}.side-panel small,.side-panel label{color:var(--yx-color-text-secondary)}.side-panel label{display:grid;gap:8px}.progress{height:8px;border-radius:99px;background:var(--yx-color-surface-muted);overflow:hidden}.progress span{display:block;height:100%;background:var(--yx-color-brand-primary)}.secondary-button,.primary-button{min-height:40px;padding:0 12px;border-radius:10px;font-weight:750}.secondary-button{border:1px solid var(--yx-color-border);color:var(--yx-color-brand-primary);background:var(--yx-color-surface-page)}.primary-button{border:0;color:var(--yx-color-text-on-brand);background:var(--yx-color-brand-primary)}button:disabled{cursor:wait;opacity:.55}.dictionary{display:grid;gap:5px;padding:12px;border-radius:12px;background:var(--yx-color-brand-primary-soft)}.dictionary span,.dictionary small{color:var(--yx-color-text-secondary);line-height:1.5}.article-panel{min-height:480px}.block{padding:14px 16px;border-left:3px solid transparent;cursor:pointer}.block.active{border-left-color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.block p{line-height:1.8}.translation{color:var(--yx-color-text-secondary)}.token-buttons{display:flex;flex-wrap:wrap;gap:6px}.token-buttons button{padding:4px 7px;border:0;border-bottom:2px solid var(--yx-color-brand-primary);color:var(--yx-color-brand-primary);background:var(--yx-color-surface-page)}.block-actions{display:flex;align-items:center;justify-content:space-between;gap:8px}.block-actions small{color:var(--yx-color-text-secondary);font-size:12px}.block-actions button{padding:7px 9px;border:0;border-radius:8px;color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft);font-size:12px}.questions{display:grid;gap:14px;margin-top:24px;padding-top:20px;border-top:1px solid var(--yx-color-border)}.question-heading{display:flex;justify-content:space-between;gap:12px;align-items:center}.question-heading h3{margin:0}.question-heading span{color:var(--yx-color-text-secondary);font-size:12px}.question{display:grid;gap:8px;padding:14px;border-radius:14px;background:var(--yx-color-surface-muted)}.question label{display:flex;gap:8px;align-items:flex-start;line-height:1.5}.question small{color:var(--yx-color-warning)}.question small.correct{color:var(--yx-color-success)}.empty-panel{min-height:160px}.empty-panel p{color:var(--yx-color-text-secondary)}
@media(max-width:760px){.page-heading{align-items:flex-start;flex-direction:column}.reading-layout{grid-template-columns:1fr}.side-panel{order:-1}.block-actions{align-items:flex-start;flex-direction:column}}
</style>
