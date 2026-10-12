<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import CanonicalBridge from '../components/CanonicalBridge.vue'
import { computed, onMounted, ref } from 'vue'
import { useLearningUi } from '../platform/learning-ui'
import { userFacingError } from '../platform/user-facing-error'
import { useB10Store } from '../stores/b10'
import type { B10ReadingQuestion } from '../domain/b10'
import '../platform/b11-i18n'

const ui = useLearningUi()
const store = useB10Store()
const fontSize = ref(18)
const showTranslation = ref(true)
const progress = computed(() => store.readingArticle?.blocks.length ? Math.round(((store.readingActiveBlock + 1) / store.readingArticle.blocks.length) * 100) : 0)
const statusTitle = computed(() => ['loading', 'empty', 'offline', 'error', 'forbidden', 'stale', 'recovering'].includes(store.readingStatus) ? ui.t(`b11.state.${store.readingStatus === 'stale' ? 'expired' : store.readingStatus}`) : ui.t('b11.state.ready'))
const displayMessage = computed(() => userFacingError(store.readingMessage, ui.t(`b11.state.${store.readingStatus === 'stale' ? 'expired' : store.readingStatus}`)))

onMounted(() => { store.restore(); void store.loadReading() })
function nextBlock(): void { const article = store.readingArticle; if (!article) return; const index = Math.min(article.blocks.length - 1, store.readingActiveBlock + 1); store.readingActiveBlock = index; const block = article.blocks[index]; if (block) void store.saveCurrentReadingProgress(block.blockId, Math.round(((index + 1) / article.blocks.length) * 100), index + 1) }
function selectBlock(index: number): void { store.readingActiveBlock = index; const article = store.readingArticle; const block = article?.blocks[index]; if (article && block) void store.saveCurrentReadingProgress(block.blockId, Math.round(((index + 1) / article.blocks.length) * 100), index + 1) }
function submitQuestion(question: B10ReadingQuestion): void { const answer = store.readingAnswers[question.questionId]; if (answer) void store.submitReadingQuestion(question, answer) }
</script>

<template>
  <section class="b11-page v2-page v2-page--b11reading" :data-performance="store.performanceLevel" aria-labelledby="b11-reading-title">
    <ExperienceHeader class="v2-b11reading-head" page="Reading" icon="book" title-id="b11-reading-title" />
    <section v-if="store.readingStatus !== 'ready' || store.queueCount" class="state-panel v2-b11reading-state" :class="`state-panel--${store.readingStatus}`" role="status" aria-live="polite"><div class="state-copy"><span class="eyebrow">阅读练习<span class="v2-sr-only">RDG / READING</span></span><strong>{{ statusTitle }}</strong><span>{{ displayMessage || (store.queueCount ? `${ui.t('b11.common.offline')} · ${store.queueCount}` : '') }}</span><small>{{ ui.t('b11.common.performance', { level: store.performanceLevel }) }}</small></div><div class="state-actions"><button v-if="['offline', 'error', 'forbidden', 'stale', 'recovering'].includes(store.readingStatus)" class="secondary-button" type="button" @click="void store.loadReading()">{{ ui.t('b11.common.retry') }}</button><button v-if="store.queueCount" class="secondary-button" type="button" @click="void store.syncOffline()">{{ ui.t('b11.common.sync') }}（{{ store.queueCount }}）</button><select :value="store.performanceLevel" aria-label="Performance level" @change="store.setPerformanceLevel(($event.target as HTMLSelectElement).value as 'Ultra' | 'High' | 'Medium' | 'Performance')"><option>Ultra</option><option>High</option><option>Medium</option><option>Performance</option></select></div></section>
    <div class="v2-b11reading-body"><div class="v2-b11reading-main"><section v-if="store.readingStatus === 'loading'" class="empty-panel v2-b11reading-empty" role="status">{{ ui.t('b11.state.loading') }}</section>
    <section v-else-if="store.readingStatus === 'empty'" class="empty-panel v2-b11reading-empty" role="status"><strong>{{ ui.t('b11.reading.noArticle') }}</strong><p>{{ ui.t('b11.state.empty') }}</p><CanonicalBridge :courses="[{ code: 'DEMO-P5-READ-A2', title: 'Demo morning routine', summary: 'A short graded paragraph.', level: 'A2' }]" /></section>
    <section v-else-if="!store.readingArticle" class="empty-panel v2-b11reading-empty" role="alert"><strong>{{ statusTitle }}</strong><p>{{ displayMessage }}</p></section>
    <section v-else class="reading-layout v2-b11reading-layout">
      <aside class="side-panel v2-b11reading-side"><p class="eyebrow v2-b11reading-meta">{{ store.readingArticle.cefrLevel }} · {{ store.readingArticle.estimatedMinutes }}分钟<span class="v2-sr-only">（{{ store.readingArticle.estimatedMinutes }}min）</span></p><h3>{{ store.readingArticle.title }}</h3><div class="progress" aria-label="阅读进度"><span :style="{ width: `${progress}%` }"></span></div><small>{{ progress }}% · {{ store.readingCached ? ui.t('b11.common.offline') : ui.t('b11.state.ready') }}</small><label class="font-control" for="reading-font-size">{{ ui.t('b11.reading.fontSize') }} <input id="reading-font-size" v-model.number="fontSize" type="range" min="14" max="32"><span>{{ fontSize }}像素<span class="v2-sr-only">（{{ fontSize }}px）</span></span></label><button class="secondary-button" type="button" @click="showTranslation = !showTranslation">{{ showTranslation ? ui.t('b11.reading.hideTranslation') : ui.t('b11.reading.bilingual') }}</button><button class="secondary-button" type="button" :disabled="!store.queueCount" @click="void store.syncOffline()">{{ ui.t('b11.common.sync') }}（{{ store.queueCount }}）</button><p class="privacy-note">{{ ui.t('b11.reading.ruleFeedback') }}</p></aside>
      <article class="article-panel v2-b11reading-article" :style="{ fontSize: `${fontSize}px` }"><div v-for="(block, index) in store.readingArticle.blocks" :key="block.blockId" class="block" :class="{ active: store.readingActiveBlock === index }" :aria-current="store.readingActiveBlock === index ? 'step' : undefined" role="button" tabindex="0" @click="selectBlock(index)" @keydown.enter.prevent="selectBlock(index)" @keydown.space.prevent="selectBlock(index)"><p>{{ block.text }}</p><p v-if="showTranslation && block.translation" class="translation">{{ block.translation }}</p><div v-if="block.tokens.length" class="tokens" aria-label="文本 token"><span v-for="token in block.tokens" :key="token.tokenId">{{ token.text }}</span></div><small><span class="v2-sr-only">{{ block.blockId }} · </span>第 {{ index + 1 }} 段 / 共 {{ store.readingArticle.blocks.length }} 段</small></div><button class="primary-button" type="button" :disabled="store.readingActiveBlock >= store.readingArticle.blocks.length - 1" @click="nextBlock">{{ ui.t('b11.reading.next') }}</button><section class="questions" aria-labelledby="reading-questions-title"><div class="question-heading"><h3 id="reading-questions-title">{{ ui.t('b11.reading.quiz') }}</h3><span>{{ ui.t('b11.common.phase1') }}</span></div><p v-if="!store.readingQuestions.length" class="muted">{{ ui.t('b11.reading.noQuestions') }}</p><div v-for="question in store.readingQuestions" :key="question.questionId" class="question"><strong>{{ question.stemText }}</strong><label v-for="option in question.options" :key="option.key"><input v-model="store.readingAnswers[question.questionId]" type="radio" :name="`b11-reading-${question.questionId}`" :value="option.key">{{ option.text }}</label><button class="secondary-button" type="button" :disabled="!store.readingAnswers[question.questionId]" @click="submitQuestion(question)">{{ ui.t('b11.reading.submit') }}</button><small v-if="store.readingResults[question.questionId]" class="feedback" :class="{ correct: store.readingResults[question.questionId].correct }">{{ store.readingResults[question.questionId].correct ? '✓' : '↺' }} · {{ store.readingResults[question.questionId].correct ? '正确' : '再试一次' }}<span class="v2-sr-only"> · {{ store.readingResults[question.questionId].feedbackCode }} · {{ store.readingResults[question.questionId].reviewSignal }}</span></small></div></section></article>
    </section>
    </div><aside class="v2-b11reading-rail" aria-label="练习提示"><h2>阅读练习</h2><ol><li>先通读全文，再逐段细读。</li><li>选好答案再提交，提交后看反馈。</li><li>离线操作会排队，联网后点同步。</li></ol></aside></div>
  </section>
</template>

<style scoped>
.b11-page{display:grid;gap:22px}.page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.page-heading h2{margin:8px 0;font-size:clamp(30px,5vw,48px);line-height:1.1}.page-heading p:not(.eyebrow){max-width:760px;margin:0;color:var(--yx-color-text-secondary);line-height:1.7}.eyebrow{margin:0;color:var(--yx-color-brand-primary);font-size:12px;font-weight:800;letter-spacing:.12em}.locale-pill{padding:8px 12px;border:1px solid var(--yx-color-border);border-radius:999px;color:var(--yx-color-text-secondary);font-size:12px}.state-panel{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;padding:15px 17px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.state-panel--offline,.state-panel--error,.state-panel--forbidden,.state-panel--stale,.state-panel--recovering{border-color:var(--yx-color-danger)}.state-copy{display:grid;gap:5px;min-width:240px}.state-copy>span:not(.eyebrow){color:var(--yx-color-text-secondary);line-height:1.5}.state-copy small{color:var(--yx-color-text-tertiary)}.state-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.state-actions select{min-height:38px;padding:0 9px;border:1px solid var(--yx-color-border);border-radius:10px;background:var(--yx-color-surface-page)}.reading-layout{display:grid;grid-template-columns:260px minmax(0,1fr);gap:20px}.side-panel,.article-panel,.empty-panel{padding:22px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.side-panel{display:grid;align-content:start;gap:13px;height:max-content}.side-panel h3{margin:0;font-size:22px}.side-panel small,.font-control{color:var(--yx-color-text-secondary)}.font-control{display:grid;gap:8px}.progress{height:8px;border-radius:999px;background:var(--yx-color-surface-muted);overflow:hidden}.progress span{display:block;height:100%;background:var(--yx-color-brand-primary)}.secondary-button,.primary-button{min-height:40px;padding:0 12px;border-radius:10px;font-weight:750}.secondary-button{border:1px solid var(--yx-color-border);color:var(--yx-color-brand-primary);background:var(--yx-color-surface-page)}.primary-button{border:0;color:var(--yx-color-text-on-brand);background:var(--yx-color-brand-primary)}button:disabled{cursor:not-allowed;opacity:.52}.privacy-note,.muted{margin:0;color:var(--yx-color-text-secondary);font-size:13px;line-height:1.6}.article-panel{min-height:500px}.block{padding:16px;border-left:3px solid transparent;cursor:pointer}.block.active{border-left-color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.block p{line-height:1.8}.translation{color:var(--yx-color-text-secondary)}.tokens{display:flex;flex-wrap:wrap;gap:6px}.tokens span{padding:3px 6px;border-bottom:2px solid var(--yx-color-brand-primary);color:var(--yx-color-brand-primary);font-size:.72em}.block small{color:var(--yx-color-text-tertiary);font-size:.68em}.questions{display:grid;gap:14px;margin-top:22px;padding-top:20px;border-top:1px solid var(--yx-color-border)}.question-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.question-heading h3{margin:0}.question-heading span{color:var(--yx-color-text-secondary);font-size:12px}.question{display:grid;gap:9px;padding:14px;border-radius:14px;background:var(--yx-color-surface-muted)}.question label{display:flex;gap:8px;align-items:flex-start;line-height:1.5}.feedback{color:var(--yx-color-warning)}.feedback.correct{color:var(--yx-color-success)}.empty-panel{min-height:140px}.empty-panel p{color:var(--yx-color-text-secondary)}
@media(max-width:760px){.page-heading{align-items:flex-start;flex-direction:column}.reading-layout{grid-template-columns:1fr}.side-panel{order:-1}.question-heading{align-items:flex-start;flex-direction:column}}
</style>

<style>
/* B11Reading v2 页面级样式（只做样式）：对齐 webDemo“专项练习会话（左主练习卡 + 右侧提示栏）”原型。
 * 选择器全部以 .v2-page--b11reading 开头；颜色只用 --v2-* tokens，不写死色值以适配暗色。 */
.v2-page--b11reading{background:var(--v2-bg);color:var(--v2-ink);font-family:var(--v2-font);display:grid;gap:var(--v2-space-5);align-items:start}
.v2-page--b11reading .v2-b11reading-head{min-width:0}
.v2-page--b11reading .v2-b11reading-body{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:var(--v2-space-5);align-items:start;min-width:0}
.v2-page--b11reading .v2-b11reading-main{display:grid;gap:var(--v2-space-5);min-width:0}
.v2-page--b11reading .v2-b11reading-state,.v2-page--b11reading .v2-b11reading-empty,.v2-page--b11reading .v2-b11reading-side,.v2-page--b11reading .v2-b11reading-article,.v2-page--b11reading .v2-b11reading-rail{background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-6);min-width:0}
.v2-page--b11reading .v2-b11reading-state{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--v2-space-4)}
.v2-page--b11reading .v2-b11reading-state .state-copy{display:grid;gap:var(--v2-space-1);min-width:240px}
.v2-page--b11reading .v2-b11reading-state .state-copy strong{color:var(--v2-ink)}
.v2-page--b11reading .v2-b11reading-state .state-copy span{color:var(--v2-mut);line-height:1.5}
.v2-page--b11reading .v2-b11reading-state .state-copy small{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b11reading .v2-b11reading-state .state-actions{display:flex;flex-wrap:wrap;align-items:center;gap:var(--v2-space-2)}
.v2-page--b11reading .eyebrow{margin:0;color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:800;letter-spacing:.12em}
.v2-page--b11reading .v2-b11reading-layout{display:grid;grid-template-columns:260px minmax(0,1fr);gap:var(--v2-space-5);align-items:start;min-width:0}
.v2-page--b11reading .v2-b11reading-side{display:grid;align-content:start;gap:var(--v2-space-3)}
.v2-page--b11reading .v2-b11reading-side h3{margin:0;font-size:var(--v2-text-lg);color:var(--v2-ink);line-height:1.4}
.v2-page--b11reading .v2-b11reading-meta{margin:0}
.v2-page--b11reading .v2-b11reading-side small{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b11reading .progress{height:6px;border-radius:var(--v2-radius-pill);background:var(--v2-surface);overflow:hidden}
.v2-page--b11reading .progress span{display:block;height:100%;background:var(--v2-brand)}
.v2-page--b11reading .font-control{display:grid;gap:var(--v2-space-2);color:var(--v2-mut);font-size:var(--v2-text-sm)}
.v2-page--b11reading .privacy-note{margin:0;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.6}
.v2-page--b11reading .v2-b11reading-article{display:grid;gap:var(--v2-space-4);align-content:start}
.v2-page--b11reading .block{display:grid;gap:var(--v2-space-2);padding:var(--v2-space-4);border-left:3px solid var(--v2-line);border-radius:var(--v2-radius-md);cursor:pointer}
.v2-page--b11reading .block p{margin:0;line-height:1.8;color:var(--v2-ink)}
.v2-page--b11reading .block.active{border-left-color:var(--v2-brand);background:var(--v2-soft)}
.v2-page--b11reading .translation{color:var(--v2-mut)}
.v2-page--b11reading .tokens{display:flex;flex-wrap:wrap;gap:var(--v2-space-2)}
.v2-page--b11reading .tokens span{padding:var(--v2-space-1) var(--v2-space-2);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700}
.v2-page--b11reading .block small{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b11reading .questions{display:grid;gap:var(--v2-space-4);padding-top:var(--v2-space-5);border-top:1px solid var(--v2-line)}
.v2-page--b11reading .question-heading{display:flex;align-items:center;justify-content:space-between;gap:var(--v2-space-3)}
.v2-page--b11reading .question-heading h3{margin:0;font-size:var(--v2-text-md);color:var(--v2-ink)}
.v2-page--b11reading .question-heading span{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b11reading .question{display:grid;gap:var(--v2-space-2);padding:var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface)}
.v2-page--b11reading .question strong{color:var(--v2-ink)}
.v2-page--b11reading .question label{display:flex;gap:var(--v2-space-2);align-items:flex-start;color:var(--v2-ink);line-height:1.5}
.v2-page--b11reading .muted{margin:0;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.6}
.v2-page--b11reading .feedback{color:var(--v2-warn);font-size:var(--v2-text-sm)}
.v2-page--b11reading .feedback.correct{color:var(--v2-ok)}
.v2-page--b11reading .primary-button{min-height:40px;padding:0 var(--v2-space-3);border:0;border-radius:var(--v2-radius-sm);background:var(--v2-brand);color:var(--v2-inverse);font-weight:750;cursor:pointer}
.v2-page--b11reading .primary-button:hover:not(:disabled){background:var(--v2-brand2)}
.v2-page--b11reading .primary-button:disabled{opacity:.5;cursor:not-allowed}
.v2-page--b11reading .secondary-button{min-height:38px;padding:0 var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-sm);background:var(--v2-soft);color:var(--v2-brand);font-weight:750;cursor:pointer}
.v2-page--b11reading .secondary-button:hover:not(:disabled){border-color:var(--v2-brand)}
.v2-page--b11reading .secondary-button:disabled{opacity:.5;cursor:not-allowed}
.v2-page--b11reading .state-actions select{min-height:38px;padding:0 var(--v2-space-2);border:1px solid var(--v2-line);border-radius:var(--v2-radius-sm);background:var(--v2-bg);color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b11reading .font-control input{accent-color:var(--v2-brand)}
.v2-page--b11reading .v2-b11reading-empty{display:grid;gap:var(--v2-space-2);align-content:start}
.v2-page--b11reading .v2-b11reading-empty strong{color:var(--v2-ink)}
.v2-page--b11reading .v2-b11reading-empty p{margin:0;color:var(--v2-mut);line-height:1.6}
.v2-page--b11reading .v2-b11reading-rail{position:sticky;top:var(--v2-space-6);display:grid;align-content:start;gap:var(--v2-space-3)}
.v2-page--b11reading .v2-b11reading-rail h2{margin:0;font-size:var(--v2-text-lg);color:var(--v2-ink)}
.v2-page--b11reading .v2-b11reading-rail ol{margin:0;padding-left:var(--v2-space-5);display:grid;gap:var(--v2-space-2);color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.7}
.v2-page--b11reading button:focus-visible,.v2-page--b11reading a:focus-visible,.v2-page--b11reading select:focus-visible,.v2-page--b11reading input:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
@media(max-width:1190px){.v2-page--b11reading .v2-b11reading-body{grid-template-columns:minmax(0,1fr) 250px}.v2-page--b11reading .v2-b11reading-layout{grid-template-columns:220px minmax(0,1fr)}}
@media(max-width:900px){.v2-page--b11reading .v2-b11reading-body{grid-template-columns:1fr}.v2-page--b11reading .v2-b11reading-layout{grid-template-columns:1fr}.v2-page--b11reading .v2-b11reading-rail{position:static}.v2-page--b11reading .question-heading{align-items:flex-start;flex-direction:column}}
</style>
