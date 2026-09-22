<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { updateListeningProgress } from '../api/b3'
import { useB3Store } from '../stores/b3'

const store = useB3Store()
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
  <p class="performance-note">性能档位：{{ store.performanceLevel }} · Performance 模式保留时间轴、字幕和听写</p>
  <section class="b3-page">
    <ExperienceHeader page="Listening" icon="headphones" title-id="listening-title" />
    <div v-if="store.status === 'loading'" class="panel">正在读取授权听力素材…</div>
    <div v-else-if="store.status === 'error' || store.status === 'offline'" class="panel error">{{ store.message }}<button type="button" @click="store.loadListening">重新读取</button></div>
    <div v-else-if="material" class="grid">
      <article class="panel player">
        <div class="waveform" role="img" aria-label="轻量波形降级轨道"><i v-for="n in 36" :key="n" :style="{ height: `${20 + (n % 7) * 9}px` }"></i></div>
        <audio ref="audio" :src="audioSrc || undefined" controls preload="metadata" @timeupdate="onTimeUpdate" @pause="void savePosition"><track kind="captions" /></audio>
        <div class="player-controls"><label>速度 <select v-model.number="playbackRate" @change="setRate"><option v-for="rate in PLAYBACK_RATES" :key="rate" :value="rate">{{ rate }}x</option></select></label><button type="button" @click="toggleLoop">{{ loopEnabled ? '关闭循环' : '单段循环' }}</button><button type="button" @click="markA">设 A</button><button type="button" @click="markB">设 B</button><button type="button" @click="blindSubtitle = !blindSubtitle">{{ blindSubtitle ? '揭示字幕' : '隐藏字幕' }}</button></div>
        <p class="media-note">{{ audioSrc ? '已获得授权播放地址，播放位置会在暂停时保存。' : '当前内容版本未返回可播放授权地址；波形、时间轴和听写仍可检查，未伪造播放成功。' }}</p><small class="performance-note">性能档位：{{ store.performanceLevel }} · Performance 模式保留时间轴、字幕和听写</small>
        <div class="player-head"><div><p class="eyebrow">{{ material.cefrLevel }} · {{ material.durationMs }}ms</p><h3>{{ material.title }}</h3></div><span class="rights">{{ material.rightsStatus }}</span></div>
        <div class="segments"><button v-for="(item, index) in material.segments" :key="item.segmentId" type="button" :class="{ active: activeSegment === index }" @click="selectSegment(index)"><span>{{ item.startMs }}–{{ item.endMs }}ms</span>{{ blindSubtitle ? '字幕已隐藏' : item.text }}</button></div>
      </article>
      <article v-if="segment" class="panel dictation"><p class="eyebrow">听写 · {{ segment.segmentId }}</p><h3>先听，再写下来</h3><div class="token-row"><span v-for="token in segment.tokens" :key="token.tokenId" :title="`${token.startMs}–${token.endMs}ms`">{{ token.text }}</span></div><textarea v-model="answer" rows="4" placeholder="答案提交到服务端规则判定，不使用本地猜测"></textarea><button type="button" :disabled="!answer.trim()" @click="submit">提交听写</button><div v-if="submitted && store.dictationResult" class="result"><strong>{{ store.dictationResult.correct ? '听写完成' : '继续修复' }}</strong><span>得分 {{ Math.round(store.dictationResult.score * 100) }} · {{ store.dictationResult.feedbackCodes.join(' / ') }}</span></div><small>音变标注：{{ segment.annotations.map((item) => item.label).join('、') || '暂无教研标注' }}；不做 AI 语音评分。</small></article>
    </div>
    <div v-else class="panel">服务端没有返回素材，未使用本地样例填充。</div>
  </section>
</template>

<style scoped>
.b3-page{display:grid;gap:24px}.hero{padding:32px;border-radius:28px;background:linear-gradient(135deg,var(--yx-color-text-primary),var(--yx-color-success));color:var(--yx-color-on-brand)}.hero h2{margin:8px 0;font-size:clamp(28px,4vw,46px)}.hero p:last-child{max-width:620px;line-height:1.7;color:var(--yx-color-success-soft)}.eyebrow{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--yx-color-text-secondary)}.hero .eyebrow{color:var(--yx-color-success-soft)}.grid{display:grid;grid-template-columns:1.2fr .8fr;gap:20px}.panel{padding:24px;border-radius:22px;background:var(--yx-color-surface-card);box-shadow:0 16px 40px color-mix(in srgb,var(--yx-color-text-primary) 5%, transparent)}.waveform{display:flex;align-items:center;gap:3px;height:100px;padding:16px;border-radius:16px;background:var(--yx-color-success-soft)}.waveform i{display:block;flex:1;border-radius:4px;background:var(--yx-color-success)}.player audio{width:100%;margin-top:12px}.player-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:12px}.player-controls button,.player-controls select{padding:8px 10px;border:1px solid var(--yx-color-border);border-radius:10px;background:var(--yx-color-surface-card);cursor:pointer}.media-note{padding:10px 12px;border-radius:10px;background:var(--yx-color-warning-soft);color:var(--yx-color-warning);font-size:12px}.player-head{display:flex;justify-content:space-between;align-items:flex-start;margin:20px 0}.player h3,.dictation h3{margin:6px 0 20px}.rights{padding:6px 10px;border-radius:99px;background:var(--yx-color-success-soft);color:var(--yx-color-success);font-size:12px}.segments{display:grid;gap:8px}.segments button{padding:14px;border:0;border-radius:12px;background:var(--yx-color-surface-page);text-align:left;cursor:pointer}.segments button.active{background:var(--yx-color-success-soft);color:var(--yx-color-success)}.segments span{display:block;margin-bottom:5px;color:var(--yx-color-text-secondary);font-size:12px}.token-row{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.token-row span{padding:8px 10px;border-bottom:3px solid var(--yx-color-success)}.dictation{display:grid;align-content:start;gap:14px}.dictation textarea{width:100%;padding:12px;border:1px solid var(--yx-color-border);border-radius:12px;resize:vertical;box-sizing:border-box}.dictation button{padding:12px 16px;border:0;border-radius:12px;background:var(--yx-color-success);color:var(--yx-color-on-brand);cursor:pointer}.dictation button:disabled{opacity:.45;cursor:not-allowed}.result{display:grid;gap:4px;padding:14px;border-radius:12px;background:var(--yx-color-success-soft);color:var(--yx-color-success)}.error{display:flex;gap:16px;align-items:center;color:var(--yx-color-danger)}@media(max-width:760px){.grid{grid-template-columns:1fr}.hero{padding:24px}}
</style>
