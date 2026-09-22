<script setup lang="ts">
import { ref } from 'vue'
import type { DragSorterQuestion } from '../../domain/b2'
defineProps<{ question: DragSorterQuestion; disabled?: boolean }>()
const emit = defineEmits<{ answer: [value: string[]] }>()
const ordered = ref<string[]>([])
function add(tokenId: string): void { if (!ordered.value.includes(tokenId)) { ordered.value.push(tokenId); emit('answer', ordered.value) } }
function remove(tokenId: string): void { ordered.value = ordered.value.filter((id) => id !== tokenId); emit('answer', ordered.value) }
</script>
<template><div class="question"><p class="question__prompt">{{ question.prompt }}</p><div class="slots" aria-label="已选择词块"><button v-for="tokenId in ordered" :key="tokenId" class="slot" type="button" :disabled="disabled" @click="remove(tokenId)">{{ question.tokens.find((token) => token.tokenId === tokenId)?.text }} ×</button><span v-if="!ordered.length" class="slots__empty">点击下方词块组成句子</span></div><div class="tokens"><button v-for="token in question.tokens" :key="token.tokenId" class="token" type="button" :disabled="disabled || ordered.includes(token.tokenId)" @click="add(token.tokenId)">{{ token.text }}</button></div></div></template>
<style scoped>.question{display:grid;gap:14px}.question__prompt{margin:0;font-size:clamp(22px,3vw,32px);font-weight:750;line-height:1.35}.slots{display:flex;flex-wrap:wrap;gap:8px;min-height:76px;align-items:center;padding:14px;border:1px dashed var(--yx-color-border);border-radius:14px;background:var(--yx-color-surface-page)}.slots__empty{color:var(--yx-color-text-secondary);font-size:13px}.slot,.token{min-height:44px;padding:0 12px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-text-primary);background:var(--yx-color-surface-card)}.slot{border-color:var(--yx-color-brand-primary);color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.tokens{display:flex;flex-wrap:wrap;gap:8px}.token:disabled{opacity:.4}.token:not(:disabled):hover{border-color:var(--yx-color-brand-primary);color:var(--yx-color-brand-primary)}</style>
