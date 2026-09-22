<script setup lang="ts">
import B2ChoiceQuestion from './B2ChoiceQuestion.vue'
import B2DragSorterQuestion from './B2DragSorterQuestion.vue'
import B2FillBlankQuestion from './B2FillBlankQuestion.vue'
import B2ListenQuestion from './B2ListenQuestion.vue'
import B2TranslationQuestion from './B2TranslationQuestion.vue'
import type { PracticeQuestion, PerformanceLevel } from '../../domain/b2'
defineProps<{ question: PracticeQuestion; disabled?: boolean; performanceLevel?: PerformanceLevel }>()
const emit = defineEmits<{ answer: [value: unknown] }>()
</script>
<template><div class="practice-question"><B2ChoiceQuestion v-if="question.type === 'CHOICE'" :question="question" :disabled="disabled" @answer="emit('answer', $event)" /><B2FillBlankQuestion v-else-if="question.type === 'FILL_BLANK'" :question="question" :disabled="disabled" @answer="emit('answer', $event)" /><B2DragSorterQuestion v-else-if="question.type === 'DRAG_SORTER'" :question="question" :disabled="disabled" @answer="emit('answer', $event)" /><B2ListenQuestion v-else-if="question.type === 'LISTEN'" :question="question" :disabled="disabled" @answer="emit('answer', $event)" /><B2TranslationQuestion v-else :question="question" :disabled="disabled" @answer="emit('answer', $event)" /></div></template>
<style scoped>.practice-question{padding:24px;border:1px solid var(--yx-color-border);border-radius:20px;background:var(--yx-color-surface-card);box-shadow:0 8px 24px color-mix(in srgb,var(--yx-color-brand-primary) 6%, transparent)}@media(max-width:640px){.practice-question{padding:18px}}</style>
