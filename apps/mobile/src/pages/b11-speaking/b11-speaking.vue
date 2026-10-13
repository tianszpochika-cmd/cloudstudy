<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import AppIcon from '../../components/AppIcon.vue'
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
  <view class="yx-page b11-page v2-b11speak-page" :class="themeClass" :style="experienceStyle" :data-motion="store.motionDisabled || store.performanceLevel === 'Performance' ? 'off' : experienceMotion">
    <MobilePageHeader page="b11-speaking" />
    <view class="v2-b11speak-body">
    <view class="yx-card card v2-b11speak-card" data-closed-practice role="status"><view class="eyebrow v2-b11speak-eyebrow"><AppIcon name="lock" :size="14" /><text>口语</text></view><text class="v2-b11speak-title v2-b11speak-h2">跟读功能暂未开放，可以先做其他练习。</text><button type="button" class="btn v2-b11speak-btn" data-closed-back @click="getUniRuntime().navigateTo({ url: '/pages/today/today' })"><AppIcon name="back" :size="14" />回到可用学习</button></view>

    <B11StatusPanel class="v2-b11speak-status" :status="store.phoneticsStatus === 'error' || store.recordingStatus === 'error' ? 'error' : store.recordingStatus === 'offline' ? 'offline' : store.phoneticsStatus" :message="store.recordingMessage ?? store.phoneticsMessage" :queue-count="store.queueCount" :performance-level="store.performanceLevel" :motion-disabled="store.motionDisabled" @retry="load" @sync="sync" @performance="setPerformance" @motion="setMotion" />

    <view v-if="hasPracticeContent" class="yx-card phoneme-card card v2-b11speak-card"><view class="card-heading v2-b11speak-heading"><view class="v2-b11speak-titlewrap"><view class="eyebrow v2-b11speak-eyebrow"><AppIcon name="type" :size="14" /><text class="kicker eyebrow v2-b11speak-eyebrow">英语音标 · 发音图解</text></view><text class="v2-b11speak-title v2-b11speak-h2">英语音标 · 发音图解</text><text class="subtle d v2-b11speak-d">{{ store.phonemes.length }}/48 · {{ b11T('speaking.aiOff') }}</text></view><text class="permission v2-b11speak-meta" :class="`permission--${store.permissionStatus.toLowerCase()}`">{{ permissionLabels[store.permissionStatus] }}</text></view><view class="phoneme-grid v2-b11speak-list"><button tabindex="0" role="button" v-for="phoneme in store.phonemes" :key="phoneme.phonemeId" class="phoneme opt v2-b11speak-opt v2-b11speak-row" :class="{ active: selectedPhoneme?.phonemeId === phoneme.phonemeId }" type="button" @click="selectedPhoneme = phoneme"><text class="symbol v2-b11speak-stem">{{ phoneme.symbol }}</text><text class="d v2-b11speak-d">{{ phoneme.exampleWord }}</text><text class="subtle d v2-b11speak-d">{{ phoneme.group }}</text></button></view></view>

    <view v-if="demoAudioUrl || hasPracticeContent" class="yx-card demo-audio card v2-b11speak-card" role="status" aria-live="polite"><view class="eyebrow v2-b11speak-eyebrow"><AppIcon name="activity" :size="14" /><text class="kicker eyebrow v2-b11speak-eyebrow">示范音频</text></view><text class="v2-b11speak-title v2-b11speak-h2">示范音频</text><button tabindex="0" role="button" v-if="demoAudioUrl" class="small-button btn sm opt v2-b11speak-btn v2-b11speak-opt v2-b11speak-submit" type="button" @click="playDemoAudio"><AppIcon name="activity" :size="14" />播放示范音频</button><text class="d v2-b11speak-d">{{ demoAudioMessage }}</text></view>

    <view v-if="hasPracticeContent || store.recordingDraft" class="yx-card recorder-card card v2-b11speak-card"><view class="eyebrow v2-b11speak-eyebrow"><AppIcon name="target" :size="14" /><text class="kicker eyebrow v2-b11speak-eyebrow">录音与影子跟读</text></view><text class="v2-b11speak-title v2-b11speak-h2">录音与影子跟读</text><view v-if="selectedPhoneme" class="mouth"><text>{{ selectedPhoneme?.symbol ?? '选择音标' }} · 发音口型图解</text><text>{{ selectedPhoneme?.mouthProfile.voicing ? '留意声带振动' : '留意清音发声' }}</text></view><text class="subtle d v2-b11speak-d">{{ recordingCopy }}</text><view class="actions v2-b11speak-controls v2-b11speak-row"><button tabindex="0" role="button" class="small-button btn sm opt v2-b11speak-btn v2-b11speak-opt v2-b11speak-tool" type="button" :disabled="!sourceSegmentId" @click="requestPermission"><AppIcon name="key" :size="14" />{{ b11T('speaking.permission') }}</button><button tabindex="0" role="button" class="small-button btn sm opt v2-b11speak-btn v2-b11speak-opt v2-b11speak-tool" type="button" :disabled="store.permissionStatus !== 'GRANTED' || !selectedPhoneme || !sourceSegmentId" @click="isRecording ? stopRecording() : startRecording()"><AppIcon name="activity" :size="14" />{{ isRecording ? b11T('speaking.stop') : b11T('speaking.start') }}</button><button tabindex="0" role="button" class="small-button btn sm opt v2-b11speak-btn v2-b11speak-opt v2-b11speak-tool" type="button" :disabled="!store.recordingDraft || isRecording" @click="playLocal"><AppIcon name="check" :size="14" />{{ b11T('speaking.playback') }}</button><button tabindex="0" role="button" class="small-button btn sm opt v2-b11speak-btn v2-b11speak-opt v2-b11speak-tool" type="button" :disabled="isRecording" @click="retake"><AppIcon name="refresh" :size="14" />{{ b11T('speaking.retake') }}</button><button tabindex="0" role="button" class="yx-button btn opt v2-b11speak-btn v2-b11speak-opt v2-b11speak-submit" type="button" :disabled="!store.recordingDraft || isRecording" @click="register"><AppIcon name="check" :size="14" />{{ b11T('speaking.save') }}</button></view><text v-if="store.recordingDraft" class="subtle d v2-b11speak-d">{{ store.recordingDraft.status === 'SAVED' ? '练习记录已保存，录音留在此设备。' : '录音已保存在此设备，尚未登记练习记录。' }}</text><view class="rating-list v2-b11speak-list"><view class="eyebrow v2-b11speak-eyebrow"><AppIcon name="star" :size="14" /><text class="kicker eyebrow v2-b11speak-eyebrow">{{ b11T('speaking.rating') }}</text></view><button tabindex="0" role="button" v-for="item in ratingOptions" :key="item.value" class="small-button btn sm opt v2-b11speak-btn v2-b11speak-opt" type="button" :disabled="!store.recordingDraft" @click="rate(item.value)">{{ item.label }}</button></view><button tabindex="0" role="button" class="yx-button yx-button--secondary btn opt v2-b11speak-btn v2-b11speak-opt v2-b11speak-submit" type="button" :disabled="!store.recordingDraft?.recordingId" @click="completeShadowing"><AppIcon name="check" :size="14" />完成影子跟读</button></view>
    <view v-if="store.recordingDraft" class="yx-card recovery-card card v2-b11speak-card"><view class="eyebrow v2-b11speak-eyebrow"><AppIcon name="shield" :size="14" /><text class="kicker eyebrow v2-b11speak-eyebrow">录音状态</text></view><text class="v2-b11speak-title v2-b11speak-h2">录音状态</text><text class="subtle d v2-b11speak-d">{{ store.recordingDraft.status === 'LOCAL_ONLY' || store.recordingDraft.status === 'FAILED' ? '练习记录尚未保存，录音留在此设备。' : '练习记录已保存，录音留在此设备。' }}</text><button tabindex="0" role="button" v-if="store.savedRecording" class="small-button danger btn sm opt v2-b11speak-btn v2-b11speak-opt" type="button" @click="store.removeSavedRecording"><AppIcon name="x" :size="14" />删除录音记录</button></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.b11-page{padding-bottom:64rpx}.phoneme-card,.recorder-card,.recovery-card,.demo-audio,.mouth,.rating-list{display:grid;gap:18rpx}.card-heading{display:flex;justify-content:space-between;gap:16rpx}.card-heading>view{display:grid;gap:6rpx}.kicker{color:var(--yx-brand);font-size:23rpx;font-weight:800;letter-spacing:1rpx}.subtle{color:var(--yx-text-secondary);font-size:22rpx;line-height:1.55}.permission{font-size:21rpx;font-weight:800}.permission--granted{color:var(--yx-success-strong)}.permission--denied{color:var(--yx-danger)}.phoneme-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10rpx}.phoneme{min-width:0;display:grid;gap:5rpx;padding:15rpx 8rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-text-primary);background:var(--yx-surface-card);font-size:20rpx;overflow-wrap:anywhere}.phoneme.active{border-color:var(--yx-brand);background:var(--yx-brand-soft)}.symbol{font-size:32rpx;font-weight:800}.demo-audio{padding:18rpx;border:1rpx solid var(--yx-border);border-radius:14rpx;background:var(--yx-surface-soft)}.demo-audio audio{width:100%}.demo-audio text:last-child{color:var(--yx-text-secondary);font-size:22rpx;line-height:1.55}.mouth{place-items:center;min-height:180rpx;padding:20rpx;border-radius:18rpx;color:var(--yx-brand);background:var(--yx-surface-soft);font-size:24rpx;text-align:center}.actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10rpx}.actions .yx-button{grid-column:1/-1}.small-button{min-height:64rpx;padding:0 18rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx;line-height:64rpx}.small-button:disabled,.yx-button:disabled{opacity:.45}.rating-list{grid-template-columns:repeat(2,minmax(0,1fr))}.rating-list .kicker{grid-column:1/-1}.danger{color:var(--yx-danger)}
/* v2 口语页换皮：对齐 practice.vue 与 today.vue 中 v2-* 卡片/eyebrow/标题/列表行/按钮同样数值，仅用 var(--v2-*)。 */
.v2-b11speak-page{min-width:0;max-width:100%;overflow-wrap:anywhere}
.v2-b11speak-body{display:flex;flex-direction:column;gap:var(--v2-space-4);font-family:var(--v2-font);min-width:0;max-width:100%}
.v2-b11speak-status{min-width:0;max-width:100%;overflow-wrap:anywhere}
.v2-b11speak-card{display:grid;gap:var(--v2-space-2);padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font);box-sizing:border-box;min-width:0;max-width:100%;overflow-wrap:anywhere}
.v2-b11speak-card:hover{border-color:var(--v2-brand)}
.v2-b11speak-eyebrow{display:flex;align-items:center;gap:var(--v2-space-2);margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase;min-width:0;max-width:100%;overflow-wrap:anywhere}
.v2-b11speak-title{display:block;margin:var(--v2-space-1) 0 0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;min-width:0;max-width:100%;overflow-wrap:anywhere;white-space:normal}
.v2-b11speak-h2{display:block;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;min-width:0;max-width:100%;overflow-wrap:anywhere;white-space:normal}
.v2-b11speak-heading{display:flex;align-items:center;justify-content:space-between;gap:var(--v2-space-2);margin:var(--v2-space-1) 0 var(--v2-space-2);flex-wrap:wrap;min-width:0;max-width:100%}
.v2-b11speak-heading>*{min-width:0;max-width:100%}
.v2-b11speak-titlewrap{display:grid;gap:var(--v2-space-1);flex:1 1 auto;min-width:0;max-width:100%;overflow-wrap:anywhere}
.v2-b11speak-d{display:block;margin-top:var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;min-width:0;max-width:100%;overflow-wrap:anywhere;white-space:normal}
.v2-b11speak-meta{display:block;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;flex:none;min-width:0;max-width:100%;overflow-wrap:anywhere}
.v2-b11speak-list{display:grid;gap:var(--v2-space-4);min-width:0;max-width:100%}
.v2-b11speak-row{display:flex;align-items:center;justify-content:space-between;gap:var(--v2-space-2);padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);font-family:var(--v2-font);box-sizing:border-box;flex-wrap:wrap;min-width:0;max-width:100%;overflow-wrap:anywhere}
.v2-b11speak-row:hover{border-color:var(--v2-brand)}
.v2-b11speak-row>*{min-width:0;max-width:100%}
.v2-b11speak-stem{display:block;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;min-width:0;max-width:100%;overflow-wrap:anywhere}
.v2-b11speak-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--v2-space-2);min-width:0;max-width:100%}
.v2-b11speak-btn{box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:var(--v2-space-2);width:100%;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;min-width:0;max-width:100%}
.v2-b11speak-btn:hover{border-color:var(--v2-brand)}
.v2-b11speak-btn:active{transform:scale(.97)}
.v2-b11speak-btn:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-b11speak-btn:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-b11speak-opt{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;min-width:0;max-width:100%}
.v2-b11speak-opt:hover{border-color:var(--v2-brand)}
.v2-b11speak-opt.sel{border-color:var(--v2-brand);background:var(--v2-soft)}
.v2-b11speak-opt:active{transform:scale(.97)}
.v2-b11speak-opt:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-b11speak-opt:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-b11speak-opt.v2-b11speak-row{flex-direction:column;white-space:normal;text-align:center;overflow-wrap:anywhere}
.v2-b11speak-tool{background:var(--v2-soft);color:var(--v2-brand)}
.v2-b11speak-submit{border-color:transparent;background:var(--v2-brand);color:var(--v2-inverse);font-family:var(--v2-font);font-weight:700}
.v2-b11speak-submit:hover{border-color:var(--v2-brand)}
@media(max-width:360px){.v2-b11speak-controls{grid-template-columns:minmax(0,1fr)}}
</style>
