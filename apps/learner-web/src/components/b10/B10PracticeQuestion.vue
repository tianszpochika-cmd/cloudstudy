<script setup lang="ts">
import { ref, watch } from 'vue'
import type { B10PerformanceLevel, B10PracticeQuestion } from '../../domain/b10'

const props = withDefaults(defineProps<{ question: B10PracticeQuestion; disabled?: boolean; performanceLevel?: B10PerformanceLevel; initialAnswer?: unknown }>(), { disabled: false, performanceLevel: 'High', initialAnswer: undefined })
const emit = defineEmits<{ answer: [value: unknown] }>()
const selected = ref<string | null>(typeof props.initialAnswer === 'string' ? props.initialAnswer : null)
const textAnswer = ref(typeof props.initialAnswer === 'string' ? props.initialAnswer : '')
const ordered = ref<string[]>(Array.isArray(props.initialAnswer) ? props.initialAnswer.filter((item): item is string => typeof item === 'string') : [])
watch(() => props.question.id, () => { selected.value = null; textAnswer.value = ''; ordered.value = [] })
function choose(value: string): void { selected.value = value; emit('answer', value) }
function updateText(): void { emit('answer', textAnswer.value) }
function addToken(tokenId: string): void { if (!ordered.value.includes(tokenId)) { ordered.value = [...ordered.value, tokenId]; emit('answer', ordered.value) } }
function removeToken(tokenId: string): void { ordered.value = ordered.value.filter((item) => item !== tokenId); emit('answer', ordered.value) }
</script>

<template>
  <article class="question" :data-performance="performanceLevel" :class="{ 'question--static': performanceLevel === 'Performance' }">
    <p class="question__prompt">{{ question.prompt }}</p>
    <p v-if="question.helperText" class="question__helper">{{ question.helperText }}</p>
    <div v-if="question.type === 'CHOICE'" class="options">
      <button v-for="option in question.options" :key="option.key" class="option" :class="{ 'option--selected': selected === option.key }" type="button" :disabled="disabled" :aria-pressed="selected === option.key" @click="choose(option.key)"><span>{{ option.key }}</span><strong>{{ option.text }}</strong></button>
    </div>
    <template v-else-if="question.type === 'FILL_BLANK'">
      <p class="sentence">{{ question.sentence ?? question.prompt }}</p>
      <div class="options options--two"><button v-for="option in question.options" :key="option.key" class="option" :class="{ 'option--selected': selected === option.key }" type="button" :disabled="disabled" :aria-pressed="selected === option.key" @click="choose(option.key)">{{ option.text }}</button></div>
    </template>
    <template v-else-if="question.type === 'DRAG_SORTER'">
      <div class="slots" aria-label="已选择词块"><button v-for="tokenId in ordered" :key="tokenId" class="slot" type="button" :disabled="disabled" @click="removeToken(tokenId)">{{ question.tokens.find((token) => token.tokenId === tokenId)?.text }} ×</button><span v-if="!ordered.length" class="slots__empty">点击下方词块组成句子</span></div>
      <div class="tokens"><button v-for="token in question.tokens" :key="token.tokenId" class="token" type="button" :disabled="disabled || ordered.includes(token.tokenId)" @click="addToken(token.tokenId)">{{ token.text }}</button></div>
    </template>
    <template v-else>
      <div v-if="question.sourceText" class="source">{{ question.sourceText }}</div>
      <textarea v-model="textAnswer" :placeholder="question.placeholder ?? '输入答案'" rows="5" :disabled="disabled" @input="updateText" @keydown.ctrl.enter="emit('answer', textAnswer)"></textarea>
    </template>
  </article>
</template>

<style scoped>
.question{display:grid;gap:14px;padding:24px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.question:not(.question--static){transition:box-shadow 180ms ease}.question__prompt,.sentence{margin:0;font-size:clamp(22px,3vw,32px);font-weight:750;line-height:1.35}.question__helper{margin:0;color:var(--yx-color-text-secondary);font-size:13px}.options{display:grid;gap:10px}.options--two{grid-template-columns:repeat(2,minmax(0,1fr))}.option{display:flex;min-height:52px;align-items:center;gap:12px;padding:10px 14px;border:1px solid var(--yx-color-border);border-radius:12px;color:var(--yx-color-text-primary);background:var(--yx-color-surface-page);text-align:left}.option:hover,.option--selected{border-color:var(--yx-color-brand-primary);color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.option span{display:grid;width:28px;height:28px;place-items:center;border-radius:8px;background:var(--yx-color-surface-muted);font-weight:800}.sentence,.source{padding:16px;border-radius:14px;color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft);line-height:1.6}.slots{display:flex;flex-wrap:wrap;gap:8px;min-height:70px;align-items:center;padding:14px;border:1px dashed var(--yx-color-border);border-radius:14px;background:var(--yx-color-surface-muted)}.slots__empty{color:var(--yx-color-text-secondary);font-size:13px}.slot,.token{min-height:44px;padding:0 12px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-text-primary);background:var(--yx-color-surface-page)}.slot{border-color:var(--yx-color-brand-primary);color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.tokens{display:flex;flex-wrap:wrap;gap:8px}textarea{width:100%;box-sizing:border-box;padding:14px;border:1px solid var(--yx-color-border);border-radius:12px;color:var(--yx-color-text-primary);background:var(--yx-color-surface-page);font:inherit;line-height:1.6}textarea:focus,.option:focus-visible,.slot:focus-visible,.token:focus-visible{outline:2px solid var(--yx-color-focus);outline-offset:2px}.option:disabled,.token:disabled,.slot:disabled{cursor:wait;opacity:.6}@media(max-width:560px){.question{padding:18px}.options--two{grid-template-columns:1fr}}
</style>
