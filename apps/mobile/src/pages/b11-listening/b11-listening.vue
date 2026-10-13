<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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
type AccountScope = { subject: string; revision: number }
let playbackScope: AccountScope | null = null
function accountScope(): AccountScope | null {
  return session.isAuthenticated && session.verifiedSubject
    ? { subject: session.verifiedSubject, revision: session.identityRevision } : null
}
function isCurrent(scope: AccountScope | null): scope is AccountScope {
  return Boolean(scope && session.isAuthenticated && session.verifiedSubject === scope.subject && session.identityRevision === scope.revision)
}
function stopPlayback(): void {
  if (timer.value) clearInterval(timer.value)
  timer.value = null
  audio.value?.destroy(); audio.value = null
  playbackScope = null
}
watch(() => session.identityRevision, () => { stopPlayback(); pageMessage.value = null }, { flush: 'sync' })
const themeClass = computed(() => `b10-theme--${b11ThemeMode.value}`)
const segment = computed(() => store.listening?.material.segments[0] ?? null)
const clip = computed(() => store.languageClips.find((item) => item.clipId === store.languageClipId) ?? null)
const source = computed(() => clip.value?.signedUrl ?? store.playbackSource)
const statusMessage = computed(() => pageMessage.value ?? store.listeningMessage)
const positionText = computed(() => `${Math.round(store.mediaPositionMs / 1000)}s / ${Math.round((store.listening?.material.durationMs ?? 0) / 1000)}s`)

async function load(): Promise<void> {
  pageMessage.value = null
  await session.restore()
  const scope = accountScope()
  if (!isCurrent(scope)) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return }
  await store.loadListening()
  if (!isCurrent(scope)) return
}

function tick(): void {
  if (!isCurrent(playbackScope)) { stopPlayback(); return }
  const seconds = audio.value?.currentTime
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return
  store.setPosition(seconds * 1000)
  if (store.abStartMs !== null && store.abEndMs !== null && store.abEndMs > store.abStartMs && store.mediaPositionMs >= store.abEndMs) {
    if (audio.value?.seek) audio.value.seek(store.abStartMs / 1000)
    else store.setPosition(store.abStartMs)
  }
}

function play(): void {
  const scope = accountScope()
  if (!isCurrent(scope)) return
  if (store.mediaRightsState === 'REVOKED') { pageMessage.value = b11T('listening.revoked'); return }
  if (store.mediaRightsState === 'EXPIRED') { pageMessage.value = b11T('status.expired'); return }
  if (!source.value) { pageMessage.value = b11T('listening.noMedia'); return }
  const context = getUniRuntime().createInnerAudioContext?.()
  if (!context) { pageMessage.value = '当前平台没有音频适配器；字幕与练习仍可继续。'; return }
  const control = context as AudioControl
  stopPlayback(); audio.value = control; playbackScope = scope
  enableUniAudioPitchPreservation(control, () => { pageMessage.value = '当前平台未声明音高保持能力；速度控制仍可用，已记录降级。' })
  control.src = source.value; control.playbackRate = store.playbackRate; control.play()
  if (timer.value) clearInterval(timer.value)
  timer.value = setInterval(tick, 500)
}

function pause(): void { if (!isCurrent(playbackScope)) return; audio.value?.pause(); tick(); void store.saveMediaProgress() }
function setRate(event: { detail: { value: number } }): void { if (!accountScope()) return; store.setPlaybackRate(PLAYBACK_RATES[Number(event.detail.value)] ?? 1); if (audio.value) audio.value.playbackRate = store.playbackRate }
function setPerformance(level: PerformanceLevel): void { store.setPerformance(level) }
function sync(): void { void store.syncOffline() }
function toggleMotion(disabled: boolean): void { store.setMotionDisabled(disabled) }
function setA(): void { if (!accountScope()) return; store.setABPoint('A'); pageMessage.value = `A 点：${Math.round(store.mediaPositionMs / 1000)}s` }
function setB(): void { if (!accountScope()) return; store.setABPoint('B'); pageMessage.value = `B 点：${Math.round(store.mediaPositionMs / 1000)}s` }
function selectClip(clipId: string): void { if (!accountScope()) return; store.selectLanguageClip(clipId); pageMessage.value = '已切换 Language Clip；播放地址仍需权益清单确认。' }

onMounted(() => { /* closed practice: no live load */ undefined })
onUnmounted(stopPlayback)
</script>

<template>
  <view class="yx-page b11-page v2-b11listen-page" :class="themeClass" :style="experienceStyle" :data-motion="store.motionDisabled || store.performanceLevel === 'Performance' ? 'off' : experienceMotion">
    <MobilePageHeader page="b11-listening" />
    <view class="v2-b11listen-body">
    <view class="yx-card card v2-b11listen-card" data-closed-practice role="status"><view class="eyebrow v2-b11listen-eyebrow"><AppIcon name="lock" :size="14" /><text>听力</text></view><text class="v2-b11listen-title v2-b11listen-h2">听力练习<text class="yx-soon-badge" data-coming-soon>即将开放</text></text><text class="yx-soon-reason" data-closed-reason>音频素材尚未上传到媒体库，播放地址无法签发；素材上线后即可在这里播放并听写。</text><button type="button" class="btn v2-b11listen-btn" data-closed-back @click="getUniRuntime().navigateTo({ url: '/pages/today/today' })"><AppIcon name="back" :size="14" />回到可用学习</button></view>

    <B11StatusPanel class="v2-b11listen-status" :status="store.listeningStatus" :message="statusMessage" :queue-count="store.queueCount" :performance-level="store.performanceLevel" :motion-disabled="store.motionDisabled" @retry="load" @sync="sync" @performance="setPerformance" @motion="toggleMotion" />

    <view v-if="store.listening && segment" class="yx-card listening-card card v2-b11listen-card">
      <view class="card-heading v2-b11listen-heading"><view class="v2-b11listen-titlewrap"><text class="kicker eyebrow v2-b11listen-eyebrow">{{ store.listening.material.title }}</text><text class="v2-b11listen-title v2-b11listen-h2">{{ store.listening.material.title }}</text><text class="subtle d v2-b11listen-d">{{ b11T('common.contentVersion') }} {{ store.listening.contentVersion }}</text></view><text class="rights v2-b11listen-meta" :class="`rights--${store.mediaRightsState.toLowerCase()}`">{{ store.mediaRightsState }}</text></view>
      <view class="timeline v2-b11listen-timeline"><view v-if="store.canUseWaveform" class="waveform v2-b11listen-wave" aria-label="waveform"><view v-for="bar in 28" :key="bar" class="bar v2-b11listen-bar" :style="{ height: `${22 + (bar % 8) * 7}rpx` }"></view></view><view v-else class="static-waveform v2-b11listen-wave"><text>2D / static timeline</text><text class="d v2-b11listen-d">{{ b11T('common.noSample') }}</text></view><view class="timeline-track v2-b11listen-track"><view class="timeline-progress v2-b11listen-progress" :style="{ width: `${store.mediaProgress}%` }"></view></view><text class="subtle d v2-b11listen-d">{{ b11T('listening.position') }} · {{ positionText }} · {{ Math.round(store.mediaProgress) }}%</text></view>
      <view class="controls v2-b11listen-controls v2-b11listen-row"><button tabindex="0" role="button" class="small-button btn sm opt v2-b11listen-btn v2-b11listen-opt v2-b11listen-tool" type="button" @click="play"><AppIcon name="activity" :size="14" />{{ b11T('listening.play') }}</button><button tabindex="0" role="button" class="small-button btn sm opt v2-b11listen-btn v2-b11listen-opt v2-b11listen-tool" type="button" @click="pause">{{ b11T('listening.pause') }}</button><picker class="v2-b11listen-picker" mode="selector" :range="PLAYBACK_RATES" :value="PLAYBACK_RATES.indexOf(store.playbackRate as (typeof PLAYBACK_RATES)[number])" @change="setRate"><view class="small-button btn sm opt v2-b11listen-btn v2-b11listen-opt v2-b11listen-tool"><AppIcon name="clock" :size="14" />{{ store.playbackRate }}x</view></picker><button tabindex="0" role="button" class="small-button btn sm opt v2-b11listen-btn v2-b11listen-opt v2-b11listen-tool" type="button" @click="setA"><AppIcon name="flag" :size="14" />{{ b11T('listening.setA') }}</button><button tabindex="0" role="button" class="small-button btn sm opt v2-b11listen-btn v2-b11listen-opt v2-b11listen-tool" type="button" @click="setB"><AppIcon name="flag" :size="14" />{{ b11T('listening.setB') }}</button><button tabindex="0" role="button" v-if="store.abStartMs !== null || store.abEndMs !== null" class="small-button secondary btn sm opt v2-b11listen-btn v2-b11listen-opt v2-b11listen-tool" type="button" @click="store.clearAB"><AppIcon name="x" :size="14" />{{ b11T('listening.clearAB') }}</button></view>
      <text v-if="store.abStartMs !== null || store.abEndMs !== null" class="subtle d v2-b11listen-d v2-b11listen-meta">A {{ store.abStartMs === null ? '—' : `${Math.round(store.abStartMs / 1000)}s` }} · B {{ store.abEndMs === null ? '—' : `${Math.round(store.abEndMs / 1000)}s` }} · 仅在 A、B 都有效时循环。</text>
      <text class="subtle d v2-b11listen-d">{{ source ? '已获得短时播放地址；过期或撤销后自动停止授权。' : b11T('listening.noMedia') }}</text>

      <view v-if="store.languageClips.length" class="clip-card card v2-b11listen-card"><view class="eyebrow v2-b11listen-eyebrow"><AppIcon name="list" :size="14" /><text class="kicker eyebrow v2-b11listen-eyebrow">{{ b11T('listening.clip') }}</text></view><scroll-view scroll-x class="clip-list v2-b11listen-list"><button tabindex="0" role="button" v-for="item in store.languageClips" :key="item.clipId" class="clip btn sm opt v2-b11listen-btn v2-b11listen-opt" :class="{ active: item.clipId === store.languageClipId }" type="button" @click="selectClip(item.clipId)">{{ item.title }} · {{ Math.round(item.startMs / 1000) }}–{{ Math.round(item.endMs / 1000) }}s</button></scroll-view></view>
      <view v-if="segment" class="subtitle-card card v2-b11listen-card"><view class="eyebrow v2-b11listen-eyebrow"><AppIcon name="type" :size="14" /><text class="kicker eyebrow v2-b11listen-eyebrow">字幕 / 音变时间轴</text></view><view class="token-list v2-b11listen-list"><view v-for="token in segment.tokens" :key="token.tokenId" class="token v2-b11listen-row"><AppIcon name="list" :size="14" /><text class="v2-b11listen-stem">{{ token.text }}</text><text class="subtle d v2-b11listen-d v2-b11listen-time">{{ token.startMs }}–{{ token.endMs }}ms</text></view></view></view>
      <view class="dictation card v2-b11listen-card"><view class="eyebrow v2-b11listen-eyebrow"><AppIcon name="type" :size="14" /><text class="kicker eyebrow v2-b11listen-eyebrow">{{ b11T('listening.dictation') }}</text></view><input v-model="store.dictationAnswer" class="answer v2-b11listen-input" placeholder="输入你听到的句子" confirm-type="done" /><button tabindex="0" role="button" class="yx-button btn opt v2-b11listen-btn v2-b11listen-opt v2-b11listen-submit" type="button" @click="store.submitDictationAnswer"><AppIcon name="check" :size="14" />{{ b11T('listening.submit') }}</button><view v-if="store.dictationResult" class="feedback fb v2-b11listen-fb"><text class="d v2-b11listen-d">{{ store.dictationResult.correct ? '规则判定正确' : '已记录错题' }}</text><text class="d v2-b11listen-d">{{ store.dictationResult.feedbackCodes.join(' · ') || '已保存' }}</text></view></view>
      <button tabindex="0" role="button" class="yx-button yx-button--secondary btn opt v2-b11listen-btn v2-b11listen-opt v2-b11listen-submit" type="button" @click="store.saveMediaProgress(true)"><AppIcon name="check" :size="14" />保存播放进度</button>
    </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.b11-page{padding-bottom:64rpx}.listening-card,.dictation,.subtitle-card,.clip-card{display:grid;gap:18rpx}.card-heading{display:flex;justify-content:space-between;gap:16rpx}.card-heading>view{display:grid;gap:6rpx}.kicker{color:var(--yx-brand);font-size:23rpx;font-weight:800;letter-spacing:1rpx}.subtle{color:var(--yx-text-secondary);font-size:22rpx;line-height:1.55}.rights{font-size:21rpx;font-weight:800}.rights--authorized{color:var(--yx-success-strong)}.rights--revoked,.rights--expired{color:var(--yx-danger)}.timeline{display:grid;gap:12rpx}.waveform{display:flex;align-items:center;justify-content:space-between;height:96rpx;padding:0 16rpx;border-radius:16rpx;background:var(--yx-surface-soft)}.bar{width:7rpx;border-radius:8rpx;background:var(--yx-brand)}.static-waveform{display:flex;justify-content:space-between;padding:28rpx 18rpx;border-radius:16rpx;color:var(--yx-text-secondary);background:var(--yx-surface-soft);font-size:23rpx}.timeline-track{height:12rpx;overflow:hidden;border-radius:8rpx;background:var(--yx-border)}.timeline-progress{height:100%;border-radius:8rpx;background:var(--yx-brand)}.controls{display:flex;flex-wrap:wrap;gap:10rpx}.small-button{min-height:62rpx;padding:0 18rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx;line-height:62rpx}.small-button.secondary{color:var(--yx-text-secondary)}.clip-list{white-space:nowrap}.clip{display:inline-block;margin-right:10rpx;padding:14rpx 18rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-text-secondary);background:var(--yx-surface-card);font-size:22rpx}.clip.active{border-color:var(--yx-brand);color:var(--yx-brand);background:var(--yx-brand-soft)}.token-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10rpx}.token{display:grid;gap:4rpx;padding:14rpx;border:1rpx solid var(--yx-border);border-radius:12rpx}.answer{height:84rpx;padding:0 20rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-text-primary);background:var(--yx-surface-card);font-size:27rpx}.feedback{display:grid;gap:6rpx;padding:18rpx;border-radius:12rpx;color:var(--yx-success-strong);background:var(--yx-success-soft);font-size:23rpx}.empty{display:grid;gap:14rpx;color:var(--yx-text-primary)}
/* v2 听力页换皮：对齐 mobile/styles.css 与 refine.css 中 .card/.eyebrow/.opt/.fb/.btn/.list-row/.prog，对齐 practice.vue v2-practice-* 与 today.vue v2-today-* 同样数值，仅用 var(--v2-*)。 */
.v2-b11listen-page{box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b11listen-body{display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b11listen-body>*{min-width:0;max-width:100%}
.v2-b11listen-status{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b11listen-card{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font)}
.v2-b11listen-card:hover{border-color:var(--v2-brand)}
.v2-b11listen-card>*{min-width:0;max-width:100%}
.v2-b11listen-eyebrow{display:flex;align-items:center;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase;overflow-wrap:anywhere}
.v2-b11listen-title,.v2-b11listen-h2{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin:var(--v2-space-1) 0 0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-b11listen-titlewrap{display:grid;gap:var(--v2-space-1);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b11listen-titlewrap>*{min-width:0;max-width:100%}
.v2-b11listen-heading{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b11listen-heading>*{min-width:0;max-width:100%}
.v2-b11listen-d{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-b11listen-meta{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-b11listen-heading .v2-b11listen-meta{flex:0 0 auto}
.v2-b11listen-timeline{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b11listen-timeline>*{min-width:0;max-width:100%}
.v2-b11listen-wave{display:flex;align-items:center;justify-content:space-between;gap:var(--v2-space-1);box-sizing:border-box;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow:hidden;overflow-wrap:anywhere}
.v2-b11listen-bar{flex:1 1 0;min-width:0;border-radius:var(--v2-radius-pill);background:var(--v2-brand)}
.v2-b11listen-track{box-sizing:border-box;max-width:100%;min-width:0;height:14rpx;margin:var(--v2-space-2) 0 var(--v2-space-4);border-radius:var(--v2-radius-pill);background:var(--v2-surface);overflow:hidden}
.v2-b11listen-progress{height:100%;border-radius:inherit;background:var(--v2-brand)}
.v2-b11listen-controls{display:flex;align-items:center;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
.v2-b11listen-controls>*{min-width:0;max-width:100%}
.v2-b11listen-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b11listen-row>*{min-width:0;max-width:100%}
.v2-b11listen-row:not(.v2-b11listen-controls){padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card)}
.v2-b11listen-row:not(.v2-b11listen-controls):hover{border-color:var(--v2-brand)}
.v2-b11listen-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b11listen-list>*{min-width:0;max-width:100%}
.v2-b11listen-stem{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-b11listen-time{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-b11listen-picker{box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b11listen-controls .v2-b11listen-picker{flex:0 0 auto}
.v2-b11listen-opt{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-b11listen-controls .v2-b11listen-opt{width:auto;flex:0 0 auto}
.v2-b11listen-opt:hover{border-color:var(--v2-brand)}
.v2-b11listen-opt.sel,.v2-b11listen-opt.active{border-color:var(--v2-brand);background:var(--v2-soft)}
.v2-b11listen-opt:active{transform:scale(.97)}
.v2-b11listen-opt:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-b11listen-opt:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-b11listen-tool{width:auto;flex:0 0 auto}
.v2-b11listen-btn{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-b11listen-row .v2-b11listen-btn{width:auto;flex:0 0 auto}
.v2-b11listen-btn:hover{border-color:var(--v2-brand)}
.v2-b11listen-btn:active{transform:scale(.97)}
.v2-b11listen-btn:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-b11listen-btn:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-b11listen-input{box-sizing:border-box;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-md);line-height:1.5;overflow-wrap:anywhere}
.v2-b11listen-input:focus,.v2-b11listen-input:focus-visible{border-color:var(--v2-brand);box-shadow:var(--v2-focus);outline:none}
.v2-b11listen-submit{border-color:transparent;background:var(--v2-brand);color:var(--v2-inverse);font-family:var(--v2-font);font-weight:700}
.v2-b11listen-submit:hover{border-color:var(--v2-brand)}
.v2-b11listen-fb{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;margin-top:var(--v2-space-4);padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
</style>
