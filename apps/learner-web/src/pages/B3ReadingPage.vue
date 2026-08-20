<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { createReadingMining, getDictionaryEntry, listReadingQuestions, submitReadingAttempt } from '../api/b3'
import type { DictionaryEntry, ReadingAttemptResult, ReadingQuestion } from '../domain/b3'
import { useB3Store } from '../stores/b3'

const store = useB3Store()
const fontSize = ref(18)
const bilingual = ref(true)
const activeBlock = ref(0)
const dictionary = ref<DictionaryEntry | null>(null)
const dictionaryMessage = ref<string | null>(null)
const questions = ref<ReadingQuestion[]>([])
const questionAnswers = ref<Record<number, string>>({})
const attemptResults = ref<Record<number, ReadingAttemptResult>>({})
const minedBlocks = ref<Set<string>>(new Set())
const progress = computed(() => store.article?.blocks.length ? Math.round((activeBlock.value + 1) / store.article.blocks.length * 100) : 0)

onMounted(async () => { await store.loadReading(); if (store.article) { try { questions.value = await listReadingQuestions(store.article.articleId) } catch { questions.value = [] } } })
onUnmounted(() => store.dispose())
async function lookup(tokenId: string): Promise<void> { if (!store.article) return; dictionaryMessage.value = null; try { dictionary.value = await getDictionaryEntry(store.article.articleId, tokenId) } catch (error) { dictionary.value = null; dictionaryMessage.value = error instanceof Error ? error.message : '词典暂时不可用。' } }
function next(): void { if (!store.article) return; activeBlock.value = Math.min(store.article.blocks.length - 1, activeBlock.value + 1); void store.saveProgress(store.article.articleId, store.article.blocks[activeBlock.value].blockId, progress.value, activeBlock.value + 1) }
async function submitQuestion(question: ReadingQuestion): Promise<void> { if (!questionAnswers.value[question.questionId] || !store.article) return; attemptResults.value[question.questionId] = await submitReadingAttempt(question.questionId, questionAnswers.value[question.questionId]) }
async function mine(blockId: string): Promise<void> { if (!store.article) return; await createReadingMining(store.article.articleId, blockId); minedBlocks.value = new Set([...minedBlocks.value, blockId]) }
</script>

<template>
  <p class="performance-note">性能档位：{{ store.performanceLevel }} · Performance 模式关闭复杂动效但保留阅读、查词和进度</p>
  <section class="b3-page">
    <div class="hero"><p class="eyebrow">B3 · IMMERSIVE READING</p><h2>在上下文里认识新词。</h2><p>分级篇章、进度锚点、双语模式和句子挖掘都绑定内容版本，排版变化不会丢位置。</p></div>
    <div v-if="store.status === 'loading'" class="panel">正在读取分级阅读内容…</div>
    <div v-else-if="store.status === 'error' || store.status === 'offline'" class="panel error">{{ store.message }}<button type="button" @click="store.loadReading">重新读取</button></div>
    <div v-else-if="store.article" class="reading-layout">
      <aside class="panel toc"><p class="eyebrow">{{ store.article.cefrLevel }} · {{ store.article.estimatedMinutes }} 分钟</p><h3>{{ store.article.title }}</h3><div class="progress"><span :style="{ width: `${progress}%` }"></span></div><small>{{ progress }}% 已保存</small><label>字号 <input v-model.number="fontSize" type="range" min="14" max="32"><span>{{ fontSize }}px</span></label><button type="button" @click="bilingual = !bilingual">{{ bilingual ? '隐藏中文' : '显示中文' }}</button><button type="button" :disabled="!store.hasOfflineQueue" @click="store.syncOffline">同步离线进度（{{ store.offlineQueue.length }}）</button><div v-if="dictionary || dictionaryMessage" class="dictionary"><strong v-if="dictionary">{{ dictionary.lemma }}</strong><span v-if="dictionary">{{ dictionary.meaningCn }}</span><small v-if="dictionary?.exampleText">例：{{ dictionary.exampleText }}</small><small v-if="dictionaryMessage">{{ dictionaryMessage }}</small></div></aside>
      <article class="panel article" :style="{ fontSize: `${fontSize}px` }"><div v-for="(block, index) in store.article.blocks" :key="block.blockId" class="block" :class="{ active: activeBlock === index }" @click="activeBlock = index"><p>{{ block.text }}</p><div v-if="block.tokens.length" class="token-buttons"><button v-for="token in block.tokens" :key="token.tokenId" type="button" @click.stop="void lookup(token.tokenId)">{{ token.text }}</button></div><p v-if="bilingual" class="translation">{{ block.translation }}</p><div class="block-actions"><small>{{ block.blockId }} · 点击词语查看上下文解释</small><button type="button" @click.stop="void mine(block.blockId)">{{ minedBlocks.has(block.blockId) ? '已加入表达复习' : '挖掘为表达' }}</button></div></div><button class="next" type="button" :disabled="activeBlock >= store.article.blocks.length - 1" @click="next">下一段</button><section v-if="questions.length" class="questions"><div class="question-heading"><h3>理解检查</h3><span>规则反馈，不生成式评分</span></div><div v-for="question in questions" :key="question.questionId" class="question"><strong>{{ question.stemText }}</strong><label v-for="option in question.options" :key="option.optionCode"><input v-model="questionAnswers[question.questionId]" type="radio" :name="`question-${question.questionId}`" :value="option.optionCode">{{ option.label }}</label><button type="button" :disabled="!questionAnswers[question.questionId]" @click="void submitQuestion(question)">提交答案</button><small v-if="attemptResults[question.questionId]" :class="{ correct: attemptResults[question.questionId].correct }">{{ attemptResults[question.questionId].correct ? '回答正确' : '需要复习' }} · {{ attemptResults[question.questionId].feedbackCode }}</small></div></section></article>
    </div>
    <div v-else class="panel">服务端没有返回文章，未使用本地样例填充。</div>
  </section>
</template>

<style scoped>
.b3-page{display:grid;gap:24px}.hero{padding:32px;border-radius:28px;background:linear-gradient(135deg,#4a2d47,#b06a83);color:#fff}.hero h2{margin:8px 0;font-size:clamp(28px,4vw,46px)}.hero p:last-child{max-width:620px;line-height:1.7;color:#ffe3ed}.eyebrow{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#7b83a1}.hero .eyebrow{color:#ffd0df}.panel{padding:24px;border-radius:22px;background:#fff;box-shadow:0 16px 40px #1f2b4b0d}.reading-layout{display:grid;grid-template-columns:260px 1fr;gap:20px}.toc{display:grid;align-content:start;gap:16px;height:max-content}.toc label{display:grid;gap:8px;color:#687087;font-size:14px}.toc button,.next{padding:11px;border:0;border-radius:12px;background:#f0e8ff;color:#784e9a;cursor:pointer}.toc button:disabled{opacity:.45}.progress{height:8px;border-radius:99px;background:#ecebf2;overflow:hidden}.progress span{display:block;height:100%;background:#c56d91}.article{min-height:480px}.block{padding:14px 16px;border-left:3px solid transparent;cursor:pointer}.block.active{border-left-color:#c56d91;background:#fff5f8}.block p{line-height:1.8}.block .translation{color:#8a6680}.block small{color:#9c91a0;font-size:12px}.block-actions{display:flex;align-items:center;justify-content:space-between;gap:8px}.block-actions button,.question button{padding:6px 9px;border:0;border-radius:8px;background:#f5eaf2;color:#874b67;cursor:pointer;font-size:12px}.token-buttons{display:flex;flex-wrap:wrap;gap:6px}.token-buttons button{padding:4px 7px;border:0;border-bottom:2px solid #c56d91;background:#fff;color:#77485d;cursor:pointer}.dictionary{display:grid;gap:4px;padding:12px;border-radius:12px;background:#fff5f8;color:#824a64}.next{margin-top:18px;background:#c56d91;color:#fff}.next:disabled{opacity:.45}.questions{display:grid;gap:14px;margin-top:24px;padding-top:20px;border-top:1px solid #f0dfe7}.question-heading{display:flex;justify-content:space-between;gap:12px;align-items:center}.question-heading h3{margin:0}.question-heading span{color:#9b7184;font-size:12px}.question{display:grid;gap:8px;padding:14px;border-radius:14px;background:#fff7fa}.question label{display:flex;gap:8px;align-items:flex-start;line-height:1.5}.question button{justify-self:start;background:#c56d91;color:#fff}.question button:disabled{opacity:.45}.question small{color:#a14c68}.question small.correct{color:#25775f}.error{display:flex;gap:16px;align-items:center;color:#a13b4b}@media(max-width:760px){.reading-layout{grid-template-columns:1fr}.hero{padding:24px}.block-actions{align-items:flex-start;flex-direction:column}}
</style>
