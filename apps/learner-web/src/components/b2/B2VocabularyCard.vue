<script setup lang="ts">
import { ref } from 'vue'
import B2SrsBadge from './B2SrsBadge.vue'
import type { CardPhase, PerformanceLevel, ReviewQuality, VocabularyCard } from '../../domain/b2'

const props = defineProps<{ card: VocabularyCard; phase: CardPhase; performanceLevel: PerformanceLevel }>()
const emit = defineEmits<{ reveal: []; rate: [quality: ReviewQuality]; retry: [] }>()
const selectedQuality = ref<ReviewQuality | null>(null)
const qualityOptions: Array<{ value: ReviewQuality; label: string; description: string }> = [
  { value: 0, label: '忘了', description: '完全想不起' },
  { value: 1, label: '模糊', description: '需要提示' },
  { value: 2, label: '记得', description: '顺利想起' },
  { value: 3, label: '很熟', description: '轻而易举' },
]
function rate(quality: ReviewQuality): void { if (props.phase === 'BACK') { selectedQuality.value = quality; emit('rate', quality) } }
</script>

<template>
  <article class="vocab-card" :class="{ 'vocab-card--static': performanceLevel === 'Performance' }" aria-live="polite">
    <div class="vocab-card__topline"><span>词卡 {{ card.position + 1 }}<span v-if="card.total"> / {{ card.total }}</span></span><B2SrsBadge :srs="card.srs" /></div>
    <section v-if="phase === 'FRONT' || phase === 'REVEALING'" class="vocab-card__front" aria-label="词卡正面">
      <span class="vocab-card__eyebrow">先回忆，再揭晓</span>
      <h2>{{ card.title }}</h2>
      <div class="vocab-card__phonetics"><span v-if="card.phoneticUs">US {{ card.phoneticUs }}</span><span v-if="card.phoneticUk">UK {{ card.phoneticUk }}</span></div>
      <p v-if="card.frontHint" class="vocab-card__hint">{{ card.frontHint }}</p>
      <p class="vocab-card__privacy">正面不展示释义、例句或标准答案。</p>
      <button class="vocab-card__reveal" type="button" :disabled="phase !== 'FRONT'" @click="emit('reveal')">{{ phase === 'REVEALING' ? '正在读取答案…' : '显示答案' }}</button>
    </section>
    <section v-else-if="phase === 'BACK' || phase === 'SUBMITTING' || phase === 'PENDING_SYNC' || phase === 'SYNCED'" class="vocab-card__back" aria-label="词卡背面">
      <span class="vocab-card__eyebrow">主动回忆反馈</span>
      <h2>{{ card.title }}</h2>
      <div class="vocab-card__meaning"><strong>{{ card.back?.meaningCn ?? '服务端未返回中文释义' }}</strong><span v-if="card.back?.partOfSpeech">{{ card.back.partOfSpeech }}</span></div>
      <p v-if="card.back?.definitionEn">{{ card.back.definitionEn }}</p>
      <ul v-if="card.back?.examples.length" class="vocab-card__examples"><li v-for="example in card.back.examples" :key="example.sentence"><span>{{ example.sentence }}</span><small v-if="example.translation">{{ example.translation }}</small></li></ul>
      <p v-if="card.back?.collocations.length" class="vocab-card__collocations">常见搭配：{{ card.back.collocations.join(' · ') }}</p>
      <p v-if="card.back?.rootSummary" class="vocab-card__root">词根提示：{{ card.back.rootSummary }}</p>
      <div class="vocab-card__rating" aria-label="选择信心度">
        <button v-for="option in qualityOptions" :key="option.value" class="rating-option" :class="{ 'rating-option--selected': selectedQuality === option.value }" type="button" :disabled="phase !== 'BACK'" :aria-pressed="selectedQuality === option.value" @click="rate(option.value)"><strong>{{ option.value }} · {{ option.label }}</strong><small>{{ option.description }}</small></button>
      </div>
      <p v-if="phase === 'PENDING_SYNC'" class="vocab-card__notice">已排队待同步。服务端尚未确认本次掌握变化。</p>
      <p v-if="phase === 'SYNCED'" class="vocab-card__notice">本批次已完成。</p>
    </section>
    <section v-else class="vocab-card__error" role="alert"><strong>这张卡片暂时无法继续</strong><p>没有伪造答案或掌握结果。请刷新服务端批次后重试。</p><button class="vocab-card__reveal" type="button" @click="emit('retry')">重新读取</button></section>
  </article>
</template>

<style scoped>
.vocab-card { min-height: 540px; padding: 28px; border: 1px solid #e6e8f0; border-radius: 24px; background: #fff; box-shadow: 0 12px 34px rgb(31 35 48 / 8%); }
.vocab-card:not(.vocab-card--static) { transition: transform 180ms ease, box-shadow 180ms ease; }
.vocab-card__topline { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; color: #969caf; font-size: 13px; }
.vocab-card__front, .vocab-card__back, .vocab-card__error { display: grid; gap: 16px; align-content: center; min-height: 460px; max-width: 680px; margin: 0 auto; text-align: center; }
.vocab-card__eyebrow { color: #596bff; font-size: 12px; font-weight: 800; letter-spacing: .12em; }
h2 { margin: 0; font-size: clamp(40px, 8vw, 74px); line-height: 1.05; letter-spacing: -.04em; }
.vocab-card__phonetics, .vocab-card__meaning { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; color: #666d80; }
.vocab-card__meaning { align-items: baseline; gap: 12px; color: #202332; font-size: 24px; }
.vocab-card__meaning span { color: #596bff; font-size: 13px; }
.vocab-card__hint, .vocab-card__back p { margin: 0; color: #666d80; line-height: 1.7; }
.vocab-card__privacy { margin: 0; color: #969caf; font-size: 13px; }
.vocab-card__reveal { min-height: 48px; padding: 0 20px; border: 0; border-radius: 14px; color: #fff; background: #596bff; font-weight: 800; }
.vocab-card__reveal:disabled { cursor: wait; opacity: .65; }
.vocab-card__examples { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; text-align: left; }
.vocab-card__examples li { display: grid; gap: 3px; padding: 12px 14px; border-radius: 12px; background: #f7f8fc; }
.vocab-card__examples small { color: #666d80; }
.vocab-card__collocations, .vocab-card__root { font-size: 13px; }
.vocab-card__rating { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 4px; }
.rating-option { display: grid; min-height: 64px; gap: 4px; place-content: center; padding: 7px; border: 1px solid #e6e8f0; border-radius: 12px; color: #202332; background: #fff; text-align: center; }
.rating-option:hover, .rating-option--selected { border-color: #596bff; color: #596bff; background: #eef0ff; }
.rating-option:disabled { cursor: wait; opacity: .62; }
.rating-option small { color: #666d80; font-size: 11px; }
.vocab-card__notice { padding: 10px 12px; border-radius: 10px; color: #9b5b00 !important; background: #fff7e8; font-size: 13px; }
.vocab-card__error p { margin: 0; color: #666d80; }
@media (max-width: 640px) { .vocab-card { min-height: 0; padding: 20px 16px; } .vocab-card__front, .vocab-card__back, .vocab-card__error { min-height: 420px; } .vocab-card__rating { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
