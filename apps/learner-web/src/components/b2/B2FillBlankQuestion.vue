<script setup lang="ts">
import { ref } from 'vue'
import type { FillBlankQuestion } from '../../domain/b2'
defineProps<{ question: FillBlankQuestion; disabled?: boolean }>()
const emit = defineEmits<{ answer: [value: string] }>()
const selected = ref<string | null>(null)
function choose(key: string): void { selected.value = key; emit('answer', key) }
</script>
<template><div class="question"><p class="question__prompt">{{ question.prompt }}</p><p class="sentence">{{ question.sentence }}</p><div class="options"><button v-for="option in question.options" :key="option.key" class="option" :class="{ 'option--selected': selected === option.key }" type="button" :disabled="disabled" :aria-pressed="selected === option.key" @click="choose(option.key)">{{ option.text }}</button></div></div></template>
<style scoped>.question{display:grid;gap:14px}.question__prompt,.sentence{margin:0;font-size:clamp(22px,3vw,32px);font-weight:750;line-height:1.35}.sentence{padding:18px;border-radius:14px;color:#596bff;background:#eef0ff}.options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.option{min-height:52px;padding:10px 14px;border:1px solid #e6e8f0;border-radius:12px;background:#fff;text-align:left}.option:hover,.option--selected{border-color:#596bff;color:#596bff;background:#eef0ff}.option:disabled{cursor:wait;opacity:.65}@media(max-width:560px){.options{grid-template-columns:1fr}}</style>
