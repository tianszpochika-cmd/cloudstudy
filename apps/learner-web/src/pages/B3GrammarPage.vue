<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { computed, onMounted, ref, watch } from 'vue'
import B10PracticeQuestion from '../components/b10/B10PracticeQuestion.vue'
import B10StatePanel from '../components/b10/B10StatePanel.vue'
import CanonicalBridge from '../components/CanonicalBridge.vue'
import { useLearningUi } from '../platform/learning-ui'
import { useB10Store } from '../stores/b10'
import type { B10GrammarExercise, B10PerformanceLevel } from '../domain/b10'
import { packNotice } from '../domain/grammar-reading-pack'
import { practiceFeedback } from '../domain/practice-loop'

import '../platform/b10-i18n'

const ui = useLearningUi()
const store = useB10Store()
const graphEnabled = computed(() => store.performanceLevel !== 'Performance')
const orderedBlocks = ref<string[]>([])
const slotValues = ref<Record<string, string>>({})
const exerciseAnswer = ref<unknown>(undefined)
const selectedExercise = computed(() => store.selectedGrammarExercises[0] ?? null)
const grammarPackNotice = computed(() => packNotice('GRAMMAR', store.selectedGrammarExercises.length, store.grammarMessage))
const grammarFeedbackView = computed(() => store.grammarFeedback ? practiceFeedback({
  correct: store.grammarFeedback.correct,
  savedReceipt: store.grammarFeedback.savedReceipt,
  feedbackText: store.grammarFeedback.feedbackText,
  nextQuestion: store.grammarFeedback.nextQuestion,
  scoreBucket: store.grammarFeedback.scoreBucket,
}) : null)
const exerciseCanSubmit = computed(() => {
  const answer = exerciseAnswer.value
  return typeof answer === 'string' ? answer.trim().length > 0 : Array.isArray(answer) ? answer.length > 0 : answer !== undefined && answer !== null
})

watch(() => store.grammarSentence, (value) => {
  if (!value) { orderedBlocks.value = []; slotValues.value = {}; return }
  const fallbackOrder = value.blockOrder.length ? value.blockOrder : value.nodes.map((node) => node.nodeId)
  orderedBlocks.value = store.grammarBlockOrder(value.sentenceId, fallbackOrder)
  slotValues.value = store.grammarImitationSlots(value.sentenceId, value.imitationSlots)
}, { immediate: true })
watch(orderedBlocks, (value) => { if (store.grammarSentence) store.saveGrammarBlockOrder(store.grammarSentence.sentenceId, value) }, { deep: true })
watch(slotValues, (value) => { if (store.grammarSentence) store.saveGrammarImitationSlots(store.grammarSentence.sentenceId, value) }, { deep: true })
watch(() => selectedExercise.value?.exerciseId, (exerciseId) => { exerciseAnswer.value = exerciseId === undefined ? undefined : store.grammarExerciseAnswer(exerciseId) }, { immediate: true })

onMounted(() => { store.restore(); void store.loadGrammar() })
function retry(): void { void store.loadGrammar() }
function sync(): void { void store.syncOffline() }
function performance(level: B10PerformanceLevel): void { store.setPerformanceLevel(level) }
function blockLabel(blockId: string): string {
  const node = store.grammarSentence?.nodes.find((item) => item.nodeId === blockId || item.role.toLowerCase() === blockId.toLowerCase())
  return node?.text ?? blockId
}
function moveBlock(index: number, delta: number): void { const target = index + delta; if (target < 0 || target >= orderedBlocks.value.length) return; const next = [...orderedBlocks.value]; [next[index], next[target]] = [next[target], next[index]]; orderedBlocks.value = next }
function dragStart(index: number, event: DragEvent): void { event.dataTransfer?.setData('text/plain', String(index)); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move' }
function dropBlock(index: number, event: DragEvent): void { const source = Number(event.dataTransfer?.getData('text/plain')); if (Number.isInteger(source)) { const next = [...orderedBlocks.value]; const [moved] = next.splice(source, 1); if (moved) next.splice(index, 0, moved); orderedBlocks.value = next } }
function submitOrder(): void { void store.submitSentenceOrder(orderedBlocks.value) }
function setExerciseAnswer(value: unknown): void { exerciseAnswer.value = value; if (selectedExercise.value) store.saveGrammarExerciseAnswer(selectedExercise.value.exerciseId, value) }
function submitExercise(exercise: B10GrammarExercise): void { if (exerciseCanSubmit.value) void store.submitGrammarExercise(exercise, exerciseAnswer.value) }
function submitImitation(): void { void store.submitImitation(slotValues.value) }
</script>

<template>
<section class="b10-page v2-page v2-page--b3grammar" :data-performance="store.performanceLevel" aria-labelledby="grammar-title">
    <ExperienceHeader class="v2-b3grammar-head" page="Grammar" icon="spark" title-id="grammar-title" />
    <B10StatePanel class="v2-b3grammar-state" v-if="store.grammarStatus !== 'ready' || store.grammarMessage" :status="store.grammarStatus" :message="store.grammarMessage" :queue-count="store.queueCount" module-label="GRM / GRAMMAR" :performance-level="store.performanceLevel" @retry="retry" @sync="sync" @performance="performance" />
    <div class="v2-b3grammar-body"><div class="v2-b3grammar-main">
    <section v-if="store.grammarPoints.length || store.selectedGrammarExercises.length" class="grammar-layout v2-b3grammar-layout">
      <aside v-if="store.grammarPoints.length" class="points-panel v2-b3grammar-points"><h3>{{ ui.t('b10.grammar.tree') }}</h3><button v-for="point in store.grammarPoints" :key="point.grammarPointId" type="button" class="point" :class="{ active: point.grammarPointId === store.selectedGrammarPointId }" @click="store.selectGrammarPoint(point.grammarPointId)"><span>{{ point.code }}</span><strong>{{ point.title }}</strong><small>{{ store.grammarMastery.find((item) => item.grammarPointId === point.grammarPointId)?.level ?? 'REVIEW' }}</small></button></aside>
      <article class="detail-panel"><div class="detail-heading"><div><p class="eyebrow">{{ store.selectedGrammarPoint?.code }}</p><h3>{{ store.selectedGrammarPoint?.title }}</h3><p>{{ store.selectedGrammarPoint?.ruleSummary }}</p></div><span v-if="store.selectedGrammarPoint">{{ ui.t('b10.common.version', { version: store.selectedGrammarPoint.contentVersionId }) }}</span></div><div class="tags"><span v-for="tag in store.selectedGrammarPoint?.trapTags ?? []" :key="tag">{{ tag }}</span></div>
<section v-if="store.grammarSentence" class="xray-section"><div class="section-heading"><div><p class="eyebrow">{{ ui.t('b10.grammar.xray') }}</p><h4>{{ store.grammarSentence.text }}</h4></div><span>{{ graphEnabled ? 'DAG' : ui.t('b10.grammar.linear') }}</span></div><p v-if="store.grammarSentence.translation" class="translation">{{ store.grammarSentence.translation }}</p><div v-if="graphEnabled && !store.grammarSentenceFallback" class="graph" role="img" aria-label="句法结构图"><svg viewBox="0 0 680 270" preserveAspectRatio="xMidYMid meet"><g v-for="(node, index) in store.grammarSentence.nodes" :key="node.nodeId" :transform="`translate(${20 + (index % 3) * 220}, ${26 + Math.floor(index / 3) * 78})`"><rect width="190" height="54" rx="12"></rect><text x="12" y="21">{{ node.role }}</text><text x="12" y="41">{{ node.text }}</text></g></svg></div><div v-else class="linear-graph"><span v-for="node in store.grammarSentence.nodes" :key="node.nodeId"><b>{{ node.role }}</b>{{ node.text }}</span><small>{{ store.grammarSentenceFallback ? ui.t('b10.reading.fallback') : ui.t('b10.grammar.performanceFallback') }}</small></div><div class="block-tools"><h4>句子块排序</h4><div class="block-list"><div v-for="(nodeId, index) in orderedBlocks" :key="nodeId" class="block" draggable="true" tabindex="0" @dragstart="dragStart(index, $event)" @dragover.prevent @drop="dropBlock(index, $event)" @keydown.up.prevent="moveBlock(index, -1)" @keydown.down.prevent="moveBlock(index, 1)"><span class="handle" aria-hidden="true">⠿</span><strong>{{ blockLabel(nodeId) }}</strong><button type="button" :aria-label="ui.t('b10.grammar.previous')" :disabled="index === 0" @click="moveBlock(index, -1)">↑</button><button type="button" :aria-label="ui.t('b10.grammar.next')" :disabled="index === orderedBlocks.length - 1" @click="moveBlock(index, 1)">↓</button></div></div><button class="secondary-button" type="button" @click="submitOrder">{{ ui.t('b10.grammar.checkOrder') }}</button><p v-if="store.blockFeedback" class="feedback">{{ store.blockFeedback.message ?? store.blockFeedback.feedbackCode }}</p></div></section>
<section v-else class="fallback-note"><strong>{{ ui.t('b10.grammar.linear') }}</strong><p>{{ store.grammarSentenceFallback ? ui.t('b10.reading.fallback') : ui.t('b10.grammar.performanceFallback') }}</p></section>
        <section v-if="Object.keys(store.grammarSentence?.imitationSlots ?? {}).length" class="imitation"><div class="section-heading"><div><p class="eyebrow">WRT · IMITATION</p><h4>{{ ui.t('b10.grammar.imitation') }}</h4></div><button class="secondary-button" type="button" @click="submitImitation">{{ ui.t('b10.grammar.imitationSubmit') }}</button></div><label v-for="(placeholder, key) in store.grammarSentence?.imitationSlots" :key="key"><span>{{ key }}</span><input v-model="slotValues[key]" :placeholder="placeholder"></label><p v-if="store.imitationFeedback" class="feedback">{{ store.imitationFeedback.message ?? store.imitationFeedback.feedbackCode }}</p></section>
        <p v-if="grammarPackNotice" class="pack-notice" data-pack-notice>{{ grammarPackNotice }}</p><section v-if="selectedExercise" class="exercise"><div class="section-heading"><div><p class="eyebrow">ASM · RULE PRACTICE</p><h4>{{ ui.t('b10.grammar.practice') }}</h4></div><button class="secondary-button" type="button" :disabled="!exerciseCanSubmit" @click="submitExercise(selectedExercise)">{{ ui.t('b10.grammar.submit') }}</button></div><B10PracticeQuestion :question="{ id: String(selectedExercise.exerciseId), type: selectedExercise.type === 'CHOICE' ? 'CHOICE' : selectedExercise.type === 'FILL_BLANK' && selectedExercise.options.length > 0 ? 'FILL_BLANK' : selectedExercise.type === 'SENTENCE_BUILD' ? 'DRAG_SORTER' : 'TRANSLATION', prompt: selectedExercise.promptText, helperText: selectedExercise.type === 'FILL_BLANK' && selectedExercise.options.length === 0 ? '填写空格后提交，由服务端规则判定。' : null, sentence: null, sourceText: null, placeholder: '输入规则答案', options: selectedExercise.options, tokens: selectedExercise.tokens, contentVersionId: selectedExercise.contentVersionId, contentLocale: selectedExercise.contentLocale }" :disabled="false" :performance-level="store.performanceLevel" :initial-answer="exerciseAnswer" @answer="setExerciseAnswer" /><p v-if="grammarFeedbackView" class="feedback"><span data-save-receipt>{{ grammarFeedbackView.savedReceipt }}</span> <span data-feedback-text>{{ grammarFeedbackView.feedbackText }}</span> <span data-next-question>{{ grammarFeedbackView.nextQuestion }}</span> <small v-if="store.grammarFeedback?.ruleVersion">· {{ store.grammarFeedback.ruleVersion }}</small></p></section>
      </article>
    </section>
    <section v-else-if="store.grammarStatus === 'empty'" class="empty-panel"><strong>{{ ui.t('b10.grammar.noTree') }}</strong><p>{{ ui.t('b10.state.empty') }}</p><CanonicalBridge :courses="[{ code: 'DEMO-P5-GRAMMAR-A1', title: 'Demo present simple', summary: 'Subject plus base verb for habits.', level: 'A1' }]" /></section>
    </div><aside class="v2-b3grammar-tips" aria-label="练习提示"><h2>专注语法</h2><ol><li>先选一个语法点，再做对应练习。</li><li>提交后看反馈，弄清对错的原因。</li></ol></aside></div>
  </section>
</template>

<style scoped>
.b10-page{display:grid;gap:22px}.page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.page-heading h2{margin:8px 0;font-size:clamp(30px,5vw,48px);line-height:1.1}.page-heading p:not(.eyebrow){max-width:720px;margin:0;color:var(--yx-color-text-secondary);line-height:1.7}.eyebrow{margin:0;color:var(--yx-color-brand-primary);font-size:12px;font-weight:800;letter-spacing:.12em}.locale-pill{padding:9px 12px;border:1px solid var(--yx-color-border);border-radius:999px;color:var(--yx-color-text-secondary);font-size:12px}.grammar-layout{display:grid;grid-template-columns:260px minmax(0,1fr);gap:20px}.points-panel,.detail-panel,.empty-panel{padding:24px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.points-panel{display:grid;align-content:start;gap:8px;height:max-content}.points-panel h3{margin:0 0 8px}.point{display:grid;gap:4px;width:100%;padding:13px;border:1px solid transparent;border-radius:12px;color:var(--yx-color-text-primary);background:transparent;text-align:left}.point:hover,.point.active{border-color:var(--yx-color-brand-primary);color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.point span,.point small{color:var(--yx-color-text-secondary);font-size:11px}.detail-panel{display:grid;gap:18px}.detail-heading{display:flex;justify-content:space-between;gap:16px}.detail-heading h3{margin:7px 0;font-size:28px}.detail-heading p:not(.eyebrow){margin:0;color:var(--yx-color-text-secondary);line-height:1.6}.detail-heading>span{color:var(--yx-color-text-secondary);font-size:12px}.tags{display:flex;flex-wrap:wrap;gap:8px}.tags span{padding:6px 10px;border-radius:99px;color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft);font-size:12px}.xray-section,.imitation,.exercise{display:grid;gap:12px;padding-top:16px;border-top:1px solid var(--yx-color-border)}.section-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.section-heading h4{margin:5px 0}.section-heading>span{color:var(--yx-color-text-secondary);font-size:12px}.translation{margin:0;color:var(--yx-color-text-secondary)}.graph{width:100%;overflow:auto;border-radius:14px;background:var(--yx-color-surface-muted)}.graph svg{display:block;min-width:580px;height:260px}.graph rect{fill:var(--yx-color-surface-card);stroke:var(--yx-color-brand-primary)}.graph text{fill:var(--yx-color-text-primary);font-size:13px}.linear-graph{display:grid;gap:8px}.linear-graph span{padding:10px;border-radius:10px;background:var(--yx-color-brand-primary-soft)}.linear-graph b{margin-right:8px;color:var(--yx-color-brand-primary)}.linear-graph small{color:var(--yx-color-text-secondary)}.block-tools{display:grid;gap:10px}.block-tools h4{margin:0}.block-list{display:grid;gap:8px}.block{display:grid;grid-template-columns:auto 1fr auto auto;gap:8px;align-items:center;padding:10px;border:1px solid var(--yx-color-border);border-radius:12px;background:var(--yx-color-surface-page);cursor:grab}.block:focus-visible{outline:2px solid var(--yx-color-focus)}.block button{border:0;border-radius:7px;color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.block button:disabled{opacity:.35}.handle{color:var(--yx-color-text-secondary)}.secondary-button{min-height:38px;padding:0 12px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-brand-primary);background:var(--yx-color-surface-page);font-weight:750}.fallback-note{padding:16px;border-radius:14px;background:var(--yx-color-surface-muted)}.fallback-note p{margin:7px 0 0;color:var(--yx-color-text-secondary)}.imitation label{display:grid;grid-template-columns:100px 1fr;gap:10px;align-items:center}.imitation label span{color:var(--yx-color-brand-primary);font-size:13px;font-weight:750}.imitation input{padding:10px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-text-primary);background:var(--yx-color-surface-page)}.feedback{margin:0;padding:10px 12px;border-radius:10px;color:var(--yx-color-success);background:var(--yx-color-surface-muted);line-height:1.6}.feedback small{color:var(--yx-color-text-secondary)}.empty-panel{min-height:160px}.empty-panel p{color:var(--yx-color-text-secondary)}
@media(max-width:760px){.page-heading{align-items:flex-start;flex-direction:column}.grammar-layout{grid-template-columns:1fr}.points-panel{order:-1}.detail-heading{align-items:flex-start;flex-direction:column}.imitation label{grid-template-columns:1fr}}
</style>

<style>
/* B3Grammar v2 页面级样式（只做样式）：对齐 webDemo“专项练习会话（左主练习卡 + 右侧提示栏）”原型。
 * 选择器全部以 .v2-page--b3grammar 开头；颜色只用 --v2-* tokens，不写死色值以适配暗色。 */
.v2-page--b3grammar{background:var(--v2-bg);color:var(--v2-ink);font-family:var(--v2-font)}
.v2-page--b3grammar .v2-b3grammar-body{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:var(--v2-space-5);align-items:start}
.v2-page--b3grammar .v2-b3grammar-main{display:grid;gap:var(--v2-space-5);min-width:0}
.v2-page--b3grammar .v2-b3grammar-state{min-width:0}
.v2-page--b3grammar .v2-b3grammar-layout{display:grid;grid-template-columns:260px minmax(0,1fr);gap:var(--v2-space-5);align-items:start}
.v2-page--b3grammar .v2-b3grammar-points,.v2-page--b3grammar .detail-panel,.v2-page--b3grammar .empty-panel,.v2-page--b3grammar .v2-b3grammar-tips{background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-6);min-width:0}
.v2-page--b3grammar .v2-b3grammar-points{display:grid;align-content:start;gap:var(--v2-space-2);height:max-content}
.v2-page--b3grammar .v2-b3grammar-points h3{margin:0 0 var(--v2-space-2);font-size:var(--v2-text-lg);color:var(--v2-ink)}
.v2-page--b3grammar .point{display:grid;gap:var(--v2-space-1);width:100%;padding:var(--v2-space-3);border:1px solid transparent;border-radius:var(--v2-radius-md);color:var(--v2-ink);background:transparent;text-align:left}
.v2-page--b3grammar .point:hover,.v2-page--b3grammar .point.active{border-color:var(--v2-brand);color:var(--v2-brand);background:var(--v2-soft)}
.v2-page--b3grammar .point span,.v2-page--b3grammar .point small{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b3grammar .detail-panel{display:grid;gap:var(--v2-space-5)}
.v2-page--b3grammar .detail-heading{display:flex;justify-content:space-between;gap:var(--v2-space-4)}
.v2-page--b3grammar .detail-heading h3{margin:var(--v2-space-1) 0;font-size:var(--v2-text-xl);color:var(--v2-ink)}
.v2-page--b3grammar .detail-heading p:not(.eyebrow){margin:0;color:var(--v2-mut);line-height:1.6}
.v2-page--b3grammar .detail-heading>span{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b3grammar .eyebrow{margin:0;color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:800;letter-spacing:.12em}
.v2-page--b3grammar .tags{display:flex;flex-wrap:wrap;gap:var(--v2-space-2)}
.v2-page--b3grammar .tags span{padding:var(--v2-space-1) var(--v2-space-3);border-radius:var(--v2-radius-pill);color:var(--v2-brand);background:var(--v2-soft);font-size:var(--v2-text-xs);font-weight:600}
.v2-page--b3grammar .xray-section,.v2-page--b3grammar .imitation,.v2-page--b3grammar .exercise{display:grid;gap:var(--v2-space-3);padding-top:var(--v2-space-4);border-top:1px solid var(--v2-line)}
.v2-page--b3grammar .section-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:var(--v2-space-3)}
.v2-page--b3grammar .section-heading h4{margin:var(--v2-space-1) 0;font-size:var(--v2-text-md);color:var(--v2-ink)}
.v2-page--b3grammar .section-heading>span{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b3grammar .translation{margin:0;color:var(--v2-mut)}
.v2-page--b3grammar .graph{width:100%;overflow:auto;border-radius:var(--v2-radius-md);background:var(--v2-surface)}
.v2-page--b3grammar .graph svg{display:block;min-width:580px;height:260px}
.v2-page--b3grammar .graph rect{fill:var(--v2-card);stroke:var(--v2-brand)}
.v2-page--b3grammar .graph text{fill:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b3grammar .linear-graph{display:grid;gap:var(--v2-space-2)}
.v2-page--b3grammar .linear-graph span{padding:var(--v2-space-3);border-radius:var(--v2-radius-sm);background:var(--v2-soft);color:var(--v2-ink)}
.v2-page--b3grammar .linear-graph b{margin-right:var(--v2-space-2);color:var(--v2-brand)}
.v2-page--b3grammar .linear-graph small{color:var(--v2-mut)}
.v2-page--b3grammar .block-tools{display:grid;gap:var(--v2-space-3)}
.v2-page--b3grammar .block-tools h4{margin:0;font-size:var(--v2-text-md);color:var(--v2-ink)}
.v2-page--b3grammar .block-list{display:grid;gap:var(--v2-space-2)}
.v2-page--b3grammar .block{display:grid;grid-template-columns:auto 1fr auto auto;gap:var(--v2-space-2);align-items:center;padding:var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-bg);cursor:grab}
.v2-page--b3grammar .block button{border:0;border-radius:var(--v2-radius-sm);color:var(--v2-brand);background:var(--v2-soft)}
.v2-page--b3grammar .block button:disabled{opacity:.35}
.v2-page--b3grammar .handle{color:var(--v2-mut)}
.v2-page--b3grammar .secondary-button{min-height:38px;padding:0 var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-sm);color:var(--v2-brand);background:var(--v2-soft);font-weight:750}
.v2-page--b3grammar .secondary-button:disabled{opacity:.5}
.v2-page--b3grammar button:focus-visible,.v2-page--b3grammar .block:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
.v2-page--b3grammar .fallback-note{padding:var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface)}
.v2-page--b3grammar .fallback-note p{margin:var(--v2-space-2) 0 0;color:var(--v2-mut)}
.v2-page--b3grammar .imitation label{display:grid;grid-template-columns:100px 1fr;gap:var(--v2-space-3);align-items:center}
.v2-page--b3grammar .imitation label span{color:var(--v2-brand);font-size:var(--v2-text-sm);font-weight:750}
.v2-page--b3grammar .imitation input{padding:var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-sm);color:var(--v2-ink);background:var(--v2-bg)}
.v2-page--b3grammar .feedback{margin:0;padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-sm);color:var(--v2-ok);background:var(--v2-ok-soft);line-height:1.6}
.v2-page--b3grammar .feedback small{color:var(--v2-mut)}
.v2-page--b3grammar .pack-notice{margin:0;padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-sm);color:var(--v2-brand);background:var(--v2-soft);line-height:1.6}
.v2-page--b3grammar .empty-panel p{color:var(--v2-mut)}
.v2-page--b3grammar .v2-b3grammar-tips{position:sticky;top:24px;display:grid;align-content:start;gap:var(--v2-space-3)}
.v2-page--b3grammar .v2-b3grammar-tips h2{margin:0;font-size:var(--v2-text-lg);color:var(--v2-ink)}
.v2-page--b3grammar .v2-b3grammar-tips ol{margin:0;padding-left:var(--v2-space-5);color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.7}
.v2-page--b3grammar progress{width:100%;height:6px;accent-color:var(--v2-brand)}
.v2-page--b3grammar [role="progressbar"]{height:6px;background:var(--v2-surface);border-radius:var(--v2-radius-pill);overflow:hidden}
@media(max-width:1190px){.v2-page--b3grammar .v2-b3grammar-body{grid-template-columns:minmax(0,1fr) 250px}.v2-page--b3grammar .v2-b3grammar-layout{grid-template-columns:220px minmax(0,1fr)}}
@media(max-width:900px){.v2-page--b3grammar .v2-b3grammar-body{grid-template-columns:1fr}.v2-page--b3grammar .v2-b3grammar-tips{position:static}.v2-page--b3grammar .v2-b3grammar-layout{grid-template-columns:1fr}.v2-page--b3grammar .v2-b3grammar-points{order:-1;height:auto}.v2-page--b3grammar .detail-heading{flex-direction:column;align-items:flex-start}.v2-page--b3grammar .imitation label{grid-template-columns:1fr}}
</style>
