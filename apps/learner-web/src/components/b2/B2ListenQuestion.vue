<script setup lang="ts">
import { ref } from 'vue'
import type { ListenQuestion } from '../../domain/b2'
defineProps<{ question: ListenQuestion; disabled?: boolean }>()
const emit = defineEmits<{ answer: [value: string] }>()
const selected = ref<string | null>(null)
const playing = ref(false)
function choose(key: string): void { selected.value = key; emit('answer', key) }
</script>
<template><div class="question"><p class="question__prompt">{{ question.prompt }}</p><button class="player" type="button" :disabled="!question.audioUrl" @click="playing = !playing"><span aria-hidden="true">{{ playing ? 'Ⅱ' : '▶' }}</span>{{ question.audioUrl ? (playing ? '播放中' : '播放音频') : '音频不可用' }}</button><p v-if="!question.audioUrl" class="notice">服务端没有返回音频资源，未伪造播放成功；你仍可继续查看可用选项。</p><div class="options"><button v-for="option in question.options" :key="option.key" class="option" :class="{ 'option--selected': selected === option.key }" type="button" :disabled="disabled" @click="choose(option.key)">{{ option.text }}</button></div></div></template>
<style scoped>.question{display:grid;gap:14px}.question__prompt{margin:0;font-size:clamp(22px,3vw,32px);font-weight:750;line-height:1.35}.player{display:flex;min-height:60px;align-items:center;justify-content:center;gap:10px;border:0;border-radius:14px;color:var(--yx-color-on-brand);background:var(--yx-color-brand-primary);font-weight:800}.player:disabled{color:var(--yx-color-text-secondary);background:var(--yx-color-surface-muted)}.notice{margin:0;padding:10px 12px;border-radius:10px;color:var(--yx-color-warning);background:var(--yx-color-warning-soft);font-size:13px}.options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.option{min-height:52px;padding:10px 14px;border:1px solid var(--yx-color-border);border-radius:12px;background:var(--yx-color-surface-card);text-align:left}.option--selected,.option:hover{border-color:var(--yx-color-brand-primary);color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}@media(max-width:560px){.options{grid-template-columns:1fr}}</style>
