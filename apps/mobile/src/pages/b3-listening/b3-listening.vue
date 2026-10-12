<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue'
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
    <view class="v2-b3listen-body">
      <view class="yx-card card v2-b3listen-card" data-closed-practice role="status"><view class="eyebrow v2-b3listen-eyebrow"><AppIcon name="lock" :size="14" /><text>听力</text></view><text class="v2-b3listen-title v2-b3listen-h2">听力功能暂未开放，可以先做其他练习。</text><button type="button" class="btn v2-b3listen-btn" data-closed-back @click="getUniRuntime().navigateTo({ url: '/pages/today/today' })"><AppIcon name="back" :size="14" />回到可用学习</button></view>

      <B2StatusPanel class="v2-b3listen-status" :status="status" :message="message" :performance-level="performanceLevel" @retry="load" @performance="setPerformance" @sync="() => undefined" />
      <view v-if="material && segment" class="yx-card listening-card card v2-b3listen-card">
        <view class="eyebrow v2-b3listen-eyebrow"><AppIcon name="activity" :size="14" /><text>听力材料</text></view>
        <view class="v2-b3listen-head"><view class="v2-b3listen-titles"><text class="card-kicker v2-b3listen-kicker">{{ material.title }} · {{ Math.round(material.durationMs / 1000) }}s</text><text class="v2-b3listen-title v2-b3listen-h2">{{ material.title }}</text></view></view>
        <view class="waveform v2-b3listen-wave"><view v-for="bar in 24" :key="bar" class="bar v2-b3listen-bar" :style="{ height: `${24 + (bar % 7) * 7}rpx` }"></view></view>
        <text class="segment-time d v2-b3listen-d v2-b3listen-meta">{{ segment.startMs }}ms — {{ segment.endMs }}ms</text>
        <view class="audio-controls v2-b3listen-controls v2-b3listen-row"><button tabindex="0" role="button" class="small-button btn opt v2-b3listen-btn v2-b3listen-opt v2-b3listen-tool" type="button" :disabled="!audioSource" @click="playAudio"><AppIcon name="activity" :size="14" />播放</button><button tabindex="0" role="button" class="small-button btn opt v2-b3listen-btn v2-b3listen-opt v2-b3listen-tool" type="button" :disabled="!audioSource" @click="pauseAudio">暂停</button><picker class="v2-b3listen-picker" mode="selector" :range="PLAYBACK_RATES" @change="playbackRate = PLAYBACK_RATES[Number($event.detail.value)] ?? 1; changeRate()"><view class="small-button btn opt v2-b3listen-btn v2-b3listen-opt v2-b3listen-tool"><AppIcon name="clock" :size="14" />{{ playbackRate }}x</view></picker></view>
        <text class="hint d v2-b3listen-d">{{ audioSource ? '已获得授权播放地址；速度控制使用原生音频适配层。' : '当前内容没有授权播放地址；波形、时间轴和听写可检查，但不会伪造播放。' }}</text>
        <view class="token-list v2-b3listen-list"><view v-for="token in segment.tokens" :key="token.tokenId" class="token v2-b3listen-row"><AppIcon name="list" :size="14" /><text class="v2-b3listen-stem">{{ token.text }}</text><text class="token__time d v2-b3listen-d v2-b3listen-time">{{ token.startMs }}–{{ token.endMs }}ms</text></view></view>
        <input v-model="answer" class="answer v2-b3listen-input" placeholder="输入你听到的句子" confirm-type="done" />
        <button tabindex="0" role="button" class="yx-button btn v2-b3listen-btn v2-b3listen-opt v2-b3listen-submit" type="button" @click="submit"><AppIcon name="check" :size="14" />提交听写</button>
        <view v-if="result" class="result fb v2-b3listen-fb"><text class="d v2-b3listen-d">得分 {{ result.score }}</text><text class="d v2-b3listen-d">{{ result.feedbackCodes.join(' · ') || '已记录' }}</text></view>
      </view>
      <view v-else-if="status !== 'loading'" class="yx-card empty card v2-b3listen-card"><view class="eyebrow v2-b3listen-eyebrow"><AppIcon name="inbox" :size="14" /><text>暂无材料</text></view><text class="v2-b3listen-title v2-b3listen-h2">暂时没有可用的授权听力材料。</text><button tabindex="0" role="button" class="yx-button btn v2-b3listen-btn v2-b3listen-opt v2-b3listen-submit" type="button" @click="load"><AppIcon name="refresh" :size="14" />重新读取</button></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.listening-card{display:grid;gap:16rpx}.card-kicker{color:var(--yx-brand);font-size:22rpx;font-weight:700}.waveform{display:flex;align-items:center;justify-content:space-between;height:90rpx;padding:0 14rpx;border-radius:14rpx;background:var(--yx-brand-soft)}.bar{width:7rpx;border-radius:8rpx;background:var(--yx-brand)}.segment-time,.hint{color:var(--yx-text-secondary);font-size:23rpx}.audio-controls{display:flex;align-items:center;gap:10rpx}.small-button{min-height:58rpx;padding:0 16rpx;border:1rpx solid var(--yx-border);border-radius:10rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx;line-height:58rpx}.small-button:disabled{opacity:.45}.token-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10rpx}.token{display:grid;gap:4rpx;padding:14rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;font-size:24rpx}.token__time{color:var(--yx-text-tertiary);font-size:19rpx}.answer{height:84rpx;padding:0 20rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;font-size:27rpx}.result{display:grid;gap:6rpx;padding:18rpx;border-radius:12rpx;color:var(--yx-success);background:var(--yx-surface-page);font-size:24rpx}.empty{display:grid;gap:16rpx;color:var(--yx-text-secondary);font-size:26rpx}
/* v2 听力页换皮：对齐 mobile/styles.css 与 refine.css 中 .card/.eyebrow/.opt/.fb/.btn/.list-row，对齐 practice.vue v2-practice-* 与 today.vue v2-today-* 同样数值，仅用 var(--v2-*)。 */
.v2-b3listen-body{display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b3listen-card{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font)}
.v2-b3listen-card:hover{border-color:var(--v2-brand)}
.v2-b3listen-eyebrow{display:flex;align-items:center;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase;overflow-wrap:anywhere}
.v2-b3listen-title,.v2-b3listen-h2{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin:var(--v2-space-1) 0 0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-b3listen-kicker{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;line-height:1.5;text-transform:uppercase;overflow-wrap:anywhere}
.v2-b3listen-head{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
.v2-b3listen-head>*{min-width:0;max-width:100%}
.v2-b3listen-titles{display:flex;flex-direction:column;gap:var(--v2-space-2);flex:1 1 auto;box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b3listen-titles>*{min-width:0;max-width:100%}
.v2-b3listen-status{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b3listen-wave{display:flex;align-items:center;justify-content:space-between;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-2) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-soft);overflow:hidden}
.v2-b3listen-bar{flex:none;min-width:0;max-width:100%;border-radius:var(--v2-radius-pill);background:var(--v2-brand)}
.v2-b3listen-d{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-b3listen-meta{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-b3listen-controls{display:flex;align-items:center;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
.v2-b3listen-controls>*{min-width:0;max-width:100%}
.v2-b3listen-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b3listen-row>*{min-width:0;max-width:100%}
.v2-b3listen-row:not(.v2-b3listen-controls){padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card)}
.v2-b3listen-row:not(.v2-b3listen-controls):hover{border-color:var(--v2-brand)}
.v2-b3listen-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b3listen-stem{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-b3listen-time{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-b3listen-picker{display:flex;box-sizing:border-box;max-width:100%;min-width:0}
.v2-b3listen-opt{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-b3listen-controls .v2-b3listen-opt{width:auto;flex:0 0 auto}
.v2-b3listen-opt:hover{border-color:var(--v2-brand)}
.v2-b3listen-opt:active{transform:scale(.97)}
.v2-b3listen-opt:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-b3listen-opt:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-b3listen-tool{width:auto;flex:0 0 auto}
.v2-b3listen-btn{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-b3listen-row .v2-b3listen-btn{width:auto;flex:0 0 auto}
.v2-b3listen-btn:hover{border-color:var(--v2-brand)}
.v2-b3listen-btn:active{transform:scale(.97)}
.v2-b3listen-btn:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-b3listen-btn:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-b3listen-submit{border-color:transparent;background:var(--v2-brand);color:var(--v2-inverse);font-family:var(--v2-font);font-weight:700}
.v2-b3listen-submit:hover{border-color:var(--v2-brand)}
.v2-b3listen-input{box-sizing:border-box;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.5;overflow-wrap:anywhere}
.v2-b3listen-input::placeholder{color:var(--v2-mut)}
.v2-b3listen-input:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-b3listen-fb{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin-top:var(--v2-space-4);padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-b3listen-fb.ok{background:var(--v2-ok-soft);color:var(--v2-ok)}
.v2-b3listen-fb.no{background:var(--v2-bad-soft);color:var(--v2-bad)}
</style>
