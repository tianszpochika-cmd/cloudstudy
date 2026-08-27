<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { PerformanceLevel } from '@englishflow/performance'
import B11StatusPanel from '../../components/b11/B11StatusPanel.vue'
import { loadB11ListeningMaterials } from '../../api/b11'
import { b11ContentLocale, b11T, b11ThemeMode, b11UiLocale } from '../../platform/b11-foundation'
import { createRecordingPlaybackSource, deleteProtectedRecording, protectRecording, recorderManager, requestMicrophonePermission } from '../../platform/b11-recording'
import { getUniRuntime, type UniAudioContext } from '../../platform/uni-runtime'
import { createB11ClientEventId, type B11PermissionStatus, type B11SelfRating } from '../../domain/b11'
import { useSessionStore } from '../../stores/session'
import { useB11LearningStore } from '../../stores/b11-learning'

const session = useSessionStore()
const store = useB11LearningStore()
const themeClass = computed(() => `b10-theme--${b11ThemeMode.value}`)
const selectedPhoneme = ref(store.phonemes[0] ?? null)
const isRecording = ref(false)
const localDuration = ref(0)
const localPath = ref<string | null>(null)
const audio = ref<UniAudioContext | null>(null)
const demoAudioUrl = ref<string | null>(null)
const demoAudioMessage = ref('正在检查示范音频资源…')
const ratingOptions: Array<{ value: B11SelfRating; label: string }> = [{ value: 'NEEDS_PRACTICE', label: '需要练习' }, { value: 'BASIC', label: '基本准确' }, { value: 'FLUENT', label: '比较流利' }, { value: 'UNCERTAIN', label: '不确定' }]
const sourceSegmentId = computed(() => store.listening?.material.segments[0]?.segmentId ?? 'b11-shadowing-segment-1')

async function load(): Promise<void> { await session.restore(); if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return }; await Promise.all([store.loadPhonetics(), loadDemoAudio()]); selectedPhoneme.value = store.phonemes[0] ?? null; const draft = store.recordingDraft; if (draft) { localPath.value = draft.localEncryptedPath ?? null; localDuration.value = draft.durationMs } }
async function loadDemoAudio(): Promise<void> {
  try {
    const material = (await loadB11ListeningMaterials({ uiLocale: b11UiLocale.value, contentLocale: b11ContentLocale.value }))[0]
    const media = material?.mediaRef
    if (media?.rightsStatus === 'AUTHORIZED' && media.availability !== 'NOT_READY' && media.signedUrl) { demoAudioUrl.value = media.signedUrl; demoAudioMessage.value = '示范音频已获得短时授权。'; return }
    demoAudioMessage.value = media?.rightsStatus === 'REVOKED' ? '示范音频权益已撤销；已降级为文本脚本和 2D 口型。' : '示范音频当前没有可播放授权地址；已降级为文本脚本和 2D 口型。'
  } catch { demoAudioMessage.value = '示范音频资源暂时不可用；已降级为文本脚本和 2D 口型。' }
}
function setPerformance(level: PerformanceLevel): void { store.setPerformance(level) }
function setMotion(disabled: boolean): void { store.setMotionDisabled(disabled) }
function sync(): void { void store.syncOffline() }
const recordingCopy = computed(() => isRecording.value ? '录音进行中…' : localPath.value ? `本地副本 ${localDuration.value}ms` : store.permissionStatus === 'REQUESTING' ? '正在请求麦克风权限…' : store.permissionStatus === 'DENIED' ? b11T('speaking.noPermission') : store.permissionStatus === 'UNSUPPORTED' ? '当前平台不支持录音；仍可学习音标、口型和跟读脚本。' : '点击权限按钮后才会请求麦克风。')
function playDemoAudio(): void { if (!demoAudioUrl.value) return; try { const context = audio.value ?? getUniRuntime().createInnerAudioContext?.(); if (!context) throw new Error('当前平台没有示范音频播放适配器。'); audio.value = context; audio.value.src = demoAudioUrl.value; audio.value.play() } catch { demoAudioMessage.value = '示范音频当前无法播放；已降级为文本脚本和 2D 口型。' } }
async function requestPermission(): Promise<void> { store.setPermissionStatus('REQUESTING'); const next = await requestMicrophonePermission(); store.setPermissionStatus(next); store.setRecordingMessage(next === 'GRANTED' ? '麦克风权限已获得；点击开始录音后才会采集声音。' : next === 'DENIED' ? b11T('speaking.noPermission') : '当前平台没有录音权限适配器；音标和脚本仍可学习。') }
function startRecording(): void {
  if (isRecording.value) return
  if (store.permissionStatus !== 'GRANTED') { void requestPermission(); return }
  const manager = recorderManager()
  if (!manager) { store.setRecordingMessage('当前平台没有录音管理器；未伪造录音成功。'); return }
  manager.onStart(() => { isRecording.value = true; store.setRecordingMessage('正在录音；停止后会计算 SHA-256 并只保留安全本地引用。') })
  manager.onStop((result) => { isRecording.value = false; localDuration.value = result.duration ?? 0; localPath.value = result.tempFilePath ?? null; if (!localPath.value) { store.setRecordingMessage('平台未返回本地媒体引用，未登记录音。'); return }; void sealLocalRecording(localPath.value) })
  manager.onError(() => { isRecording.value = false; store.setRecordingMessage('录音失败，未生成任何服务端评测结果。') })
  manager.start({ duration: 60000 })
}
function stopRecording(): void { recorderManager()?.stop() }
async function sealLocalRecording(path: string): Promise<void> { if (localDuration.value < 300) { store.setRecordingMessage('录音少于 300ms，已保留临时文件但不会登记。'); return }; try { const protectedFile = await protectRecording(path); const draft = { sourceSegmentId: sourceSegmentId.value, durationMs: localDuration.value, contentHash: protectedFile.contentHash, storageMode: protectedFile.storageMode, localEncryptedPath: protectedFile.localPath, status: 'LOCAL_ONLY' as const, clientEventId: createB11ClientEventId(`recording-${sourceSegmentId.value}`), contentVersion: store.listening?.contentVersion ?? store.reading?.contentVersion ?? 'unknown', createdAt: new Date().toISOString() }; store.setRecordingDraft(draft); store.setRecordingMessage(b11T('speaking.localOnly')) } catch (error) { store.setRecordingMessage(error instanceof Error ? error.message : '录音完整性校验失败，未登记。') } }
async function playLocal(): Promise<void> { const draft = store.recordingDraft; if (!draft?.localEncryptedPath) { store.setRecordingMessage('暂无已保护录音可回放。'); return }; try { const playbackSource = await createRecordingPlaybackSource(draft.localEncryptedPath, draft.storageMode); audio.value?.destroy(); const context = getUniRuntime().createInnerAudioContext?.(); if (!context) throw new Error('当前平台没有安全回放适配器。'); audio.value = context; audio.value.src = playbackSource; audio.value.play() } catch (error) { store.setRecordingMessage(error instanceof Error ? error.message : '本地回放失败。') } }
async function retake(): Promise<void> { const draft = store.recordingDraft; if (draft?.localEncryptedPath) await deleteProtectedRecording(draft.localEncryptedPath, draft.storageMode); localPath.value = null; localDuration.value = 0; store.clearRecordingDraft(); store.setRecordingMessage('已清理当前本地录音，可重新录制。') }
async function register(): Promise<void> { if (!store.recordingDraft) { store.setRecordingMessage('请先完成真实录音；不会提交空文件。'); return }; await store.registerRecordingDraft() }
function rate(value: B11SelfRating): void { void store.saveSelfRating(value) }
function completeShadowing(): void { void store.completeShadowing(sourceSegmentId.value) }
onMounted(() => { void load() })
onUnmounted(() => { audio.value?.destroy() })
</script>

<template>
  <view class="yx-page b11-page" :class="themeClass">
    <text class="yx-eyebrow">{{ b11T('speaking.eyebrow') }}</text>
    <text class="yx-title">{{ b11T('speaking.title') }}</text>
    <text class="yx-description">{{ b11T('speaking.description') }}</text>
    <B11StatusPanel :status="store.phoneticsStatus === 'error' || store.recordingStatus === 'error' ? 'error' : store.recordingStatus === 'offline' ? 'offline' : store.phoneticsStatus" :message="store.recordingMessage ?? store.phoneticsMessage" :queue-count="store.queueCount" :performance-level="store.performanceLevel" :motion-disabled="store.motionDisabled" @retry="load" @sync="sync" @performance="setPerformance" @motion="setMotion" />

    <view class="yx-card phoneme-card"><view class="card-heading"><view><text class="kicker">EN_48_PHASE1 · 2D fallback</text><text class="subtle">{{ store.phonemes.length }}/48 · {{ b11T('speaking.aiOff') }}</text></view><text class="permission" :class="`permission--${store.permissionStatus.toLowerCase()}`">{{ store.permissionStatus }}</text></view><view class="phoneme-grid"><button v-for="phoneme in store.phonemes" :key="phoneme.phonemeId" class="phoneme" :class="{ active: selectedPhoneme?.phonemeId === phoneme.phonemeId }" type="button" @click="selectedPhoneme = phoneme"><text class="symbol">{{ phoneme.symbol }}</text><text>{{ phoneme.exampleWord }}</text><text class="subtle">{{ phoneme.group }}</text></button></view></view>

    <view class="yx-card demo-audio" role="status" aria-live="polite"><text class="kicker">DEMO AUDIO</text><button v-if="demoAudioUrl" class="small-button" type="button" @click="playDemoAudio">播放示范音频</button><text>{{ demoAudioMessage }}</text></view>

    <view class="yx-card recorder-card"><text class="kicker">录音与影子跟读</text><view class="mouth"><text>{{ selectedPhoneme?.symbol ?? '选择音标' }} · 2D mouth fallback</text><text>下颌 {{ selectedPhoneme?.mouthProfile.jawOpen ?? 0 }} · 舌高 {{ selectedPhoneme?.mouthProfile.tongueHeight ?? 0 }} · 唇圆 {{ selectedPhoneme?.mouthProfile.lipRound ?? 0 }}</text><text>{{ selectedPhoneme?.mouthProfile.voicing ? '声带振动' : '清音' }}</text></view><text class="subtle">{{ recordingCopy }}</text><view class="actions"><button class="small-button" type="button" @click="requestPermission">{{ b11T('speaking.permission') }}</button><button class="small-button" type="button" :disabled="store.permissionStatus !== 'GRANTED'" @click="isRecording ? stopRecording() : startRecording()">{{ isRecording ? b11T('speaking.stop') : b11T('speaking.start') }}</button><button class="small-button" type="button" :disabled="!store.recordingDraft || isRecording" @click="playLocal">{{ b11T('speaking.playback') }}</button><button class="small-button" type="button" :disabled="isRecording" @click="retake">{{ b11T('speaking.retake') }}</button><button class="yx-button" type="button" :disabled="!store.recordingDraft || isRecording" @click="register">{{ b11T('speaking.save') }}</button></view><text v-if="store.recordingDraft" class="subtle">SHA-256：{{ store.recordingDraft.contentHash }} · {{ store.recordingDraft.status }} · 服务端只接收哈希/时长/版本元数据。</text><view class="rating-list"><text class="kicker">{{ b11T('speaking.rating') }}</text><button v-for="item in ratingOptions" :key="item.value" class="small-button" type="button" :disabled="!store.recordingDraft" @click="rate(item.value)">{{ item.label }}</button></view><button class="yx-button yx-button--secondary" type="button" :disabled="!store.recordingDraft?.recordingId" @click="completeShadowing">完成影子跟读</button></view>
    <view v-if="store.recordingDraft" class="yx-card recovery-card"><text class="kicker">RECOVERY</text><text class="subtle">{{ store.recordingDraft.status === 'LOCAL_ONLY' || store.recordingDraft.status === 'FAILED' ? '服务端未确认；本地安全副本仍保留，联网后可恢复。' : '服务端已登记元数据；删除前仍需服务端确认。' }}</text><button v-if="store.savedRecording" class="small-button danger" type="button" @click="store.removeSavedRecording">删除服务端登记</button></view>
  </view>
</template>

<style scoped lang="scss">
.b11-page{padding-bottom:64rpx}.phoneme-card,.recorder-card,.recovery-card,.demo-audio,.mouth,.rating-list{display:grid;gap:18rpx}.card-heading{display:flex;justify-content:space-between;gap:16rpx}.card-heading>view{display:grid;gap:6rpx}.kicker{color:var(--yx-brand);font-size:23rpx;font-weight:800;letter-spacing:1rpx}.subtle{color:var(--yx-text-secondary);font-size:22rpx;line-height:1.55}.permission{font-size:21rpx;font-weight:800}.permission--granted{color:var(--yx-success-strong)}.permission--denied{color:var(--yx-danger)}.phoneme-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10rpx}.phoneme{min-width:0;display:grid;gap:5rpx;padding:15rpx 8rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-text-primary);background:var(--yx-surface-card);font-size:20rpx;overflow-wrap:anywhere}.phoneme.active{border-color:var(--yx-brand);background:var(--yx-brand-soft)}.symbol{font-size:32rpx;font-weight:800}.demo-audio{padding:18rpx;border:1rpx solid var(--yx-border);border-radius:14rpx;background:var(--yx-surface-soft)}.demo-audio audio{width:100%}.demo-audio text:last-child{color:var(--yx-text-secondary);font-size:22rpx;line-height:1.55}.mouth{place-items:center;min-height:180rpx;padding:20rpx;border-radius:18rpx;color:var(--yx-brand);background:var(--yx-surface-soft);font-size:24rpx;text-align:center}.actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10rpx}.actions .yx-button{grid-column:1/-1}.small-button{min-height:64rpx;padding:0 18rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx;line-height:64rpx}.small-button:disabled,.yx-button:disabled{opacity:.45}.rating-list{grid-template-columns:repeat(2,minmax(0,1fr))}.rating-list .kicker{grid-column:1/-1}.danger{color:var(--yx-danger)}
</style>
