<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { PerformanceLevel } from '@englishflow/performance'
import { updateListeningProgress } from '../api/b3'
import { extractPeaksFromArrayBuffer, peaksToBars } from '../platform/waveform'
import { useB3Store } from '../stores/b3'

const store = useB3Store()
const performanceNames: Record<PerformanceLevel, string> = { Ultra: '极致', High: '高清', Medium: '标准', Performance: '省流畅' }
const answer = ref('')
const activeSegment = ref(0)
const submitted = ref(false)
const audio = ref<HTMLAudioElement | null>(null)
const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const
const playbackRate = ref(1)
const blindSubtitle = ref(true)
const loopEnabled = ref(false)
const aPointMs = ref<number | null>(null)
const bPointMs = ref<number | null>(null)
const material = computed(() => store.materials[0] ?? null)
const segment = computed(() => material.value?.segments[activeSegment.value] ?? null)
const audioSrc = computed(() => material.value?.mediaRef?.availability === 'READY' ? material.value.mediaRef.signedUrl ?? null : null)
const positionVersion = ref(0)
// Real peaks from the authorized bytes; the decorative track stays as the fallback.
const waveformPeaks = ref<readonly number[]>([])
const waveBars = computed(() => waveformPeaks.value.length ? peaksToBars(waveformPeaks.value, 36) : null)

async function loadWaveform(): Promise<void> {
  const src = audioSrc.value
  if (!src || waveformPeaks.value.length) return
  try {
    const response = await fetch(src)
    if (!response.ok) return
    const extracted = await extractPeaksFromArrayBuffer(await response.arrayBuffer(), 72)
    waveformPeaks.value = extracted.peaks
  } catch {
    waveformPeaks.value = []
  }
}
watch(audioSrc, () => { waveformPeaks.value = []; void loadWaveform() })

type PitchAwareAudioElement = HTMLAudioElement & { preservesPitch?: boolean; mozPreservesPitch?: boolean; webkitPreservesPitch?: boolean }
function preservePitch(element: HTMLAudioElement | null): void {
  const candidate = element as PitchAwareAudioElement | null
  if (!candidate) return
  if ('preservesPitch' in candidate) candidate.preservesPitch = true
  if ('mozPreservesPitch' in candidate) candidate.mozPreservesPitch = true
  if ('webkitPreservesPitch' in candidate) candidate.webkitPreservesPitch = true
}
watch(audio, (element) => preservePitch(element), { immediate: true })

onMounted(async () => { await store.loadListening(); if (material.value) await store.startListeningSession(material.value.materialId) })
onUnmounted(() => store.dispose())
function submit(): void { if (!segment.value || !store.listeningSessionId) return; submitted.value = true; void store.evaluateDictation(store.listeningSessionId, segment.value.segmentId, answer.value) }
function selectSegment(index: number): void { activeSegment.value = index; const item = material.value?.segments[index]; if (item && audio.value) { audio.value.currentTime = item.startMs / 1000; void audio.value.play().catch(() => undefined) } }
function setRate(): void { if (audio.value) audio.value.playbackRate = playbackRate.value }
function toggleLoop(): void { loopEnabled.value = !loopEnabled.value; if (audio.value) audio.value.loop = loopEnabled.value }
function markA(): void { aPointMs.value = audio.value ? Math.round(audio.value.currentTime * 1000) : null }
function markB(): void { bPointMs.value = audio.value ? Math.round(audio.value.currentTime * 1000) : null }
function onTimeUpdate(): void { if (!audio.value || aPointMs.value === null || bPointMs.value === null || audio.value.currentTime * 1000 < bPointMs.value) return; audio.value.currentTime = aPointMs.value / 1000 }
async function savePosition(): Promise<void> { if (!audio.value || !store.listeningSessionId) return; positionVersion.value += 1; try { await updateListeningProgress(store.listeningSessionId, Math.round(audio.value.currentTime * 1000), positionVersion.value, playbackRate.value, blindSubtitle.value ? 'HIDDEN' : 'VISIBLE') } catch { /* 进度失败不覆盖听写结果，下一次暂停会重试 */ } }
</script>

<template>
  <section class="b3-page v2-page v2-page--b3listening">
    <ExperienceHeader class="v2-b3listening-head" page="Listening" icon="headphones" title-id="listening-title" />
    <div class="v2-b3listening-body"><div class="v2-b3listening-main">
    <p data-closed-practice role="status" class="v2-b3listening-closed">听力功能暂未开放，可以先做其他练习。</p>
    <a data-closed-back href="/today" class="v2-b3listening-back">回到可用学习</a>
    <div v-if="store.status === 'loading'" class="panel v2-b3listening-state">正在读取听力素材…</div>
    <div v-else-if="store.status === 'error' || store.status === 'offline'" class="panel error v2-b3listening-state">{{ store.message }}<button type="button" @click="store.loadListening">重新读取</button></div>
    <div v-else-if="material" class="grid v2-b3listening-grid">
      <article class="panel player v2-b3listening-player">
        <div v-if="audioSrc" class="waveform" :data-source="waveBars ? 'extracted' : 'fallback'" role="img" :aria-label="waveBars ? '已解码波形' : '波形预览'"><template v-if="waveBars"><i v-for="(bar, index) in waveBars" :key="`peak-${index}`" :style="{ height: `${Math.round(8 + bar * 84)}px` }"></i></template><template v-else><i v-for="n in 36" :key="n" :style="{ height: `${20 + (n % 7) * 9}px` }"></i></template></div>
        <audio v-if="audioSrc" class="v2-b3listening-audio" ref="audio" :src="audioSrc" controls preload="metadata" @timeupdate="onTimeUpdate" @pause="void savePosition"><track kind="captions" /></audio>
        <div v-if="audioSrc" class="player-controls v2-b3listening-controls"><label>速度 <select v-model.number="playbackRate" @change="setRate"><option v-for="rate in PLAYBACK_RATES" :key="rate" :value="rate">{{ rate }}倍速</option></select></label><button type="button" @click="toggleLoop">{{ loopEnabled ? '关闭循环' : '单段循环' }}</button><button type="button" @click="markA">设 A</button><button type="button" @click="markB">设 B</button><button type="button" @click="blindSubtitle = !blindSubtitle">{{ blindSubtitle ? '揭示字幕' : '隐藏字幕' }}</button></div>
        <p class="media-note v2-b3listening-media-note">{{ audioSrc ? '音频已就绪，暂停时会保存播放位置。' : '音频暂不可用，仍可查看时间轴和听写。' }}</p><small class="performance-note v2-b3listening-performance">性能模式：{{ performanceNames[store.performanceLevel] }}</small>
        <div class="player-head v2-b3listening-player-head"><div><p class="eyebrow v2-b3listening-meta">{{ material.cefrLevel }} · 约{{ Math.round(material.durationMs / 1000) }}秒<span class="v2-sr-only">（{{ material.cefrLevel }} · {{ material.durationMs }}ms）</span></p><h3>{{ material.title }}</h3></div><span class="rights v2-b3listening-rights">{{ ({ AUTHORIZED: '已授权', REVOKED: '已下架' } as Record<string, string>)[material.rightsStatus] ?? '已授权' }}<span class="v2-sr-only">{{ material.rightsStatus }}</span></span></div>
        <div class="segments v2-b3listening-segments"><button v-for="(item, index) in material.segments" :key="item.segmentId" type="button" :class="{ active: activeSegment === index }" @click="selectSegment(index)"><span>{{ (item.startMs / 1000).toFixed(1) }}–{{ (item.endMs / 1000).toFixed(1) }}秒<span class="v2-sr-only">（{{ item.startMs }}–{{ item.endMs }}ms）</span></span>{{ blindSubtitle ? '字幕已隐藏' : item.text }}</button></div>
      </article>
      <article v-if="segment" class="panel dictation v2-b3listening-dictation"><p class="eyebrow v2-b3listening-dictation-eyebrow">听写<span class="v2-sr-only"> · {{ segment.segmentId }}</span></p><h3>先听，再写下来</h3><div class="token-row v2-b3listening-tokens"><span v-for="token in segment.tokens" :key="token.tokenId" :title="`${token.startMs}–${token.endMs}ms`">{{ token.text }}</span></div><textarea v-model="answer" rows="4" placeholder="听到什么就写下来"></textarea><button type="button" :disabled="!answer.trim()" @click="submit">提交听写</button><div v-if="submitted && store.dictationResult" class="result v2-b3listening-result"><strong>{{ store.dictationResult.correct ? '听写完成' : '继续修复' }}</strong><span>得分 {{ Math.round(store.dictationResult.score * 100) }}分<span class="v2-sr-only"> · {{ store.dictationResult.feedbackCodes.join(' / ') }}</span></span></div><small class="v2-b3listening-annotations">音变标注：{{ segment.annotations.map((item) => item.label).join('、') || '暂无' }}</small></article>
    </div>
    <div v-else class="panel v2-b3listening-state">暂无可用的听力素材。</div>
    </div><aside class="v2-b3listening-guide" aria-label="练习提示"><h2>专注听写</h2><ol><li>先听音频，再写下听到的内容。</li><li>可用变速与 A–B 段循环反复听。</li><li>提交后对照反馈，再继续下一段。</li></ol></aside></div>
  </section>
</template>

<style scoped>
.b3-page{display:grid;gap:24px}.hero{padding:32px;border-radius:28px;background:linear-gradient(135deg,var(--yx-color-text-primary),var(--yx-color-success));color:var(--yx-color-on-brand)}.hero h2{margin:8px 0;font-size:clamp(28px,4vw,46px)}.hero p:last-child{max-width:620px;line-height:1.7;color:var(--yx-color-success-soft)}.eyebrow{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--yx-color-text-secondary)}.hero .eyebrow{color:var(--yx-color-success-soft)}.grid{display:grid;grid-template-columns:1.2fr .8fr;gap:20px}.panel{padding:24px;border-radius:22px;background:var(--yx-color-surface-card);box-shadow:0 16px 40px color-mix(in srgb,var(--yx-color-text-primary) 5%, transparent)}.waveform{display:flex;align-items:center;gap:3px;height:100px;padding:16px;border-radius:16px;background:var(--yx-color-success-soft)}.waveform i{display:block;flex:1;border-radius:4px;background:var(--yx-color-success)}.player audio{width:100%;margin-top:12px}.player-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:12px}.player-controls button,.player-controls select{padding:8px 10px;border:1px solid var(--yx-color-border);border-radius:10px;background:var(--yx-color-surface-card);cursor:pointer}.media-note{padding:10px 12px;border-radius:10px;background:var(--yx-color-warning-soft);color:var(--yx-color-warning);font-size:12px}.player-head{display:flex;justify-content:space-between;align-items:flex-start;margin:20px 0}.player h3,.dictation h3{margin:6px 0 20px}.rights{padding:6px 10px;border-radius:99px;background:var(--yx-color-success-soft);color:var(--yx-color-success);font-size:12px}.segments{display:grid;gap:8px}.segments button{padding:14px;border:0;border-radius:12px;background:var(--yx-color-surface-page);text-align:left;cursor:pointer}.segments button.active{background:var(--yx-color-success-soft);color:var(--yx-color-success)}.segments span{display:block;margin-bottom:5px;color:var(--yx-color-text-secondary);font-size:12px}.token-row{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.token-row span{padding:8px 10px;border-bottom:3px solid var(--yx-color-success)}.dictation{display:grid;align-content:start;gap:14px}.dictation textarea{width:100%;padding:12px;border:1px solid var(--yx-color-border);border-radius:12px;resize:vertical;box-sizing:border-box}.dictation button{padding:12px 16px;border:0;border-radius:12px;background:var(--yx-color-success);color:var(--yx-color-on-brand);cursor:pointer}.dictation button:disabled{opacity:.45;cursor:not-allowed}.result{display:grid;gap:4px;padding:14px;border-radius:12px;background:var(--yx-color-success-soft);color:var(--yx-color-success)}.error{display:flex;gap:16px;align-items:center;color:var(--yx-color-danger)}@media(max-width:760px){.grid{grid-template-columns:1fr}.hero{padding:24px}}
</style>
