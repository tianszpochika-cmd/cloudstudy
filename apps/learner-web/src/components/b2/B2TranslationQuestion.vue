<script setup lang="ts">
import { ref } from 'vue'
import type { TranslationQuestion } from '../../domain/b2'
defineProps<{ question: TranslationQuestion; disabled?: boolean }>()
const emit = defineEmits<{ answer: [value: string] }>()
const answer = ref('')
function submit(): void { emit('answer', answer.value) }
</script>
<template><div class="question"><p class="question__prompt">{{ question.prompt }}</p><div class="source">{{ question.sourceText }}</div><textarea v-model="answer" :placeholder="question.placeholder" :disabled="disabled" rows="5" @keydown.ctrl.enter="submit"></textarea><button class="submit" type="button" :disabled="disabled || !answer.trim()" @click="submit">提交译文</button></div></template>
<style scoped>.question{display:grid;gap:14px}.question__prompt{margin:0;font-size:clamp(22px,3vw,32px);font-weight:750;line-height:1.35}.source{padding:16px;border-radius:14px;color:#202332;background:#f7f8fc;font-size:18px;line-height:1.6}textarea{width:100%;resize:vertical;padding:14px;border:1px solid #d9dce7;border-radius:12px;color:#202332;background:#fff;font:inherit;line-height:1.6}textarea:focus{outline:2px solid #cdd3ff;border-color:#596bff}.submit{min-height:48px;border:0;border-radius:12px;color:#fff;background:#596bff;font-weight:800}.submit:disabled{cursor:not-allowed;opacity:.55}</style>
