<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { computed, onMounted, ref } from 'vue'
import B10StatePanel from '../components/b10/B10StatePanel.vue'
import { useLearningUi } from '../platform/learning-ui'
import { useB10Store } from '../stores/b10'
import type { B10PerformanceLevel, B10ReadingQuestion } from '../domain/b10'
import { packNotice } from '../domain/grammar-reading-pack'
import { practiceFeedback } from '../domain/practice-loop'

import '../platform/b10-i18n'

const ui = useLearningUi()
const store = useB10Store()
const fontSize = ref(18)
const bilingual = ref(true)
const progress = computed(() => store.readingArticle?.blocks.length ? Math.round(((store.readingActiveBlock + 1) / store.readingArticle.blocks.length) * 100) : 0)
const readingPackNotice = computed(() => packNotice('READING', store.readingQuestions.length, store.readingMessage))
function readingFeedback(questionId: number) {
  const result = store.readingResults[questionId]
  return result ? practiceFeedback({ correct: result.correct, savedReceipt: result.savedReceipt, feedbackText: result.feedbackText, nextQuestion: result.nextQuestion, scoreBucket: result.scoreBucket }) : null
}

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
  <main class="b10-page v2-page v2-page--b3reading" :data-performance="store.performanceLevel" aria-labelledby="reading-title">
    <ExperienceHeader class="v2-b3reading-head" page="Reading" icon="book" title-id="reading-title" />
    <B10StatePanel class="v2-b3reading-state" v-if="store.readingStatus !== 'ready' || store.queueCount" :status="store.readingStatus" :message="store.readingMessage" :queue-count="store.queueCount" :cached="store.readingCached" module-label="RDG / READING" :performance-level="store.performanceLevel" @retry="retry" @sync="sync" @performance="performance" />
    <div class="v2-b3reading-body"><div class="v2-b3reading-main">
    <section v-if="store.readingArticle" class="reading-layout v2-b3reading-layout">
      <aside class="side-panel v2-b3reading-side"><p class="eyebrow v2-b3reading-meta">{{ store.readingArticle.cefrLevel }} · {{ store.readingArticle.estimatedMinutes }}分钟<span class="v2-sr-only">（{{ store.readingArticle.estimatedMinutes }}min）</span></p><h3>{{ store.readingArticle.title }}</h3><div class="progress"><span :style="{ width: `${progress}%` }"></span></div><small>{{ ui.t('b10.reading.progress', { percent: progress }) }}</small><label>字号 <input v-model.number="fontSize" type="range" min="14" max="32"><span>{{ fontSize }}像素<span class="v2-sr-only">（{{ fontSize }}px）</span></span></label><button class="secondary-button" type="button" @click="bilingual = !bilingual">{{ bilingual ? '隐藏中文' : '显示中文' }}</button><button class="secondary-button" type="button" :disabled="!store.queueCount" @click="sync">{{ ui.t('b10.common.sync') }}（{{ store.queueCount }}）</button><div v-if="store.readingDictionary || store.readingDictionaryMessage" class="dictionary"><strong v-if="store.readingDictionary">{{ store.readingDictionary.lemma }}</strong><span v-if="store.readingDictionary">{{ store.readingDictionary.meaningCn }}</span><small v-if="store.readingDictionary?.exampleText">{{ store.readingDictionary.exampleText }}</small><small v-if="store.readingDictionaryMessage">{{ store.readingDictionaryMessage }}</small></div></aside>
      <article class="article-panel v2-b3reading-article" :style="{ fontSize: `${fontSize}px` }"><div v-for="(block, index) in store.readingArticle.blocks" :key="block.blockId" class="block" :class="{ active: store.readingActiveBlock === index }" @click="store.readingActiveBlock = index"><p>{{ block.text }}</p><div v-if="block.tokens.length" class="token-buttons"><button v-for="token in block.tokens" :key="token.tokenId" type="button" @click.stop="void store.lookupReading(token.tokenId)">{{ token.text }}</button></div><p v-if="bilingual && block.translation" class="translation">{{ block.translation }}</p><div class="block-actions"><small><span class="v2-sr-only">{{ block.blockId }} · </span>第 {{ index + 1 }} 段 · {{ ui.t('b10.reading.lookup') }}</small><button type="button" @click.stop="void store.mineReading(block.blockId)">{{ store.minedBlocks.has(block.blockId) ? ui.t('b10.reading.mined') : ui.t('b10.reading.mine') }}</button></div></div><button class="primary-button" type="button" :disabled="store.readingActiveBlock >= store.readingArticle.blocks.length - 1" @click="next">{{ ui.t('b10.practice.next') }}</button><p v-if="readingPackNotice" class="pack-notice" data-pack-notice>{{ readingPackNotice }}</p><section v-if="store.readingQuestions.length" class="questions"><div class="question-heading"><h3>{{ ui.t('b10.reading.quiz') }}</h3><span>{{ ui.t('b10.common.noAnswerRule') }}</span></div><div v-for="question in store.readingQuestions" :key="question.questionId" class="question"><strong>{{ question.stemText }}</strong><label v-for="option in question.options" :key="option.key"><input v-model="store.readingAnswers[question.questionId]" type="radio" :name="`reading-${question.questionId}`" :value="option.key">{{ option.text }}</label><button class="secondary-button" type="button" :disabled="!store.readingAnswers[question.questionId]" @click="submitQuestion(question)">{{ ui.t('b10.reading.quizSubmit') }}</button><p v-if="readingFeedback(question.questionId)" class="feedback"><span data-save-receipt>{{ readingFeedback(question.questionId)?.savedReceipt }}</span> <span data-feedback-text>{{ readingFeedback(question.questionId)?.feedbackText }}</span> <span data-next-question>{{ readingFeedback(question.questionId)?.nextQuestion }}</span></p></div></section></article>
    </section>
    <section v-else-if="store.readingStatus === 'empty'" class="empty-panel v2-b3reading-empty"><strong>{{ ui.t('b10.reading.noArticle') }}</strong><p>{{ ui.t('b10.state.empty') }}</p></section>
    </div><aside class="v2-b3reading-tips" aria-label="练习提示"><h2>专注阅读</h2><ol><li>先通读全文，再逐段点词查义。</li><li>选好答案再提交，提交后看反馈。</li><li>离线操作会排队，联网后点同步。</li></ol></aside></div>
  </main>
</template>

<style scoped>
.b10-page{display:grid;gap:22px}.page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.page-heading h2{margin:8px 0;font-size:clamp(30px,5vw,48px);line-height:1.1}.page-heading p:not(.eyebrow){max-width:720px;margin:0;color:var(--yx-color-text-secondary);line-height:1.7}.eyebrow{margin:0;color:var(--yx-color-brand-primary);font-size:12px;font-weight:800;letter-spacing:.12em}.locale-pill{padding:9px 12px;border:1px solid var(--yx-color-border);border-radius:999px;color:var(--yx-color-text-secondary);font-size:12px}.reading-layout{display:grid;grid-template-columns:260px minmax(0,1fr);gap:20px}.side-panel,.article-panel,.empty-panel{padding:24px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.side-panel{display:grid;align-content:start;gap:14px;height:max-content}.side-panel h3{margin:0;font-size:22px}.side-panel small,.side-panel label{color:var(--yx-color-text-secondary)}.side-panel label{display:grid;gap:8px}.progress{height:8px;border-radius:99px;background:var(--yx-color-surface-muted);overflow:hidden}.progress span{display:block;height:100%;background:var(--yx-color-brand-primary)}.secondary-button,.primary-button{min-height:40px;padding:0 12px;border-radius:10px;font-weight:750}.secondary-button{border:1px solid var(--yx-color-border);color:var(--yx-color-brand-primary);background:var(--yx-color-surface-page)}.primary-button{border:0;color:var(--yx-color-text-on-brand);background:var(--yx-color-brand-primary)}button:disabled{cursor:wait;opacity:.55}.dictionary{display:grid;gap:5px;padding:12px;border-radius:12px;background:var(--yx-color-brand-primary-soft)}.dictionary span,.dictionary small{color:var(--yx-color-text-secondary);line-height:1.5}.article-panel{min-height:480px}.block{padding:14px 16px;border-left:3px solid transparent;cursor:pointer}.block.active{border-left-color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.block p{line-height:1.8}.translation{color:var(--yx-color-text-secondary)}.token-buttons{display:flex;flex-wrap:wrap;gap:6px}.token-buttons button{padding:4px 7px;border:0;border-bottom:2px solid var(--yx-color-brand-primary);color:var(--yx-color-brand-primary);background:var(--yx-color-surface-page)}.block-actions{display:flex;align-items:center;justify-content:space-between;gap:8px}.block-actions small{color:var(--yx-color-text-secondary);font-size:12px}.block-actions button{padding:7px 9px;border:0;border-radius:8px;color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft);font-size:12px}.questions{display:grid;gap:14px;margin-top:24px;padding-top:20px;border-top:1px solid var(--yx-color-border)}.question-heading{display:flex;justify-content:space-between;gap:12px;align-items:center}.question-heading h3{margin:0}.question-heading span{color:var(--yx-color-text-secondary);font-size:12px}.question{display:grid;gap:8px;padding:14px;border-radius:14px;background:var(--yx-color-surface-muted)}.question label{display:flex;gap:8px;align-items:flex-start;line-height:1.5}.question small{color:var(--yx-color-warning)}.question small.correct{color:var(--yx-color-success)}.empty-panel{min-height:160px}.empty-panel p{color:var(--yx-color-text-secondary)}
@media(max-width:760px){.page-heading{align-items:flex-start;flex-direction:column}.reading-layout{grid-template-columns:1fr}.side-panel{order:-1}.block-actions{align-items:flex-start;flex-direction:column}}
</style>

<style>
/* B3Reading v2 页面级样式（只做样式）：对齐 webDemo“专项练习会话（左主练习卡 + 右侧提示栏）”原型。
 * 选择器全部以 .v2-page--b3reading 开头；颜色只用 --v2-* tokens，不写死色值以适配暗色。 */
.v2-page--b3reading{background:var(--v2-bg);color:var(--v2-ink);font-family:var(--v2-font)}
.v2-page--b3reading .v2-b3reading-body{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:var(--v2-space-5);align-items:start}
.v2-page--b3reading .v2-b3reading-main{display:grid;gap:var(--v2-space-5);min-width:0}
.v2-page--b3reading .v2-b3reading-head{min-width:0}
.v2-page--b3reading .v2-b3reading-state{min-width:0}
.v2-page--b3reading .v2-b3reading-layout{display:grid;grid-template-columns:260px minmax(0,1fr);gap:var(--v2-space-5);align-items:start}
.v2-page--b3reading .v2-b3reading-side,.v2-page--b3reading .v2-b3reading-article,.v2-page--b3reading .v2-b3reading-empty,.v2-page--b3reading .v2-b3reading-tips{background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-6);min-width:0}
.v2-page--b3reading .v2-b3reading-side{display:grid;align-content:start;gap:var(--v2-space-4);height:max-content}
.v2-page--b3reading .v2-b3reading-side h3{margin:0;font-size:var(--v2-text-lg);color:var(--v2-ink)}
.v2-page--b3reading .v2-b3reading-side small,.v2-page--b3reading .v2-b3reading-side label{color:var(--v2-mut)}
.v2-page--b3reading .v2-b3reading-side label{display:grid;gap:var(--v2-space-2)}
.v2-page--b3reading .v2-b3reading-meta{margin:0;color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:800;letter-spacing:.12em}
.v2-page--b3reading .progress{height:6px;border-radius:var(--v2-radius-pill);background:var(--v2-surface);overflow:hidden}
.v2-page--b3reading .progress span{display:block;height:100%;background:var(--v2-brand)}
.v2-page--b3reading input[type="range"]{width:100%;accent-color:var(--v2-brand)}
.v2-page--b3reading .secondary-button{min-height:38px;padding:0 var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-sm);color:var(--v2-brand);background:var(--v2-soft);font-weight:750}
.v2-page--b3reading .secondary-button:disabled{opacity:.5}
.v2-page--b3reading .primary-button{min-height:40px;padding:0 var(--v2-space-3);border:0;border-radius:var(--v2-radius-sm);color:var(--v2-inverse);background:var(--v2-brand);font-weight:750}
.v2-page--b3reading .primary-button:hover:not(:disabled){background:var(--v2-brand2)}
.v2-page--b3reading .primary-button:disabled{opacity:.5}
.v2-page--b3reading .dictionary{display:grid;gap:var(--v2-space-1);padding:var(--v2-space-3);border-radius:var(--v2-radius-md);background:var(--v2-soft)}
.v2-page--b3reading .dictionary span,.v2-page--b3reading .dictionary small{color:var(--v2-mut);line-height:1.5}
.v2-page--b3reading .v2-b3reading-article{display:grid;gap:var(--v2-space-3);align-content:start;min-height:480px}
.v2-page--b3reading .block{padding:var(--v2-space-4);border-left:3px solid transparent;border-radius:var(--v2-radius-sm);cursor:pointer}
.v2-page--b3reading .block.active{border-left-color:var(--v2-brand);background:var(--v2-soft)}
.v2-page--b3reading .block p{margin:0;color:var(--v2-ink);line-height:1.8}
.v2-page--b3reading .translation{color:var(--v2-mut)}
.v2-page--b3reading .token-buttons{display:flex;flex-wrap:wrap;gap:var(--v2-space-2)}
.v2-page--b3reading .token-buttons button{padding:var(--v2-space-1) var(--v2-space-2);border:0;border-bottom:2px solid var(--v2-brand);color:var(--v2-brand);background:transparent}
.v2-page--b3reading .block-actions{display:flex;align-items:center;justify-content:space-between;gap:var(--v2-space-2)}
.v2-page--b3reading .block-actions small{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b3reading .block-actions button{padding:var(--v2-space-2);border:0;border-radius:var(--v2-radius-sm);color:var(--v2-brand);background:var(--v2-soft);font-size:var(--v2-text-xs)}
.v2-page--b3reading .questions{display:grid;gap:var(--v2-space-4);margin-top:var(--v2-space-6);padding-top:var(--v2-space-5);border-top:1px solid var(--v2-line)}
.v2-page--b3reading .question-heading{display:flex;justify-content:space-between;gap:var(--v2-space-3);align-items:center}
.v2-page--b3reading .question-heading h3{margin:0;font-size:var(--v2-text-md);color:var(--v2-ink)}
.v2-page--b3reading .question-heading span{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b3reading .question{display:grid;gap:var(--v2-space-2);padding:var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface)}
.v2-page--b3reading .question strong{color:var(--v2-ink)}
.v2-page--b3reading .question label{display:flex;gap:var(--v2-space-2);align-items:flex-start;color:var(--v2-ink);line-height:1.5}
.v2-page--b3reading .question input{accent-color:var(--v2-brand)}
.v2-page--b3reading .feedback{margin:0;padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-sm);color:var(--v2-ok);background:var(--v2-ok-soft);line-height:1.6}
.v2-page--b3reading .pack-notice{margin:0;padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-sm);color:var(--v2-brand);background:var(--v2-soft);line-height:1.6}
.v2-page--b3reading .v2-b3reading-empty strong{color:var(--v2-ink)}
.v2-page--b3reading .v2-b3reading-empty p{color:var(--v2-mut)}
.v2-page--b3reading .v2-b3reading-tips{position:sticky;top:24px;display:grid;align-content:start;gap:var(--v2-space-3)}
.v2-page--b3reading .v2-b3reading-tips h2{margin:0;font-size:var(--v2-text-lg);color:var(--v2-ink)}
.v2-page--b3reading .v2-b3reading-tips ol{margin:0;padding-left:var(--v2-space-5);color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.7}
.v2-page--b3reading button:focus-visible,.v2-page--b3reading .block:focus-visible,.v2-page--b3reading input:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
@media(max-width:1190px){.v2-page--b3reading .v2-b3reading-body{grid-template-columns:minmax(0,1fr) 250px}.v2-page--b3reading .v2-b3reading-layout{grid-template-columns:220px minmax(0,1fr)}}
@media(max-width:900px){.v2-page--b3reading .v2-b3reading-body{grid-template-columns:1fr}.v2-page--b3reading .v2-b3reading-tips{position:static}.v2-page--b3reading .v2-b3reading-layout{grid-template-columns:1fr}.v2-page--b3reading .v2-b3reading-side{order:-1;height:auto}.v2-page--b3reading .block-actions{flex-direction:column;align-items:flex-start}}
</style>
