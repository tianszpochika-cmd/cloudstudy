<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { submitSentenceBlocks, submitSentenceImitation } from '../api/b3'
import type { SentenceGraph, SentenceSlice } from '../domain/b3'
import { useB3Store } from '../stores/b3'

const store = useB3Store()
const selected = ref(0)
const exerciseAnswer = ref('')
const draggedBlock = ref<string | null>(null)
const blockOrder = ref<string[]>([])
const slotValues = ref<Record<string, string>>({})
const blockFeedback = ref<Record<string, unknown> | null>(null)
const imitationFeedback = ref<Record<string, unknown> | null>(null)
const selectedExercise = computed(() => store.grammarExercises[0] ?? null)
const sentence = computed(() => store.sentence)
const slices = computed<SentenceSlice[]>(() => sentence.value?.slices ?? [])
const imitationSlots = computed(() => sentence.value?.imitationSlots ?? null)
const orderedBlocks = computed(() => blockOrder.value.map((id) => slices.value.find((item) => item.sliceId === id)).filter((item): item is SentenceSlice => Boolean(item)))
const graphEnabled = computed(() => store.performanceLevel !== 'Performance')
const nodePosition = (nodeId: string): { x: number; y: number } => {
  const index = Math.max(0, sentence.value?.nodes.findIndex((node) => node.nodeId === nodeId) ?? 0)
  return { x: 40 + (index % 3) * 205, y: 80 + Math.floor(index / 3) * 100 }
}

watch(sentence, (value: SentenceGraph | null) => {
  if (!value) return
  blockOrder.value = [...(value.blockOrder ?? value.slices?.map((item) => item.sliceId) ?? [])]
  slotValues.value = { ...(value.imitationSlots ?? {}) }
}, { immediate: true })

onMounted(() => { void store.loadGrammar() })
onUnmounted(() => store.dispose())

function submitExercise(): void {
  if (!selectedExercise.value || !exerciseAnswer.value.trim()) return
  void store.evaluateGrammar(selectedExercise.value.exerciseId, { value: exerciseAnswer.value })
}

function moveBlock(index: number, offset: number): void {
  const target = index + offset
  if (target < 0 || target >= blockOrder.value.length) return
  const next = [...blockOrder.value]
  ;[next[index], next[target]] = [next[target], next[index]]
  blockOrder.value = next
}

function dropBlock(targetId: string): void {
  if (!draggedBlock.value || draggedBlock.value === targetId) return
  const next = [...blockOrder.value]
  const from = next.indexOf(draggedBlock.value)
  const to = next.indexOf(targetId)
  if (from < 0 || to < 0) return
  next.splice(from, 1)
  next.splice(to, 0, draggedBlock.value)
  blockOrder.value = next
  draggedBlock.value = null
}

async function checkBlocks(): Promise<void> {
  if (!sentence.value || !blockOrder.value.length) return
  blockFeedback.value = await submitSentenceBlocks(sentence.value.sentenceId, blockOrder.value)
}

async function checkImitation(): Promise<void> {
  if (!sentence.value) return
  imitationFeedback.value = await submitSentenceImitation(sentence.value.sentenceId, slotValues.value)
}
</script>

<template>
  <section class="b3-page">
    <div class="hero"><p class="eyebrow">B3 · GRAMMAR X-RAY</p><h2>把长句拆开，找到规则。</h2><p>规则卡片、句法 DAG、可排序句子积木和仿写槽位共用版本化内容；错误会留下复习信号。</p></div>
    <div v-if="store.status === 'loading'" class="panel">正在读取服务端语法内容…</div>
    <div v-else-if="store.status === 'error' || store.status === 'offline'" class="panel error">{{ store.message }}<button type="button" @click="store.loadGrammar">重新读取</button></div>
    <div v-else class="grid">
      <article class="panel"><p class="eyebrow">规则卡片</p><button v-for="(point, index) in store.grammarPoints" :key="point.grammarPointId" class="list-item" :class="{ active: selected === index }" type="button" @click="selected = index"><span>{{ point.title }}</span><small>{{ point.cefrLevel }} · {{ point.code }}</small></button></article>
      <article v-if="store.grammarPoints[selected]" class="panel detail">
        <p class="eyebrow">{{ store.grammarPoints[selected].code }}</p><h3>{{ store.grammarPoints[selected].ruleFormula }}</h3><p>{{ store.grammarPoints[selected].meaningCn }}</p>
        <div class="examples"><span>The team has completed the project.</span><span>The team has not completed the project.</span></div>
        <div class="tags"><span v-for="tag in store.grammarPoints[selected].trapTags" :key="tag">易错：{{ tag }}</span></div>
        <div v-if="sentence" class="sentence">
          <strong>{{ sentence.text }}</strong><span>{{ sentence.translation }}</span>
          <div v-if="graphEnabled" class="dag" role="img" aria-label="句法有向无环图">
            <svg viewBox="0 0 660 210" preserveAspectRatio="xMidYMid meet">
              <defs><marker id="b3-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#7b83a1" /></marker></defs>
              <line v-for="edge in sentence.edges" :key="`${edge.fromNodeId}-${edge.toNodeId}`" :x1="nodePosition(edge.fromNodeId).x + 90" :y1="nodePosition(edge.fromNodeId).y + 26" :x2="nodePosition(edge.toNodeId).x" :y2="nodePosition(edge.toNodeId).y + 26" stroke="#9aa4bd" stroke-width="2" marker-end="url(#b3-arrow)" />
              <g v-for="node in sentence.nodes" :key="node.nodeId"><rect :x="nodePosition(node.nodeId).x" :y="nodePosition(node.nodeId).y" width="180" height="52" rx="12" fill="#eef0ff" stroke="#596bff" /><text :x="nodePosition(node.nodeId).x + 12" :y="nodePosition(node.nodeId).y + 20" fill="#596bff" font-size="11">{{ node.role }}</text><text :x="nodePosition(node.nodeId).x + 12" :y="nodePosition(node.nodeId).y + 39" fill="#202332" font-size="13">{{ node.text }}</text></g>
            </svg>
          </div>
          <div v-else class="fallback-graph"><span v-for="node in sentence.nodes" :key="node.nodeId"><b>{{ node.role }}</b> {{ node.text }}</span><small>Performance 模式：已降级为 2D 节点列表。</small></div>
          <small>{{ sentence.edges.length }} 条依存边 · DAG 已校验</small>
        </div>
        <div v-if="slices.length" class="blocks">
          <div class="section-heading"><div><p class="eyebrow">SENTENCE BLOCKS</p><h4>拖动或用箭头重排句子积木</h4></div><button type="button" @click="checkBlocks">提交顺序</button></div>
          <div class="block-list"><div v-for="(block, index) in orderedBlocks" :key="block.sliceId" class="block" draggable="true" @dragstart="draggedBlock = block.sliceId" @dragover.prevent @drop="dropBlock(block.sliceId)"><span class="handle">⋮⋮</span><span><b>{{ block.role }}</b>{{ block.text }}</span><button type="button" :disabled="index === 0" @click="moveBlock(index, -1)">↑</button><button type="button" :disabled="index === orderedBlocks.length - 1" @click="moveBlock(index, 1)">↓</button></div></div>
          <div v-if="blockFeedback" class="feedback">{{ blockFeedback.correct ? '顺序正确' : '需要调整' }} · {{ blockFeedback.feedbackCode }} · {{ blockFeedback.ruleVersion }}</div>
        </div>
        <div v-if="imitationSlots" class="imitation"><div class="section-heading"><div><p class="eyebrow">IMITATION</p><h4>按结构槽位仿写</h4></div><button type="button" @click="checkImitation">检查仿写</button></div><label v-for="(value, key) in imitationSlots" :key="key"><span>{{ key }}</span><input v-model="slotValues[key]" :placeholder="value"></label><div v-if="imitationFeedback" class="feedback">{{ imitationFeedback.structureMatched ? '结构匹配' : '仍有槽位需要复习' }} · {{ imitationFeedback.feedbackCode }}</div></div>
        <div v-if="selectedExercise" class="exercise"><p class="eyebrow">{{ selectedExercise.type }} · 规则练习</p><p>{{ selectedExercise.promptText }}</p><input v-model="exerciseAnswer" placeholder="填写服务端规则答案" @keyup.enter="submitExercise"><button type="button" :disabled="!exerciseAnswer.trim()" @click="submitExercise">提交练习</button><span v-if="store.grammarAttemptResult">{{ store.grammarAttemptResult.correct ? '规则命中' : '需要复习' }} · {{ store.grammarAttemptResult.feedbackCode }}</span></div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.b3-page{display:grid;gap:24px}.hero{padding:32px;border-radius:28px;background:linear-gradient(135deg,#17213b,#4b5fd2);color:#fff}.hero h2{margin:8px 0;font-size:clamp(28px,4vw,46px)}.hero p:last-child{max-width:680px;line-height:1.7;color:#dce3ff}.eyebrow{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#7b83a1}.hero .eyebrow{color:#b8c3ff}.grid{display:grid;grid-template-columns:minmax(240px,.8fr) minmax(320px,1.4fr);gap:20px}.panel{padding:24px;border-radius:22px;background:#fff;box-shadow:0 16px 40px #1f2b4b0d}.error{display:flex;gap:16px;align-items:center;color:#a13b4b}.error button{margin-left:auto}.list-item{display:grid;gap:4px;width:100%;padding:14px;border:0;border-radius:14px;background:transparent;text-align:left;cursor:pointer}.list-item:hover,.list-item.active{background:#eef0ff;color:#3e4fc5}.list-item small{color:#858ba1}.detail h3{font-size:28px}.examples{display:grid;gap:6px;padding:12px;border-radius:12px;background:#f6f8ff;color:#4e5b88}.tags{display:flex;flex-wrap:wrap;gap:8px}.tags span{padding:6px 10px;border-radius:99px;background:#f5f0ff;color:#7652a9}.sentence{display:grid;gap:12px;margin-top:26px;padding:18px;border-radius:16px;background:#f8f9fd}.sentence span{color:#6c7289}.dag{width:100%;overflow:auto;border-radius:14px;background:#fff}.dag svg{display:block;min-width:560px;height:210px}.fallback-graph{display:grid;gap:8px}.fallback-graph span{padding:10px;border-radius:10px;background:#eaf0ff}.fallback-graph b{color:#4d5bc4;margin-right:8px}.fallback-graph small{color:#7b83a1}.blocks,.imitation{display:grid;gap:12px;padding-top:12px}.section-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.section-heading h4{margin:5px 0}.section-heading button,.exercise button{padding:9px 12px;border:0;border-radius:10px;background:#596bff;color:#fff;cursor:pointer}.block-list{display:grid;gap:8px}.block{display:grid;grid-template-columns:auto 1fr auto auto;gap:9px;align-items:center;padding:10px;border:1px solid #dde2f0;border-radius:12px;background:#fff;cursor:grab}.block b{display:block;color:#596bff;font-size:11px}.block button{border:0;border-radius:7px;background:#f0f3ff;color:#596bff;cursor:pointer}.block button:disabled{opacity:.3}.handle{color:#99a1b8}.feedback{padding:10px;border-radius:10px;background:#edf9f4;color:#26745f}.imitation label{display:grid;grid-template-columns:100px 1fr;gap:8px;align-items:center}.imitation label span{color:#596bff;font-size:13px;font-weight:700}.imitation input,.exercise input{padding:10px;border:1px solid #cfe8dd;border-radius:10px}.exercise{display:grid;gap:8px;margin-top:18px;padding:16px;border-radius:16px;background:#eefaf5}.exercise button:disabled{opacity:.45}@media(max-width:760px){.grid{grid-template-columns:1fr}.hero{padding:24px}.imitation label{grid-template-columns:1fr}}
</style>
