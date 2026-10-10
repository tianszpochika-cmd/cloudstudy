<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, onMounted, onUnmounted, ref } from 'vue'
import { createAdaptivePerformanceEngine, type PerformanceLevel } from '@englishflow/performance'
import B2StatusPanel from '../../components/b2/B2StatusPanel.vue'
import { createListeningSession, isB3OfflineError, listListeningMaterials, submitDictation } from '../../api/b3'
import type { B3Status, DictationResult, ListeningMaterial } from '../../domain/b3'
import { enableUniAudioPitchPreservation, getUniRuntime, type UniAudioContext } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore(); const engine = createAdaptivePerformanceEngine(); const performanceLevel = ref<PerformanceLevel>(engine.level)
const status = ref<B3Status>('idle'); const message = ref<string | null>(null); const material = ref<ListeningMaterial | null>(null); const sessionId = ref<string | null>(null); const answer = ref(''); const result = ref<DictationResult | null>(null)
const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const
const segment = computed(() => material.value?.segments[0] ?? null); const audioSource = computed(() => material.value?.mediaRef?.availability === 'READY' ? material.value.mediaRef.signedUrl ?? null : null); const audio = ref<UniAudioContext | null>(null); const playbackRate = ref(1); const unsubscribe = engine.subscribe((state) => { performanceLevel.value = state.level })
function setPerformance(level: PerformanceLevel): void { engine.setLevel(level, 'manual'); performanceLevel.value = level }
async function load(): Promise<void> { status.value = 'loading'; message.value = null; result.value = null; answer.value = ''; try { const materials = await listListeningMaterials(); material.value = materials[0] ?? null; sessionId.value = material.value ? await createListeningSession(material.value.materialId) : null; status.value = material.value ? 'ready' : 'empty'; if (material.value && !sessionId.value) message.value = '听力会话尚未建立，答题不会伪造成功。' } catch (error) { status.value = isB3OfflineError(error) ? 'offline' : 'error'; message.value = error instanceof Error ? error.message : '听力服务暂时不可用，未使用本地音频样例。' } }
async function submit(): Promise<void> { if (!sessionId.value || !segment.value || !answer.value.trim()) { message.value = '请先读取真实听力会话并填写听写答案。'; return } try { result.value = await submitDictation(sessionId.value, segment.value.segmentId, answer.value); message.value = result.value.correct ? '服务端判定正确。' : '服务端已记录本次错题，可按反馈复习。' } catch (error) { status.value = isB3OfflineError(error) ? 'offline' : 'error'; message.value = error instanceof Error ? error.message : '听写提交失败，答案仍保留在当前页面。' } }
function playAudio(): void { if (!audioSource.value) { message.value = '当前内容没有授权播放地址；未伪造音频播放。'; return } audio.value?.destroy(); const context = getUniRuntime().createInnerAudioContext?.(); if (!context) { message.value = '当前平台没有音频适配器；未伪造音频播放。'; return } audio.value = context; enableUniAudioPitchPreservation(context, () => { message.value = '当前平台未声明音高保持能力；速度控制仍可用，已记录降级。' }); context.src = audioSource.value; context.playbackRate = playbackRate.value; context.play() }
function pauseAudio(): void { audio.value?.pause() }
function changeRate(): void { if (audio.value) audio.value.playbackRate = playbackRate.value }
onMounted(async () => { await session.restore(); if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return } void load() })
onUnmounted(() => { audio.value?.destroy(); unsubscribe(); engine.dispose() })
</script>

<template>
  <view class="yx-page" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="b3-listening" />
    <view class="yx-card" data-closed-practice role="status"><text>听力功能暂未开放，可以先做其他练习。</text><button type="button" data-closed-back @click="getUniRuntime().navigateTo({ url: '/pages/today/today' })">回到可用学习</button></view>

    <B2StatusPanel :status="status" :message="message" :performance-level="performanceLevel" @retry="load" @performance="setPerformance" @sync="() => undefined" />
    <view v-if="material && segment" class="yx-card listening-card">
      <text class="card-kicker">{{ material.title }} · {{ Math.round(material.durationMs / 1000) }}s</text>
      <view class="waveform"><view v-for="bar in 24" :key="bar" class="bar" :style="{ height: `${24 + (bar % 7) * 7}rpx` }"></view></view>
      <text class="segment-time">{{ segment.startMs }}ms — {{ segment.endMs }}ms</text>
      <view class="audio-controls"><button tabindex="0" role="button" class="small-button" type="button" :disabled="!audioSource" @click="playAudio">播放</button><button tabindex="0" role="button" class="small-button" type="button" :disabled="!audioSource" @click="pauseAudio">暂停</button><picker mode="selector" :range="PLAYBACK_RATES" @change="playbackRate = PLAYBACK_RATES[Number($event.detail.value)] ?? 1; changeRate()"><view class="small-button">{{ playbackRate }}x</view></picker></view>
      <text class="hint">{{ audioSource ? '已获得授权播放地址；速度控制使用原生音频适配层。' : '当前内容没有授权播放地址；波形、时间轴和听写可检查，但不会伪造播放。' }}</text>
      <view class="token-list"><view v-for="token in segment.tokens" :key="token.tokenId" class="token"><text>{{ token.text }}</text><text class="token__time">{{ token.startMs }}–{{ token.endMs }}ms</text></view></view>
      <input v-model="answer" class="answer" placeholder="输入你听到的句子" confirm-type="done" />
      <button tabindex="0" role="button" class="yx-button" type="button" @click="submit">提交听写</button>
      <view v-if="result" class="result"><text>得分 {{ result.score }}</text><text>{{ result.feedbackCodes.join(' · ') || '已记录' }}</text></view>
    </view>
    <view v-else-if="status !== 'loading'" class="yx-card empty"><text>暂时没有可用的授权听力材料。</text><button tabindex="0" role="button" class="yx-button" type="button" @click="load">重新读取</button></view>
  </view>
</template>

<style scoped lang="scss">
.listening-card{display:grid;gap:16rpx}.card-kicker{color:var(--yx-brand);font-size:22rpx;font-weight:700}.waveform{display:flex;align-items:center;justify-content:space-between;height:90rpx;padding:0 14rpx;border-radius:14rpx;background:var(--yx-brand-soft)}.bar{width:7rpx;border-radius:8rpx;background:var(--yx-brand)}.segment-time,.hint{color:var(--yx-text-secondary);font-size:23rpx}.audio-controls{display:flex;align-items:center;gap:10rpx}.small-button{min-height:58rpx;padding:0 16rpx;border:1rpx solid var(--yx-border);border-radius:10rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx;line-height:58rpx}.small-button:disabled{opacity:.45}.token-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10rpx}.token{display:grid;gap:4rpx;padding:14rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;font-size:24rpx}.token__time{color:var(--yx-text-tertiary);font-size:19rpx}.answer{height:84rpx;padding:0 20rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;font-size:27rpx}.result{display:grid;gap:6rpx;padding:18rpx;border-radius:12rpx;color:var(--yx-success);background:var(--yx-surface-page);font-size:24rpx}.empty{display:grid;gap:16rpx;color:var(--yx-text-secondary);font-size:26rpx}
</style>
