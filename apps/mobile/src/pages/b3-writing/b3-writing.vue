<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { createAdaptivePerformanceEngine, type PerformanceLevel } from '@englishflow/performance'
import B10FeedbackCard from '../../components/b10/B10FeedbackCard.vue'
import B10StatusPanel from '../../components/b10/B10StatusPanel.vue'
import B10ThemeBar from '../../components/b10/B10ThemeBar.vue'
import type { B10RuleFeedback, B10WritingPrompt } from '../../domain/b10'
import { b10LearningApi, b10ErrorInfo, createB10ClientEventId } from '../../api/b10'
import { b10ContentLocale, b10ThemeMode, b10T, b10UiLocale } from '../../platform/b10-foundation'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const engine = createAdaptivePerformanceEngine()
const performanceLevel = ref<PerformanceLevel>(engine.level)
const status = ref<'idle' | 'loading' | 'ready' | 'empty' | 'offline' | 'forbidden' | 'stale' | 'error'>('idle')
const message = ref<string | null>(null)
const prompts = ref<B10WritingPrompt[]>([])
const selectedPrompt = ref<B10WritingPrompt | null>(null)
const answer = ref('')
const feedback = ref<B10RuleFeedback | null>(null)
const draftSavedAt = ref<string | null>(null)
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const context = computed(() => ({ uiLocale: b10UiLocale.value, contentLocale: b10ContentLocale.value }))
const storageKey = 'yx.b10.mobile.writing.draft.v1'
let draftTimer: ReturnType<typeof setTimeout> | undefined

function setPerformance(level: PerformanceLevel): void { engine.setLevel(level, 'manual'); performanceLevel.value = level }
function persistDraft(): void { if (!selectedPrompt.value) return; draftSavedAt.value = new Date().toISOString(); getUniRuntime().setStorageSync(storageKey, JSON.stringify({ promptId: selectedPrompt.value.promptId, text: answer.value, savedAt: draftSavedAt.value })) }
function restoreDraft(): void { const raw = getUniRuntime().getStorageSync(storageKey); if (typeof raw !== 'string') return; try { const value = JSON.parse(raw) as Record<string, unknown>; const promptId = typeof value.promptId === 'number' ? value.promptId : 0; const prompt = prompts.value.find((item) => item.promptId === promptId); if (prompt) { selectedPrompt.value = prompt; answer.value = typeof value.text === 'string' ? value.text : ''; draftSavedAt.value = typeof value.savedAt === 'string' ? value.savedAt : null } } catch { /* ignore corrupt draft */ } }
async function load(): Promise<void> { status.value = 'loading'; message.value = null; try { prompts.value = await b10LearningApi.listWritingPrompts(context.value); if (!prompts.value.length) { status.value = 'empty'; return } selectedPrompt.value ??= prompts.value[0]; restoreDraft(); status.value = 'ready' } catch (error) { const info = b10ErrorInfo(error, '写作服务暂时不可用。'); status.value = info.kind; message.value = info.message } }
function selectPrompt(index: number): void { selectedPrompt.value = prompts.value[index] ?? null; feedback.value = null; answer.value = ''; restoreDraft() }
function onInput(): void { clearTimeout(draftTimer); draftTimer = setTimeout(persistDraft, 250) }
async function submit(): Promise<void> { if (!selectedPrompt.value || !answer.value.trim()) { message.value = '请先读取服务端题目并填写答案。'; return } status.value = 'loading'; message.value = null; const clientEventId = createB10ClientEventId(`writing-${selectedPrompt.value.promptId}`); try { feedback.value = selectedPrompt.value.promptType === 'CORRECTION' ? await b10LearningApi.submitCorrection(context.value, selectedPrompt.value, answer.value, clientEventId) : await b10LearningApi.submitWriting(context.value, selectedPrompt.value, answer.value, selectedPrompt.value.promptType === 'TRANSLATION' ? 'TRANSLATION' : 'WRITING', clientEventId); status.value = feedback.value.contentVersionStale ? 'stale' : 'ready'; message.value = feedback.value.contentVersionStale ? b10T('common.stale') : null; persistDraft() } catch (error) { const info = b10ErrorInfo(error, '写作提交失败，草稿仍保留。'); status.value = info.kind; message.value = info.message; persistDraft() } }
watch(answer, onInput)
onMounted(() => { session.restore(); if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return } void load() })
onUnmounted(() => { clearTimeout(draftTimer); engine.dispose() })
</script>

<template>
  <view class="yx-page" :class="themeClass">
    <text class="yx-eyebrow">{{ b10T('writing.eyebrow') }}</text>
    <text class="yx-title">{{ b10T('writing.title') }}</text>
    <text class="yx-description">{{ b10T('writing.description') }}</text>
    <B10ThemeBar />
    <B10StatusPanel :status="status" :message="message" :performance-level="performanceLevel" @retry="load" @performance="setPerformance" />
    <view v-if="prompts.length" class="yx-card b10-writing-card"><picker :range="prompts.map((prompt) => `${prompt.promptType} · ${prompt.title}`)" :value="Math.max(0, prompts.findIndex((prompt) => prompt.promptId === selectedPrompt?.promptId))" @change="selectPrompt(Number($event.detail.value))"><view class="b10-prompt-picker">{{ selectedPrompt?.promptType }} · {{ selectedPrompt?.title }}</view></picker><text v-if="selectedPrompt?.sourceText" class="b10-writing-card__source">{{ selectedPrompt.sourceText }}</text><text class="b10-writing-card__task">{{ selectedPrompt?.taskText }}</text><view v-if="selectedPrompt?.targetStructure?.length" class="b10-targets"><text v-for="target in selectedPrompt.targetStructure" :key="target" class="b10-target">{{ target }}</text></view><textarea v-model="answer" class="b10-textarea" maxlength="12000" placeholder="输入答案；提交后由服务端返回规则反馈。" /><view class="b10-draft-row"><text>{{ b10T('writing.draft') }}：{{ draftSavedAt ? '已保存' : '输入中' }}</text><button class="b10-draft-button" type="button" @click="persistDraft">{{ b10T('writing.save') }}</button></view><button class="yx-button" type="button" @click="submit">{{ selectedPrompt?.promptType === 'CORRECTION' ? b10T('writing.correction') : b10T('writing.submit') }}</button></view>
    <view v-else-if="status === 'loading'" class="yx-card b10-empty"><text>{{ b10T('status.loading') }}</text></view>
    <view v-else class="yx-card b10-empty"><text>{{ b10T('writing.noPrompt') }}</text><button class="yx-button" type="button" @click="load">{{ b10T('status.retry') }}</button></view>
    <B10FeedbackCard :feedback="feedback" />
  </view>
</template>

<style scoped lang="scss">
.b10-writing-card{display:grid;gap:18rpx}.b10-prompt-picker{min-height:72rpx;padding:0 18rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-text-primary);background:var(--yx-surface-card);font-size:25rpx;line-height:72rpx}.b10-writing-card__source,.b10-writing-card__task{color:var(--yx-text-primary);font-size:28rpx;line-height:1.7}.b10-writing-card__source{padding:18rpx;border-radius:12rpx;background:var(--yx-surface-soft)}.b10-targets{display:flex;flex-wrap:wrap;gap:10rpx}.b10-target{padding:8rpx 14rpx;border-radius:999rpx;color:var(--yx-brand);background:var(--yx-brand-soft);font-size:21rpx}.b10-textarea{width:100%;min-height:300rpx;box-sizing:border-box;padding:18rpx;border:1rpx solid var(--yx-border);border-radius:14rpx;background:var(--yx-surface-card);font-size:26rpx;line-height:1.6}.b10-draft-row{display:flex;align-items:center;justify-content:space-between;color:var(--yx-text-tertiary);font-size:21rpx}.b10-draft-button{min-height:58rpx;padding:0 14rpx;border:1rpx solid var(--yx-border);border-radius:10rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx;line-height:58rpx}.b10-empty{display:grid;gap:16rpx;color:var(--yx-text-secondary);font-size:24rpx}
</style>
