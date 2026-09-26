import { experiencePerformance } from '../platform/experience-ui'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { type PerformanceLevel } from '@englishflow/performance'
import { getMediaManifest, isB11ExpiredError, isB11OfflineError, isB11PermissionError, isB11RevokedError, issueMediaSignedUrl, progressChange, pullB11OfflineChanges, pushB11OfflineChanges, saveB11RecordingMetadata } from '../api/b11'
import type { B11ListeningProgress, B11MediaManifest, B11OfflineChange, B11RecordingMetadata, B11SignedUrl, B11Status, B11SyncResult } from '../domain/b11'

export const useB11Store = defineStore('b11', () => {
  const engine = experiencePerformance
  const status = ref<B11Status>('idle')
  const message = ref('')
  const manifest = ref<B11MediaManifest | null>(null)
  const signedUrl = ref<B11SignedUrl | null>(null)
  const progress = ref<B11ListeningProgress | null>(null)
  const recording = ref<B11RecordingMetadata | null>(null)
  const pending = ref<B11OfflineChange[]>([])
  const cursor = ref('0')
  const performanceLevel = ref<PerformanceLevel>(engine.level)
  const motionDisabled = ref(engine.state.motionDisabled)
  const lastSync = ref<B11SyncResult | null>(null)
  const unsubscribe = engine.subscribe((state) => { performanceLevel.value = state.level; motionDisabled.value = state.motionDisabled })

  const hasPending = computed(() => pending.value.length > 0)
  const renderPolicy = computed(() => engine.getMediaPolicy('waveform'))

  async function loadMedia(assetId: string): Promise<void> {
    signedUrl.value = null
    manifest.value = null
    status.value = 'loading'; message.value = ''
    try { manifest.value = await getMediaManifest(assetId); status.value = manifest.value.renditions.some((item) => item.status === 'READY') ? 'ready' : 'empty' }
    catch (error) { status.value = isB11PermissionError(error) ? 'permission' : isB11RevokedError(error) ? 'revoked' : isB11ExpiredError(error) ? 'expired' : isB11OfflineError(error) ? 'offline' : 'error'; message.value = error instanceof Error ? error.message : '媒体 manifest 暂时不可用。' }
  }

  async function authorizePlayback(): Promise<void> {
    signedUrl.value = null
    if (!manifest.value) return
    const rendition = manifest.value.renditions.find((item) => item.status === 'READY')
    if (!rendition) { message.value = '当前版本没有可播放 rendition，已降级为时间轴和文本练习。'; return }
    try { signedUrl.value = await issueMediaSignedUrl(manifest.value.assetId, rendition.renditionId, manifest.value.contentVersionId) }
    catch (error) { status.value = isB11RevokedError(error) ? 'revoked' : isB11ExpiredError(error) ? 'expired' : isB11OfflineError(error) ? 'offline' : 'error'; message.value = error instanceof Error ? error.message : '播放授权失败。' }
  }


  function queueProgress(next: B11ListeningProgress, payloadHash: string): void {
    progress.value = next
    const sequence = pending.value.length + 1
    const change = progressChange(next, sequence, payloadHash)
    if (!pending.value.some((item) => item.clientEventId === change.clientEventId)) pending.value.push(change)
    status.value = 'offline'; message.value = '进度已安全排队，服务端确认前不会标记为已同步。'
  }

  async function sync(): Promise<void> {
    if (!pending.value.length) { message.value = '没有待同步变更。'; return }
    status.value = 'recovering'
    try { lastSync.value = await pushB11OfflineChanges(pending.value, cursor.value); const accepted = new Set(lastSync.value.acceptedClientEventIds); pending.value = pending.value.filter((item) => !accepted.has(item.clientEventId)); cursor.value = lastSync.value.nextCursor; status.value = lastSync.value.conflicts.length ? 'recovering' : 'ready'; message.value = lastSync.value.conflicts.length ? `已同步 ${accepted.size} 项，仍有 ${lastSync.value.conflicts.length} 项需要冲突恢复。` : `已同步 ${accepted.size} 项离线变更。` }
    catch (error) { status.value = isB11OfflineError(error) ? 'offline' : 'error'; message.value = error instanceof Error ? error.message : '同步失败，待同步变更仍保留。' }
  }

  async function pull(cursorValue = cursor.value): Promise<void> { try { const result = await pullB11OfflineChanges(cursorValue); cursor.value = result.nextCursor } catch (error) { status.value = isB11OfflineError(error) ? 'offline' : 'error'; message.value = error instanceof Error ? error.message : '增量同步读取失败。' } }
  async function saveRecording(metadata: Omit<B11RecordingMetadata, 'status' | 'aiScoringEnabled'>): Promise<void> { try { recording.value = await saveB11RecordingMetadata(metadata); message.value = '录音元数据已保存；Phase 1 不执行 AI 评分。' } catch (error) { status.value = isB11OfflineError(error) ? 'offline' : 'error'; message.value = error instanceof Error ? error.message : '录音元数据保存失败，本地加密副本仍保留。' } }
  function setPerformance(level: PerformanceLevel): void { engine.setLevel(level, 'manual'); performanceLevel.value = level }
  function setMotionDisabled(value: boolean): void { engine.setMotionDisabled(value, 'manual'); motionDisabled.value = value }
  function dispose(): void { unsubscribe(); /* Shared engine lives for the application lifetime. */ }

  return { status, message, manifest, signedUrl, progress, recording, pending, cursor, performanceLevel, motionDisabled, lastSync, hasPending, renderPolicy, loadMedia, authorizePlayback, queueProgress, sync, pull, saveRecording, setPerformance, setMotionDisabled, dispose }
})
