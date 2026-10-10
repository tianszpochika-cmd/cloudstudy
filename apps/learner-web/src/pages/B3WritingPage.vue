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
  <section class="b10-page" :data-performance="store.performanceLevel" aria-labelledby="writing-title">
    <ExperienceHeader page="Writing" icon="pen" title-id="writing-title" />
    <p data-closed-practice role="status">写作功能暂未开放，可以先做其他练习。</p>
    <a data-closed-back href="/today">回到可用学习</a>
    <B10StatePanel v-if="store.writingStatus !== 'ready' || store.writingMessage" :status="store.writingStatus" :message="store.writingMessage" module-label="WRT / WRITING" :performance-level="store.performanceLevel" @retry="retry" @performance="performance" />
    <section v-if="prompt" class="writing-layout">
      <article class="prompt-panel"><p class="eyebrow">{{ prompt.promptType }} · {{ prompt.contentVersionId }}</p><h3>{{ prompt.title }}</h3><p>{{ prompt.taskText }}</p><div class="tags"><span v-for="target in prompt.targetStructure" :key="target">{{ target }}</span></div><h4>可用模板</h4><button v-for="template in store.writingTemplates" :key="template.templateId" class="template" :class="{ active: selectedTemplateId === template.templateId }" type="button" @click="chooseTemplate(template.templateId)"><strong>{{ template.title }}</strong><small>{{ template.structure.map((slot) => slot.label).join(' → ') }}</small></button><h4>主题材料</h4><p v-for="material in store.writingMaterials" :key="material.materialId" class="material">{{ material.title }}：{{ material.bodyText }}</p></article>
      <article class="answer-panel"><label for="b10-writing-answer">{{ ui.t('b10.writing.draft') }}</label><textarea id="b10-writing-answer" v-model="draft" rows="11" placeholder="输入答案；断网时仍保留本地草稿。"></textarea><div class="draft-meta"><span>{{ ui.t('b10.writing.autoSaved') }}</span><span>{{ draft.length }} 字符</span></div><button class="primary-button" type="button" :disabled="!draft.trim() || store.writingSubmitting" @click="store.submitCurrentWriting">{{ store.writingSubmitting ? ui.t('b10.writing.submitting') : ui.t('b10.writing.submit') }}</button><section v-if="store.writingFeedback" class="feedback"><h4>{{ ui.t('b10.writing.feedback') }}</h4><strong>{{ store.writingFeedback.band ?? '—' }} · {{ store.writingFeedback.score ?? '—' }}</strong><p v-if="store.writingFeedback.message">{{ store.writingFeedback.message }}</p><small v-if="store.writingFeedback.ruleVersion">规则版本：{{ store.writingFeedback.ruleVersion }}</small><div v-for="item in store.writingFeedback.items" :key="item.code" class="feedback-item"><b>{{ item.code }} · {{ item.feedbackCode }}</b><span v-if="item.message">{{ item.message }}</span><small v-if="item.evidence">证据：{{ item.evidence }}</small></div></section><h4>{{ ui.t('b10.writing.proofreading') }}</h4><div v-for="issue in store.proofreadingExercises" :key="issue.issueId" class="proofreading"><strong>{{ issue.errorType }}</strong><span>{{ issue.wrongText }}</span><input v-if="issue === store.proofreadingExercises[0]" v-model="correctionAnswer" placeholder="输入改正后的句子"><button v-if="issue === store.proofreadingExercises[0]" class="secondary-button" type="button" :disabled="!correctionAnswer.trim()" @click="submitCorrection">{{ ui.t('b10.writing.proofreadingSubmit') }}</button></div><div v-if="store.proofreadingFeedback" class="feedback"><strong>{{ store.proofreadingFeedback.correct === false ? '需要再练一次' : '规则已反馈' }}</strong><p v-if="store.proofreadingFeedback.message">{{ store.proofreadingFeedback.message }}</p><small>{{ store.proofreadingFeedback.feedbackCode }}</small></div><h4>{{ ui.t('b10.writing.history') }}</h4><div v-for="item in store.writingHistory" :key="item.submissionId" class="history"><strong>{{ item.band ?? '—' }} · {{ item.score ?? '—' }}</strong><span>{{ historyPromptLabel(item.promptId, item.promptTitle) }} · {{ item.feedbackCode ?? '—' }}</span></div></article>
    </section>
    <section v-else-if="store.writingStatus === 'empty' || store.writingStatus === 'error' || store.writingStatus === 'offline'" class="empty-panel"><strong>{{ ui.t('b10.writing.noPrompt') }}</strong><p>{{ ui.t('b10.state.empty') }}</p><CanonicalBridge :courses="[{ code: 'DEMO-P5-SENT-B1', title: 'Demo sentence train', summary: 'Build one sentence at a time. 造句基础。', level: 'B1' }]" /></section>
  </section>
</template>

<style scoped>
.b10-page{display:grid;gap:22px}.page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.page-heading h2{margin:8px 0;font-size:clamp(30px,5vw,48px);line-height:1.1}.page-heading p:not(.eyebrow){max-width:720px;margin:0;color:var(--yx-color-text-secondary);line-height:1.7}.eyebrow{margin:0;color:var(--yx-color-brand-primary);font-size:12px;font-weight:800;letter-spacing:.12em}.locale-pill{padding:9px 12px;border:1px solid var(--yx-color-border);border-radius:999px;color:var(--yx-color-text-secondary);font-size:12px}.writing-layout{display:grid;grid-template-columns:.9fr 1.1fr;gap:20px}.prompt-panel,.answer-panel,.empty-panel{padding:24px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.prompt-panel h3{font-size:28px}.prompt-panel p{line-height:1.8;color:var(--yx-color-text-secondary)}.prompt-panel h4,.answer-panel h4{margin:18px 0 8px}.tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.tags span{padding:8px 12px;border-radius:99px;color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.template{display:grid;gap:5px;width:100%;margin:6px 0;padding:11px;border:1px solid transparent;border-radius:10px;color:var(--yx-color-text-primary);background:var(--yx-color-surface-muted);text-align:left}.template.active,.template:hover{border-color:var(--yx-color-brand-primary);color:var(--yx-color-brand-primary)}.template small,.material{color:var(--yx-color-text-secondary)}.material{padding:10px;border-left:3px solid var(--yx-color-brand-primary);background:var(--yx-color-surface-muted);font-size:13px}.answer-panel{display:grid;gap:13px}.answer-panel label{font-weight:750}.answer-panel textarea{width:100%;box-sizing:border-box;padding:14px;border:1px solid var(--yx-color-border);border-radius:12px;resize:vertical;color:var(--yx-color-text-primary);background:var(--yx-color-surface-page);font:inherit;line-height:1.6}.answer-panel textarea:focus,.answer-panel input:focus{outline:2px solid var(--yx-color-focus)}.draft-meta{display:flex;justify-content:space-between;color:var(--yx-color-text-secondary);font-size:12px}.primary-button,.secondary-button{min-height:42px;padding:0 14px;border-radius:10px;font-weight:750}.primary-button{border:0;color:var(--yx-color-text-on-brand);background:var(--yx-color-brand-primary)}.secondary-button{border:1px solid var(--yx-color-border);color:var(--yx-color-brand-primary);background:var(--yx-color-surface-page)}button:disabled{cursor:wait;opacity:.55}.feedback{display:grid;gap:7px;padding:15px;border-radius:14px;background:var(--yx-color-surface-muted)}.feedback h4{margin:0}.feedback p{margin:0;color:var(--yx-color-text-secondary);line-height:1.6}.feedback small,.feedback-item span,.feedback-item small,.history span{color:var(--yx-color-text-secondary);font-size:12px}.feedback-item{display:grid;gap:3px;padding:9px;border-top:1px solid var(--yx-color-border)}.proofreading{display:grid;gap:6px;padding:12px;border-radius:12px;background:var(--yx-color-surface-muted)}.proofreading span{color:var(--yx-color-text-secondary);line-height:1.5}.proofreading input{padding:10px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-text-primary);background:var(--yx-color-surface-page)}.history{display:grid;gap:4px;padding:10px;border-radius:10px;background:var(--yx-color-surface-muted)}.empty-panel{min-height:160px}.empty-panel p{color:var(--yx-color-text-secondary)}
@media(max-width:760px){.page-heading{align-items:flex-start;flex-direction:column}.writing-layout{grid-template-columns:1fr}}
</style>
