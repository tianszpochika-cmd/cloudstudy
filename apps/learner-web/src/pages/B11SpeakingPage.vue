<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { createShadowingSession, deleteRecording, listListeningMaterials, listMinimalPairs, submitSelfRating, updateShadowingProgress } from '../api/b3'
import { createMemoryB3RecordingVault, decryptB3Recording, encryptB3Recording } from '../platform/b3-recording-vault'
import { useLearningUi } from '../platform/learning-ui'
import { userFacingError } from '../platform/user-facing-error'
import { useB3Store } from '../stores/b3'
import { useB11Store } from '../stores/b11'
import type { ListeningMaterial, MinimalPair, Phoneme, SelfRating, ShadowingSession } from '../domain/b3'
import type { B11RecordingMetadata } from '../domain/b11'
import '../platform/b11-i18n'

const ui = useLearningUi()
const b3 = useB3Store()
const b11 = useB11Store()
const vault = createMemoryB3RecordingVault()
const recorder = ref<MediaRecorder | null>(null)
const isRecording = ref(false)
const permissionState = ref<'unknown' | 'prompt' | 'granted' | 'denied'>('unknown')
const selectedPhoneme = ref<Phoneme | null>(null)
const minimalPairs = ref<MinimalPair[]>([])
const localMeta = ref<B11RecordingMetadata | null>(null)
const localVaultId = ref<string | null>(null)
const playbackUrl = ref<string | null>(null)
const rating = ref<SelfRating | null>(null)
const recordingDurationMs = ref(0)
const shadowing = ref<ShadowingSession | null>(null)
const demoAudioUrl = ref<string | null>(null)
const demoAudioMessage = ref('正在检查示范音频资源…')
const chunks: Blob[] = []
let startedAt = 0

const activeVersion = computed(() => selectedPhoneme.value?.contentVersionId ?? 0)
const effectiveStatus = computed(() => b11.status !== 'idle' && b11.status !== 'ready' ? b11.status : b3.status)
const statusTitle = computed(() => ['loading', 'empty', 'offline', 'error', 'permission', 'revoked', 'expired', 'recovering'].includes(effectiveStatus.value) ? ui.t(`b11.state.${effectiveStatus.value}`) : ui.t('b11.state.ready'))
const effectiveMessage = computed(() => userFacingError(b11.message || b3.message, ui.t('b11.state.error')))
const currentRecording = computed(() => b11.recording ?? localMeta.value)

// Closed practice (coming soon): no live media/recording reads until the backend path exists.
onMounted(() => undefined)
onUnmounted(() => { if (recorder.value?.state === 'recording') recorder.value.stop(); if (playbackUrl.value) URL.revokeObjectURL(playbackUrl.value) })

async function loadDemoAudio(): Promise<void> {
  try {
    const material = (await listListeningMaterials())[0] as ListeningMaterial | undefined
    const media = material?.mediaRef
    if (media?.rightsStatus === 'AUTHORIZED' && media.availability !== 'NOT_READY' && media.signedUrl) {
      demoAudioUrl.value = media.signedUrl
      demoAudioMessage.value = '示范音频已获得短时授权。'
      return
    }
    demoAudioMessage.value = media?.rightsStatus === 'REVOKED'
      ? '示范音频权益已撤销；已降级为文本脚本和 2D 口型。'
      : '示范音频当前没有可播放授权地址；已降级为文本脚本和 2D 口型。'
  } catch {
    demoAudioMessage.value = '示范音频资源暂时不可用；已降级为文本脚本和 2D 口型。'
  }
}

async function startRecording(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { permissionState.value = 'denied'; b11.status = 'permission'; b11.message = ui.t('b11.speaking.denied'); return }
  permissionState.value = 'prompt'
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); permissionState.value = 'granted'; chunks.splice(0, chunks.length); startedAt = Date.now()
    const nextRecorder = new MediaRecorder(stream)
    nextRecorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
    nextRecorder.onstop = () => { stream.getTracks().forEach((track) => track.stop()); recordingDurationMs.value = Math.max(500, Date.now() - startedAt); isRecording.value = false; b11.message = '录音已停止；点击保存录音前不会上传任何原始音频。' }
    nextRecorder.start(); recorder.value = nextRecorder; isRecording.value = true; b11.message = '正在录音；完成后点击停止。'
  } catch { permissionState.value = 'denied'; b11.status = 'permission'; b11.message = ui.t('b11.speaking.denied') }
}
function stopRecording(): void { if (recorder.value?.state === 'recording') recorder.value.stop() }
async function encryptAndRegister(): Promise<void> {
  if (!chunks.length || isRecording.value || !selectedPhoneme.value) return
  try {
    const blob = new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' }); const encrypted = await encryptB3Recording(blob, vault.keyProvider); const id = `b11-local-${encrypted.contentHash.slice(0, 32)}`; await vault.put(id, encrypted); localVaultId.value = id
    const meta = { recordingId: id, sourceSegmentId: `phoneme-${selectedPhoneme.value.phonemeId}`, durationMs: recordingDurationMs.value, contentHash: encrypted.contentHash, storageMode: 'LOCAL_ENCRYPTED' as const, status: 'LOCAL_ONLY' as const, aiScoringEnabled: false as const, contentVersionId: selectedPhoneme.value.contentVersionId }
    localMeta.value = meta
    chunks.splice(0, chunks.length)
    b11.recording = null
    await b11.saveRecording({ recordingId: meta.recordingId, sourceSegmentId: meta.sourceSegmentId, durationMs: meta.durationMs, contentHash: meta.contentHash, storageMode: meta.storageMode, contentVersionId: meta.contentVersionId })
    const savedRecording = b11.recording as B11RecordingMetadata | null
    if (savedRecording && savedRecording.recordingId === meta.recordingId && savedRecording.status === 'SAVED') localMeta.value = savedRecording
  } catch (error) { b11.status = 'error'; b11.message = error instanceof Error ? error.message : '录音加密失败；未保存原始录音。' }
}
async function replayLocal(): Promise<void> { if (!localVaultId.value) { b11.message = ui.t('b11.speaking.missing'); return }; const encrypted = await vault.get(localVaultId.value); if (!encrypted) { b11.message = ui.t('b11.speaking.missing'); return }; try { const blob = await decryptB3Recording(encrypted, vault.keyProvider); if (playbackUrl.value) URL.revokeObjectURL(playbackUrl.value); playbackUrl.value = URL.createObjectURL(blob); b11.message = '正在回放临时解密音频；普通状态只保留本地仓 ID 和 hash。' } catch (error) { b11.message = error instanceof Error ? error.message : ui.t('b11.speaking.missing') } }
async function retake(): Promise<void> { if (localVaultId.value) await vault.delete(localVaultId.value); localVaultId.value = null; localMeta.value = null; b11.recording = null; rating.value = null; if (playbackUrl.value) { URL.revokeObjectURL(playbackUrl.value); playbackUrl.value = null }; chunks.splice(0, chunks.length); b11.message = '已清理当前录音，新的录音会生成新的 hash 和幂等事件。' }
async function remove(): Promise<void> { const serverId = b11.recording?.recordingId; if (serverId) { try { await deleteRecording(serverId) } catch (error) { b11.message = error instanceof Error ? error.message : '服务端删除暂未确认，本地副本仍保留。'; return } }; await retake() }
async function rate(value: SelfRating): Promise<void> { rating.value = value; const serverId = b11.recording?.recordingId; if (serverId) { try { await submitSelfRating(serverId, value); b11.message = '自评已提交；系统不会生成 AI 分数。' } catch (error) { b11.status = 'offline'; b11.message = error instanceof Error ? error.message : '自评提交失败，本地录音仍保留。' } } else b11.message = '自评已保存在本地，待录音登记完成后提交。' }
async function startShadowing(): Promise<void> { if (selectedPhoneme.value) { try { shadowing.value = await createShadowingSession(`phoneme-${selectedPhoneme.value.phonemeId}`) } catch (error) { b11.message = error instanceof Error ? error.message : '影子跟读会话暂时无法建立。' } } }
async function saveShadowing(): Promise<void> { if (!shadowing.value || !selectedPhoneme.value) return; try { await updateShadowingProgress(shadowing.value.shadowingSessionId, recordingDurationMs.value, shadowing.value.attemptCount + 1); shadowing.value = { ...shadowing.value, positionMs: recordingDurationMs.value, attemptCount: shadowing.value.attemptCount + 1 }; b11.message = ui.t('b11.speaking.shadowingSaved') } catch (error) { b11.message = error instanceof Error ? error.message : '影子跟读进度暂未同步。' } }
</script>

<template>
  <section class="b11-page v2-page v2-page--b11speaking" :data-performance="b11.performanceLevel" aria-labelledby="b11-speaking-title">
    <ExperienceHeader page="Speaking" icon="mic" title-id="b11-speaking-title" />
    <p data-closed-practice role="status"><strong>跟读练习</strong><span data-coming-soon style="display:inline-block;margin-left:8px;padding:1px 8px;border-radius:999px;background:rgba(245,158,11,.16);color:#d97706;font-size:12px;font-weight:700;vertical-align:middle">即将开放</span><span data-closed-reason style="display:block;margin-top:4px;opacity:.8">跟读需要录音上传和发音评分服务，目前尚未接入，无法给出真实评分。</span></p>
    <a data-closed-back href="/today">回到可用学习</a>
     <section v-if="effectiveStatus !== 'ready' || b11.hasPending" class="state-panel" :class="`state-panel--${effectiveStatus}`" role="status" aria-live="polite"><div class="state-copy"><span class="eyebrow">跟读 · 录音</span><strong>{{ statusTitle }}</strong><span>{{ effectiveMessage || (b11.hasPending ? `${ui.t('b11.common.offline')} · ${b11.pending.length}` : '') }}</span><small>{{ ui.t('b11.common.performance', { level: b11.performanceLevel }) }}</small></div><div class="state-actions"><button v-if="['offline', 'error', 'permission', 'revoked', 'expired', 'recovering'].includes(effectiveStatus)" class="secondary-button" type="button" @click="void b3.loadPhonetics()">{{ ui.t('b11.common.retry') }}</button><button v-if="b11.hasPending" class="secondary-button" type="button" @click="void b11.sync()">{{ ui.t('b11.common.sync') }}（{{ b11.pending.length }}）</button><select :value="b11.performanceLevel" aria-label="Performance level" @change="b11.setPerformance(($event.target as HTMLSelectElement).value as 'Ultra' | 'High' | 'Medium' | 'Performance')"><option>Ultra</option><option>High</option><option>Medium</option><option>Performance</option></select></div></section>
    <section v-if="b3.status === 'loading'" class="empty-panel" role="status">{{ ui.t('b11.state.loading') }}</section>
    <section v-else-if="!b3.phonemes.length && effectiveStatus === 'empty'" class="empty-panel"><strong>{{ ui.t('b11.speaking.noPhonemes') }}</strong><p>{{ ui.t('b11.state.empty') }}</p></section>
    <section v-else class="speaking-layout v2-b11speaking-main">
      <article class="phonetics-panel"><div class="panel-heading"><div><p class="eyebrow">EN_48_PHASE1</p><h3>{{ b3.phonemes.length }} 个音标条目</h3></div><span class="state-chip">{{ ui.t('b11.speaking.noAi') }}</span></div><div class="phonemes"><button v-for="item in b3.phonemes" :key="item.phonemeId" type="button" :class="{ active: selectedPhoneme?.phonemeId === item.phonemeId }" :aria-pressed="selectedPhoneme?.phonemeId === item.phonemeId" @click="selectedPhoneme = item"><strong>{{ item.symbol }}</strong><small>{{ item.group }}</small></button></div><div v-if="selectedPhoneme" class="mouth-fallback"><p class="eyebrow">2D MOUTH FALLBACK · {{ selectedPhoneme.mouthProfile.profileVersion }}</p><strong>{{ selectedPhoneme.symbol }} · {{ selectedPhoneme.exampleWord }}</strong><span>{{ selectedPhoneme.description }}</span><small>下颌 {{ selectedPhoneme.mouthProfile.jawOpen }} · 舌高 {{ selectedPhoneme.mouthProfile.tongueHeight }} · 唇圆 {{ selectedPhoneme.mouthProfile.lipRound }} · {{ selectedPhoneme.mouthProfile.voicing ? '声带振动' : '清音' }}</small></div><div class="demo-audio" role="status" aria-live="polite"><p class="eyebrow">DEMO AUDIO</p><audio v-if="demoAudioUrl" class="demo-audio-player" controls :src="demoAudioUrl" aria-label="示范音频"></audio><span v-else>{{ demoAudioMessage }}</span></div><div class="pairs"><p class="eyebrow">最小对立词</p><span v-for="pair in minimalPairs" :key="pair.pairId">{{ pair.leftWord }} ↔ {{ pair.rightWord }}</span></div></article>
      <article class="recorder-panel"><div class="panel-heading"><div><p class="eyebrow">录音 · 本地加密</p><h3>Good habits help.</h3></div><span class="state-chip">v{{ activeVersion }}</span></div><p class="privacy-note">{{ ui.t('b11.speaking.permission') }} {{ ui.t('b11.common.phase1') }}</p><div class="permission-banner" :class="`permission-banner--${permissionState}`" role="status"><strong>MIC: {{ permissionState.toUpperCase() }}</strong><span v-if="permissionState === 'denied'">{{ ui.t('b11.speaking.denied') }}</span><span v-else>录音原始数据不会写入普通 Pinia 状态、事件或日志。</span></div><div class="actions"><button v-if="!isRecording" class="primary-button" type="button" @click="void startRecording()">{{ ui.t('b11.speaking.start') }}</button><button v-else class="danger-button" type="button" @click="stopRecording">{{ ui.t('b11.speaking.stop') }}</button><button class="secondary-button" type="button" :disabled="!chunks.length || isRecording" @click="void encryptAndRegister()">{{ ui.t('b11.speaking.save') }}</button><button class="secondary-button" type="button" :disabled="!currentRecording" @click="void replayLocal()">{{ ui.t('b11.speaking.replay') }}</button><button class="secondary-button" type="button" :disabled="!currentRecording" @click="void retake()">{{ ui.t('b11.speaking.retake') }}</button><button class="secondary-button" type="button" :disabled="!currentRecording" @click="void remove()">{{ ui.t('b11.speaking.delete') }}</button></div><audio v-if="playbackUrl" class="playback" controls :src="playbackUrl" aria-label="本地录音回放"></audio><div v-if="currentRecording" class="recording-meta" role="status"><strong>{{ currentRecording.status }}</strong><span>{{ currentRecording.durationMs }}ms · SHA-256 {{ currentRecording.contentHash.slice(0, 16) }}…</span><small>{{ currentRecording.recordingId.startsWith('b11-local-') ? ui.t('b11.speaking.localOnly') : `server:${currentRecording.recordingId}` }}</small><div class="rating"><span>{{ ui.t('b11.speaking.rating') }}</span><button type="button" @click="void rate('NEEDS_PRACTICE')">{{ ui.t('b11.speaking.needsPractice') }}</button><button type="button" @click="void rate('BASIC')">{{ ui.t('b11.speaking.basic') }}</button><button type="button" @click="void rate('FLUENT')">{{ ui.t('b11.speaking.fluent') }}</button><button type="button" @click="void rate('UNCERTAIN')">{{ ui.t('b11.speaking.uncertain') }}</button></div></div><div v-if="!currentRecording" class="rating rating--disabled" role="group" aria-label="自评"><span>完成真实录音并登记后可提交自评</span><button type="button" disabled>{{ ui.t('b11.speaking.needsPractice') }}</button><button type="button" disabled>{{ ui.t('b11.speaking.basic') }}</button><button type="button" disabled>{{ ui.t('b11.speaking.fluent') }}</button><button type="button" disabled>{{ ui.t('b11.speaking.uncertain') }}</button></div><p v-if="b11.message" class="message" role="status">{{ b11.message }}</p></article>
    </section>
    <article v-if="selectedPhoneme" class="shadowing-panel"><div class="panel-heading"><div><p class="eyebrow">{{ ui.t('b11.speaking.shadowing') }} · 500ms</p><h3>Scripted shadowing</h3></div><span class="state-chip">{{ ui.t('b11.common.phase1') }}</span></div><p class="privacy-note">影子跟读只提交片段、位置、次数和 contentVersion；不提交语音内容，也不生成 AI 分数。</p><div class="actions"><button class="primary-button" type="button" @click="void startShadowing()">{{ ui.t('b11.speaking.startShadowing') }}</button><button class="secondary-button" type="button" :disabled="!shadowing" @click="void saveShadowing()">{{ ui.t('b11.reading.save') }}</button></div><p v-if="shadowing" class="recording-meta">{{ shadowing.status }} · {{ shadowing.attemptCount }} attempts · {{ shadowing.positionMs }}ms · aiScoringAvailable=false</p></article>
    <aside class="v2-b11speaking-rail" aria-label="练习提示"><h2>口语练习</h2><ol><li>先听示范，再开始录音。</li><li>录完可回放，满意后再提交。</li></ol></aside>
  </section>
</template>

<style scoped>
.b11-page{display:grid;gap:22px}.page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.page-heading h2{margin:8px 0;font-size:clamp(30px,5vw,48px);line-height:1.1}.page-heading p:not(.eyebrow){max-width:760px;margin:0;color:var(--yx-color-text-secondary);line-height:1.7}.eyebrow{margin:0;color:var(--yx-color-brand-primary);font-size:12px;font-weight:800;letter-spacing:.12em}.locale-pill,.state-chip{padding:8px 12px;border:1px solid var(--yx-color-border);border-radius:999px;color:var(--yx-color-text-secondary);font-size:12px}.state-panel{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;padding:15px 17px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.state-panel--offline,.state-panel--error,.state-panel--permission,.state-panel--revoked,.state-panel--recovering{border-color:var(--yx-color-danger)}.state-copy{display:grid;gap:5px;min-width:240px}.state-copy>span:not(.eyebrow){color:var(--yx-color-text-secondary);line-height:1.5}.state-copy small{color:var(--yx-color-text-tertiary)}.state-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.state-actions select{min-height:38px;padding:0 9px;border:1px solid var(--yx-color-border);border-radius:10px;background:var(--yx-color-surface-page)}.speaking-layout{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:20px}.phonetics-panel,.recorder-panel,.shadowing-panel,.empty-panel{min-width:0;padding:22px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.phonetics-panel,.recorder-panel,.shadowing-panel{display:grid;align-content:start;gap:14px}.panel-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.panel-heading h3{margin:5px 0 0}.phonemes{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.phonemes button{min-width:0;display:grid;gap:4px;padding:10px;border:1px solid var(--yx-color-border);border-radius:12px;background:var(--yx-color-surface-page);cursor:pointer}.phonemes button.active{border-color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft);box-shadow:0 0 0 2px var(--yx-color-focus-ring)}.phonemes strong{font-size:25px;color:var(--yx-color-brand-primary)}.phonemes small{overflow-wrap:anywhere;color:var(--yx-color-text-tertiary);font-size:10px}.mouth-fallback{display:grid;gap:8px;min-height:150px;padding:16px;border-radius:14px;background:var(--yx-color-brand-primary-soft)}.mouth-fallback strong{font-size:24px}.mouth-fallback span,.mouth-fallback small,.privacy-note,.message{color:var(--yx-color-text-secondary);line-height:1.6}.demo-audio{display:grid;gap:8px;padding:12px;border:1px solid var(--yx-color-border);border-radius:12px;background:var(--yx-color-surface-muted)}.demo-audio span{color:var(--yx-color-text-secondary);line-height:1.5}.demo-audio-player{width:100%;max-width:100%}.pairs{display:flex;flex-wrap:wrap;gap:8px}.pairs .eyebrow{width:100%}.pairs span{padding:7px 10px;border-radius:999px;background:var(--yx-color-surface-muted);color:var(--yx-color-brand-primary);font-size:13px}.recorder-panel{min-height:350px}.permission-banner{display:grid;gap:5px;padding:12px;border:1px solid var(--yx-color-border);border-radius:12px;background:var(--yx-color-surface-muted)}.permission-banner span{color:var(--yx-color-text-secondary);font-size:13px;line-height:1.5}.permission-banner--denied{border-color:var(--yx-color-danger)}.permission-banner--granted{border-color:var(--yx-color-success)}.actions,.rating{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.secondary-button,.primary-button,.danger-button,.rating button{min-height:40px;padding:0 12px;border-radius:10px;font-weight:750}.secondary-button,.rating button{border:1px solid var(--yx-color-border);color:var(--yx-color-brand-primary);background:var(--yx-color-surface-page)}.primary-button{border:0;color:var(--yx-color-text-on-brand);background:var(--yx-color-brand-primary)}.danger-button{border:0;color:var(--yx-color-text-on-brand);background:var(--yx-color-danger)}button:disabled{cursor:not-allowed;opacity:.52}.playback{width:100%}.recording-meta{display:grid;gap:6px;padding:13px;border-radius:12px;background:var(--yx-color-brand-primary-soft);word-break:break-word}.recording-meta span,.recording-meta small{color:var(--yx-color-text-secondary)}.rating{padding-top:8px;border-top:1px solid var(--yx-color-border)}.rating>span{width:100%;color:var(--yx-color-text-secondary);font-size:13px}.empty-panel{min-height:140px}.empty-panel p{color:var(--yx-color-text-secondary)}
@media(max-width:840px){.page-heading{align-items:flex-start;flex-direction:column}.speaking-layout{grid-template-columns:1fr}}
@media(max-width:520px){.phonemes{grid-template-columns:repeat(4,minmax(0,1fr))}.panel-heading{flex-direction:column}}
.rating--disabled{color:var(--yx-color-text-tertiary)}.rating--disabled button{cursor:not-allowed;opacity:.52}
.state-panel--expired{border-color:var(--yx-color-danger)}
</style>

<style>
/* B11Speaking v2 页面级样式（只做样式）：对齐 webDemo“专项练习会话（左主练习卡 + 右侧提示栏）”原型。
 * 选择器全部以 .v2-page--b11speaking 开头；颜色只用 --v2-* tokens，不写死色值以适配暗色。 */
.v2-page--b11speaking.v2-page{background:var(--v2-bg);color:var(--v2-ink);font-family:var(--v2-font);display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:var(--v2-space-5);align-items:start}
.v2-page--b11speaking .experience-heading{grid-column:1/-1;min-width:0}
.v2-page--b11speaking .state-panel{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--v2-space-4);padding:var(--v2-space-4) var(--v2-space-5);background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);min-width:0}
.v2-page--b11speaking .state-panel--offline,.v2-page--b11speaking .state-panel--error,.v2-page--b11speaking .state-panel--permission,.v2-page--b11speaking .state-panel--revoked,.v2-page--b11speaking .state-panel--expired,.v2-page--b11speaking .state-panel--recovering{border-color:var(--v2-bad)}
.v2-page--b11speaking .state-copy{display:grid;gap:var(--v2-space-1);min-width:240px}
.v2-page--b11speaking .state-copy strong{color:var(--v2-ink)}
.v2-page--b11speaking .state-panel .state-copy span{color:var(--v2-mut);line-height:1.5}
.v2-page--b11speaking .state-copy small{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b11speaking .state-actions{display:flex;flex-wrap:wrap;align-items:center;gap:var(--v2-space-2)}
.v2-page--b11speaking .empty-panel{grid-column:1;display:grid;gap:var(--v2-space-2);align-content:start;background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-6);min-width:0}
.v2-page--b11speaking .empty-panel strong{color:var(--v2-ink)}
.v2-page--b11speaking .empty-panel p{margin:0;color:var(--v2-mut);line-height:1.6}
.v2-page--b11speaking .v2-b11speaking-main{grid-column:1;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:var(--v2-space-5);align-items:start;min-width:0}
.v2-page--b11speaking .phonetics-panel,.v2-page--b11speaking .recorder-panel,.v2-page--b11speaking .shadowing-panel,.v2-page--b11speaking .v2-b11speaking-rail{background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-6);min-width:0}
.v2-page--b11speaking .phonetics-panel,.v2-page--b11speaking .recorder-panel,.v2-page--b11speaking .shadowing-panel{display:grid;gap:var(--v2-space-4);align-content:start}
.v2-page--b11speaking .shadowing-panel{grid-column:1}
.v2-page--b11speaking .panel-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--v2-space-3)}
.v2-page--b11speaking .panel-heading>div{min-width:0}
.v2-page--b11speaking .panel-heading h3{margin:var(--v2-space-1) 0 0;font-size:var(--v2-text-lg);color:var(--v2-ink);line-height:1.4}
.v2-page--b11speaking .eyebrow{margin:0;color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:800;letter-spacing:.12em}
.v2-page--b11speaking .state-chip{padding:var(--v2-space-2) var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700;white-space:nowrap}
.v2-page--b11speaking .phonemes{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:var(--v2-space-2)}
.v2-page--b11speaking .phonemes button{min-width:0;display:grid;gap:var(--v2-space-1);padding:var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-ink);cursor:pointer}
.v2-page--b11speaking .phonemes button:hover{border-color:var(--v2-brand);background:var(--v2-soft)}
.v2-page--b11speaking .phonemes button.active{border-color:var(--v2-brand);background:var(--v2-soft)}
.v2-page--b11speaking .phonemes strong{font-size:var(--v2-text-lg);color:var(--v2-brand)}
.v2-page--b11speaking .phonemes small{overflow-wrap:anywhere;color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b11speaking .mouth-fallback{display:grid;gap:var(--v2-space-2);padding:var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-soft)}
.v2-page--b11speaking .mouth-fallback strong{font-size:var(--v2-text-lg);color:var(--v2-ink)}
.v2-page--b11speaking .mouth-fallback span,.v2-page--b11speaking .mouth-fallback small{color:var(--v2-mut);line-height:1.6}
.v2-page--b11speaking .mouth-fallback small{font-size:var(--v2-text-xs)}
.v2-page--b11speaking .demo-audio{display:grid;gap:var(--v2-space-2);padding:var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-surface)}
.v2-page--b11speaking .demo-audio span{color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.5}
.v2-page--b11speaking .demo-audio-player{width:100%;max-width:100%}
.v2-page--b11speaking .pairs{display:flex;flex-wrap:wrap;gap:var(--v2-space-2)}
.v2-page--b11speaking .pairs .eyebrow{width:100%}
.v2-page--b11speaking .pairs span{padding:var(--v2-space-1) var(--v2-space-2);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-size:var(--v2-text-sm)}
.v2-page--b11speaking .privacy-note{margin:0;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.6}
.v2-page--b11speaking .message{margin:0;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.6}
.v2-page--b11speaking .permission-banner{display:grid;gap:var(--v2-space-1);padding:var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-surface)}
.v2-page--b11speaking .permission-banner strong{color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b11speaking .permission-banner span{color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.5}
.v2-page--b11speaking .permission-banner--denied{border-color:var(--v2-bad);background:var(--v2-bad-soft)}
.v2-page--b11speaking .permission-banner--granted{border-color:var(--v2-ok);background:var(--v2-ok-soft)}
.v2-page--b11speaking .actions,.v2-page--b11speaking .rating{display:flex;flex-wrap:wrap;gap:var(--v2-space-2);align-items:center}
.v2-page--b11speaking .primary-button,.v2-page--b11speaking .secondary-button,.v2-page--b11speaking .danger-button,.v2-page--b11speaking .rating button{min-height:40px;padding:0 var(--v2-space-3);border-radius:var(--v2-radius-sm);font-weight:750;cursor:pointer}
.v2-page--b11speaking .primary-button{border:0;background:var(--v2-brand);color:var(--v2-inverse)}
.v2-page--b11speaking .primary-button:hover:not(:disabled){background:var(--v2-brand2)}
.v2-page--b11speaking .secondary-button,.v2-page--b11speaking .rating button{border:1px solid var(--v2-line);background:var(--v2-soft);color:var(--v2-brand)}
.v2-page--b11speaking .secondary-button:hover:not(:disabled),.v2-page--b11speaking .rating button:hover:not(:disabled){border-color:var(--v2-brand)}
.v2-page--b11speaking .danger-button{border:0;background:var(--v2-bad);color:var(--v2-inverse)}
.v2-page--b11speaking .primary-button:disabled,.v2-page--b11speaking .secondary-button:disabled,.v2-page--b11speaking .danger-button:disabled,.v2-page--b11speaking .rating button:disabled{opacity:.5;cursor:not-allowed}
.v2-page--b11speaking .playback{width:100%}
.v2-page--b11speaking .recording-meta{display:grid;gap:var(--v2-space-1);padding:var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-soft);word-break:break-word}
.v2-page--b11speaking .recording-meta strong{color:var(--v2-ink)}
.v2-page--b11speaking .recording-meta span,.v2-page--b11speaking .recording-meta small{color:var(--v2-mut);font-size:var(--v2-text-sm)}
.v2-page--b11speaking .rating{padding-top:var(--v2-space-2);border-top:1px solid var(--v2-line)}
.v2-page--b11speaking .rating>span{width:100%;color:var(--v2-mut);font-size:var(--v2-text-sm)}
.v2-page--b11speaking .rating--disabled{color:var(--v2-mut)}
.v2-page--b11speaking .progress{height:6px;border-radius:var(--v2-radius-pill);background:var(--v2-surface);overflow:hidden}
.v2-page--b11speaking .progress span{display:block;height:100%;background:var(--v2-brand)}
.v2-page--b11speaking .state-actions select{min-height:38px;padding:0 var(--v2-space-2);border:1px solid var(--v2-line);border-radius:var(--v2-radius-sm);background:var(--v2-bg);color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b11speaking .v2-b11speaking-rail{grid-column:2;grid-row:2 / -1;position:sticky;top:var(--v2-space-6);display:grid;align-content:start;gap:var(--v2-space-3)}
.v2-page--b11speaking:has(.state-panel) .v2-b11speaking-rail{grid-row:3 / -1}
.v2-page--b11speaking .v2-b11speaking-rail h2{margin:0;font-size:var(--v2-text-lg);color:var(--v2-ink)}
.v2-page--b11speaking .v2-b11speaking-rail ol{margin:0;padding-left:var(--v2-space-5);display:grid;gap:var(--v2-space-2);color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.7}
.v2-page--b11speaking button:focus-visible,.v2-page--b11speaking a:focus-visible,.v2-page--b11speaking select:focus-visible,.v2-page--b11speaking audio:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
@media(max-width:1190px){.v2-page--b11speaking.v2-page{grid-template-columns:minmax(0,1fr) 250px}.v2-page--b11speaking .v2-b11speaking-main{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.v2-page--b11speaking .phonemes{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:900px){.v2-page--b11speaking.v2-page{grid-template-columns:1fr}.v2-page--b11speaking .empty-panel,.v2-page--b11speaking .v2-b11speaking-main,.v2-page--b11speaking .shadowing-panel{grid-column:1}.v2-page--b11speaking .v2-b11speaking-main{grid-template-columns:1fr}.v2-page--b11speaking .v2-b11speaking-rail{grid-column:1;grid-row:auto;position:static}.v2-page--b11speaking .panel-heading{flex-direction:column;align-items:flex-start}}
</style>
