<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { PerformanceLevel } from '@englishflow/performance'
import B11StatusPanel from '../../components/b11/B11StatusPanel.vue'
import { authorizeB11Playback, loadB11ListeningMaterials } from '../../api/b11'
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
const demoAudioMessage = ref('正在检查示范音频…')
const practiceSegment = ref<{ id: string; contentVersion: string | number } | null>(null)
const ratingOptions: Array<{ value: B11SelfRating; label: string }> = [{ value: 'NEEDS_PRACTICE', label: '需要练习' }, { value: 'BASIC', label: '基本准确' }, { value: 'FLUENT', label: '比较流利' }, { value: 'UNCERTAIN', label: '不确定' }]
const hasPracticeContent = computed(() => store.phonemes.length > 0)
const permissionLabels: Record<B11PermissionStatus, string> = { UNKNOWN: '未申请', REQUESTING: '申请中', GRANTED: '已允许', DENIED: '已拒绝', UNSUPPORTED: '不可用' }
const sourceSegmentId = computed(() => practiceSegment.value?.id ?? null)
type AccountScope = { subject: string; revision: number }
function accountScope(): AccountScope | null {
  return session.isAuthenticated && session.verifiedSubject
    ? { subject: session.verifiedSubject, revision: session.identityRevision } : null
}
function isCurrent(scope: AccountScope | null): scope is AccountScope {
  return Boolean(scope && session.isAuthenticated && session.verifiedSubject === scope.subject && session.identityRevision === scope.revision)
}
function clearPage(): void {
  if (isRecording.value) recorderManager()?.stop()
  isRecording.value = false
  audio.value?.destroy(); audio.value = null
  selectedPhoneme.value = null; localDuration.value = 0; localPath.value = null
  demoAudioUrl.value = null; demoAudioMessage.value = '正在检查示范音频…'; practiceSegment.value = null
}
watch(() => session.identityRevision, clearPage, { flush: 'sync' })

async function load(): Promise<void> { await session.restore(); const scope = accountScope(); if (!isCurrent(scope)) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return }; await Promise.all([store.loadPhonetics(), loadDemoAudio(scope)]); if (!isCurrent(scope)) return; selectedPhoneme.value = store.phonemes[0] ?? null; const draft = store.recordingDraft; localPath.value = draft?.localEncryptedPath ?? null; localDuration.value = draft?.durationMs ?? 0 }
async function loadDemoAudio(scope: AccountScope): Promise<void> {
  practiceSegment.value = null
  demoAudioUrl.value = null
  try {
    const material = (await loadB11ListeningMaterials({ uiLocale: b11UiLocale.value, contentLocale: b11ContentLocale.value }))[0]
    if (!isCurrent(scope)) return
    const media = material?.mediaRef
    const segmentId = material?.segments[0]?.segmentId
    if (material?.rightsStatus === 'AUTHORIZED' && media?.rightsStatus === 'AUTHORIZED' && media.assetId && segmentId && material.contentVersionId != null) {
      const manifest = await authorizeB11Playback(media.assetId, media.variant || 'default', { uiLocale: b11UiLocale.value, contentLocale: b11ContentLocale.value }, createB11ClientEventId(`demo-${media.assetId}`), material.contentVersionId)
      if (!isCurrent(scope)) return
      const signedUrl = manifest?.rightsStatus === 'AUTHORIZED' && manifest.availability === 'READY' ? manifest.variants.find((variant) => variant.signedUrl)?.signedUrl : null
      if (signedUrl) {
        demoAudioUrl.value = signedUrl
        practiceSegment.value = { id: segmentId, contentVersion: material.contentVersionId }
        demoAudioMessage.value = '示范音频已可播放。'
        return
      }
    }
    demoAudioMessage.value = media?.rightsStatus === 'REVOKED' ? '示范音频已下线。' : '暂无可用的跟读片段。'
  } catch { if (isCurrent(scope)) demoAudioMessage.value = '示范音频暂时无法加载。' }
}
function setPerformance(level: PerformanceLevel): void { store.setPerformance(level) }
function setMotion(disabled: boolean): void { store.setMotionDisabled(disabled) }
function sync(): void { void store.syncOffline() }
const recordingCopy = computed(() => isRecording.value ? '正在录音…' : localPath.value ? `已录制 ${(localDuration.value / 1000).toFixed(1)} 秒` : !sourceSegmentId.value ? '暂无可练习的跟读片段。' : store.permissionStatus === 'REQUESTING' ? '正在请求麦克风权限…' : store.permissionStatus === 'DENIED' ? b11T('speaking.noPermission') : store.permissionStatus === 'UNSUPPORTED' ? '当前设备暂不支持录音。' : '允许麦克风后即可录音。')
function playDemoAudio(): void { if (!accountScope() || !demoAudioUrl.value) return; try { const context = audio.value ?? getUniRuntime().createInnerAudioContext?.(); if (!context) throw new Error('当前平台没有示范音频播放适配器。'); audio.value = context; audio.value.src = demoAudioUrl.value; audio.value.play() } catch { demoAudioMessage.value = '示范音频当前无法播放；已降级为文本脚本和 2D 口型。' } }
async function requestPermission(): Promise<void> { const scope = accountScope(); if (!isCurrent(scope)) return; store.setPermissionStatus('REQUESTING'); const next = await requestMicrophonePermission(); if (!isCurrent(scope)) return; store.setPermissionStatus(next); store.setRecordingMessage(next === 'GRANTED' ? '麦克风权限已获得；点击开始录音后才会采集声音。' : next === 'DENIED' ? b11T('speaking.noPermission') : '当前平台没有录音权限适配器；音标和脚本仍可学习。') }
function startRecording(): void {
  const scope = accountScope()
  if (!isCurrent(scope) || isRecording.value) return
  if (!selectedPhoneme.value || !sourceSegmentId.value) { store.setRecordingMessage('暂无可练习的跟读片段。'); return }
  if (store.permissionStatus !== 'GRANTED') { void requestPermission(); return }
  const manager = recorderManager()
  if (!manager) { store.setRecordingMessage('当前设备暂不支持录音。'); return }
  manager.onStart(() => { if (!isCurrent(scope)) return; isRecording.value = true; store.setRecordingMessage('正在录音…') })
  manager.onStop((result) => { if (!isCurrent(scope)) return; isRecording.value = false; localDuration.value = result.duration ?? 0; localPath.value = result.tempFilePath ?? null; if (!localPath.value) { store.setRecordingMessage('录音没有保存，请重试。'); return }; void sealLocalRecording(localPath.value, scope) })
  manager.onError(() => { if (!isCurrent(scope)) return; isRecording.value = false; store.setRecordingMessage('录音失败，请重试。') })
  manager.start({ duration: 60000 })
}
function stopRecording(): void { recorderManager()?.stop() }
async function sealLocalRecording(path: string, scope: AccountScope): Promise<void> { if (!isCurrent(scope)) return; const durationMs = localDuration.value; if (durationMs < 300) { store.setRecordingMessage('录音太短，请重试。'); return }; const source = practiceSegment.value; if (!source) { store.setRecordingMessage('跟读片段已失效，请重新加载。'); return }; try { const protectedFile = await protectRecording(path); if (!isCurrent(scope)) { await deleteProtectedRecording(protectedFile.localPath, protectedFile.storageMode); return }; const draft = { sourceSegmentId: source.id, durationMs, contentHash: protectedFile.contentHash, storageMode: protectedFile.storageMode, localEncryptedPath: protectedFile.localPath, status: 'LOCAL_ONLY' as const, clientEventId: createB11ClientEventId(`recording-${source.id}`), contentVersion: source.contentVersion, createdAt: new Date().toISOString() }; store.setRecordingDraft(draft); store.setRecordingMessage(b11T('speaking.localOnly')) } catch (error) { if (isCurrent(scope)) store.setRecordingMessage(error instanceof Error ? error.message : '录音保存失败，请重试。') } }
async function playLocal(): Promise<void> { const scope = accountScope(); if (!isCurrent(scope)) return; const draft = store.recordingDraft; if (!draft?.localEncryptedPath) { store.setRecordingMessage('暂无已保护录音可回放。'); return }; try { const playbackSource = await createRecordingPlaybackSource(draft.localEncryptedPath, draft.storageMode); if (!isCurrent(scope) || store.recordingDraft !== draft) return; audio.value?.destroy(); const context = getUniRuntime().createInnerAudioContext?.(); if (!context) throw new Error('当前平台没有安全回放适配器。'); audio.value = context; audio.value.src = playbackSource; audio.value.play() } catch (error) { if (isCurrent(scope)) store.setRecordingMessage(error instanceof Error ? error.message : '本地回放失败。') } }
async function retake(): Promise<void> { const scope = accountScope(); if (!isCurrent(scope)) return; const draft = store.recordingDraft; if (draft?.localEncryptedPath) await deleteProtectedRecording(draft.localEncryptedPath, draft.storageMode); if (!isCurrent(scope)) return; localPath.value = null; localDuration.value = 0; store.clearRecordingDraft(); store.setRecordingMessage('已清理当前本地录音，可重新录制。') }
async function register(): Promise<void> { if (!store.recordingDraft) { store.setRecordingMessage('请先录音。'); return }; await store.registerRecordingDraft() }
function rate(value: B11SelfRating): void { void store.saveSelfRating(value) }
function completeShadowing(): void { if (!store.recordingDraft?.sourceSegmentId) return; void store.completeShadowing(store.recordingDraft.sourceSegmentId) }
onMounted(() => { void load() })
onUnmounted(() => { audio.value?.destroy() })
</script>

<template>
  <view class="yx-page b11-page" :class="themeClass" :style="experienceStyle" :data-motion="store.motionDisabled || store.performanceLevel === 'Performance' ? 'off' : experienceMotion">
    <MobilePageHeader page="b11-speaking" />

    <B11StatusPanel :status="store.phoneticsStatus === 'error' || store.recordingStatus === 'error' ? 'error' : store.recordingStatus === 'offline' ? 'offline' : store.phoneticsStatus" :message="store.recordingMessage ?? store.phoneticsMessage" :queue-count="store.queueCount" :performance-level="store.performanceLevel" :motion-disabled="store.motionDisabled" @retry="load" @sync="sync" @performance="setPerformance" @motion="setMotion" />

    <view v-if="hasPracticeContent" class="yx-card phoneme-card"><view class="card-heading"><view><text class="kicker">英语音标 · 发音图解</text><text class="subtle">{{ store.phonemes.length }}/48 · {{ b11T('speaking.aiOff') }}</text></view><text class="permission" :class="`permission--${store.permissionStatus.toLowerCase()}`">{{ permissionLabels[store.permissionStatus] }}</text></view><view class="phoneme-grid"><button tabindex="0" role="button" v-for="phoneme in store.phonemes" :key="phoneme.phonemeId" class="phoneme" :class="{ active: selectedPhoneme?.phonemeId === phoneme.phonemeId }" type="button" @click="selectedPhoneme = phoneme"><text class="symbol">{{ phoneme.symbol }}</text><text>{{ phoneme.exampleWord }}</text><text class="subtle">{{ phoneme.group }}</text></button></view></view>

    <view v-if="demoAudioUrl || hasPracticeContent" class="yx-card demo-audio" role="status" aria-live="polite"><text class="kicker">示范音频</text><button tabindex="0" role="button" v-if="demoAudioUrl" class="small-button" type="button" @click="playDemoAudio">播放示范音频</button><text>{{ demoAudioMessage }}</text></view>

    <view v-if="hasPracticeContent || store.recordingDraft" class="yx-card recorder-card"><text class="kicker">录音与影子跟读</text><view v-if="selectedPhoneme" class="mouth"><text>{{ selectedPhoneme?.symbol ?? '选择音标' }} · 发音口型图解</text><text>{{ selectedPhoneme?.mouthProfile.voicing ? '留意声带振动' : '留意清音发声' }}</text></view><text class="subtle">{{ recordingCopy }}</text><view class="actions"><button tabindex="0" role="button" class="small-button" type="button" :disabled="!sourceSegmentId" @click="requestPermission">{{ b11T('speaking.permission') }}</button><button tabindex="0" role="button" class="small-button" type="button" :disabled="store.permissionStatus !== 'GRANTED' || !selectedPhoneme || !sourceSegmentId" @click="isRecording ? stopRecording() : startRecording()">{{ isRecording ? b11T('speaking.stop') : b11T('speaking.start') }}</button><button tabindex="0" role="button" class="small-button" type="button" :disabled="!store.recordingDraft || isRecording" @click="playLocal">{{ b11T('speaking.playback') }}</button><button tabindex="0" role="button" class="small-button" type="button" :disabled="isRecording" @click="retake">{{ b11T('speaking.retake') }}</button><button tabindex="0" role="button" class="yx-button" type="button" :disabled="!store.recordingDraft || isRecording" @click="register">{{ b11T('speaking.save') }}</button></view><text v-if="store.recordingDraft" class="subtle">{{ store.recordingDraft.status === 'SAVED' ? '练习记录已保存，录音留在此设备。' : '录音已保存在此设备，尚未登记练习记录。' }}</text><view class="rating-list"><text class="kicker">{{ b11T('speaking.rating') }}</text><button tabindex="0" role="button" v-for="item in ratingOptions" :key="item.value" class="small-button" type="button" :disabled="!store.recordingDraft" @click="rate(item.value)">{{ item.label }}</button></view><button tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" :disabled="!store.recordingDraft?.recordingId" @click="completeShadowing">完成影子跟读</button></view>
    <view v-if="store.recordingDraft" class="yx-card recovery-card"><text class="kicker">录音状态</text><text class="subtle">{{ store.recordingDraft.status === 'LOCAL_ONLY' || store.recordingDraft.status === 'FAILED' ? '练习记录尚未保存，录音留在此设备。' : '练习记录已保存，录音留在此设备。' }}</text><button tabindex="0" role="button" v-if="store.savedRecording" class="small-button danger" type="button" @click="store.removeSavedRecording">删除录音记录</button></view>
  </view>
</template>

<style scoped lang="scss">
.b11-page{padding-bottom:64rpx}.phoneme-card,.recorder-card,.recovery-card,.demo-audio,.mouth,.rating-list{display:grid;gap:18rpx}.card-heading{display:flex;justify-content:space-between;gap:16rpx}.card-heading>view{display:grid;gap:6rpx}.kicker{color:var(--yx-brand);font-size:23rpx;font-weight:800;letter-spacing:1rpx}.subtle{color:var(--yx-text-secondary);font-size:22rpx;line-height:1.55}.permission{font-size:21rpx;font-weight:800}.permission--granted{color:var(--yx-success-strong)}.permission--denied{color:var(--yx-danger)}.phoneme-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10rpx}.phoneme{min-width:0;display:grid;gap:5rpx;padding:15rpx 8rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-text-primary);background:var(--yx-surface-card);font-size:20rpx;overflow-wrap:anywhere}.phoneme.active{border-color:var(--yx-brand);background:var(--yx-brand-soft)}.symbol{font-size:32rpx;font-weight:800}.demo-audio{padding:18rpx;border:1rpx solid var(--yx-border);border-radius:14rpx;background:var(--yx-surface-soft)}.demo-audio audio{width:100%}.demo-audio text:last-child{color:var(--yx-text-secondary);font-size:22rpx;line-height:1.55}.mouth{place-items:center;min-height:180rpx;padding:20rpx;border-radius:18rpx;color:var(--yx-brand);background:var(--yx-surface-soft);font-size:24rpx;text-align:center}.actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10rpx}.actions .yx-button{grid-column:1/-1}.small-button{min-height:64rpx;padding:0 18rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx;line-height:64rpx}.small-button:disabled,.yx-button:disabled{opacity:.45}.rating-list{grid-template-columns:repeat(2,minmax(0,1fr))}.rating-list .kicker{grid-column:1/-1}.danger{color:var(--yx-danger)}
</style>
