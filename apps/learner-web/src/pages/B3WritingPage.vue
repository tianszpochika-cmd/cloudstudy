<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { listProofreadingExercises, listWritingHistory, listWritingMaterials, listWritingTemplates, submitCorrection } from '../api/b3'
import type { ProofreadingIssue, WritingHistoryItem, WritingMaterial, WritingTemplate } from '../domain/b3'
import { useB3Store } from '../stores/b3'

const store = useB3Store()
const answer = ref('')
const submitted = ref(false)
const templates = ref<WritingTemplate[]>([])
const materials = ref<WritingMaterial[]>([])
const proofreading = ref<ProofreadingIssue[]>([])
const history = ref<WritingHistoryItem[]>([])
const correctionAnswer = ref('')
const correctionResult = ref<Record<string, unknown> | null>(null)
const prompt = computed(() => store.writingPrompts[0] ?? null)

onMounted(async () => { await store.loadWriting(); try { [templates.value, materials.value, proofreading.value, history.value] = await Promise.all([listWritingTemplates(), listWritingMaterials(), listProofreadingExercises(), listWritingHistory()]) } catch { /* 主题资料失败不覆盖已加载的规则题 */ } })
onUnmounted(() => store.dispose())
async function submit(): Promise<void> { if (!prompt.value || !answer.value.trim()) return; submitted.value = false; await store.evaluateWriting(answer.value); submitted.value = Boolean(store.writingEvaluation) }
async function correct(): Promise<void> { const issue = proofreading.value[0]; if (!issue || !correctionAnswer.value.trim()) return; correctionResult.value = await submitCorrection(issue.promptId, correctionAnswer.value) }
</script>

<template>
  <p class="performance-note">性能档位：{{ store.performanceLevel }} · Performance 模式保留输入、规则反馈和改错</p>
  <section class="b3-page">
    <div class="hero"><p class="eyebrow">B3 · WRITING RUBRIC</p><h2>写出来，再看规则命中了哪些点。</h2><p>汉译英、模板写作和改错共享版本化采分点；Phase 1 不调用生成式评分。</p></div>
    <div v-if="store.status === 'loading'" class="panel">正在读取写作题目…</div>
    <div v-else-if="store.status === 'error' || store.status === 'offline'" class="panel error">{{ store.message }}<button type="button" @click="store.loadWriting">重新读取</button></div>
    <div v-else-if="prompt" class="writing-grid">
      <article class="panel prompt-panel"><p class="eyebrow">{{ prompt.promptType }} · {{ prompt.contentVersionId }}</p><h3>{{ prompt.title }}</h3><p>{{ prompt.taskText }}</p><div class="targets"><span v-for="target in prompt.targetStructure" :key="target">{{ target }}</span></div><h4>可用模板</h4><button v-for="template in templates" :key="template.templateId" class="template" type="button">{{ template.title }}<small>{{ template.structure.map((slot) => slot.label).join(' → ') }}</small></button><h4>主题材料</h4><p v-for="material in materials" :key="material.materialId" class="material">{{ material.title }}：{{ material.bodyText }}</p></article>
      <article class="panel answer-panel"><label for="b3-writing-answer">你的答案</label><textarea id="b3-writing-answer" v-model="answer" rows="8" placeholder="输入答案；服务端会按规则采分点返回反馈。"></textarea><button type="button" :disabled="!answer.trim()" @click="submit">提交规则评测</button><div v-if="submitted && store.writingEvaluation" class="result"><strong>{{ store.writingEvaluation.band }} · {{ Math.round(store.writingEvaluation.score) }} 分</strong><span>规则版本：{{ store.writingEvaluation.ruleVersion }}</span><span>命中采分点：{{ store.writingEvaluation.matchedPointCodes.join('、') || '暂无' }}</span><small>AI 评分：不可用（Phase 1 规则评测）</small></div><h4>改错规则卡</h4><div v-for="issue in proofreading" :key="issue.issueId" class="proofreading"><strong>{{ issue.errorType }}</strong><span>{{ issue.explanation }}</span><small>待改文本：{{ issue.wrongText }}</small><input v-if="issue === proofreading[0]" v-model="correctionAnswer" placeholder="输入改正后的句子"><button v-if="issue === proofreading[0]" type="button" :disabled="!correctionAnswer.trim()" @click="correct">提交改错</button></div><div v-if="correctionResult" class="result"><strong>{{ correctionResult.correct ? '改错正确' : '需要再练一次' }}</strong><span>{{ correctionResult.feedbackCode }}</span></div><h4>历史反馈</h4><div v-for="item in history" :key="item.submissionId" class="history"><strong>{{ item.band }} · {{ Math.round(item.score) }} 分</strong><span>{{ item.promptTitle || `题目 ${item.promptId}` }} · {{ item.matchedPointCodes.join('、') || '暂无命中采分点' }}</span></div></article>
    </div>
    <div v-else class="panel">服务端没有返回写作题目，未使用本地样例填充。</div>
  </section>
</template>

<style scoped>
.b3-page{display:grid;gap:24px}.hero{padding:32px;border-radius:28px;background:linear-gradient(135deg,#5b2947,#c06c84);color:#fff}.hero h2{margin:8px 0;font-size:clamp(28px,4vw,46px)}.hero p:last-child{max-width:680px;line-height:1.7;color:#ffe7ef}.eyebrow{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#7b83a1}.hero .eyebrow{color:#ffd0df}.writing-grid{display:grid;grid-template-columns:.9fr 1.1fr;gap:20px}.panel{padding:24px;border-radius:22px;background:#fff;box-shadow:0 16px 40px #1f2b4b0d}.prompt-panel h3{font-size:28px}.prompt-panel p{line-height:1.8;color:#555d75}.targets{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}.targets span{padding:8px 12px;border-radius:99px;background:#fff0f4;color:#9e4f6b}.template{display:grid;gap:4px;width:100%;margin:6px 0;padding:10px;border:0;border-radius:10px;background:#fff4f6;text-align:left;color:#8d4762}.template small{color:#b1798c}.material{padding:10px;border-left:3px solid #c06c84;background:#fff8fa;font-size:13px}.answer-panel{display:grid;gap:14px}.answer-panel label{font-weight:700}.answer-panel textarea{width:100%;box-sizing:border-box;padding:14px;border:1px solid #dfe3ef;border-radius:12px;resize:vertical;font:inherit}.answer-panel button{padding:12px 16px;border:0;border-radius:12px;background:#bd6682;color:#fff;cursor:pointer}.answer-panel button:disabled{opacity:.45;cursor:not-allowed}.result{display:grid;gap:5px;padding:16px;border-radius:14px;background:#fff2f5;color:#8f4461}.result small{color:#9a7382}.proofreading{display:grid;gap:4px;padding:12px;border-radius:12px;background:#f7f6ff;color:#5e5285}.proofreading small{color:#817a9e}.proofreading input{margin-top:8px;padding:10px;border:1px solid #ddd8ee;border-radius:10px}.history{display:grid;gap:4px;padding:10px;border-radius:10px;background:#fff8fa;color:#7e4560}.history span{font-size:13px;color:#967c89}.error{display:flex;align-items:center;gap:16px;color:#a13b4b}.error button{margin-left:auto}@media(max-width:760px){.writing-grid{grid-template-columns:1fr}.hero{padding:24px}}
</style>
