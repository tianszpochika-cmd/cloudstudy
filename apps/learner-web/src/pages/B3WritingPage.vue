<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { computed, onMounted, ref } from 'vue'
import B10StatePanel from '../components/b10/B10StatePanel.vue'
import CanonicalBridge from '../components/CanonicalBridge.vue'
import { useLearningUi } from '../platform/learning-ui'
import { useB10Store } from '../stores/b10'
import type { B10PerformanceLevel } from '../domain/b10'

import '../platform/b10-i18n'

const ui = useLearningUi()
const store = useB10Store()
const prompt = computed(() => store.writingPrompts[0] ?? null)
const correctionAnswer = ref('')
const selectedTemplateId = ref<number | null>(null)
const draft = computed({ get: () => store.writingDraft, set: (value: string) => store.saveWritingDraft(value) })

onMounted(() => { store.restore(); void store.loadWriting() })
function retry(): void { void store.loadWriting() }
function performance(level: B10PerformanceLevel): void { store.setPerformanceLevel(level) }
function chooseTemplate(templateId: number): void {
  selectedTemplateId.value = templateId
  const template = store.writingTemplates.find((item) => item.templateId === templateId)
  if (template && !draft.value.trim()) draft.value = template.structure.map((slot) => `[${slot.label}]`).join('\n')
}
function historyPromptLabel(promptId: number, promptTitle: string | null): string {
  if (promptTitle) return promptTitle
  return store.writingPrompts.find((item) => item.promptId === promptId)?.title ?? `题目 ${promptId}`
}
function submitCorrection(): void { void store.submitCurrentProofreading(correctionAnswer.value) }
</script>

<template>
  <section class="b10-page v2-page v2-page--b3writing" :data-performance="store.performanceLevel" aria-labelledby="writing-title">
    <ExperienceHeader class="v2-b3writing-head" page="Writing" icon="pen" title-id="writing-title" />
    <p data-closed-practice role="status" class="v2-b3writing-closed">写作功能暂未开放，可以先做其他练习。</p>
    <a data-closed-back href="/today" class="v2-b3writing-back">回到可用学习</a>
    <B10StatePanel class="v2-b3writing-state" v-if="store.writingStatus !== 'ready' || store.writingMessage" :status="store.writingStatus" :message="store.writingMessage" module-label="WRT / WRITING" :performance-level="store.performanceLevel" @retry="retry" @performance="performance" />
    <div class="v2-b3writing-body"><div class="v2-b3writing-main">
    <section v-if="prompt" class="writing-layout v2-b3writing-layout">
      <article class="prompt-panel v2-b3writing-prompt"><p class="eyebrow v2-b3writing-meta">写作练习<span class="v2-sr-only">{{ prompt.promptType }} · {{ prompt.contentVersionId }}</span></p><h3>{{ prompt.title }}</h3><p>{{ prompt.taskText }}</p><div class="tags"><span v-for="target in prompt.targetStructure" :key="target">{{ target }}</span></div><h4>可用模板</h4><button v-for="template in store.writingTemplates" :key="template.templateId" class="template" :class="{ active: selectedTemplateId === template.templateId }" type="button" @click="chooseTemplate(template.templateId)"><strong>{{ template.title }}</strong><small>{{ template.structure.map((slot) => slot.label).join(' → ') }}</small></button><h4>主题材料</h4><p v-for="material in store.writingMaterials" :key="material.materialId" class="material">{{ material.title }}：{{ material.bodyText }}</p></article>
      <article class="answer-panel v2-b3writing-answer"><label for="b10-writing-answer">{{ ui.t('b10.writing.draft') }}</label><textarea id="b10-writing-answer" v-model="draft" rows="11" placeholder="输入答案；断网时仍保留本地草稿。"></textarea><div class="draft-meta"><span>{{ ui.t('b10.writing.autoSaved') }}</span><span>{{ draft.length }} 字符</span></div><button class="primary-button" type="button" :disabled="!draft.trim() || store.writingSubmitting" @click="store.submitCurrentWriting">{{ store.writingSubmitting ? ui.t('b10.writing.submitting') : ui.t('b10.writing.submit') }}</button><section v-if="store.writingFeedback" class="feedback"><h4>{{ ui.t('b10.writing.feedback') }}</h4><strong>{{ store.writingFeedback.band ?? '—' }} · {{ store.writingFeedback.score ?? '—' }}</strong><p v-if="store.writingFeedback.message">{{ store.writingFeedback.message }}</p><small v-if="store.writingFeedback.ruleVersion">规则版本：<span class="v2-sr-only">{{ store.writingFeedback.ruleVersion }}</span></small><div v-for="item in store.writingFeedback.items" :key="item.code" class="feedback-item"><b>分项反馈<span class="v2-sr-only">{{ item.code }} · {{ item.feedbackCode }}</span></b><span v-if="item.message">{{ item.message }}</span><small v-if="item.evidence">证据：{{ item.evidence }}</small></div></section><h4>{{ ui.t('b10.writing.proofreading') }}</h4><div v-for="issue in store.proofreadingExercises" :key="issue.issueId" class="proofreading"><strong>待改写句<span class="v2-sr-only">{{ issue.errorType }}</span></strong><span>{{ issue.wrongText }}</span><input v-if="issue === store.proofreadingExercises[0]" v-model="correctionAnswer" placeholder="输入改正后的句子"><button v-if="issue === store.proofreadingExercises[0]" class="secondary-button" type="button" :disabled="!correctionAnswer.trim()" @click="submitCorrection">{{ ui.t('b10.writing.proofreadingSubmit') }}</button></div><div v-if="store.proofreadingFeedback" class="feedback"><strong>{{ store.proofreadingFeedback.correct === false ? '需要再练一次' : '规则已反馈' }}</strong><p v-if="store.proofreadingFeedback.message">{{ store.proofreadingFeedback.message }}</p><small>已反馈<span class="v2-sr-only">{{ store.proofreadingFeedback.feedbackCode }}</span></small></div><h4>{{ ui.t('b10.writing.history') }}</h4><div v-for="item in store.writingHistory" :key="item.submissionId" class="history"><strong>{{ item.band ?? '—' }} · {{ item.score ?? '—' }}</strong><span>{{ historyPromptLabel(item.promptId, item.promptTitle) }}<span class="v2-sr-only"> · {{ item.feedbackCode ?? '—' }}</span></span></div></article>
    </section>
    <section v-else-if="store.writingStatus === 'empty' || store.writingStatus === 'error' || store.writingStatus === 'offline'" class="empty-panel v2-b3writing-empty"><strong>{{ ui.t('b10.writing.noPrompt') }}</strong><p>{{ ui.t('b10.state.empty') }}</p><CanonicalBridge :courses="[{ code: 'DEMO-P5-SENT-B1', title: 'Demo sentence train', summary: 'Build one sentence at a time. 造句基础。', level: 'B1' }]" /></section>
    </div><aside class="v2-b3writing-tips" aria-label="练习提示"><h2>专注写作</h2><ol><li>先读题目与材料，再选模板搭结构。</li><li>写完提交看反馈，对照修改再留存。</li><li>断网时草稿保留本地，联网后提交。</li></ol></aside></div>
  </section>
</template>

<style scoped>
.b10-page{display:grid;gap:22px}.page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.page-heading h2{margin:8px 0;font-size:clamp(30px,5vw,48px);line-height:1.1}.page-heading p:not(.eyebrow){max-width:720px;margin:0;color:var(--yx-color-text-secondary);line-height:1.7}.eyebrow{margin:0;color:var(--yx-color-brand-primary);font-size:12px;font-weight:800;letter-spacing:.12em}.locale-pill{padding:9px 12px;border:1px solid var(--yx-color-border);border-radius:999px;color:var(--yx-color-text-secondary);font-size:12px}.writing-layout{display:grid;grid-template-columns:.9fr 1.1fr;gap:20px}.prompt-panel,.answer-panel,.empty-panel{padding:24px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.prompt-panel h3{font-size:28px}.prompt-panel p{line-height:1.8;color:var(--yx-color-text-secondary)}.prompt-panel h4,.answer-panel h4{margin:18px 0 8px}.tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.tags span{padding:8px 12px;border-radius:99px;color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.template{display:grid;gap:5px;width:100%;margin:6px 0;padding:11px;border:1px solid transparent;border-radius:10px;color:var(--yx-color-text-primary);background:var(--yx-color-surface-muted);text-align:left}.template.active,.template:hover{border-color:var(--yx-color-brand-primary);color:var(--yx-color-brand-primary)}.template small,.material{color:var(--yx-color-text-secondary)}.material{padding:10px;border-left:3px solid var(--yx-color-brand-primary);background:var(--yx-color-surface-muted);font-size:13px}.answer-panel{display:grid;gap:13px}.answer-panel label{font-weight:750}.answer-panel textarea{width:100%;box-sizing:border-box;padding:14px;border:1px solid var(--yx-color-border);border-radius:12px;resize:vertical;color:var(--yx-color-text-primary);background:var(--yx-color-surface-page);font:inherit;line-height:1.6}.answer-panel textarea:focus,.answer-panel input:focus{outline:2px solid var(--yx-color-focus)}.draft-meta{display:flex;justify-content:space-between;color:var(--yx-color-text-secondary);font-size:12px}.primary-button,.secondary-button{min-height:42px;padding:0 14px;border-radius:10px;font-weight:750}.primary-button{border:0;color:var(--yx-color-text-on-brand);background:var(--yx-color-brand-primary)}.secondary-button{border:1px solid var(--yx-color-border);color:var(--yx-color-brand-primary);background:var(--yx-color-surface-page)}button:disabled{cursor:wait;opacity:.55}.feedback{display:grid;gap:7px;padding:15px;border-radius:14px;background:var(--yx-color-surface-muted)}.feedback h4{margin:0}.feedback p{margin:0;color:var(--yx-color-text-secondary);line-height:1.6}.feedback small,.feedback-item span,.feedback-item small,.history span{color:var(--yx-color-text-secondary);font-size:12px}.feedback-item{display:grid;gap:3px;padding:9px;border-top:1px solid var(--yx-color-border)}.proofreading{display:grid;gap:6px;padding:12px;border-radius:12px;background:var(--yx-color-surface-muted)}.proofreading span{color:var(--yx-color-text-secondary);line-height:1.5}.proofreading input{padding:10px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-text-primary);background:var(--yx-color-surface-page)}.history{display:grid;gap:4px;padding:10px;border-radius:10px;background:var(--yx-color-surface-muted)}.empty-panel{min-height:160px}.empty-panel p{color:var(--yx-color-text-secondary)}
@media(max-width:760px){.page-heading{align-items:flex-start;flex-direction:column}.writing-layout{grid-template-columns:1fr}}
</style>

<style>
/* B3Writing v2 页面级样式（只做样式）：对齐 webDemo“专项练习会话（左主练习卡 + 右侧提示栏）”原型。
 * 选择器全部以 .v2-page--b3writing 开头；颜色只用 --v2-* tokens，不写死色值以适配暗色。 */
.v2-page--b3writing{background:var(--v2-bg);color:var(--v2-ink);font-family:var(--v2-font)}
.v2-page--b3writing .v2-b3writing-body{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:var(--v2-space-5);align-items:start}
.v2-page--b3writing .v2-b3writing-main{display:grid;gap:var(--v2-space-5);min-width:0}
.v2-page--b3writing .v2-b3writing-head{min-width:0}
.v2-page--b3writing .v2-b3writing-state{min-width:0}
.v2-page--b3writing .v2-b3writing-closed{margin:0;padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-soft);color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.6}
.v2-page--b3writing .v2-b3writing-back{width:max-content;color:var(--v2-brand);font-size:var(--v2-text-sm);font-weight:600}
.v2-page--b3writing .v2-b3writing-layout{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:var(--v2-space-5);align-items:start}
.v2-page--b3writing .v2-b3writing-prompt,.v2-page--b3writing .v2-b3writing-answer,.v2-page--b3writing .v2-b3writing-empty,.v2-page--b3writing .v2-b3writing-tips{background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-6);min-width:0}
.v2-page--b3writing .v2-b3writing-prompt{display:grid;gap:var(--v2-space-3);align-content:start}
.v2-page--b3writing .v2-b3writing-prompt h3{margin:0;font-size:var(--v2-text-xl);color:var(--v2-ink);line-height:1.3}
.v2-page--b3writing .v2-b3writing-prompt p{margin:0;color:var(--v2-mut);line-height:1.8}
.v2-page--b3writing .v2-b3writing-prompt h4{margin:var(--v2-space-4) 0 0;color:var(--v2-ink);font-size:var(--v2-text-md)}
.v2-page--b3writing .v2-b3writing-meta{margin:0;color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:800;letter-spacing:.12em}
.v2-page--b3writing .tags{display:flex;flex-wrap:wrap;gap:var(--v2-space-2);margin-top:var(--v2-space-2)}
.v2-page--b3writing .tags span{padding:var(--v2-space-2) var(--v2-space-3);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700}
.v2-page--b3writing .template{display:grid;gap:var(--v2-space-1);width:100%;margin:var(--v2-space-1) 0;padding:var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-ink);text-align:left}
.v2-page--b3writing .template strong{color:var(--v2-ink)}
.v2-page--b3writing .template small{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b3writing .template.active,.v2-page--b3writing .template:hover{border-color:var(--v2-brand);color:var(--v2-brand)}
.v2-page--b3writing .template.active strong,.v2-page--b3writing .template:hover strong{color:var(--v2-brand)}
.v2-page--b3writing .material{margin:0;padding:var(--v2-space-3);border-left:3px solid var(--v2-brand);border-radius:var(--v2-radius-sm);background:var(--v2-surface);color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.6}
.v2-page--b3writing .v2-b3writing-answer{display:grid;gap:var(--v2-space-3);align-content:start}
.v2-page--b3writing .v2-b3writing-answer h4{margin:var(--v2-space-4) 0 0;color:var(--v2-ink);font-size:var(--v2-text-md)}
.v2-page--b3writing .v2-b3writing-answer label{color:var(--v2-ink);font-weight:750}
.v2-page--b3writing .v2-b3writing-answer textarea{width:100%;box-sizing:border-box;padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-bg);color:var(--v2-ink);font:inherit;line-height:1.6;resize:vertical}
.v2-page--b3writing .v2-b3writing-answer input{padding:var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-sm);background:var(--v2-bg);color:var(--v2-ink)}
.v2-page--b3writing .draft-meta{display:flex;justify-content:space-between;gap:var(--v2-space-3);color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b3writing .primary-button{min-height:40px;padding:0 var(--v2-space-3);border:0;border-radius:var(--v2-radius-sm);background:var(--v2-brand);color:var(--v2-inverse);font-weight:750}
.v2-page--b3writing .primary-button:hover:not(:disabled){background:var(--v2-brand2)}
.v2-page--b3writing .primary-button:disabled{opacity:.5}
.v2-page--b3writing .secondary-button{min-height:38px;padding:0 var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-sm);background:var(--v2-soft);color:var(--v2-brand);font-weight:750}
.v2-page--b3writing .secondary-button:disabled{opacity:.5}
.v2-page--b3writing .feedback{display:grid;gap:var(--v2-space-2);padding:var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface)}
.v2-page--b3writing .feedback h4{margin:0}
.v2-page--b3writing .feedback p{margin:0;color:var(--v2-mut);line-height:1.6}
.v2-page--b3writing .feedback strong{color:var(--v2-ink)}
.v2-page--b3writing .feedback small{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b3writing .feedback-item{display:grid;gap:var(--v2-space-1);padding:var(--v2-space-3) 0;border-top:1px solid var(--v2-line)}
.v2-page--b3writing .feedback-item span,.v2-page--b3writing .feedback-item small{color:var(--v2-mut);font-size:var(--v2-text-xs);line-height:1.5}
.v2-page--b3writing .proofreading{display:grid;gap:var(--v2-space-2);padding:var(--v2-space-3);border-radius:var(--v2-radius-md);background:var(--v2-surface)}
.v2-page--b3writing .proofreading span{color:var(--v2-mut);line-height:1.5}
.v2-page--b3writing .history{display:grid;gap:var(--v2-space-1);padding:var(--v2-space-3);border-radius:var(--v2-radius-md);background:var(--v2-surface)}
.v2-page--b3writing .history span{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b3writing .progress{height:6px;border-radius:var(--v2-radius-pill);background:var(--v2-surface);overflow:hidden}
.v2-page--b3writing .progress span{display:block;height:100%;background:var(--v2-brand)}
.v2-page--b3writing .v2-b3writing-empty{display:grid;gap:var(--v2-space-2);align-content:start}
.v2-page--b3writing .v2-b3writing-empty strong{color:var(--v2-ink)}
.v2-page--b3writing .v2-b3writing-empty p{margin:0;color:var(--v2-mut);line-height:1.6}
.v2-page--b3writing .v2-b3writing-tips{position:sticky;top:var(--v2-space-6);display:grid;align-content:start;gap:var(--v2-space-3)}
.v2-page--b3writing .v2-b3writing-tips h2{margin:0;font-size:var(--v2-text-lg);color:var(--v2-ink)}
.v2-page--b3writing .v2-b3writing-tips ol{margin:0;padding-left:var(--v2-space-5);color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.7}
.v2-page--b3writing button:focus-visible,.v2-page--b3writing a:focus-visible,.v2-page--b3writing input:focus-visible,.v2-page--b3writing textarea:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
@media(max-width:1190px){.v2-page--b3writing .v2-b3writing-body{grid-template-columns:minmax(0,1fr) 250px}.v2-page--b3writing .v2-b3writing-layout{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
@media(max-width:900px){.v2-page--b3writing .v2-b3writing-body{grid-template-columns:1fr}.v2-page--b3writing .v2-b3writing-tips{position:static}.v2-page--b3writing .v2-b3writing-layout{grid-template-columns:1fr}}
</style>
