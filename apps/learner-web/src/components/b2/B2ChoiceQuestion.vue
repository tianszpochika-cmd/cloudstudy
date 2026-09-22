<script setup lang="ts">
import { ref } from 'vue'
import type { ChoiceQuestion } from '../../domain/b2'
defineProps<{ question: ChoiceQuestion; disabled?: boolean }>()
const emit = defineEmits<{ answer: [value: string] }>()
const selected = ref<string | null>(null)
function choose(key: string): void { selected.value = key; emit('answer', key) }
</script>
<template><div class="question"><p class="question__prompt">{{ question.prompt }}</p><p v-if="question.helperText" class="question__helper">{{ question.helperText }}</p><div class="options"><button v-for="option in question.options" :key="option.key" class="option" :class="{ 'option--selected': selected === option.key }" type="button" :disabled="disabled" :aria-pressed="selected === option.key" @click="choose(option.key)"><span>{{ option.key }}</span><strong>{{ option.text }}</strong></button></div></div></template>
<style scoped>.question{display:grid;gap:14px}.question__prompt{margin:0;font-size:clamp(22px,3vw,32px);font-weight:750;line-height:1.35}.question__helper{margin:0;color:var(--yx-color-text-secondary);font-size:13px}.options{display:grid;gap:10px}.option{display:flex;min-height:52px;align-items:center;gap:12px;padding:10px 14px;border:1px solid var(--yx-color-border);border-radius:12px;color:var(--yx-color-text-primary);background:var(--yx-color-surface-card);text-align:left}.option:hover,.option--selected{border-color:var(--yx-color-brand-primary);color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.option span{display:grid;width:28px;height:28px;place-items:center;border-radius:8px;background:var(--yx-color-surface-muted);font-weight:800}.option strong{font-weight:650}.option:disabled{cursor:wait;opacity:.65}</style>
