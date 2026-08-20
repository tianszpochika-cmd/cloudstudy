<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { createAdaptivePerformanceEngine, type PerformanceLevel } from '@englishflow/performance'
import B2StatusPanel from '../../components/b2/B2StatusPanel.vue'
import { isB3OfflineError, listWritingPrompts, submitWriting } from '../../api/b3'
import type { B3Status, WritingEvaluation, WritingPrompt } from '../../domain/b3'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore(); const engine = createAdaptivePerformanceEngine(); const performanceLevel = ref<PerformanceLevel>(engine.level); const status = ref<B3Status>('idle'); const message = ref<string | null>(null); const prompt = ref<WritingPrompt | null>(null); const answer = ref(''); const evaluation = ref<WritingEvaluation | null>(null)
const unsubscribe = engine.subscribe((state) => { performanceLevel.value = state.level })
function setPerformance(level: PerformanceLevel): void { engine.setLevel(level, 'manual'); performanceLevel.value = level }
async function load(): Promise<void> { status.value = 'loading'; message.value = null; try { prompt.value = (await listWritingPrompts())[0] ?? null; evaluation.value = null; status.value = prompt.value ? 'ready' : 'empty' } catch (error) { status.value = isB3OfflineError(error) ? 'offline' : 'error'; message.value = error instanceof Error ? error.message : '写作服务暂时不可用，未使用本地样例题。' } }
async function submit(): Promise<void> { if (!prompt.value || !answer.value.trim()) { message.value = '请先读取服务端题目并填写答案。'; return } try { evaluation.value = await submitWriting(prompt.value.promptId, answer.value); message.value = '服务端规则评测已返回；Phase 1 不生成 AI 分数。' } catch (error) { status.value = isB3OfflineError(error) ? 'offline' : 'error'; message.value = error instanceof Error ? error.message : '写作提交失败，当前答案未标记为已评测。' } }
onMounted(() => { session.restore(); if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return } void load() })
onUnmounted(() => { unsubscribe(); engine.dispose() })
</script>

<template>
  <view class="yx-page"><text class="yx-eyebrow">WRITING · RULE RUBRIC</text><text class="yx-title">写出来，再看采分点。</text><text class="yx-description">服务端按版本化规则评测答案；不会在本地猜测结果，也不会启用生成式 AI。</text><B2StatusPanel :status="status" :message="message" :performance-level="performanceLevel" @retry="load" @performance="setPerformance" @sync="() => undefined" /><view v-if="prompt" class="yx-card writing-card"><text class="card-kicker">{{ prompt.promptType }} · {{ prompt.contentVersionId }}</text><text class="card-title">{{ prompt.title }}</text><text class="task">{{ prompt.taskText }}</text><view class="targets"><text v-for="target in prompt.targetStructure" :key="target" class="target">{{ target }}</text></view><textarea v-model="answer" class="answer" maxlength="1000" placeholder="输入答案；提交后由服务端返回规则反馈。" /><button class="yx-button" type="button" @click="submit">提交规则评测</button><view v-if="evaluation" class="result"><text>{{ evaluation.band }} · {{ Math.round(evaluation.score) }} 分</text><text>命中采分点：{{ evaluation.matchedPointCodes.join('、') || '暂无' }}</text><text>AI 评分：不可用（Phase 1）</text></view></view><view v-else-if="status !== 'loading'" class="yx-card empty"><text>服务端没有返回写作题目。</text><button class="yx-button" type="button" @click="load">重新读取</button></view></view>
</template>

<style scoped lang="scss">
.writing-card{display:grid;gap:16rpx}.card-kicker{color:#596bff;font-size:22rpx;font-weight:700}.card-title{font-size:36rpx;font-weight:750}.task{color:#666d80;font-size:28rpx;line-height:1.7}.targets{display:flex;flex-wrap:wrap;gap:10rpx}.target{padding:8rpx 14rpx;border-radius:999rpx;color:#9e4f6b;background:#fff0f4;font-size:22rpx}.answer{width:100%;min-height:240rpx;box-sizing:border-box;padding:18rpx;border:1rpx solid #d9dce7;border-radius:12rpx;font-size:26rpx;line-height:1.6}.result{display:grid;gap:8rpx;padding:18rpx;border-radius:12rpx;color:#8f4461;background:#fff2f5;font-size:24rpx}.empty{display:grid;gap:16rpx;color:#666d80;font-size:26rpx}
</style>
