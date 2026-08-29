<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { PerformanceLevel } from '@englishflow/performance'
import B11StatusPanel from '../../components/b11/B11StatusPanel.vue'
import { b11T, b11ThemeMode } from '../../platform/b11-foundation'
import { enableUniAudioPitchPreservation, getUniRuntime, type UniAudioContext } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'
import { useB11LearningStore } from '../../stores/b11-learning'

type AudioControl = UniAudioContext & { currentTime?: number; duration?: number; seek?: (seconds: number) => void; onEnded?: (callback: () => void) => void }

const session = useSessionStore()
const store = useB11LearningStore()
const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const
const pageMessage = ref<string | null>(null)
const audio = ref<AudioControl | null>(null)
const timer = ref<ReturnType<typeof setInterval> | null>(null)
const themeClass = computed(() => `b10-theme--${b11ThemeMode.value}`)
const segment = computed(() => store.listening?.material.segments[0] ?? null)
const clip = computed(() => store.languageClips.find((item) => item.clipId === store.languageClipId) ?? null)
const source = computed(() => clip.value?.signedUrl ?? store.playbackSource)
const statusMessage = computed(() => pageMessage.value ?? store.listeningMessage)
const positionText = computed(() => `${Math.round(store.mediaPositionMs / 1000)}s / ${Math.round((store.listening?.material.durationMs ?? 0) / 1000)}s`)

async function load(): Promise<void> {
  pageMessage.value = null
  await session.restore()
  if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return }
  await store.loadListening()
}

function tick(): void {
  const seconds = audio.value?.currentTime
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return
  store.setPosition(seconds * 1000)
  if (store.abStartMs !== null && store.abEndMs !== null && store.abEndMs > store.abStartMs && store.mediaPositionMs >= store.abEndMs) {
    if (audio.value?.seek) audio.value.seek(store.abStartMs / 1000)
    else store.setPosition(store.abStartMs)
  }
}

function play(): void {
  if (store.mediaRightsState === 'REVOKED') { pageMessage.value = b11T('listening.revoked'); return }
  if (store.mediaRightsState === 'EXPIRED') { pageMessage.value = b11T('status.expired'); return }
  if (!source.value) { pageMessage.value = b11T('listening.noMedia'); return }
  const context = getUniRuntime().createInnerAudioContext?.()
  if (!context) { pageMessage.value = '当前平台没有音频适配器；字幕与练习仍可继续。'; return }
  const control = context as AudioControl
  audio.value?.destroy(); audio.value = control
  enableUniAudioPitchPreservation(control, () => { pageMessage.value = '当前平台未声明音高保持能力；速度控制仍可用，已记录降级。' })
  control.src = source.value; control.playbackRate = store.playbackRate; control.play()
  if (timer.value) clearInterval(timer.value)
  timer.value = setInterval(tick, 500)
}

function pause(): void { audio.value?.pause(); tick(); void store.saveMediaProgress() }
function setRate(event: { detail: { value: number } }): void { store.setPlaybackRate(PLAYBACK_RATES[Number(event.detail.value)] ?? 1); if (audio.value) audio.value.playbackRate = store.playbackRate }
function setPerformance(level: PerformanceLevel): void { store.setPerformance(level) }
function sync(): void { void store.syncOffline() }
function toggleMotion(disabled: boolean): void { store.setMotionDisabled(disabled) }
function setA(): void { store.setABPoint('A'); pageMessage.value = `A 点：${Math.round(store.mediaPositionMs / 1000)}s` }
function setB(): void { store.setABPoint('B'); pageMessage.value = `B 点：${Math.round(store.mediaPositionMs / 1000)}s` }
function selectClip(clipId: string): void { store.selectLanguageClip(clipId); pageMessage.value = '已切换 Language Clip；播放地址仍需权益清单确认。' }

onMounted(() => { void load() })
onUnmounted(() => { if (timer.value) clearInterval(timer.value); audio.value?.destroy() })
</script>

<template>
  <view class="yx-page b11-page" :class="themeClass">
    <text class="yx-eyebrow">{{ b11T('listening.eyebrow') }}</text>
    <text class="yx-title">{{ b11T('listening.title') }}</text>
    <text class="yx-description">{{ b11T('listening.description') }}</text>
    <B11StatusPanel :status="store.listeningStatus" :message="statusMessage" :queue-count="store.queueCount" :performance-level="store.performanceLevel" :motion-disabled="store.motionDisabled" @retry="load" @sync="sync" @performance="setPerformance" @motion="toggleMotion" />

    <view v-if="store.listening && segment" class="yx-card listening-card">
      <view class="card-heading"><view><text class="kicker">{{ store.listening.material.title }}</text><text class="subtle">{{ b11T('common.contentVersion') }} {{ store.listening.contentVersion }}</text></view><text class="rights" :class="`rights--${store.mediaRightsState.toLowerCase()}`">{{ store.mediaRightsState }}</text></view>
      <view class="timeline"><view v-if="store.canUseWaveform" class="waveform" aria-label="waveform"><view v-for="bar in 28" :key="bar" class="bar" :style="{ height: `${22 + (bar % 8) * 7}rpx` }"></view></view><view v-else class="static-waveform"><text>2D / static timeline</text><text>{{ b11T('common.noSample') }}</text></view><view class="timeline-track"><view class="timeline-progress" :style="{ width: `${store.mediaProgress}%` }"></view></view><text class="subtle">{{ b11T('listening.position') }} · {{ positionText }} · {{ Math.round(store.mediaProgress) }}%</text></view>
      <view class="controls"><button class="small-button" type="button" @click="play">{{ b11T('listening.play') }}</button><button class="small-button" type="button" @click="pause">{{ b11T('listening.pause') }}</button><picker mode="selector" :range="PLAYBACK_RATES" :value="PLAYBACK_RATES.indexOf(store.playbackRate as (typeof PLAYBACK_RATES)[number])" @change="setRate"><view class="small-button">{{ store.playbackRate }}x</view></picker><button class="small-button" type="button" @click="setA">{{ b11T('listening.setA') }}</button><button class="small-button" type="button" @click="setB">{{ b11T('listening.setB') }}</button><button v-if="store.abStartMs !== null || store.abEndMs !== null" class="small-button secondary" type="button" @click="store.clearAB">{{ b11T('listening.clearAB') }}</button></view>
      <text v-if="store.abStartMs !== null || store.abEndMs !== null" class="subtle">A {{ store.abStartMs === null ? '—' : `${Math.round(store.abStartMs / 1000)}s` }} · B {{ store.abEndMs === null ? '—' : `${Math.round(store.abEndMs / 1000)}s` }} · 仅在 A、B 都有效时循环。</text>
      <text class="subtle">{{ source ? '已获得短时播放地址；过期或撤销后自动停止授权。' : b11T('listening.noMedia') }}</text>

      <view v-if="store.languageClips.length" class="clip-card"><text class="kicker">{{ b11T('listening.clip') }}</text><scroll-view scroll-x class="clip-list"><button v-for="item in store.languageClips" :key="item.clipId" class="clip" :class="{ active: item.clipId === store.languageClipId }" type="button" @click="selectClip(item.clipId)">{{ item.title }} · {{ Math.round(item.startMs / 1000) }}–{{ Math.round(item.endMs / 1000) }}s</button></scroll-view></view>
      <view v-if="segment" class="subtitle-card"><text class="kicker">字幕 / 音变时间轴</text><view class="token-list"><view v-for="token in segment.tokens" :key="token.tokenId" class="token"><text>{{ token.text }}</text><text class="subtle">{{ token.startMs }}–{{ token.endMs }}ms</text></view></view></view>
      <view class="dictation"><text class="kicker">{{ b11T('listening.dictation') }}</text><input v-model="store.dictationAnswer" class="answer" placeholder="输入你听到的句子" confirm-type="done" /><button class="yx-button" type="button" @click="store.submitDictationAnswer">{{ b11T('listening.submit') }}</button><view v-if="store.dictationResult" class="feedback"><text>{{ store.dictationResult.correct ? '规则判定正确' : '已记录错题' }}</text><text>{{ store.dictationResult.feedbackCodes.join(' · ') || '服务端已保存' }}</text></view></view>
      <button class="yx-button yx-button--secondary" type="button" @click="store.saveMediaProgress(true)">保存播放进度</button>
    </view>
    <view v-else-if="store.listeningStatus !== 'loading'" class="yx-card empty"><text>{{ b11T('status.empty') }}</text><text class="subtle">{{ b11T('common.noSample') }}</text><button class="yx-button" type="button" @click="load">{{ b11T('status.retry') }}</button></view>
  </view>
</template>

<style scoped lang="scss">
.b11-page{padding-bottom:64rpx}.listening-card,.dictation,.subtitle-card,.clip-card{display:grid;gap:18rpx}.card-heading{display:flex;justify-content:space-between;gap:16rpx}.card-heading>view{display:grid;gap:6rpx}.kicker{color:var(--yx-brand);font-size:23rpx;font-weight:800;letter-spacing:1rpx}.subtle{color:var(--yx-text-secondary);font-size:22rpx;line-height:1.55}.rights{font-size:21rpx;font-weight:800}.rights--authorized{color:var(--yx-success-strong)}.rights--revoked,.rights--expired{color:var(--yx-danger)}.timeline{display:grid;gap:12rpx}.waveform{display:flex;align-items:center;justify-content:space-between;height:96rpx;padding:0 16rpx;border-radius:16rpx;background:var(--yx-surface-soft)}.bar{width:7rpx;border-radius:8rpx;background:var(--yx-brand)}.static-waveform{display:flex;justify-content:space-between;padding:28rpx 18rpx;border-radius:16rpx;color:var(--yx-text-secondary);background:var(--yx-surface-soft);font-size:23rpx}.timeline-track{height:12rpx;overflow:hidden;border-radius:8rpx;background:var(--yx-border)}.timeline-progress{height:100%;border-radius:8rpx;background:var(--yx-brand)}.controls{display:flex;flex-wrap:wrap;gap:10rpx}.small-button{min-height:62rpx;padding:0 18rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx;line-height:62rpx}.small-button.secondary{color:var(--yx-text-secondary)}.clip-list{white-space:nowrap}.clip{display:inline-block;margin-right:10rpx;padding:14rpx 18rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-text-secondary);background:var(--yx-surface-card);font-size:22rpx}.clip.active{border-color:var(--yx-brand);color:var(--yx-brand);background:var(--yx-brand-soft)}.token-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10rpx}.token{display:grid;gap:4rpx;padding:14rpx;border:1rpx solid var(--yx-border);border-radius:12rpx}.answer{height:84rpx;padding:0 20rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-text-primary);background:var(--yx-surface-card);font-size:27rpx}.feedback{display:grid;gap:6rpx;padding:18rpx;border-radius:12rpx;color:var(--yx-success-strong);background:var(--yx-success-soft);font-size:23rpx}.empty{display:grid;gap:14rpx;color:var(--yx-text-primary)}
</style>
