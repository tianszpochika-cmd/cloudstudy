<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { downloadB3Asset } from '../platform/b3-media-download'
import { sha256Text } from '../platform/b3-offline'
import { listLanguageClips } from '../api/b3'
import { saveB11MediaProgress } from '../api/b11'
import type { LanguageClip } from '../domain/b3'
import { useLearningUi } from '../platform/learning-ui'
import { extractPeaksFromArrayBuffer, peaksToBars } from '../platform/waveform'
import { useB3Store } from '../stores/b3'
import { useB11Store } from '../stores/b11'
import '../platform/b11-i18n'

const ui = useLearningUi()
const b3 = useB3Store()
const b11 = useB11Store()
const audio = ref<HTMLAudioElement | null>(null)
const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const
const activeSegmentIndex = ref(0)
const answer = ref('')
const aPointMs = ref<number | null>(null)
const bPointMs = ref<number | null>(null)
const loopEnabled = ref(false)
const mediaUnavailable = ref(false)
// A-B LOOP is a local timeline aid; its points never enter ordinary progress payloads.
// Language Clips remain server-provided segment references and use the same player.
const clips = ref<LanguageClip[]>([])
const downloadState = ref<'idle' | 'loading' | 'done' | 'error'>('idle')
const downloadMessage = ref<string | null>(null)
// Real peaks extracted from the authorized bytes; empty while loading or when the
// environment cannot decode, in which case the view keeps the decorative fallback.
const waveformPeaks = ref<readonly number[]>([])
const waveBars = computed(() => waveformPeaks.value.length ? peaksToBars(waveformPeaks.value, 48) : null)

async function loadWaveform(): Promise<void> {
  const src = audioSrc.value
  if (!src || waveformPeaks.value.length) return
  try {
    const response = await fetch(src)
    if (!response.ok) return
    const extracted = await extractPeaksFromArrayBuffer(await response.arrayBuffer(), 96)
    waveformPeaks.value = extracted.peaks
  } catch {
    waveformPeaks.value = []
  }
}

const material = computed(() => b3.materials[0] ?? null)
const activeSegment = computed(() => material.value?.segments[activeSegmentIndex.value] ?? null)
const audioSrc = computed(() => mediaUnavailable.value ? null : b11.signedUrl?.url ?? material.value?.mediaRef?.signedUrl ?? null)
const progressPercent = computed(() => material.value?.durationMs ? Math.min(100, Math.round((b11.progress?.positionMs ?? 0) / material.value.durationMs * 100)) : 0)
const effectiveStatus = computed(() => b11.status !== 'idle' && b11.status !== 'ready' ? b11.status : b3.status)
const effectiveMessage = computed(() => b11.message || b3.message)
const statusTitle = computed(() => ['loading', 'empty', 'offline', 'error', 'permission', 'revoked', 'expired', 'recovering'].includes(effectiveStatus.value) ? ui.t(`b11.state.${effectiveStatus.value}`) : ui.t('b11.state.ready'))

type PitchAwareAudioElement = HTMLAudioElement & { preservesPitch?: boolean; mozPreservesPitch?: boolean; webkitPreservesPitch?: boolean }
function preservePitch(element: HTMLAudioElement | null): void {
  const candidate = element as PitchAwareAudioElement | null
  if (!candidate) return
  if ('preservesPitch' in candidate) candidate.preservesPitch = true
  if ('mozPreservesPitch' in candidate) candidate.mozPreservesPitch = true
  if ('webkitPreservesPitch' in candidate) candidate.webkitPreservesPitch = true
}
watch(audio, (element) => preservePitch(element), { immediate: true })

onMounted(async () => {
  await b3.loadListening()
  const item = material.value
  if (!item) return
  clips.value = await listLanguageClips(item.materialId).catch(() => [])
  if (item.mediaRef?.assetId) { await b11.loadMedia(item.mediaRef.assetId); await b11.authorizePlayback(); void loadWaveform() }
  await b3.startListeningSession(item.materialId)
})

onUnmounted(() => { audio.value?.pause(); if (audio.value) audio.value.src = '' })

async function reload(): Promise<void> { mediaUnavailable.value = false; b11.signedUrl = null; await b3.loadListening(); const item = material.value; if (item?.mediaRef?.assetId) { await b11.loadMedia(item.mediaRef.assetId); await b11.authorizePlayback() } }
async function selectSegment(index: number): Promise<void> { activeSegmentIndex.value = index; const segment = material.value?.segments[index]; if (!segment || !audio.value || !audioSrc.value) return; audio.value.currentTime = segment.startMs / 1000; try { await audio.value.play() } catch { b11.status = 'error'; b11.message = ui.t('b11.listening.mediaUnavailable') } }
function setRate(value: string): void { const rate = Number(value); if (!Number.isFinite(rate)) return; if (audio.value) audio.value.playbackRate = rate }
function onPlay(): void { b11.message = '' }
function onMediaError(): void { mediaUnavailable.value = true; b11.signedUrl = null; b11.status = 'error'; b11.message = ui.t('b11.listening.mediaUnavailable') }
function onTimeUpdate(): void {
  const positionMs = Math.round((audio.value?.currentTime ?? 0) * 1000)
  const segment = activeSegment.value
  if (segment && positionMs >= segment.endMs && activeSegmentIndex.value < (material.value?.segments.length ?? 1) - 1) activeSegmentIndex.value += 1
  if (loopEnabled.value && aPointMs.value !== null && bPointMs.value !== null && positionMs >= bPointMs.value && audio.value) audio.value.currentTime = aPointMs.value / 1000
}
async function savePosition(): Promise<void> {
  const item = material.value
  const sessionId = b3.listeningSessionId
  const positionMs = Math.round((audio.value?.currentTime ?? 0) * 1000)
  const assetId = item?.mediaRef?.assetId ?? b11.manifest?.assetId
  if (!item || !assetId) return
  const positionVersion = (b11.progress?.positionVersion ?? 0) + 1
  const payload = { assetId, contentVersionId: item.contentVersionId, positionMs, positionVersion, playbackRate: audio.value?.playbackRate ?? 1, subtitleMode: (b11.progress?.subtitleMode ?? 'HIDDEN') as 'HIDDEN' | 'VISIBLE' }
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new TypeError('offline')
    await saveB11MediaProgress({ sessionId, assetId, positionMs, durationMs: item.durationMs, contentVersion: item.contentVersionId, entityVersion: positionVersion, clientEventId: `b11-media-progress-${assetId}-${positionVersion}` })
    b11.progress = payload
  } catch {
    try { b11.queueProgress(payload, await sha256Text(JSON.stringify(payload))) } catch { b11.status = 'error'; b11.message = '当前环境无法生成安全进度哈希。' }
  }
}
function toggleSubtitles(): void {
  const item = material.value
  const assetId = item?.mediaRef?.assetId ?? b11.manifest?.assetId
  if (!item || !assetId) return
  b11.progress = { assetId, contentVersionId: item.contentVersionId, positionMs: b11.progress?.positionMs ?? 0, positionVersion: b11.progress?.positionVersion ?? 0, playbackRate: b11.progress?.playbackRate ?? 1, subtitleMode: b11.progress?.subtitleMode === 'VISIBLE' ? 'HIDDEN' : 'VISIBLE' }
}
function markA(): void { aPointMs.value = Math.round((audio.value?.currentTime ?? 0) * 1000) }
function markB(): void { bPointMs.value = Math.round((audio.value?.currentTime ?? 0) * 1000) }
function clearAB(): void { aPointMs.value = null; bPointMs.value = null; loopEnabled.value = false }
function submit(): void { if (b3.listeningSessionId && activeSegment.value) void b3.evaluateDictation(b3.listeningSessionId, activeSegment.value.segmentId, answer.value) }
async function cacheMedia(): Promise<void> {
  const manifest = b11.manifest
  const access = b11.signedUrl
  if (!manifest || !access?.url || !access.checksumSha256) { downloadState.value = 'error'; downloadMessage.value = ui.t('b11.listening.mediaUnavailable'); return }
  downloadState.value = 'loading'; downloadMessage.value = null
  try { await downloadB3Asset({ assetId: manifest.assetId, url: access.url, expectedSha256: access.checksumSha256, expectedBytes: manifest.renditions.find((item) => item.renditionId === access.renditionId)?.byteLength, expiresAt: access.expiresAt }); downloadState.value = 'done'; downloadMessage.value = ui.t('b11.listening.downloaded') }
  catch (error) { downloadState.value = 'error'; downloadMessage.value = error instanceof Error ? error.message : ui.t('b11.listening.mediaUnavailable') }
}
function formatMs(value: number): string { const seconds = Math.max(0, Math.round(value / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` }
function scorePercent(value: number): number { const score = Number(value); if (!Number.isFinite(score)) return 0; return Math.round(score > 1 ? score : score * 100) }
function feedbackText(result: { feedbackCodes?: string[]; feedbackCode?: string; reviewSignal?: string }): string { return result.feedbackCodes?.join(' · ') || result.feedbackCode || result.reviewSignal || '' }
</script>

<template>
  <section class="b11-page" :data-performance="b11.performanceLevel" aria-labelledby="b11-listening-title">
    <ExperienceHeader page="Listening" icon="headphones" title-id="b11-listening-title" />
    <section v-if="effectiveStatus !== 'ready' || b11.hasPending" class="state-panel" :class="`state-panel--${effectiveStatus}`" role="status" aria-live="polite"><div class="state-copy"><span class="eyebrow">LST / MEDIA</span><strong>{{ statusTitle }}</strong><span>{{ effectiveMessage || (b11.hasPending ? `${ui.t('b11.common.offline')} · ${b11.pending.length}` : '') }}</span><small>{{ ui.t('b11.common.performance', { level: b11.performanceLevel }) }}</small></div><div class="state-actions"><button v-if="['offline', 'error', 'permission', 'revoked', 'expired', 'recovering'].includes(effectiveStatus)" class="secondary-button" type="button" @click="reload">{{ ui.t('b11.common.retry') }}</button><button v-if="b11.hasPending" class="secondary-button" type="button" @click="void b11.sync()">{{ ui.t('b11.common.sync') }}（{{ b11.pending.length }}）</button><select :value="b11.performanceLevel" aria-label="Performance level" @change="b11.setPerformance(($event.target as HTMLSelectElement).value as 'Ultra' | 'High' | 'Medium' | 'Performance')"><option>Ultra</option><option>High</option><option>Medium</option><option>Performance</option></select></div></section>
    <section v-if="effectiveStatus === 'loading'" class="empty-panel" role="status">{{ ui.t('b11.state.loading') }}</section>
    <section v-else-if="!material" class="empty-panel"><strong>{{ ui.t('b11.listening.noMaterial') }}</strong><p>{{ ui.t('b11.state.empty') }}</p></section>
    <section v-else class="listening-layout">
      <aside class="side-panel"><div class="material-meta"><strong>{{ material.title }}</strong><span>{{ material.cefrLevel ?? '—' }} · {{ formatMs(material.durationMs) }}</span><span :class="material.rightsStatus === 'AUTHORIZED' ? 'status-good' : 'status-bad'">{{ material.rightsStatus }}</span></div><div class="progress" aria-label="播放进度"><span :style="{ width: `${progressPercent}%` }"></span></div><small>{{ ui.t('b11.listening.positionSaved') }}</small><button class="secondary-button" type="button" :disabled="!b11.signedUrl?.url || downloadState === 'loading'" @click="void cacheMedia()">{{ downloadState === 'done' ? ui.t('b11.listening.downloaded') : ui.t('b11.listening.download') }}</button><span v-if="downloadMessage" class="message" role="status">{{ downloadMessage }}</span><div class="clip-list"><p class="eyebrow">LANGUAGE CLIPS</p><p v-if="!clips.length" class="muted">{{ ui.t('b11.listening.noClips') }}</p><button v-for="clip in clips" :key="clip.clipId" type="button" @click="void selectSegment(material.segments.findIndex((segment) => segment.startMs === clip.startMs))">{{ clip.title }} · {{ formatMs(clip.endMs - clip.startMs) }}</button></div></aside>
          <section class="content-column"><article class="player-panel"><div class="panel-heading"><div><p class="eyebrow">{{ b11.signedUrl ? 'AUTHORIZED URL' : 'TEXT / TIMELINE FALLBACK' }}</p><h3>{{ activeSegment?.text ?? ui.t('b11.listening.mediaUnavailable') }}</h3></div><span class="state-chip">{{ b11.performanceLevel }} · {{ b11.renderPolicy.mode }}</span></div><div class="waveform" :data-source="waveBars ? 'extracted' : 'fallback'" aria-hidden="true"><template v-if="waveBars"><i v-for="(bar, index) in waveBars" :key="`peak-${index}`" :style="{ height: `${Math.round(8 + bar * 84)}%` }"></i></template><template v-else><i v-for="bar in 48" :key="`fallback-${bar}`" :style="{ height: `${28 + ((bar * 17) % 58)}%` }"></i></template></div><audio v-if="audioSrc" ref="audio" :src="audioSrc" controls preload="metadata" @play="onPlay" @error="onMediaError" @pause="void savePosition()" @ended="void savePosition()" @timeupdate="onTimeUpdate"><track kind="captions" /></audio><div v-else class="media-fallback" role="status"><strong>{{ b11.status === 'revoked' ? ui.t('b11.listening.revoked') : b11.status === 'expired' ? ui.t('b11.listening.expired') : ui.t('b11.listening.mediaUnavailable') }}</strong><span>{{ ui.t('b11.common.noMedia') }}</span></div><div class="player-controls"><label>{{ ui.t('b11.listening.speed') }} <select :value="audio?.playbackRate ?? 1" @change="setRate(($event.target as HTMLSelectElement).value)"><option v-for="rate in PLAYBACK_RATES" :key="rate" :value="rate">{{ rate }}×</option></select></label><button class="secondary-button" type="button" @click="toggleSubtitles">{{ b11.progress?.subtitleMode === 'VISIBLE' ? ui.t('b11.listening.hideSubtitles') : ui.t('b11.listening.subtitles') }}</button><button class="secondary-button" type="button" @click="markA">{{ ui.t('b11.listening.markA') }} <small>{{ aPointMs === null ? '—' : formatMs(aPointMs) }}</small></button><button class="secondary-button" type="button" @click="markB">{{ ui.t('b11.listening.markB') }} <small>{{ bPointMs === null ? '—' : formatMs(bPointMs) }}</small></button><button class="secondary-button" type="button" :aria-pressed="loopEnabled" :disabled="aPointMs === null || bPointMs === null" @click="loopEnabled = !loopEnabled">{{ ui.t('b11.listening.loop') }}</button><button class="secondary-button" type="button" @click="clearAB">{{ ui.t('b11.listening.clearAB') }}</button></div><p v-if="b11.progress?.subtitleMode === 'VISIBLE' && activeSegment" class="subtitle" aria-live="polite">{{ activeSegment.text }}<span v-if="activeSegment.translation"> · {{ activeSegment.translation }}</span></p></article><article class="dictation-panel"><div class="panel-heading"><div><p class="eyebrow">DICTATION · SERVER RULES</p><h3>{{ ui.t('b11.listening.dictation') }}</h3></div><span class="state-chip">{{ ui.t('b11.common.phase1') }}</span></div><div class="segment-list"><button v-for="(segment, index) in material.segments" :key="segment.segmentId" type="button" :class="{ active: activeSegmentIndex === index }" @click="void selectSegment(index)"><span>{{ formatMs(segment.startMs) }}–{{ formatMs(segment.endMs) }}</span>{{ segment.text }}</button></div><label class="field-label" for="dictation-answer">{{ ui.t('b11.listening.answerPlaceholder') }}</label><textarea id="dictation-answer" v-model="answer" rows="4" :placeholder="ui.t('b11.listening.answerPlaceholder')" autocomplete="off"></textarea><button class="primary-button" type="button" :disabled="!answer.trim() || !b3.listeningSessionId || !activeSegment" @click="submit">{{ ui.t('b11.listening.submit') }}</button><div v-if="b3.dictationResult" class="result" role="status"><strong>{{ b3.dictationResult.correct ? '✓' : '↺' }} · {{ scorePercent(b3.dictationResult.score) }}%</strong><span>{{ feedbackText(b3.dictationResult) }}</span></div></article></section>
    </section>
  </section>
</template>

<style scoped>
.b11-page{display:grid;gap:22px}.page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.page-heading h2{margin:8px 0;font-size:clamp(30px,5vw,48px);line-height:1.1}.page-heading p:not(.eyebrow){max-width:760px;margin:0;color:var(--yx-color-text-secondary);line-height:1.7}.eyebrow{margin:0;color:var(--yx-color-brand-primary);font-size:12px;font-weight:800;letter-spacing:.12em}.locale-pill,.state-chip{padding:8px 12px;border:1px solid var(--yx-color-border);border-radius:999px;color:var(--yx-color-text-secondary);font-size:12px}.state-panel{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;padding:15px 17px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.state-panel--offline,.state-panel--error,.state-panel--permission,.state-panel--revoked,.state-panel--recovering{border-color:var(--yx-color-danger)}.state-copy{display:grid;gap:5px;min-width:240px}.state-copy>span:not(.eyebrow){color:var(--yx-color-text-secondary);line-height:1.5}.state-copy small{color:var(--yx-color-text-tertiary)}.state-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.state-actions select,.player-controls select{min-height:38px;padding:0 9px;border:1px solid var(--yx-color-border);border-radius:10px;background:var(--yx-color-surface-page)}.listening-layout{display:grid;grid-template-columns:260px minmax(0,1fr);gap:20px}.side-panel,.player-panel,.dictation-panel,.empty-panel{padding:22px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.side-panel{display:grid;align-content:start;gap:12px;height:max-content}.material-meta{display:grid;gap:4px}.material-meta span{color:var(--yx-color-text-secondary);font-size:13px}.status-good{color:var(--yx-color-success)!important}.status-bad{color:var(--yx-color-danger)!important}.progress{height:8px;border-radius:999px;background:var(--yx-color-surface-muted);overflow:hidden}.progress span{display:block;height:100%;background:var(--yx-color-brand-primary)}.secondary-button,.primary-button{min-height:40px;padding:0 12px;border-radius:10px;font-weight:750}.secondary-button{border:1px solid var(--yx-color-border);color:var(--yx-color-brand-primary);background:var(--yx-color-surface-page)}.primary-button{border:0;color:var(--yx-color-text-on-brand);background:var(--yx-color-brand-primary)}button:disabled{cursor:not-allowed;opacity:.52}.message,.muted{color:var(--yx-color-text-secondary);font-size:13px;line-height:1.6}.clip-list{display:grid;gap:7px;margin-top:8px}.clip-list button,.segment-list button{padding:10px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-text-primary);background:var(--yx-color-surface-page);text-align:left}.clip-list button:hover,.segment-list button.active{border-color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.content-column{display:grid;gap:20px}.player-panel,.dictation-panel{display:grid;gap:14px}.panel-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.panel-heading h3{margin:5px 0 0}.waveform{display:flex;align-items:center;gap:4px;height:96px;padding:15px;border-radius:14px;background:var(--yx-color-brand-primary-soft);overflow:hidden}.waveform i{display:block;flex:1;min-width:2px;border-radius:4px;background:var(--yx-color-brand-primary)}audio{width:100%}.media-fallback{display:grid;gap:4px;padding:20px;border:1px dashed var(--yx-color-border);border-radius:14px;color:var(--yx-color-text-secondary)}.player-controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.player-controls label{display:flex;align-items:center;gap:7px;color:var(--yx-color-text-secondary);font-size:13px}.subtitle{margin:0;padding:12px;border-radius:10px;background:var(--yx-color-surface-muted);line-height:1.7}.segment-list{display:grid;gap:8px;max-height:250px;overflow:auto}.segment-list button{display:grid;gap:4px}.segment-list button span{color:var(--yx-color-text-tertiary);font-size:12px}.dictation-panel textarea{width:100%;box-sizing:border-box;padding:12px;border:1px solid var(--yx-color-border);border-radius:10px;background:var(--yx-color-surface-page);resize:vertical}.result{display:grid;gap:5px;padding:13px;border-radius:12px;background:var(--yx-color-brand-primary-soft)}.result span{color:var(--yx-color-text-secondary)}.empty-panel{min-height:140px}.empty-panel p{color:var(--yx-color-text-secondary)}
@media(max-width:760px){.page-heading{align-items:flex-start;flex-direction:column}.listening-layout{grid-template-columns:1fr}.side-panel{order:-1}.panel-heading{flex-direction:column}}
    .state-panel--expired{border-color:var(--yx-color-danger)}
    </style>
